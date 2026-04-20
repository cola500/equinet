//
//  AuthManager.swift
//  Equinet
//
//  Manages native authentication state via Supabase Swift SDK.
//  Session persistence handled by SDK (App Group Keychain via SupabaseManager).
//

import Foundation
import Observation
import OSLog
import Supabase
import WebKit

enum AuthState: Equatable {
    case checking        // Startup: checking for existing Supabase session
    case loggedOut       // No valid session -> show NativeLoginView
    case authenticated   // Valid session -> show main app
}

enum LoginError: Equatable {
    case invalidCredentials
    case networkUnavailable
    case serverError
    case unknown

    var message: String {
        switch self {
        case .invalidCredentials: return "E-post eller lösenord stämmer inte"
        case .networkUnavailable: return "Ingen internetanslutning. Kontrollera nätverket och försök igen."
        case .serverError: return "Något gick fel hos oss. Försök igen om en stund."
        case .unknown: return "Oväntat fel. Försök igen eller kontakta support."
        }
    }

    var icon: String {
        switch self {
        case .invalidCredentials: return "person.badge.key"
        case .networkUnavailable: return "wifi.slash"
        case .serverError: return "exclamationmark.triangle"
        case .unknown: return "questionmark.circle"
        }
    }
}

@MainActor
@Observable
final class AuthManager {

    private(set) var state: AuthState = .checking
    private(set) var loginError: String?
    private(set) var loginErrorType: LoginError?
    private(set) var isLoggingIn = false
    private(set) var userType: String?  // "provider" or "customer"

    /// Keychain abstraction (still used for userType storage).
    let keychain: KeychainStorable

    /// URLSession used for session exchange network requests (injectable for testing).
    private let urlSession: URLSession

    /// Production factory -- call from @MainActor context.
    static func createDefault() -> AuthManager {
        AuthManager(keychain: KeychainHelper.shared)
    }

    init(keychain: KeychainStorable, urlSession: URLSession = .shared) {
        self.keychain = keychain
        self.urlSession = urlSession
    }

    // MARK: - Check existing auth

    /// Called on app launch. Checks Supabase SDK for a valid session.
    func checkExistingAuth() {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--debug-autologin") {
            Task {
                await debugAutoLogin()
            }
            return
        }
        #endif

        if SupabaseManager.client.auth.currentSession != nil {
            userType = keychain.load(key: KeychainHelper.userTypeKey)
            state = .authenticated
        } else {
            state = .loggedOut
        }
    }

    // MARK: - Login with credentials

    func login(email: String, password: String) async {
        loginError = nil
        loginErrorType = nil
        isLoggingIn = true
        defer { isLoggingIn = false }

        do {
            let session = try await SupabaseManager.client.auth.signIn(
                email: email,
                password: password
            )

            // Extract userType from JWT claims (app_metadata)
            let resolvedUserType = resolveUserType(from: session.user)
            userType = resolvedUserType
            _ = keychain.save(key: KeychainHelper.userTypeKey, value: resolvedUserType)

            state = .authenticated
        } catch let urlError as URLError {
            let type = mapURLError(urlError)
            loginErrorType = type
            loginError = type.message
        } catch let error as AuthError {
            let type = mapSupabaseAuthError(error)
            loginErrorType = type
            loginError = type.message
        } catch {
            loginErrorType = .unknown
            loginError = LoginError.unknown.message
            AppLogger.auth.error("Login failed with unexpected error: \(error)")
        }
    }

    func mapURLError(_ error: URLError) -> LoginError {
        switch error.code {
        case .notConnectedToInternet, .networkConnectionLost, .timedOut, .cancelled:
            return .networkUnavailable
        default:
            return .unknown
        }
    }

    #if DEBUG
    /// Auto-login with test credentials for automated testing.
    /// Triggered by launch argument: --debug-autologin
    /// Email/password read from launch args: --debug-email <email> --debug-password <pwd>
    /// Defaults to anna@hastvard-goteborg.se / test123
    private func debugAutoLogin() async {
        let args = ProcessInfo.processInfo.arguments
        let email = args.elementAfter("--debug-email") ?? "anna@hastvard-goteborg.se"
        let password = args.elementAfter("--debug-password") ?? "test123"
        AppLogger.auth.info("Debug auto-login: \(email)")
        await login(email: email, password: password)
    }
    #endif

    // MARK: - Logout

    func logout() {
        // Unregister device token from backend (fire-and-forget)
        if let token = PushManager.shared.deviceToken {
            Task {
                do {
                    try await APIClient.shared.unregisterDeviceToken(token)
                } catch {
                    AppLogger.push.error("Failed to unregister device token at logout: \(error)")
                }
            }
        }
        PushManager.shared.clearDeviceToken()

        // Sign out from Supabase (fire-and-forget, clears local session)
        Task {
            do {
                try await SupabaseManager.client.auth.signOut(scope: .local)
            } catch {
                AppLogger.auth.error("Supabase signOut failed: \(error)")
            }
        }

        // Clear userType from Keychain
        _ = keychain.delete(key: KeychainHelper.userTypeKey)

        // Clear cached data
        SharedDataManager.clearDashboardCache()
        SharedDataManager.clearCalendarCache()
        SharedDataManager.clearWidgetData()
        SharedDataManager.clearBookingsCache()

        userType = nil
        state = .loggedOut
    }

    // MARK: - Session exchange for WKWebView

    /// Exchange Supabase access token for web session cookies via server endpoint.
    /// Called before loading WKWebView pages.
    func exchangeSessionForWebCookies(into cookieStore: WKHTTPCookieStore) async {
        guard let session = SupabaseManager.client.auth.currentSession else {
            AppLogger.auth.warning("No Supabase session for cookie exchange")
            return
        }

        guard let url = URL(string: AppConfig.sessionExchangePath, relativeTo: AppConfig.baseURL) else {
            AppLogger.auth.error("Invalid session exchange URL")
            return
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10

        // Send refresh token in body so server can set proper session cookies
        let body = ["refreshToken": session.refreshToken]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (_, response) = try await urlSession.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else { return }

            if httpResponse.statusCode == 200 {
                // URLSession stores all Set-Cookie headers in HTTPCookieStorage automatically.
                // allHeaderFields merges duplicate headers into one key (HTTP/2 limitation),
                // so we read from HTTPCookieStorage.shared which parses them correctly.
                if let responseURL = httpResponse.url {
                    let cookies = HTTPCookieStorage.shared.cookies(for: responseURL) ?? []
                    for cookie in cookies {
                        await cookieStore.setCookie(cookie)
                    }
                    AppLogger.auth.debug("Injected \(cookies.count) cookies into WKWebView")
                    if cookies.isEmpty {
                        AppLogger.auth.warning("Session exchange succeeded but no cookies found in HTTPCookieStorage")
                    }
                }
            } else {
                AppLogger.auth.error("Session exchange failed: HTTP \(httpResponse.statusCode)")
            }
        } catch {
            AppLogger.auth.error("Session exchange request failed: \(error)")
        }
    }

    // MARK: - Private

    private func resolveUserType(from user: User) -> String {
        // Check app_metadata for userType (set by custom access token hook)
        if let appMetadata = user.appMetadata["userType"],
           case let .string(type) = appMetadata {
            return type
        }
        // Fallback to user_metadata
        if let userMetadata = user.userMetadata["userType"],
           case let .string(type) = userMetadata {
            return type
        }
        return "provider"
    }

    private func mapSupabaseAuthError(_ error: AuthError) -> LoginError {
        switch error {
        case .sessionMissing:
            // SDK-internal: signIn succeeded but no session returned -- server-side issue
            return .serverError
        case let .api(message, errorCode, _, _):
            switch errorCode {
            case .invalidCredentials, .userNotFound:
                return .invalidCredentials
            case .emailNotConfirmed:
                // Correct credentials but account not confirmed -- closest to invalidCredentials
                return .invalidCredentials
            case .userBanned:
                // Server/admin decision, not wrong credentials
                return .serverError
            case .overRequestRateLimit:
                AppLogger.auth.warning("Rate limit hit during login")
                return .serverError
            default:
                AppLogger.auth.error("Auth API error [\(errorCode.rawValue)]: \(message)")
                return .serverError
            }
        default:
            return .unknown
        }
    }
}

#if DEBUG
extension Array where Element == String {
    /// Returns the element after the given flag, e.g. ["--email", "a@b.se"].elementAfter("--email") -> "a@b.se"
    func elementAfter(_ flag: String) -> String? {
        guard let idx = firstIndex(of: flag), idx + 1 < count else { return nil }
        return self[idx + 1]
    }
}
#endif
