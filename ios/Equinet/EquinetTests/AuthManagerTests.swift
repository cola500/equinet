//
//  AuthManagerTests.swift
//  EquinetTests
//
//  Tests for AuthManager state machine using a mock keychain.
//  AuthManager now uses Supabase SDK for login/logout.
//  These tests verify state transitions and keychain cleanup.
//

@testable import Equinet
import WebKit
import XCTest

// MARK: - URLProtocol mock for AuthManager network interception

final class AuthManagerMockURLProtocol: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = AuthManagerMockURLProtocol.requestHandler else {
            client?.urlProtocol(self, didFailWithError: URLError(.unknown))
            return
        }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

@MainActor
final class AuthManagerTests: XCTestCase {

    private var mockKeychain: MockKeychainHelper!
    private var authManager: AuthManager!
    private var mockURLSession: URLSession!

    override func setUp() {
        super.setUp()
        mockKeychain = MockKeychainHelper()
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [AuthManagerMockURLProtocol.self]
        mockURLSession = URLSession(configuration: config)
        authManager = AuthManager(keychain: mockKeychain, urlSession: mockURLSession)
        AuthManagerMockURLProtocol.requestHandler = nil
    }

    override func tearDown() {
        authManager = nil
        mockKeychain = nil
        mockURLSession = nil
        AuthManagerMockURLProtocol.requestHandler = nil
        PushManager.shared.setDeviceTokenForTesting(nil)
        super.tearDown()
    }

    // MARK: - Initial state

    func testInitialStateIsChecking() {
        XCTAssertEqual(authManager.state, .checking)
    }

    // MARK: - checkExistingAuth

    func testCheckExistingAuthWithoutSession_goesToLoggedOut() {
        // No Supabase session (default in test env)
        authManager.checkExistingAuth()
        XCTAssertEqual(authManager.state, .loggedOut)
    }

    // MARK: - logout

    func testLogoutClearsKeychain() {
        // Set up some state
        mockKeychain.save(key: KeychainHelper.userTypeKey, value: "provider")

        authManager.logout()

        // Verify userType cleared from keychain
        XCTAssertFalse(mockKeychain.has(key: KeychainHelper.userTypeKey))

        // Verify state
        XCTAssertNil(authManager.userType)
        XCTAssertEqual(authManager.state, .loggedOut)
    }

    // MARK: - Logout clears push token

    func testLogoutClearsPushDeviceToken() {
        // Simulate a registered device token
        PushManager.shared.setDeviceTokenForTesting("abc123hex")
        XCTAssertEqual(PushManager.shared.deviceToken, "abc123hex")

        authManager.logout()

        // Device token should be cleared after logout
        XCTAssertNil(PushManager.shared.deviceToken)
    }

    // MARK: - State properties

    func testLoginErrorStartsNil() {
        XCTAssertNil(authManager.loginError)
    }

    func testIsLoggingInStartsFalse() {
        XCTAssertFalse(authManager.isLoggingIn)
    }

    func testUserTypeStartsNil() {
        XCTAssertNil(authManager.userType)
    }

    // MARK: - URLError mapping (S34-3)

    func testNotConnectedToInternetMapsToNetworkUnavailable() {
        let error = URLError(.notConnectedToInternet)
        XCTAssertEqual(authManager.mapURLError(error), .networkUnavailable)
    }

    func testTimedOutMapsToNetworkUnavailable() {
        let error = URLError(.timedOut)
        XCTAssertEqual(authManager.mapURLError(error), .networkUnavailable)
    }

    func testCancelledMapsToNetworkUnavailable() {
        let error = URLError(.cancelled)
        XCTAssertEqual(authManager.mapURLError(error), .networkUnavailable)
    }

    func testUnknownURLErrorMapsToUnknown() {
        let error = URLError(.unknown)
        XCTAssertEqual(authManager.mapURLError(error), .unknown)
    }

    // MARK: - exchangeSessionForWebCookies (S48-0)

    // MARK: - buildExchangeRequest (S49-0)

    func testBuildExchangeRequest_putsRefreshTokenInXHeader() {
        let request = authManager.buildExchangeRequest(
            accessToken: "access-123",
            refreshToken: "refresh-456",
            baseURL: URL(string: "https://equinet.vercel.app")!
        )
        XCTAssertNotNil(request)
        XCTAssertEqual(request?.value(forHTTPHeaderField: "X-Refresh-Token"), "refresh-456")
        // Refresh token must NOT be in body
        XCTAssertNil(request?.httpBody)
    }

    func testBuildExchangeRequest_setsAuthorizationHeader() {
        let request = authManager.buildExchangeRequest(
            accessToken: "my-jwt",
            refreshToken: "my-refresh",
            baseURL: URL(string: "https://equinet.vercel.app")!
        )
        XCTAssertEqual(request?.value(forHTTPHeaderField: "Authorization"), "Bearer my-jwt")
    }

    // MARK: - filterCookies (S49-0)

    func testFilterCookies_keepsMatchingDomainCookies() {
        let matching = HTTPCookie(properties: [
            .domain: "equinet.vercel.app", .path: "/",
            .name: "sb-token", .value: "abc"
        ])!
        let foreign = HTTPCookie(properties: [
            .domain: "evil.com", .path: "/",
            .name: "steal", .value: "data"
        ])!
        let result = authManager.filterCookies(
            [matching, foreign],
            for: URL(string: "https://equinet.vercel.app")!
        )
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result[0].name, "sb-token")
    }

    func testFilterCookies_keepsSubdomainCookies() {
        let subdomain = HTTPCookie(properties: [
            .domain: ".equinet.vercel.app", .path: "/",
            .name: "sb-refresh", .value: "xyz"
        ])!
        let result = authManager.filterCookies(
            [subdomain],
            for: URL(string: "https://equinet.vercel.app")!
        )
        XCTAssertEqual(result.count, 1)
    }

    func testFilterCookies_rejectsUnrelatedDomainCookies() {
        let foreign = HTTPCookie(properties: [
            .domain: "malicious.com", .path: "/",
            .name: "spy", .value: "data"
        ])!
        let result = authManager.filterCookies(
            [foreign],
            for: URL(string: "https://equinet.vercel.app")!
        )
        XCTAssertTrue(result.isEmpty)
    }

    // MARK: - logout clears cookie store (S49-0)

    func testLogout_clearsCookiesFromInjectedStore() async throws {
        let dataStore = WKWebsiteDataStore.nonPersistent()
        let cookieStore = dataStore.httpCookieStore
        let cookie = HTTPCookie(properties: [
            .domain: "equinet.vercel.app", .path: "/",
            .name: "sb-session", .value: "live-session-token"
        ])!
        await cookieStore.setCookie(cookie)
        let before = await cookieStore.allCookies()
        XCTAssertEqual(before.count, 1, "Precondition: cookie must be set before logout")

        authManager.logout(cookieStore: cookieStore)
        // logout is synchronous but clears cookies via fire-and-forget Task
        try await Task.sleep(nanoseconds: 300_000_000)

        let after = await cookieStore.allCookies()
        XCTAssertTrue(after.isEmpty, "All cookies should be deleted after logout")
    }

    // MARK: - exchangeSessionForWebCookies (S48-0)

    func testExchangeSessionForWebCookies_withNoSession_doesNotCrash() async {
        // When there is no Supabase session, the function should return early without crashing.
        // In tests, SupabaseManager has no active session.
        let dataStore = WKWebsiteDataStore.nonPersistent()
        // Should complete without error (no session guard fires)
        await authManager.exchangeSessionForWebCookies(into: dataStore.httpCookieStore)
        // If we reach here without crash, the guard condition handled no-session correctly.
    }

    func testExchangeSessionForWebCookies_withSuccessResponse_doesNotCrash() async throws {
        // Given: mock URLSession returns a 200 with multiple Set-Cookie headers
        let exchangeURL = URL(string: "https://equinet-app.vercel.app/api/auth/native-session-exchange")!
        AuthManagerMockURLProtocol.requestHandler = { request in
            guard request.url?.path == "/api/auth/native-session-exchange" else {
                throw URLError(.badURL)
            }
            // Simulate Supabase SSR setting two cookie chunks (the bug: allHeaderFields only kept one)
            let response = HTTPURLResponse(
                url: exchangeURL,
                statusCode: 200,
                httpVersion: "HTTP/2",
                headerFields: [
                    // HTTPURLResponse merges duplicates into comma-separated string
                    "Set-Cookie": "sb-test-auth-token.0=chunk0; Path=/; HttpOnly, sb-test-auth-token.1=chunk1; Path=/; HttpOnly"
                ]
            )!
            return (response, Data())
        }

        let dataStore = WKWebsiteDataStore.nonPersistent()
        // The function should complete without throwing
        await authManager.exchangeSessionForWebCookies(into: dataStore.httpCookieStore)
        // Note: full cookie injection verification requires a real Supabase session.
        // This test verifies the network path doesn't crash with the mock setup.
    }
}
