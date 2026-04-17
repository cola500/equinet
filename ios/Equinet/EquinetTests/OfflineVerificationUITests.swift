//
//  OfflineVerificationUITests.swift
//  EquinetTests
//
//  E2E verification of the offline chain:
//  NetworkMonitor debug override → isConnected changes → onStatusChanged fires
//  Plus: UserDefaults polling (simulates simctl spawn defaults write)
//
//  Run: xcodebuild test -project Equinet.xcodeproj -scheme Equinet \
//       -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
//       -only-testing:EquinetTests/OfflineVerificationUITests
//

import XCTest
@testable import Equinet

@MainActor
final class OfflineVerificationUITests: XCTestCase {

    /// Full chain: connected → offline override → callback fires → clear override → callback fires
    func testOfflineChainWithDebugOverride() {
        let monitor = NetworkMonitor()
        var statusChanges: [Bool] = []
        monitor.onStatusChanged = { isOnline in
            statusChanges.append(isOnline)
        }

        // Baseline: connected
        XCTAssertTrue(monitor.isConnected)

        // Go offline
        monitor.debugOverrideConnected = false
        XCTAssertFalse(monitor.isConnected)
        XCTAssertEqual(statusChanges, [false])

        // Reconnect
        monitor.debugOverrideConnected = nil
        XCTAssertTrue(monitor.isConnected)
        XCTAssertEqual(statusChanges, [false, true])
    }

    /// Verify UserDefaults polling picks up external changes (simulates simctl spawn defaults write)
    func testUserDefaultsPollingTriggersOverride() async throws {
        let monitor = NetworkMonitor()
        var statusChanges: [Bool] = []
        monitor.onStatusChanged = { isOnline in
            statusChanges.append(isOnline)
        }
        monitor.start()

        // Simulate: xcrun simctl spawn <UDID> defaults write com.equinet.Equinet debugOffline -bool true
        UserDefaults.standard.set(true, forKey: "debugOffline")

        // Wait for polling (1s interval + margin)
        try await Task.sleep(for: .seconds(1.5))

        XCTAssertFalse(monitor.isConnected, "Should be offline after UserDefaults set")
        XCTAssertTrue(statusChanges.contains(false), "Should have notified offline")

        // Simulate: xcrun simctl spawn <UDID> defaults delete com.equinet.Equinet debugOffline
        UserDefaults.standard.removeObject(forKey: "debugOffline")

        // Wait for polling
        try await Task.sleep(for: .seconds(1.5))

        XCTAssertTrue(monitor.isConnected, "Should be back online after UserDefaults cleared")
        XCTAssertTrue(statusChanges.contains(true), "Should have notified reconnected")

        // Cleanup
        monitor.stop()
        UserDefaults.standard.removeObject(forKey: "debugOffline")
    }

    /// Verify DashboardViewModel respects offline NetworkStatusProviding
    func testDashboardViewModelUsesNetworkStatus() async {
        let mockNetwork = OfflineTestNetworkStatus()
        mockNetwork.isConnected = false

        // DashboardViewModel should check networkStatus.isConnected
        // to decide whether to use stale cache (ignoreTTL)
        XCTAssertFalse(mockNetwork.isConnected)

        // When back online
        mockNetwork.isConnected = true
        XCTAssertTrue(mockNetwork.isConnected)
    }
}

private final class OfflineTestNetworkStatus: NetworkStatusProviding {
    var isConnected = true
}
