//
//  AuthManagerTests.swift
//  EquinetTests
//
//  Tests for AuthManager state machine using a mock keychain.
//  Note: Biometric tests are not possible in simulator without hardware,
//  so we test the non-biometric paths.
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
        super.tearDown()
    }

    // MARK: - Initial state

    func testInitialStateIsChecking() {
        XCTAssertEqual(authManager.state, .checking)
    }

    // MARK: - checkExistingAuth

    func testCheckExistingAuthWithoutToken_goesToLoggedOut() {
        // No token in keychain
        authManager.checkExistingAuth()
        XCTAssertEqual(authManager.state, .loggedOut)
    }

    func testCheckExistingAuthWithTokenButNoSessionCookie_goesToLoggedOut() {
        // Token exists but no session cookie
        mockKeychain.save(key: KeychainHelper.mobileTokenKey, value: "some-jwt")
        // No session cookie saved

        authManager.checkExistingAuth()

        // Without biometric hardware (simulator), goes to loggedOut since no session cookie
        // The exact state depends on LAContext.canEvaluatePolicy which returns false in tests
        // Either way without a session cookie value, should be loggedOut
        XCTAssertEqual(authManager.state, .loggedOut)
    }

    func testCheckExistingAuthWithTokenAndSessionCookie_authenticatesOnSimulator() {
        // Token + session cookie in keychain
        mockKeychain.save(key: KeychainHelper.mobileTokenKey, value: "some-jwt")
        mockKeychain.save(key: KeychainHelper.sessionCookieNameKey, value: "session-token")
        mockKeychain.save(key: KeychainHelper.sessionCookieValueKey, value: "abc123")
        mockKeychain.save(key: KeychainHelper.sessionCookieSecureKey, value: "false")

        authManager.checkExistingAuth()

        // On simulator (no biometric hardware), goes straight to authenticated
        XCTAssertEqual(authManager.state, .authenticated)
        XCTAssertEqual(authManager.sessionCookieName, "session-token")
        XCTAssertEqual(authManager.sessionCookieValue, "abc123")
    }

    // MARK: - logout

    func testLogoutClearsAllState() {
        // Set up some state
        mockKeychain.save(key: KeychainHelper.mobileTokenKey, value: "jwt")
        mockKeychain.save(key: KeychainHelper.tokenExpiresAtKey, value: "2026-06-01T00:00:00.000Z")
        mockKeychain.save(key: KeychainHelper.sessionCookieNameKey, value: "name")
        mockKeychain.save(key: KeychainHelper.sessionCookieValueKey, value: "value")
        mockKeychain.save(key: KeychainHelper.sessionCookieSecureKey, value: "true")

        authManager.logout()

        // Verify keychain cleared
        XCTAssertFalse(mockKeychain.has(key: KeychainHelper.mobileTokenKey))
        XCTAssertFalse(mockKeychain.has(key: KeychainHelper.tokenExpiresAtKey))
        XCTAssertFalse(mockKeychain.has(key: KeychainHelper.sessionCookieNameKey))
        XCTAssertFalse(mockKeychain.has(key: KeychainHelper.sessionCookieValueKey))
        XCTAssertFalse(mockKeychain.has(key: KeychainHelper.sessionCookieSecureKey))

        // Verify properties reset
        XCTAssertNil(authManager.sessionCookieName)
        XCTAssertNil(authManager.sessionCookieValue)
        XCTAssertFalse(authManager.sessionCookieSecure)
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
}

// MARK: - AuthState Equatable conformance for testing

extension AuthState: @retroactive Equatable {
    public static func == (lhs: AuthState, rhs: AuthState) -> Bool {
        switch (lhs, rhs) {
        case (.checking, .checking),
             (.loggedOut, .loggedOut),
             (.biometricPrompt, .biometricPrompt),
             (.authenticated, .authenticated):
            return true
        default:
            return false
        }
    }
}
