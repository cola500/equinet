//
//  BookingDetailViewModelTests.swift
//  EquinetTests
//
//  Tests for booking detail view actions via BookingsViewModel.
//  Verifies that all actions work correctly and optimistic UI is applied/reverted.
//

@testable import Equinet
import XCTest

@MainActor
final class BookingDetailViewModelTests: XCTestCase {

    private var fetcher: MockBookingsFetcher!
    private var viewModel: BookingsViewModel!

    override func setUp() {
        super.setUp()
        SharedDataManager.clearBookingsCache()
        fetcher = MockBookingsFetcher()
        viewModel = BookingsViewModel(fetcher: fetcher)
    }

    // MARK: - Helpers

    private func makeDetailBooking(
        id: String = "b1",
        status: String = "pending",
        providerNotes: String? = nil
    ) -> BookingsListItem {
        BookingsListItem(
            id: id,
            bookingDate: "2026-05-10",
            startTime: "09:00",
            endTime: "10:00",
            status: status,
            serviceName: "Ridlektion",
            servicePrice: 500,
            customerFirstName: "Emma",
            customerLastName: "Eriksson",
            customerEmail: "emma@example.com",
            customerPhone: "070-9876543",
            horseName: "Storm",
            horseId: "h1",
            horseBreed: "Arabiskt fullblod",
            isPaid: false,
            invoiceNumber: nil,
            isManualBooking: false,
            bookingSeriesId: nil,
            customerNotes: "Hälsning från kunden",
            providerNotes: providerNotes,
            cancellationMessage: nil,
            customerReview: nil
        )
    }

    // MARK: - Confirm (pending -> confirmed)

    func testConfirmBookingUpdatesStatusOptimistically() async {
        let booking = makeDetailBooking(id: "b1", status: "pending")
        viewModel.bookings = [booking]
        fetcher.updateResult = .success(())

        await viewModel.confirmBooking(id: "b1")

        XCTAssertEqual(viewModel.bookings.first?.status, "confirmed")
    }

    func testConfirmBookingRevertsOnAPIError() async {
        let booking = makeDetailBooking(id: "b1", status: "pending")
        viewModel.bookings = [booking]
        fetcher.updateResult = .failure(NSError(domain: "test", code: 500))

        await viewModel.confirmBooking(id: "b1")

        XCTAssertEqual(viewModel.bookings.first?.status, "pending")
    }

    // MARK: - Complete (confirmed -> completed)

    func testCompleteBookingUpdatesStatus() async {
        let booking = makeDetailBooking(id: "b1", status: "confirmed")
        viewModel.bookings = [booking]
        fetcher.updateResult = .success(())

        await viewModel.completeBooking(id: "b1")

        XCTAssertEqual(viewModel.bookings.first?.status, "completed")
    }

    func testCompleteBookingRevertsOnError() async {
        let booking = makeDetailBooking(id: "b1", status: "confirmed")
        viewModel.bookings = [booking]
        fetcher.updateResult = .failure(NSError(domain: "test", code: 500))

        await viewModel.completeBooking(id: "b1")

        XCTAssertEqual(viewModel.bookings.first?.status, "confirmed")
    }

    // MARK: - Cancel (with message)

    func testCancelBookingUpdatesStatus() async {
        let booking = makeDetailBooking(id: "b1", status: "confirmed")
        viewModel.bookings = [booking]
        fetcher.updateResult = .success(())

        await viewModel.cancelBooking(id: "b1", message: "Förhinder")

        XCTAssertEqual(viewModel.bookings.first?.status, "cancelled")
    }

    func testCancelBookingPassesMessageToAPI() async {
        let booking = makeDetailBooking(id: "b1", status: "confirmed")
        viewModel.bookings = [booking]

        await viewModel.cancelBooking(id: "b1", message: "Sjukdom")

        XCTAssertEqual(fetcher.updateCalls.first?.cancellationMessage, "Sjukdom")
    }

    func testCancelBookingRevertsOnError() async {
        let booking = makeDetailBooking(id: "b1", status: "confirmed")
        viewModel.bookings = [booking]
        fetcher.updateResult = .failure(NSError(domain: "test", code: 500))

        await viewModel.cancelBooking(id: "b1", message: "")

        XCTAssertEqual(viewModel.bookings.first?.status, "confirmed")
    }

    // MARK: - No Show

    func testMarkNoShowUpdatesStatus() async {
        let booking = makeDetailBooking(id: "b1", status: "confirmed")
        viewModel.bookings = [booking]
        fetcher.updateResult = .success(())

        await viewModel.markNoShow(id: "b1")

        XCTAssertEqual(viewModel.bookings.first?.status, "no_show")
    }

    func testMarkNoShowRevertsOnError() async {
        let booking = makeDetailBooking(id: "b1", status: "confirmed")
        viewModel.bookings = [booking]
        fetcher.updateResult = .failure(NSError(domain: "test", code: 503))

        await viewModel.markNoShow(id: "b1")

        XCTAssertEqual(viewModel.bookings.first?.status, "confirmed")
    }

    // MARK: - Decline (pending -> cancelled)

    func testDeclineBookingUpdatesStatus() async {
        let booking = makeDetailBooking(id: "b1", status: "pending")
        viewModel.bookings = [booking]
        fetcher.updateResult = .success(())

        await viewModel.declineBooking(id: "b1")

        XCTAssertEqual(viewModel.bookings.first?.status, "cancelled")
    }

    func testDeclineBookingRevertsOnError() async {
        let booking = makeDetailBooking(id: "b1", status: "pending")
        viewModel.bookings = [booking]
        fetcher.updateResult = .failure(NSError(domain: "test", code: 500))

        await viewModel.declineBooking(id: "b1")

        XCTAssertEqual(viewModel.bookings.first?.status, "pending")
    }

    // MARK: - Submit Review

    func testSubmitReviewAddsReviewToBooking() async {
        let booking = makeDetailBooking(id: "b1", status: "completed")
        viewModel.bookings = [booking]
        fetcher.reviewResult = .success(CreateReviewResponse(id: "rev1", rating: 5, comment: "Utmärkt"))

        let success = await viewModel.submitReview(bookingId: "b1", rating: 5, comment: "Utmärkt")

        XCTAssertTrue(success)
        XCTAssertNotNil(viewModel.bookings.first?.customerReview)
        XCTAssertEqual(viewModel.bookings.first?.customerReview?.rating, 5)
    }

    // MARK: - Quick Note

    func testSaveQuickNoteUpdatesProviderNotes() async {
        let booking = makeDetailBooking(id: "b1", status: "confirmed")
        viewModel.bookings = [booking]
        fetcher.quickNoteResult = .success(QuickNoteResponse(providerNotes: "Notera allergier"))

        await viewModel.saveQuickNote(bookingId: "b1", text: "Notera allergier")

        XCTAssertEqual(viewModel.bookings.first?.providerNotes, "Notera allergier")
    }

    // MARK: - Live data for detail view

    func testDetailViewReflectsOptimisticUpdate() async {
        let booking = makeDetailBooking(id: "b1", status: "pending")
        viewModel.bookings = [booking]
        fetcher.updateResult = .success(())

        await viewModel.confirmBooking(id: "b1")

        let found = viewModel.bookings.first { $0.id == "b1" }
        XCTAssertEqual(found?.status, "confirmed")
    }
}
