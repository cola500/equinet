//
//  MockKeychainHelper.swift
//  EquinetTests
//
//  In-memory test double for KeychainStorable protocol.
//

@testable import Equinet
import Foundation

final class MockKeychainHelper: KeychainStorable {
    private var store: [String: String] = [:]

    @discardableResult
    func save(key: String, value: String) -> Bool {
        store[key] = value
        return true
    }

    func load(key: String) -> String? {
        store[key]
    }

    @discardableResult
    func delete(key: String) -> Bool {
        store.removeValue(forKey: key)
        return true
    }

    /// Convenience: check if a key exists
    func has(key: String) -> Bool {
        store[key] != nil
    }

    /// Convenience: reset all stored data
    func reset() {
        store.removeAll()
    }
}
