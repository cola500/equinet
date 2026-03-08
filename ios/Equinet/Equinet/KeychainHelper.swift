//
//  KeychainHelper.swift
//  Equinet
//
//  Keychain wrapper for secure token storage.
//  Uses App Group access so the widget extension can read tokens.
//

import Foundation
import Security

enum KeychainHelper {
    private static let service = "com.equinet.mobile-token"
    private static let accessGroup = "group.com.equinet.shared"

    /// Save a string value to Keychain
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

// MARK: - Convenience keys

extension KeychainHelper {
    static let mobileTokenKey = "mobile_token_jwt"
    static let tokenExpiresAtKey = "mobile_token_expires_at"

    /// Save mobile token JWT and expiry
    static func saveMobileToken(jwt: String, expiresAt: String) {
        _ = save(key: mobileTokenKey, value: jwt)
        _ = save(key: tokenExpiresAtKey, value: expiresAt)
    }

    /// Load mobile token JWT (nil if not stored or expired)
    static func loadMobileToken() -> String? {
        guard let jwt = load(key: mobileTokenKey),
              let expiresAtStr = load(key: tokenExpiresAtKey),
              let expiresAt = ISO8601DateFormatter().date(from: expiresAtStr),
              expiresAt > Date() else {
            return nil
        }
        return jwt
    }

    /// Check if token expires within given days
    static func tokenExpiresWithinDays(_ days: Int) -> Bool {
        guard let expiresAtStr = load(key: tokenExpiresAtKey),
              let expiresAt = ISO8601DateFormatter().date(from: expiresAtStr) else {
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
}
