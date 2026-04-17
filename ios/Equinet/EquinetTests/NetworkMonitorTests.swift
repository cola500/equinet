//
//  NetworkMonitorTests.swift
//  EquinetTests
//
//  Tests for NetworkMonitor debug override functionality.
//  Verifies that #if DEBUG override allows simulating offline state
//  for automated E2E testing via mobile-mcp.
//

import XCTest
@testable import Equinet

@MainActor
final class NetworkMonitorTests: XCTestCase {

    // MARK: - Debug Override

    func testDebugOverrideDisconnects() {
        let monitor = NetworkMonitor()
        // Default: connected (host has network)
        XCTAssertTrue(monitor.isConnected)

        monitor.debugOverrideConnected = false
        XCTAssertFalse(monitor.isConnected)
    }

    func testDebugOverrideReconnects() {
        let monitor = NetworkMonitor()
        monitor.debugOverrideConnected = false
        XCTAssertFalse(monitor.isConnected)

        monitor.debugOverrideConnected = nil // Remove override
        // Back to real status (host has network in test env)
        XCTAssertTrue(monitor.isConnected)
    }

    func testDebugOverrideTriggersCallback() {
        let monitor = NetworkMonitor()
        var receivedStatuses: [Bool] = []

        monitor.onStatusChanged = { isOnline in
            receivedStatuses.append(isOnline)
        }

        monitor.debugOverrideConnected = false
        XCTAssertEqual(receivedStatuses, [false])

        monitor.debugOverrideConnected = nil
        XCTAssertEqual(receivedStatuses, [false, true])
    }

    func testDebugOverrideTrueKeepsConnected() {
        let monitor = NetworkMonitor()
        monitor.debugOverrideConnected = true
        XCTAssertTrue(monitor.isConnected)
    }
}
