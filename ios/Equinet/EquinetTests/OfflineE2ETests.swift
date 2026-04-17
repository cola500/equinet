//
//  OfflineE2ETests.swift
//  EquinetTests
//
//  End-to-end test of the iOS offline chain:
//  NetworkMonitor → offline banner condition → stale cache → reconnect → fresh fetch
//
//  Tests the complete scenario that a user would experience:
//  1. Online: dashboard loads fresh data
//  2. Goes offline: stale cache served, no fetch attempted
//  3. Navigates: stale cache continues working
//  4. Reconnects: fresh fetch triggered
//
//  Uses real NetworkMonitor with debug override (same mechanism as simctl spawn defaults write).
//  Mock fetcher simulates API responses without requiring a running server.
//

import XCTest
@testable import Equinet

@MainActor
final class OfflineE2ETests: XCTestCase {

    private var monitor: NetworkMonitor!
    private var fetcher: E2EMockFetcher!

    override func setUp() {
        super.setUp()
        monitor = NetworkMonitor()
        fetcher = E2EMockFetcher()
        // Clear any cached dashboard data
        SharedDataManager.clearDashboardCache()
    }

    override func tearDown() {
        monitor.debugOverrideConnected = nil
        monitor.stop()
        monitor = nil
        fetcher = nil
        SharedDataManager.clearDashboardCache()
        super.tearDown()
    }

    // MARK: - Full E2E Scenario

    /// Anna is online, loads dashboard, goes offline, sees stale cache, reconnects, gets fresh data
    func testFullOfflineReconnectScenario() async throws {
        // Setup: ViewModel with real NetworkMonitor + mock fetcher
        let viewModel = DashboardViewModel(fetcher: fetcher, networkStatus: monitor)

        // -- Step 1: Online -- fresh data loads
        fetcher.response = makeResponse(upcomingCount: 5)
        await viewModel.loadDashboard()

        XCTAssertEqual(viewModel.dashboard?.upcomingBookingCount, 5, "Should show fresh data")
        XCTAssertEqual(fetcher.fetchCount, 1, "Should have fetched once")

        // -- Step 2: Go offline
        monitor.debugOverrideConnected = false
        XCTAssertFalse(monitor.isConnected)

        // -- Step 3: Load dashboard while offline -- should use stale cache
        fetcher.response = makeResponse(upcomingCount: 99) // Would be new data if fetched
        await viewModel.loadDashboard()

        XCTAssertEqual(viewModel.dashboard?.upcomingBookingCount, 5, "Should still show cached data")
        XCTAssertEqual(fetcher.fetchCount, 1, "Should NOT have fetched while offline")

        // -- Step 4: Reconnect
        monitor.debugOverrideConnected = nil
        XCTAssertTrue(monitor.isConnected)

        // -- Step 5: Load dashboard after reconnect -- should fetch fresh data
        fetcher.response = makeResponse(upcomingCount: 10)
        await viewModel.loadDashboard()

        XCTAssertEqual(viewModel.dashboard?.upcomingBookingCount, 10, "Should show fresh data after reconnect")
        XCTAssertTrue(fetcher.fetchCount >= 2, "Should have fetched again after reconnect")
    }

    /// Verify offline with existing cache skips network fetch
    func testOfflineWithCacheSkipsFetch() async {
        let viewModel = DashboardViewModel(fetcher: fetcher, networkStatus: monitor)

        // First: populate cache while online
        fetcher.response = makeResponse(upcomingCount: 7)
        await viewModel.loadDashboard()
        XCTAssertEqual(fetcher.fetchCount, 1)

        // Go offline
        monitor.debugOverrideConnected = false

        // Load again -- should use cache, not fetch
        let countBefore = fetcher.fetchCount
        await viewModel.loadDashboard()
        XCTAssertEqual(viewModel.dashboard?.upcomingBookingCount, 7, "Should show cached data")
        XCTAssertEqual(fetcher.fetchCount, countBefore, "Should not fetch when offline with cache")
    }

    /// Verify UserDefaults polling integrates with ViewModel correctly
    func testUserDefaultsPollingAffectsViewModel() async throws {
        monitor.start()
        let viewModel = DashboardViewModel(fetcher: fetcher, networkStatus: monitor)

        // Pre-populate cache via a normal fetch
        fetcher.response = makeResponse(upcomingCount: 3)
        await viewModel.loadDashboard()
        XCTAssertEqual(viewModel.dashboard?.upcomingBookingCount, 3)

        // Simulate simctl spawn defaults write
        UserDefaults.standard.set(true, forKey: "debugOffline")
        try await Task.sleep(for: .seconds(1.5))

        XCTAssertFalse(monitor.isConnected, "Monitor should be offline via UserDefaults")

        // Load again -- should use cache, not fetch
        fetcher.response = makeResponse(upcomingCount: 99)
        let fetchCountBefore = fetcher.fetchCount
        await viewModel.loadDashboard()

        XCTAssertEqual(viewModel.dashboard?.upcomingBookingCount, 3, "Should use stale cache")
        XCTAssertEqual(fetcher.fetchCount, fetchCountBefore, "Should not fetch while offline")

        // Simulate simctl spawn defaults delete
        UserDefaults.standard.removeObject(forKey: "debugOffline")
        try await Task.sleep(for: .seconds(1.5))

        XCTAssertTrue(monitor.isConnected, "Monitor should be back online")

        // Cleanup
        UserDefaults.standard.removeObject(forKey: "debugOffline")
    }

    /// Verify callback chain: offline -> onStatusChanged fires
    func testStatusChangedCallbackChain() {
        var changes: [Bool] = []
        monitor.onStatusChanged = { isOnline in
            changes.append(isOnline)
        }

        monitor.debugOverrideConnected = false
        monitor.debugOverrideConnected = nil

        XCTAssertEqual(changes, [false, true], "Should fire offline then online callbacks")
    }

    // MARK: - Helpers

    private func makeResponse(upcomingCount: Int) -> DashboardResponse {
        DashboardResponse(
            todayBookings: [],
            todayBookingCount: 0,
            upcomingBookingCount: upcomingCount,
            pendingBookingCount: 0,
            reviewStats: DashboardReviewStats(averageRating: 4.5, totalCount: 10),
            onboarding: DashboardOnboarding(
                profileComplete: true,
                hasServices: true,
                hasAvailability: true,
                isActive: true,
                allComplete: true
            ),
            priorityAction: DashboardPriorityAction(
                type: .pendingBookings,
                count: 0,
                label: ""
            )
        )
    }
}

// MARK: - Mock Fetcher

private final class E2EMockFetcher: DashboardDataFetching, @unchecked Sendable {
    var response: DashboardResponse?
    var fetchCount = 0
    var shouldFail = false

    func fetchDashboard() async throws -> DashboardResponse {
        fetchCount += 1
        if shouldFail {
            throw NSError(domain: "test", code: 500, userInfo: [NSLocalizedDescriptionKey: "Test server error"])
        }
        return response ?? DashboardResponse(
            todayBookings: [],
            todayBookingCount: 0,
            upcomingBookingCount: 0,
            pendingBookingCount: 0,
            reviewStats: DashboardReviewStats(averageRating: 0, totalCount: 0),
            onboarding: DashboardOnboarding(
                profileComplete: false,
                hasServices: false,
                hasAvailability: false,
                isActive: false,
                allComplete: false
            ),
            priorityAction: DashboardPriorityAction(type: .pendingBookings, count: 0, label: "")
        )
    }
}
