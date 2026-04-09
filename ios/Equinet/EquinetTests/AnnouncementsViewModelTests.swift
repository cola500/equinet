//
//  AnnouncementsViewModelTests.swift
//  EquinetTests
//
//  Tests for AnnouncementsViewModel: loading, cancel, computed filters.
//

import XCTest
@testable import Equinet

// MARK: - Mock Fetcher

@MainActor
final class MockAnnouncementsFetcher: AnnouncementsDataFetching {
    var announcementsToReturn: [AnnouncementItem] = []
    var shouldThrow = false
    var lastCancelledId: String?
    var cancelCallCount = 0

    func fetchAnnouncements() async throws -> [AnnouncementItem] {
        if shouldThrow { throw APIError.serverError(500) }
        return announcementsToReturn
    }

    func cancelAnnouncement(id: String) async throws {
        if shouldThrow { throw APIError.serverError(500) }
        lastCancelledId = id
        cancelCallCount += 1
        // Simulate server: remove cancelled announcement from future fetches
        announcementsToReturn = announcementsToReturn.map { ann in
            if ann.id == id {
                return makeAnnouncementItem(id: ann.id, status: "cancelled")
            }
            return ann
        }
    }

    func createAnnouncement(_ request: CreateAnnouncementRequest) async throws -> AnnouncementItem {
        if shouldThrow { throw APIError.serverError(500) }
        return makeAnnouncementItem(id: "new-ann", status: "open")
    }

    func fetchAnnouncementDetail(id: String) async throws -> AnnouncementDetailResponse {
        if shouldThrow { throw APIError.serverError(500) }
        return AnnouncementDetailResponse(
            announcement: AnnouncementDetailInfo(
                id: id, serviceType: "Test", municipality: "Stockholm",
                dateFrom: "2026-04-10T00:00:00.000Z", dateTo: "2026-04-17T00:00:00.000Z",
                status: "open", specialInstructions: nil,
                createdAt: "2026-04-09T00:00:00.000Z",
                services: [AnnouncementService(id: "s1", name: "Test")]
            ),
            bookings: [],
            summary: AnnouncementSummary(total: 0, pending: 0, confirmed: 0)
        )
    }

    func updateAnnouncementBookingStatus(announcementId: String, bookingId: String, status: String) async throws -> BookingStatusUpdateResponse {
        if shouldThrow { throw APIError.serverError(500) }
        return BookingStatusUpdateResponse(id: bookingId, status: status)
    }
}

// MARK: - Test Helpers

@MainActor
func makeAnnouncementItem(
    id: String = "ann-1",
    serviceType: String = "Hovslagning",
    municipality: String? = "Alingsås",
    dateFrom: String = "2026-04-10T00:00:00.000Z",
    dateTo: String = "2026-04-12T00:00:00.000Z",
    status: String = "open",
    specialInstructions: String? = nil,
    createdAt: String = "2026-04-01T10:00:00.000Z",
    routeStops: [AnnouncementRouteStop] = [],
    services: [AnnouncementService] = [AnnouncementService(id: "svc-1", name: "Hovverkning")],
    bookingCount: Int = 0
) -> AnnouncementItem {
    AnnouncementItem(
        id: id,
        serviceType: serviceType,
        municipality: municipality,
        dateFrom: dateFrom,
        dateTo: dateTo,
        status: status,
        specialInstructions: specialInstructions,
        createdAt: createdAt,
        routeStops: routeStops,
        services: services,
        bookingCount: bookingCount
    )
}

// MARK: - Tests

@MainActor
final class AnnouncementsViewModelTests: XCTestCase {

    private var fetcher: MockAnnouncementsFetcher!
    private var vm: AnnouncementsViewModel!

    override func setUp() {
        super.setUp()
        SharedDataManager.clearAnnouncementsCache()
        fetcher = MockAnnouncementsFetcher()
        vm = AnnouncementsViewModel(fetcher: fetcher)
    }

    // MARK: - Loading

    func testLoadAnnouncementsSuccess() async {
        fetcher.announcementsToReturn = [
            makeAnnouncementItem(),
            makeAnnouncementItem(id: "ann-2", status: "completed"),
        ]

        await vm.loadAnnouncements()

        XCTAssertEqual(vm.announcements.count, 2)
        XCTAssertNil(vm.error)
        XCTAssertFalse(vm.isLoading)
    }

    func testLoadAnnouncementsError() async {
        fetcher.shouldThrow = true

        await vm.loadAnnouncements()

        XCTAssertEqual(vm.error, "Kunde inte hämta annonser")
        XCTAssertFalse(vm.isLoading)
    }

    func testRefreshSuccess() async {
        fetcher.announcementsToReturn = [makeAnnouncementItem()]
        await vm.loadAnnouncements()
        XCTAssertEqual(vm.announcements.count, 1)

        fetcher.announcementsToReturn = [
            makeAnnouncementItem(),
            makeAnnouncementItem(id: "ann-2"),
        ]
        await vm.refresh()

        XCTAssertEqual(vm.announcements.count, 2)
        XCTAssertNil(vm.error)
    }

    func testRefreshError() async {
        fetcher.announcementsToReturn = [makeAnnouncementItem()]
        await vm.loadAnnouncements()

        fetcher.shouldThrow = true
        await vm.refresh()

        XCTAssertEqual(vm.error, "Kunde inte uppdatera annonser")
    }

    // MARK: - Cancel

    func testCancelAnnouncementSuccess() async {
        fetcher.announcementsToReturn = [makeAnnouncementItem()]
        await vm.loadAnnouncements()

        let result = await vm.cancelAnnouncement(id: "ann-1")

        XCTAssertTrue(result)
        XCTAssertEqual(fetcher.lastCancelledId, "ann-1")
        XCTAssertFalse(vm.actionInProgress)
        // After cancel + reload, the item should be "cancelled"
        XCTAssertEqual(vm.announcements.first?.status, "cancelled")
    }

    func testCancelAnnouncementFailure() async {
        fetcher.announcementsToReturn = [makeAnnouncementItem()]
        await vm.loadAnnouncements()

        fetcher.shouldThrow = true
        let result = await vm.cancelAnnouncement(id: "ann-1")

        XCTAssertFalse(result)
        XCTAssertFalse(vm.actionInProgress)
        // Should revert to original
        XCTAssertEqual(vm.announcements.first?.status, "open")
    }

    // MARK: - Computed Filters

    func testOpenAnnouncements() async {
        fetcher.announcementsToReturn = [
            makeAnnouncementItem(id: "ann-1", status: "open"),
            makeAnnouncementItem(id: "ann-2", status: "completed"),
            makeAnnouncementItem(id: "ann-3", status: "cancelled"),
        ]
        await vm.loadAnnouncements()

        XCTAssertEqual(vm.openAnnouncements.count, 1)
        XCTAssertEqual(vm.openAnnouncements.first?.id, "ann-1")
    }

    func testClosedAnnouncements() async {
        fetcher.announcementsToReturn = [
            makeAnnouncementItem(id: "ann-1", status: "open"),
            makeAnnouncementItem(id: "ann-2", status: "completed"),
            makeAnnouncementItem(id: "ann-3", status: "cancelled"),
        ]
        await vm.loadAnnouncements()

        XCTAssertEqual(vm.closedAnnouncements.count, 2)
    }

    // MARK: - Reset

    func testReset() async {
        fetcher.announcementsToReturn = [makeAnnouncementItem()]
        await vm.loadAnnouncements()
        XCTAssertEqual(vm.announcements.count, 1)

        vm.reset()

        XCTAssertEqual(vm.announcements.count, 0)
        XCTAssertNil(vm.error)
        XCTAssertFalse(vm.isLoading)
        XCTAssertFalse(vm.actionInProgress)
        XCTAssertNil(vm.announcementToCancel)
    }

    // MARK: - Model Computed Properties

    func testStatusLabel() {
        XCTAssertEqual(makeAnnouncementItem(status: "open").statusLabel, "Öppen")
        XCTAssertEqual(makeAnnouncementItem(status: "in_route").statusLabel, "På rutt")
        XCTAssertEqual(makeAnnouncementItem(status: "completed").statusLabel, "Avslutad")
        XCTAssertEqual(makeAnnouncementItem(status: "cancelled").statusLabel, "Avbruten")
    }

    func testLocationSummary() {
        // Municipality takes precedence
        let withMunicipality = makeAnnouncementItem(municipality: "Göteborg")
        XCTAssertEqual(withMunicipality.locationSummary, "Göteborg")

        // Falls back to first route stop
        let withStop = makeAnnouncementItem(
            municipality: nil,
            routeStops: [AnnouncementRouteStop(id: "s1", stopOrder: 1, locationName: "Centrum", address: "Gatan 1")]
        )
        XCTAssertEqual(withStop.locationSummary, "Centrum")

        // Falls back to "Okänd plats"
        let empty = makeAnnouncementItem(municipality: nil, routeStops: [])
        XCTAssertEqual(empty.locationSummary, "Okänd plats")
    }

    func testIsOpen() {
        XCTAssertTrue(makeAnnouncementItem(status: "open").isOpen)
        XCTAssertFalse(makeAnnouncementItem(status: "completed").isOpen)
    }
}
