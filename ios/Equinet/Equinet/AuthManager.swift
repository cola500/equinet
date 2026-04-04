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

@MainActor
@Observable
final class AuthManager {

    private(set) var state: AuthState = .checking
    private(set) var loginError: String?
    private(set) var isLoggingIn = false
    private(set) var userType: String?  // "provider" or "customer"

    /// Keychain abstraction (still used for userType storage).
    let keychain: KeychainStorable

    /// Production factory -- call from @MainActor context.
    static func createDefault() -> AuthManager {
        AuthManager(keychain: KeychainHelper.shared)
    }

    init(keychain: KeychainStorable) {
        self.keychain = keychain
    }

    // MARK: - Check existing auth

    /// Called on app launch. Checks Supabase SDK for a valid session.
    func checkExistingAuth() {
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
        } catch let error as AuthError {
            loginError = mapAuthError(error)
        } catch {
            loginError = "Något gick fel. Försök igen."
            AppLogger.auth.error("Login failed with unexpected error: \(error)")
        }
    }

    // MARK: - Logout

    func logout() {
        // Unregister device token from backend (fire-and-forget)
        if let token = PushManager.shared.deviceToken {
            Task.detached {
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

        let url = URL(string: AppConfig.sessionExchangePath, relativeTo: AppConfig.baseURL)!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10

        do {
            let (_, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else { return }

            if httpResponse.statusCode == 200 {
                // Extract Set-Cookie headers and inject into WKWebView
                if let headerFields = httpResponse.allHeaderFields as? [String: String],
                   let responseURL = httpResponse.url {
                    let cookies = HTTPCookie.cookies(withResponseHeaderFields: headerFields, for: responseURL)
                    for cookie in cookies {
                        await cookieStore.setCookie(cookie)
                    }
                    AppLogger.auth.debug("Injected \(cookies.count) cookies into WKWebView")
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

    private func mapAuthError(_ error: AuthError) -> String {
        switch error {
        case .sessionMissing:
            return "Sessionen har gått ut. Logga in igen."
        case let .api(message, errorCode, _, _):
            switch errorCode {
            case .invalidCredentials, .userNotFound:
                return "Ogiltig email eller lösenord"
            case .emailNotConfirmed:
                return "Verifiera din email innan du loggar in"
            case .userBanned:
                return "Kontot är inte tillgängligt"
            case .overRequestRateLimit:
                return "För många inloggningsförsök. Försök igen om en stund."
            default:
                AppLogger.auth.error("Auth API error [\(errorCode.rawValue)]: \(message)")
                return "Inloggningen misslyckades. Försök igen."
            }
        default:
            return "Något gick fel. Försök igen."
        }
    }
}
