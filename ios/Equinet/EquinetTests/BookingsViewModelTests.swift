//
//  BookingsViewModelTests.swift
//  EquinetTests
//
//  Tests for BookingsViewModel using mock dependencies.
//

@testable import Equinet
import XCTest

// MARK: - Mock

final class MockBookingsFetcher: BookingsDataFetching, @unchecked Sendable {
    var fetchResult: Result<[BookingsListItem], Error> = .success([])
    var updateResult: Result<Void, Error> = .success(())
    var reviewResult: Result<CreateReviewResponse, Error> = .success(
        CreateReviewResponse(id: "r1", rating: 4, comment: nil)
    )
    var fetchCallCount = 0
    var updateCalls: [(bookingId: String, newStatus: String, cancellationMessage: String?)] = []
    var reviewCalls: [(bookingId: String, rating: Int, comment: String?)] = []

    func fetchBookings(status: String?) async throws -> [BookingsListItem] {
        fetchCallCount += 1
        return try fetchResult.get()
    }

    func updateBookingStatus(bookingId: String, newStatus: String, cancellationMessage: String?) async throws {
        updateCalls.append((bookingId, newStatus, cancellationMessage))
        try updateResult.get()
    }

    func createBookingReview(bookingId: String, rating: Int, comment: String?) async throws -> CreateReviewResponse {
        reviewCalls.append((bookingId, rating, comment))
        return try reviewResult.get()
    }
}

// MARK: - Test Helpers

private func makeBooking(
    id: String = "b1",
    status: String = "confirmed",
    date: String = "2026-03-14",
    customerFirstName: String = "Anna",
    customerLastName: String = "Andersson",
    review: BookingReview? = nil
) -> BookingsListItem {
    BookingsListItem(
        id: id,
        bookingDate: date,
        startTime: "10:00",
        endTime: "11:00",
        status: status,
        serviceName: "Ridlektion",
        servicePrice: 450,
        customerFirstName: customerFirstName,
        customerLastName: customerLastName,
        customerEmail: "anna@example.com",
        customerPhone: "070-1234567",
        horseName: "Blansen",
        horseBreed: "Halvblod",
        isPaid: false,
        invoiceNumber: nil,
        isManualBooking: false,
        bookingSeriesId: nil,
        customerNotes: nil,
        providerNotes: nil,
        cancellationMessage: nil,
        customerReview: review
    )
}

// MARK: - Tests

@MainActor
final class BookingsViewModelTests: XCTestCase {

    private var fetcher: MockBookingsFetcher!
    private var viewModel: BookingsViewModel!

    override func setUp() {
        super.setUp()
        SharedDataManager.clearBookingsCache()
        fetcher = MockBookingsFetcher()
        viewModel = BookingsViewModel(fetcher: fetcher)
    }

    // MARK: - Filtering

    func testFilterAllExcludesCancelledAndNoShow() {
        let bookings = [
            makeBooking(id: "b1", status: "pending"),
            makeBooking(id: "b2", status: "confirmed"),
            makeBooking(id: "b3", status: "completed"),
            makeBooking(id: "b4", status: "cancelled"),
            makeBooking(id: "b5", status: "no_show"),
        ]
        viewModel.bookings = bookings
        viewModel.selectedFilter = .all

        let filtered = viewModel.filteredBookings
        XCTAssertEqual(filtered.count, 3)
        XCTAssertFalse(filtered.contains { $0.status == "cancelled" })
        XCTAssertFalse(filtered.contains { $0.status == "no_show" })
    }

    func testFilterPendingReturnsOnlyPending() {
        let bookings = [
            makeBooking(id: "b1", status: "pending"),
            makeBooking(id: "b2", status: "confirmed"),
        ]
        viewModel.bookings = bookings
        viewModel.selectedFilter = .pending

        XCTAssertEqual(viewModel.filteredBookings.count, 1)
        XCTAssertEqual(viewModel.filteredBookings.first?.id, "b1")
    }

    func testFilterCancelledReturnsOnlyCancelled() {
        let bookings = [
            makeBooking(id: "b1", status: "pending"),
            makeBooking(id: "b2", status: "cancelled"),
        ]
        viewModel.bookings = bookings
        viewModel.selectedFilter = .cancelled

        XCTAssertEqual(viewModel.filteredBookings.count, 1)
        XCTAssertEqual(viewModel.filteredBookings.first?.id, "b2")
    }

    // MARK: - Sorting

    func testAllFilterSortsPendingFirst() {
        let bookings = [
            makeBooking(id: "b1", status: "confirmed", date: "2026-03-15"),
            makeBooking(id: "b2", status: "pending", date: "2026-03-10"),
            makeBooking(id: "b3", status: "completed", date: "2026-03-20"),
        ]
        viewModel.bookings = bookings
        viewModel.selectedFilter = .all

        let filtered = viewModel.filteredBookings
        XCTAssertEqual(filtered.first?.id, "b2")  // pending first
    }

    func testSpecificFilterSortsDateDescending() {
        let bookings = [
            makeBooking(id: "b1", status: "confirmed", date: "2026-03-10"),
            makeBooking(id: "b2", status: "confirmed", date: "2026-03-20"),
            makeBooking(id: "b3", status: "confirmed", date: "2026-03-15"),
        ]
        viewModel.bookings = bookings
        viewModel.selectedFilter = .confirmed

        let filtered = viewModel.filteredBookings
        XCTAssertEqual(filtered[0].id, "b2")  // newest first
        XCTAssertEqual(filtered[1].id, "b3")
        XCTAssertEqual(filtered[2].id, "b1")
    }

    // MARK: - Filter Counts

    func testFilterCountsAreCorrect() {
        let bookings = [
            makeBooking(id: "b1", status: "pending"),
            makeBooking(id: "b2", status: "pending"),
            makeBooking(id: "b3", status: "confirmed"),
            makeBooking(id: "b4", status: "completed"),
            makeBooking(id: "b5", status: "cancelled"),
            makeBooking(id: "b6", status: "no_show"),
        ]
        viewModel.bookings = bookings

        let counts = viewModel.filterCounts
        XCTAssertEqual(counts[.all], 4)  // excludes cancelled + no_show
        XCTAssertEqual(counts[.pending], 2)
        XCTAssertEqual(counts[.confirmed], 1)
        XCTAssertEqual(counts[.completed], 1)
        XCTAssertEqual(counts[.cancelled], 1)
        XCTAssertEqual(counts[.noShow], 1)
    }

    // MARK: - Optimistic UI

    func testConfirmBookingUpdatesStatusOptimistically() async {
        let bookings = [makeBooking(id: "b1", status: "pending")]
        viewModel.bookings = bookings

        await viewModel.confirmBooking(id: "b1")

        XCTAssertEqual(viewModel.bookings.first?.status, "confirmed")
        XCTAssertEqual(fetcher.updateCalls.count, 1)
        XCTAssertEqual(fetcher.updateCalls.first?.newStatus, "confirmed")
    }

    func testOptimisticUpdateRevertsOnError() async {
        let bookings = [makeBooking(id: "b1", status: "pending")]
        viewModel.bookings = bookings
        fetcher.updateResult = .failure(NSError(domain: "test", code: 500))

        await viewModel.confirmBooking(id: "b1")

        XCTAssertEqual(viewModel.bookings.first?.status, "pending")  // reverted
    }

    func testCancelBookingIncludesMessage() async {
        let bookings = [makeBooking(id: "b1", status: "confirmed")]
        viewModel.bookings = bookings

        await viewModel.cancelBooking(id: "b1", message: "Kunden avbokade")

        XCTAssertEqual(fetcher.updateCalls.first?.cancellationMessage, "Kunden avbokade")
        XCTAssertEqual(viewModel.bookings.first?.status, "cancelled")
    }

    // MARK: - Review

    func testSubmitReviewUpdatesBooking() async {
        let bookings = [makeBooking(id: "b1", status: "completed")]
        viewModel.bookings = bookings
        fetcher.reviewResult = .success(CreateReviewResponse(id: "r1", rating: 4, comment: "Bra"))

        let success = await viewModel.submitReview(bookingId: "b1", rating: 4, comment: "Bra")

        XCTAssertTrue(success)
        XCTAssertNotNil(viewModel.bookings.first?.customerReview)
        XCTAssertEqual(viewModel.bookings.first?.customerReview?.rating, 4)
    }

    func testSubmitReviewReturnsFalseOnError() async {
        let bookings = [makeBooking(id: "b1", status: "completed")]
        viewModel.bookings = bookings
        fetcher.reviewResult = .failure(NSError(domain: "test", code: 500))

        let success = await viewModel.submitReview(bookingId: "b1", rating: 4, comment: nil)

        XCTAssertFalse(success)
        XCTAssertNil(viewModel.bookings.first?.customerReview)
    }

    // MARK: - Loading

    func testLoadBookingsFetchesFromAPI() async {
        let bookings = [makeBooking(id: "b1")]
        fetcher.fetchResult = .success(bookings)

        await viewModel.loadBookings()

        XCTAssertEqual(viewModel.bookings.count, 1)
        XCTAssertEqual(fetcher.fetchCallCount, 1)
        XCTAssertFalse(viewModel.isLoading)
    }

    func testLoadBookingsSetsErrorOnFailure() async {
        fetcher.fetchResult = .failure(NSError(domain: "test", code: 500))

        await viewModel.loadBookings()

        XCTAssertNotNil(viewModel.error)
        XCTAssertFalse(viewModel.isLoading)
    }

    // MARK: - Model helpers

    func testWithStatusCreatesNewBooking() {
        let booking = makeBooking(id: "b1", status: "pending")
        let updated = booking.withStatus("confirmed")

        XCTAssertEqual(updated.status, "confirmed")
        XCTAssertEqual(updated.id, "b1")
        XCTAssertEqual(updated.serviceName, "Ridlektion")
    }

    func testCustomerFullName() {
        let booking = makeBooking(customerFirstName: "Anna", customerLastName: "Svensson")
        XCTAssertEqual(booking.customerFullName, "Anna Svensson")
    }
}
