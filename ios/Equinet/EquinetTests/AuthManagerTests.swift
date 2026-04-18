//
//  AuthManagerTests.swift
//  EquinetTests
//
//  Tests for AuthManager state machine using a mock keychain.
//  AuthManager now uses Supabase SDK for login/logout.
//  These tests verify state transitions and keychain cleanup.
//

@testable import Equinet
import XCTest

@MainActor
final class AuthManagerTests: XCTestCase {

    private var mockKeychain: MockKeychainHelper!
    private var authManager: AuthManager!

    override func setUp() {
        super.setUp()
        mockKeychain = MockKeychainHelper()
        authManager = AuthManager(keychain: mockKeychain)
    }

    override func tearDown() {
        authManager = nil
        mockKeychain = nil
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
}
