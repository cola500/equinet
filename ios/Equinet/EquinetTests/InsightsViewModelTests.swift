//
//  InsightsViewModelTests.swift
//  EquinetTests
//
//  Tests for InsightsViewModel: loading, period change, heatmap pre-computation.
//

import XCTest
@testable import Equinet

// MARK: - Mock Fetcher

@MainActor
final class MockInsightsFetcher: InsightsDataFetching {
    var responsesToReturn: [Int: InsightsResponse] = [:]
    var defaultResponse: InsightsResponse?
    var shouldThrow = false
    var lastRequestedMonths: Int?

    func fetchInsights(months: Int) async throws -> InsightsResponse {
        lastRequestedMonths = months
        if shouldThrow { throw APIError.serverError(500) }
        if let specific = responsesToReturn[months] {
            return specific
        }
        return defaultResponse ?? makeEmptyResponse()
    }
}

// MARK: - Test Helpers

@MainActor
func makeEmptyResponse() -> InsightsResponse {
    InsightsResponse(
        serviceBreakdown: [],
        timeHeatmap: [],
        customerRetention: [],
        kpis: InsightsKPIs(
            cancellationRate: 0,
            noShowRate: 0,
            averageBookingValue: 0,
            uniqueCustomers: 0,
            manualBookingRate: 0
        )
    )
}

@MainActor
func makeSampleResponse() -> InsightsResponse {
    InsightsResponse(
        serviceBreakdown: [
            ServiceBreakdownItem(serviceName: "Hovvård", count: 10, revenue: 12000),
            ServiceBreakdownItem(serviceName: "Tandvård", count: 3, revenue: 2400),
        ],
        timeHeatmap: [
            TimeHeatmapEntry(day: "Mån", dayIndex: 1, hour: 9, count: 5),
            TimeHeatmapEntry(day: "Mån", dayIndex: 1, hour: 10, count: 3),
            TimeHeatmapEntry(day: "Ons", dayIndex: 3, hour: 9, count: 2),
            TimeHeatmapEntry(day: "Fre", dayIndex: 5, hour: 14, count: 7),
        ],
        customerRetention: [
            CustomerRetentionMonth(month: "jan", newCustomers: 3, returningCustomers: 5),
            CustomerRetentionMonth(month: "feb", newCustomers: 2, returningCustomers: 6),
        ],
        kpis: InsightsKPIs(
            cancellationRate: 15,
            noShowRate: 5,
            averageBookingValue: 1200,
            uniqueCustomers: 18,
            manualBookingRate: 20
        )
    )
}

// MARK: - Tests

@MainActor
final class InsightsViewModelTests: XCTestCase {

    private var fetcher: MockInsightsFetcher!
    private var vm: InsightsViewModel!

    override func setUp() {
        super.setUp()
        SharedDataManager.clearAllInsightsCache()
        fetcher = MockInsightsFetcher()
        vm = InsightsViewModel(fetcher: fetcher)
    }

    // MARK: - Loading

    func testLoadInsightsSuccess() async {
        fetcher.defaultResponse = makeSampleResponse()
        await vm.loadInsights()

        XCTAssertNotNil(vm.response)
        XCTAssertEqual(vm.response?.kpis.uniqueCustomers, 18)
        XCTAssertEqual(vm.response?.serviceBreakdown.count, 2)
        XCTAssertNil(vm.error)
        XCTAssertFalse(vm.isLoading)
    }

    func testLoadInsightsError() async {
        fetcher.shouldThrow = true
        await vm.loadInsights()

        XCTAssertEqual(vm.error, "Kunde inte hämta insikter")
        XCTAssertFalse(vm.isLoading)
    }

    func testRefreshSuccess() async {
        fetcher.defaultResponse = makeEmptyResponse()
        await vm.loadInsights()
        XCTAssertEqual(vm.response?.kpis.uniqueCustomers, 0)

        fetcher.defaultResponse = makeSampleResponse()
        await vm.refresh()

        XCTAssertEqual(vm.response?.kpis.uniqueCustomers, 18)
        XCTAssertNil(vm.error)
    }

    func testRefreshError() async {
        fetcher.defaultResponse = makeSampleResponse()
        await vm.loadInsights()

        fetcher.shouldThrow = true
        await vm.refresh()

        XCTAssertEqual(vm.error, "Kunde inte uppdatera insikter")
    }

    // MARK: - Period Change

    func testChangePeriodFetchesNewData() async {
        fetcher.defaultResponse = makeSampleResponse()
        await vm.loadInsights()
        XCTAssertEqual(fetcher.lastRequestedMonths, 6) // default

        await vm.changePeriod(to: .threeMonths)
        XCTAssertEqual(fetcher.lastRequestedMonths, 3)
        XCTAssertEqual(vm.selectedPeriod, .threeMonths)
    }

    func testDefaultPeriodIsSixMonths() {
        XCTAssertEqual(vm.selectedPeriod, .sixMonths)
    }

    // MARK: - Heatmap Pre-computation

    func testHeatmapMatrixBuiltFromResponse() async {
        fetcher.defaultResponse = makeSampleResponse()
        await vm.loadInsights()

        XCTAssertEqual(vm.heatmapMatrix.days.count, 7)
        XCTAssertFalse(vm.heatmapMatrix.hours.isEmpty)
        XCTAssertEqual(vm.heatmapMatrix.maxCount, 7) // Fre 14:00 has 7
    }

    func testHeatmapMatrixDayOrder() async {
        fetcher.defaultResponse = makeSampleResponse()
        await vm.loadInsights()

        // Swedish day order: Mon first
        XCTAssertEqual(vm.heatmapMatrix.days.first, "Mån")
        XCTAssertEqual(vm.heatmapMatrix.days.last, "Sön")
    }

    func testHeatmapIntensity() async {
        fetcher.defaultResponse = makeSampleResponse()
        await vm.loadInsights()

        // Max count is 7 (Fre 14:00), so intensity = count/7
        // Mån (displayIndex 0), hour 9 has 5 bookings -> intensity 5/7
        let mån9Intensity = vm.heatmapMatrix.intensity(day: 0, hour: 0) // first hour index
        XCTAssertEqual(mån9Intensity, 5.0 / 7.0, accuracy: 0.01)
    }

    func testHeatmapEmptyWhenNoData() async {
        fetcher.defaultResponse = makeEmptyResponse()
        await vm.loadInsights()

        XCTAssertEqual(vm.heatmapMatrix.maxCount, 0)
        XCTAssertTrue(vm.heatmapMatrix.hours.isEmpty)
    }

    // MARK: - HeatmapMatrix Static Method

    func testHeatmapMatrixFromEntries() {
        let entries = [
            TimeHeatmapEntry(day: "Mån", dayIndex: 1, hour: 10, count: 3),
            TimeHeatmapEntry(day: "Sön", dayIndex: 0, hour: 10, count: 1),
        ]
        let matrix = HeatmapMatrix.from(entries: entries)

        // Mon (API dayIndex 1) -> displayIndex 0
        // Sun (API dayIndex 0) -> displayIndex 6
        XCTAssertEqual(matrix.cells[0][0], 3) // Mon, hour 10 (only hour)
        XCTAssertEqual(matrix.cells[6][0], 1) // Sun, hour 10
        XCTAssertEqual(matrix.maxCount, 3)
        XCTAssertEqual(matrix.hours, [10])
    }

    func testHeatmapMatrixEmptyEntries() {
        let matrix = HeatmapMatrix.from(entries: [])
        XCTAssertTrue(matrix.hours.isEmpty)
        XCTAssertEqual(matrix.maxCount, 0)
    }

    // MARK: - Reset

    func testReset() async {
        fetcher.defaultResponse = makeSampleResponse()
        await vm.loadInsights()
        XCTAssertNotNil(vm.response)

        vm.reset()

        XCTAssertNil(vm.response)
        XCTAssertEqual(vm.heatmapMatrix.maxCount, 0)
        XCTAssertNil(vm.error)
        XCTAssertFalse(vm.isLoading)
        XCTAssertEqual(vm.selectedPeriod, .sixMonths)
    }
}
