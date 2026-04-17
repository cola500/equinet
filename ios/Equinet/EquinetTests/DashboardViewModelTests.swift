//
//  DashboardViewModelTests.swift
//  EquinetTests
//
//  Tests for DashboardViewModel using mock dependencies.
//

@testable import Equinet
import XCTest

// MARK: - Mocks

final class MockDashboardFetcher: DashboardDataFetching, @unchecked Sendable {
    var fetchResult: Result<DashboardResponse, Error> = .success(makeDashboardResponse())
    var fetchCallCount = 0

    func fetchDashboard() async throws -> DashboardResponse {
        fetchCallCount += 1
        return try fetchResult.get()
    }
}

final class MockNetworkStatus: NetworkStatusProviding {
    var isConnected = true
}

// MARK: - Test Helpers

private func makeDashboardResponse(
    todayBookings: [DashboardTodayBooking] = [],
    todayBookingCount: Int = 0,
    upcomingBookingCount: Int = 5,
    pendingBookingCount: Int = 2,
    reviewStats: DashboardReviewStats = DashboardReviewStats(averageRating: 4.5, totalCount: 12),
    onboarding: DashboardOnboarding = DashboardOnboarding(
        profileComplete: true,
        hasServices: true,
        hasAvailability: true,
        isActive: true,
        allComplete: true
    ),
    priorityAction: DashboardPriorityAction = DashboardPriorityAction(
        type: .pendingBookings,
        count: 2,
        label: "2 bokningar väntar"
    )
) -> DashboardResponse {
    DashboardResponse(
        todayBookings: todayBookings,
        todayBookingCount: todayBookingCount,
        upcomingBookingCount: upcomingBookingCount,
        pendingBookingCount: pendingBookingCount,
        reviewStats: reviewStats,
        onboarding: onboarding,
        priorityAction: priorityAction
    )
}

private func makeTodayBooking(
    id: String = "b1",
    status: String = "confirmed"
) -> DashboardTodayBooking {
    DashboardTodayBooking(
        id: id,
        startTime: "10:00",
        endTime: "11:00",
        customerFirstName: "Anna",
        customerLastName: "Andersson",
        serviceName: "Ridlektion",
        status: status
    )
}

// MARK: - Tests

@MainActor
final class DashboardViewModelTests: XCTestCase {

    private var fetcher: MockDashboardFetcher!
    private var sut: DashboardViewModel!

    override func setUp() {
        super.setUp()
        fetcher = MockDashboardFetcher()
        sut = DashboardViewModel(fetcher: fetcher)
        // Clear any cached dashboard data
        SharedDataManager.clearDashboardCache()
        // Clear onboarding dismiss state
        UserDefaults.standard.removeObject(forKey: "dashboard_onboarding_dismiss_until")
        UserDefaults.standard.removeObject(forKey: "dashboard_onboarding_dismiss_permanent")
    }

    override func tearDown() {
        SharedDataManager.clearDashboardCache()
        UserDefaults.standard.removeObject(forKey: "dashboard_onboarding_dismiss_until")
        UserDefaults.standard.removeObject(forKey: "dashboard_onboarding_dismiss_permanent")
        super.tearDown()
    }

    // MARK: - Initial State

    func testInitialState() {
        XCTAssertNil(sut.dashboard)
        XCTAssertTrue(sut.isLoading)
        XCTAssertNil(sut.error)
        XCTAssertFalse(sut.onboardingDismissed)
    }

    // MARK: - Successful Load

    func testLoadDashboardSuccess() async {
        let response = makeDashboardResponse(upcomingBookingCount: 7, pendingBookingCount: 3)
        fetcher.fetchResult = .success(response)

        await sut.loadDashboard()

        XCTAssertNotNil(sut.dashboard)
        XCTAssertEqual(sut.dashboard?.upcomingBookingCount, 7)
        XCTAssertEqual(sut.dashboard?.pendingBookingCount, 3)
        XCTAssertFalse(sut.isLoading)
        XCTAssertNil(sut.error)
        XCTAssertEqual(fetcher.fetchCallCount, 1)
    }

    func testLoadDashboardWithTodayBookings() async {
        let bookings = [
            makeTodayBooking(id: "b1", status: "confirmed"),
            makeTodayBooking(id: "b2", status: "pending"),
        ]
        fetcher.fetchResult = .success(makeDashboardResponse(
            todayBookings: bookings,
            todayBookingCount: 2
        ))

        await sut.loadDashboard()

        XCTAssertEqual(sut.dashboard?.todayBookings.count, 2)
        XCTAssertEqual(sut.dashboard?.todayBookingCount, 2)
    }

    // MARK: - Error Handling

    func testLoadDashboardNetworkError() async {
        fetcher.fetchResult = .failure(APIError.networkError(URLError(.notConnectedToInternet)))

        await sut.loadDashboard()

        XCTAssertNil(sut.dashboard)
        XCTAssertNotNil(sut.error)
        XCTAssertEqual(sut.error, "Kontrollera din internetanslutning och försök igen.")
        XCTAssertFalse(sut.isLoading)
    }

    func testLoadDashboardTimeoutError() async {
        fetcher.fetchResult = .failure(APIError.timeout)

        await sut.loadDashboard()

        XCTAssertEqual(sut.error, "Kontrollera din internetanslutning och försök igen.")
    }

    func testLoadDashboardUnauthorizedError() async {
        fetcher.fetchResult = .failure(APIError.unauthorized)

        await sut.loadDashboard()

        XCTAssertEqual(sut.error, "Du behöver logga in igen.")
    }

    func testLoadDashboardRateLimitedError() async {
        fetcher.fetchResult = .failure(APIError.rateLimited(retryAfter: 30))

        await sut.loadDashboard()

        XCTAssertEqual(sut.error, "För många förfrågningar. Försök igen om en stund.")
    }

    func testLoadDashboardGenericError() async {
        fetcher.fetchResult = .failure(APIError.serverError(500))

        await sut.loadDashboard()

        XCTAssertEqual(sut.error, "Något gick fel. Försök igen.")
    }

    func testErrorNotShownWhenCachedDataExists() async {
        // First: successful load to populate state
        fetcher.fetchResult = .success(makeDashboardResponse(upcomingBookingCount: 5))
        await sut.loadDashboard()
        XCTAssertNotNil(sut.dashboard)

        // Second: refresh fails
        fetcher.fetchResult = .failure(APIError.serverError(500))
        await sut.refresh()

        // Error should NOT overwrite existing dashboard
        XCTAssertNotNil(sut.dashboard)
        XCTAssertNil(sut.error)
    }

    // MARK: - Refresh

    func testRefreshUpdatesDashboard() async {
        // Initial load
        fetcher.fetchResult = .success(makeDashboardResponse(upcomingBookingCount: 3))
        await sut.loadDashboard()
        XCTAssertEqual(sut.dashboard?.upcomingBookingCount, 3)

        // Refresh with new data
        fetcher.fetchResult = .success(makeDashboardResponse(upcomingBookingCount: 8))
        await sut.refresh()

        XCTAssertEqual(sut.dashboard?.upcomingBookingCount, 8)
        XCTAssertEqual(fetcher.fetchCallCount, 2)
    }

    // MARK: - Onboarding Dismiss

    func testOnboardingNotDismissedByDefault() {
        XCTAssertFalse(sut.isOnboardingDismissed())
    }

    func testDismissOnboardingTemporary() {
        sut.dismissOnboarding(permanent: false)

        XCTAssertTrue(sut.onboardingDismissed)
        XCTAssertTrue(sut.isOnboardingDismissed())
    }

    func testDismissOnboardingPermanent() {
        sut.dismissOnboarding(permanent: true)

        XCTAssertTrue(sut.isOnboardingDismissed())
        // Persisted in UserDefaults
        XCTAssertTrue(UserDefaults.standard.bool(forKey: "dashboard_onboarding_dismiss_permanent"))
    }

    func testPermanentDismissSurvivesNewInstance() {
        sut.dismissOnboarding(permanent: true)

        // Create new ViewModel (simulates app restart)
        let newVM = DashboardViewModel(fetcher: fetcher)
        XCTAssertTrue(newVM.isOnboardingDismissed())
    }

    // MARK: - Reset

    func testResetClearsState() async {
        fetcher.fetchResult = .success(makeDashboardResponse())
        await sut.loadDashboard()
        sut.dismissOnboarding(permanent: false)

        sut.reset()

        XCTAssertNil(sut.dashboard)
        XCTAssertTrue(sut.isLoading)
        XCTAssertNil(sut.error)
        XCTAssertFalse(sut.onboardingDismissed)
    }

    // MARK: - Offline Cache Behavior

    func testOfflineColdStartShowsStaleDashboardCache() async {
        // Populate cache, then expire it by waiting (simulated via old cachedAt)
        let oldResponse = makeDashboardResponse(upcomingBookingCount: 42)
        SharedDataManager.saveDashboardCache(oldResponse)
        // Manually write stale cache (10 min old, beyond 5 min TTL)
        writeStaleCache(response: oldResponse, ageSeconds: 600)

        // Network is offline, fetch will fail
        let networkStatus = MockNetworkStatus()
        networkStatus.isConnected = false
        fetcher.fetchResult = .failure(APIError.networkError(URLError(.notConnectedToInternet)))
        sut = DashboardViewModel(fetcher: fetcher, networkStatus: networkStatus)

        await sut.loadDashboard()

        // Should show stale cached data instead of error
        XCTAssertNotNil(sut.dashboard, "Stale cache should be shown when offline")
        XCTAssertEqual(sut.dashboard?.upcomingBookingCount, 42)
        XCTAssertNil(sut.error, "No error should be shown when stale cache is available offline")
    }

    func testOfflineNetworkErrorShowsOfflineMessage() async {
        // No cache available, network offline
        let networkStatus = MockNetworkStatus()
        networkStatus.isConnected = false
        fetcher.fetchResult = .failure(APIError.networkError(URLError(.notConnectedToInternet)))
        sut = DashboardViewModel(fetcher: fetcher, networkStatus: networkStatus)

        await sut.loadDashboard()

        // Should show offline-specific error (not generic network error)
        XCTAssertNotNil(sut.error)
        XCTAssertTrue(sut.error?.contains("offline") == true || sut.error?.contains("Offline") == true,
                       "Error message should mention offline status: got '\(sut.error ?? "")'")
    }

    func testOnlineWithStaleCacheStillFetchesFresh() async {
        // Stale cache exists but we're online
        let oldResponse = makeDashboardResponse(upcomingBookingCount: 42)
        writeStaleCache(response: oldResponse, ageSeconds: 600)

        let networkStatus = MockNetworkStatus()
        networkStatus.isConnected = true
        let freshResponse = makeDashboardResponse(upcomingBookingCount: 99)
        fetcher.fetchResult = .success(freshResponse)
        sut = DashboardViewModel(fetcher: fetcher, networkStatus: networkStatus)

        await sut.loadDashboard()

        // Online: should fetch fresh data, not rely on stale cache
        XCTAssertEqual(sut.dashboard?.upcomingBookingCount, 99)
        XCTAssertEqual(fetcher.fetchCallCount, 1)
    }

    // MARK: - Test Helpers (Offline)

    /// Write a cache entry with a custom age (simulates stale cache)
    private func writeStaleCache(response: DashboardResponse, ageSeconds: TimeInterval) {
        // Access App Group UserDefaults directly to write stale cache
        guard let defaults = UserDefaults(suiteName: "group.com.equinet.shared") else { return }
        let staleCache = SharedDataManager.DashboardCache(
            response: response,
            cachedAt: Date.now.addingTimeInterval(-ageSeconds)
        )
        if let encoded = try? JSONEncoder().encode(staleCache) {
            defaults.set(encoded, forKey: "dashboard_cache_data")
        }
    }
}
