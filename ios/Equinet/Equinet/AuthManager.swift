//
//  AuthManager.swift
//  Equinet
//
//  Manages native authentication state: Keychain token check,
//  biometric authentication (Face ID / Touch ID), and native login.
//

import Foundation
import LocalAuthentication
import Observation
import WebKit

enum AuthState {
    case checking        // Startup: checking Keychain for existing token
    case loggedOut       // No valid token -> show NativeLoginView
    case biometricPrompt // Has valid token -> ask for Face ID / Touch ID
    case authenticated   // Ready to show WebView with session cookie
}

@MainActor
@Observable
final class AuthManager {

    private(set) var state: AuthState = .checking
    private(set) var loginError: String?
    private(set) var isLoggingIn = false

    // Session cookie data (populated after login or biometric unlock)
    private(set) var sessionCookieName: String?
    private(set) var sessionCookieValue: String?
    private(set) var sessionCookieSecure: Bool = false

    /// Keychain abstraction for testability.
    let keychain: KeychainStorable

    /// Production factory -- call from @MainActor context to avoid concurrency warnings.
    static func createDefault() -> AuthManager {
        AuthManager(keychain: KeychainHelper.shared)
    }

    init(keychain: KeychainStorable) {
        self.keychain = keychain
    }

    // MARK: - Check existing auth

    /// Called on app launch. Checks Keychain for a valid mobile token.
    func checkExistingAuth() {
        guard keychain.load(key: KeychainHelper.mobileTokenKey) != nil else {
            state = .loggedOut
            return
        }

        // Has valid token -- check if biometric hardware is available
        let context = LAContext()
        var error: NSError?
        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            // Has saved session cookie? If so, go to biometric prompt
            if keychain.load(key: KeychainHelper.sessionCookieValueKey) != nil {
                state = .biometricPrompt
            } else {
                // Token exists but no session cookie -- need fresh login
                state = .loggedOut
            }
        } else {
            // No biometric hardware -- check for session cookie
            if keychain.load(key: KeychainHelper.sessionCookieValueKey) != nil {
                loadSessionCookieFromKeychain()
                state = .authenticated
            } else {
                state = .loggedOut
            }
        }
    }

    // MARK: - Login with credentials

    func login(email: String, password: String) async {
        loginError = nil
        isLoggingIn = true
        defer { isLoggingIn = false }

        do {
            let response = try await performLogin(email: email, password: password)

            // Save mobile token
            _ = keychain.save(key: KeychainHelper.mobileTokenKey, value: response.token)
            _ = keychain.save(key: KeychainHelper.tokenExpiresAtKey, value: response.expiresAt)

            // Save session cookie
            _ = keychain.save(key: KeychainHelper.sessionCookieNameKey, value: response.sessionCookie.name)
            _ = keychain.save(key: KeychainHelper.sessionCookieValueKey, value: response.sessionCookie.value)
            _ = keychain.save(key: KeychainHelper.sessionCookieSecureKey, value: response.sessionCookie.secure ? "true" : "false")

            sessionCookieName = response.sessionCookie.name
            sessionCookieValue = response.sessionCookie.value
            sessionCookieSecure = response.sessionCookie.secure

            state = .authenticated
        } catch let error as LoginError {
            loginError = error.message
        } catch {
            loginError = "Något gick fel. Försök igen."
        }
    }

    // MARK: - Biometric authentication

    func authenticateWithBiometric() async {
        let context = LAContext()
        context.localizedCancelTitle = "Logga in med lösenord"

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Logga in i Equinet"
            )

            if success {
                loadSessionCookieFromKeychain()
                state = .authenticated
            } else {
                state = .loggedOut
            }
        } catch {
            // User cancelled or biometric failed
            state = .loggedOut
        }
    }

    // MARK: - Logout

    func logout() {
        _ = keychain.delete(key: KeychainHelper.mobileTokenKey)
        _ = keychain.delete(key: KeychainHelper.tokenExpiresAtKey)
        _ = keychain.delete(key: KeychainHelper.sessionCookieNameKey)
        _ = keychain.delete(key: KeychainHelper.sessionCookieValueKey)
        _ = keychain.delete(key: KeychainHelper.sessionCookieSecureKey)
        sessionCookieName = nil
        sessionCookieValue = nil
        sessionCookieSecure = false
        state = .loggedOut
    }

    // MARK: - Cookie injection

    /// Inject the session cookie into WKWebView's cookie store
    func injectSessionCookie(into cookieStore: WKHTTPCookieStore) async {
        guard let name = sessionCookieName,
              let value = sessionCookieValue else {
            return
        }

        let isProduction = sessionCookieSecure
        let domain = isProduction ? "equinet.vercel.app" : "localhost"

        var properties: [HTTPCookiePropertyKey: Any] = [
            .name: name,
            .value: value,
            .path: "/",
            .domain: domain,
        ]

        if isProduction {
            properties[.secure] = true
        }

        guard let cookie = HTTPCookie(properties: properties) else {
            print("[AuthManager] Failed to create HTTPCookie")
            return
        }

        await cookieStore.setCookie(cookie)
        print("[AuthManager] Session cookie injected into WKWebView")
    }

    // MARK: - Biometric type

    var biometryTypeName: String {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        switch context.biometryType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        case .none: return "biometri"
        @unknown default: return "biometri"
        }
    }

    var biometryIconName: String {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        switch context.biometryType {
        case .faceID: return "faceid"
        case .touchID: return "touchid"
        default: return "lock.shield"
        }
    }

    // MARK: - Private

    private func loadSessionCookieFromKeychain() {
        sessionCookieName = keychain.load(key: KeychainHelper.sessionCookieNameKey)
        sessionCookieValue = keychain.load(key: KeychainHelper.sessionCookieValueKey)
        sessionCookieSecure = keychain.load(key: KeychainHelper.sessionCookieSecureKey) == "true"
    }

    private func performLogin(email: String, password: String) async throws -> NativeLoginResponse {
        let url = AppConfig.baseURL.appendingPathComponent("api/auth/native-login")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 15

        var body: [String: String] = [
            "email": email,
            "password": password,
        ]
        body["deviceName"] = UIDevice.current.name

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw LoginError(message: "Ogiltig serverrespons")
        }

        switch httpResponse.statusCode {
        case 200:
            return try JSONDecoder().decode(NativeLoginResponse.self, from: data)
        case 401:
            throw LoginError(message: "Ogiltig email eller lösenord")
        case 403:
            if let errorBody = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw LoginError(message: errorBody.error)
            }
            throw LoginError(message: "Kontot är inte tillgängligt")
        case 409:
            throw LoginError(message: "Max antal enheter uppnått. Ta bort en enhet först.")
        case 429:
            throw LoginError(message: "För många inloggningsförsök. Försök igen om 15 minuter.")
        default:
            throw LoginError(message: "Serverfel (\(httpResponse.statusCode)). Försök igen senare.")
        }
    }
}

// MARK: - Response types

private struct NativeLoginResponse: Decodable {
    let token: String
    let expiresAt: String
    let sessionCookie: SessionCookieResponse
    let user: UserResponse
}

private struct SessionCookieResponse: Decodable {
    let name: String
    let value: String
    let maxAge: Int
    let secure: Bool
    let domain: String
}

private struct UserResponse: Decodable {
    let id: String
    let name: String
    let userType: String
    let providerId: String?
}

private struct ErrorResponse: Decodable {
    let error: String
}

private struct LoginError: Error {
    let message: String
}
