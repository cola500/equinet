//
//  KeychainHelper.swift
//  Equinet
//
//  Keychain wrapper for secure token storage.
//  Uses App Group access so the widget extension can read tokens.
//

import Foundation
import Security

/// Protocol for Keychain operations, enabling test doubles.
protocol KeychainStorable: Sendable {
    func save(key: String, value: String) -> Bool
    func load(key: String) -> String?
    func delete(key: String) -> Bool
}

enum KeychainHelper {
    private static let service = "com.equinet.mobile-token"
    private static let accessGroup = "group.com.equinet.shared"

    /// Save a string value to Keychain
    @discardableResult
    static func save(key: String, value: String) -> Bool {
        guard let data = value.data(using: .utf8) else { return false }

        // Delete existing item first
        delete(key: key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecAttrAccessGroup as String: accessGroup,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]

        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }

    /// Load a string value from Keychain
    static func load(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecAttrAccessGroup as String: accessGroup,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }

        return value
    }

    /// Delete a value from Keychain
    @discardableResult
    static func delete(key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecAttrAccessGroup as String: accessGroup,
        ]

        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
}

// MARK: - KeychainStorable conformance (instance wrapper around static methods)

extension KeychainHelper {
    /// Shared instance for production use with KeychainStorable protocol.
    static let shared = KeychainHelperAdapter()
}

/// Adapter that wraps KeychainHelper's static methods as an instance conforming to KeychainStorable.
struct KeychainHelperAdapter: KeychainStorable, Sendable {
    func save(key: String, value: String) -> Bool {
        KeychainHelper.save(key: key, value: value)
    }

    func load(key: String) -> String? {
        KeychainHelper.load(key: key)
    }

    func delete(key: String) -> Bool {
        KeychainHelper.delete(key: key)
    }
}

// MARK: - Convenience keys

extension KeychainHelper {
    static let mobileTokenKey = "mobile_token_jwt"
    static let tokenExpiresAtKey = "mobile_token_expires_at"

    /// ISO8601 formatter that handles fractional seconds (e.g. "2026-06-06T00:00:00.000Z")
    /// JavaScript's toISOString() always includes milliseconds -- default ISO8601DateFormatter does NOT parse them.
    private static var iso8601Formatter: ISO8601DateFormatter {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }

    /// Save mobile token JWT and expiry
    static func saveMobileToken(jwt: String, expiresAt: String) {
        let jwtSaved = save(key: mobileTokenKey, value: jwt)
        let expirySaved = save(key: tokenExpiresAtKey, value: expiresAt)
        if !jwtSaved || !expirySaved {
            print("[Keychain] Failed to save mobile token (jwt: \(jwtSaved), expiry: \(expirySaved))")
        }
    }

    /// Load mobile token JWT (nil if not stored or expired)
    static func loadMobileToken() -> String? {
        guard let jwt = load(key: mobileTokenKey),
              let expiresAtStr = load(key: tokenExpiresAtKey),
              let expiresAt = iso8601Formatter.date(from: expiresAtStr),
              expiresAt > Date() else {
            return nil
        }
        return jwt
    }

    /// Check if token expires within given days
    static func tokenExpiresWithinDays(_ days: Int) -> Bool {
        guard let expiresAtStr = load(key: tokenExpiresAtKey),
              let expiresAt = iso8601Formatter.date(from: expiresAtStr) else {
            return true // No token = treat as expired
        }
        let threshold = Date().addingTimeInterval(TimeInterval(days * 24 * 60 * 60))
        return expiresAt < threshold
    }

    /// Clear all mobile token data
    static func clearMobileToken() {
        delete(key: mobileTokenKey)
        delete(key: tokenExpiresAtKey)
    }

    // MARK: - Session Cookie

    static let sessionCookieNameKey = "session_cookie_name"
    static let sessionCookieValueKey = "session_cookie_value"
    static let sessionCookieSecureKey = "session_cookie_secure"
    static let userTypeKey = "user_type"

    /// Save session cookie data for WKWebView injection
    static func saveSessionCookie(name: String, value: String, secure: Bool) {
        save(key: sessionCookieNameKey, value: name)
        save(key: sessionCookieValueKey, value: value)
        save(key: sessionCookieSecureKey, value: secure ? "true" : "false")
    }

    /// Load session cookie data (returns nil if not stored)
    static func loadSessionCookie() -> (name: String, value: String, secure: Bool)? {
        guard let name = load(key: sessionCookieNameKey),
              let value = load(key: sessionCookieValueKey),
              let secureStr = load(key: sessionCookieSecureKey) else {
            return nil
        }
        return (name, value, secureStr == "true")
    }

    /// Clear session cookie data
    static func clearSessionCookie() {
        delete(key: sessionCookieNameKey)
        delete(key: sessionCookieValueKey)
        delete(key: sessionCookieSecureKey)
    }
}
