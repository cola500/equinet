//
//  BookingsViewModel.swift
//  Equinet
//
//  MVVM ViewModel for the native bookings list.
//  Handles filtering, sorting, optimistic UI, and cache-first loading.
//  Dependencies injected via protocol for testability.
//

import Foundation
import OSLog
import Observation
#if os(iOS)
import UIKit
#endif

// MARK: - DI Protocol

@MainActor
protocol BookingsDataFetching: Sendable {
    func fetchBookings(status: String?) async throws -> [BookingsListItem]
    func updateBookingStatus(bookingId: String, newStatus: String, cancellationMessage: String?) async throws
    func createBookingReview(bookingId: String, rating: Int, comment: String?) async throws -> CreateReviewResponse
}

// MARK: - Production Adapter

struct APIBookingsFetcher: BookingsDataFetching {
    func fetchBookings(status: String?) async throws -> [BookingsListItem] {
        try await APIClient.shared.fetchBookings(status: status)
    }

    func updateBookingStatus(bookingId: String, newStatus: String, cancellationMessage: String?) async throws {
        try await APIClient.shared.updateBookingStatus(
            bookingId: bookingId,
            newStatus: newStatus,
            cancellationMessage: cancellationMessage
        )
    }

    func createBookingReview(bookingId: String, rating: Int, comment: String?) async throws -> CreateReviewResponse {
        try await APIClient.shared.createBookingReview(
            bookingId: bookingId,
            rating: rating,
            comment: comment
        )
    }
}

// MARK: - ViewModel

@Observable
@MainActor
final class BookingsViewModel {

    // MARK: - State

    var bookings: [BookingsListItem] = []
    var selectedFilter: BookingFilter = .all
    private(set) var isLoading = false
    private(set) var error: String?
    private(set) var actionInProgress: String?  // booking ID under mutation

    // MARK: - Dependencies

    private let fetcher: BookingsDataFetching

    // MARK: - Init

    init(fetcher: BookingsDataFetching? = nil) {
        self.fetcher = fetcher ?? APIBookingsFetcher()
    }

    // MARK: - Computed

    /// Filtered bookings based on selected filter.
    /// "all" excludes cancelled and no_show (matches web behavior).
    var filteredBookings: [BookingsListItem] {
        let filtered: [BookingsListItem]
        switch selectedFilter {
        case .all:
            filtered = bookings.filter { b in
                b.status != "cancelled" && b.status != "no_show"
            }
        default:
            filtered = bookings.filter { $0.status == selectedFilter.rawValue }
        }

        // Sort: pending first in "all" view, date DESC otherwise
        if selectedFilter == .all {
            return filtered.sorted { a, b in
                if a.status == "pending" && b.status != "pending" { return true }
                if a.status != "pending" && b.status == "pending" { return false }
                return a.bookingDate > b.bookingDate
            }
        }
        return filtered.sorted { $0.bookingDate > $1.bookingDate }
    }

    /// Count of bookings per filter (for badge display)
    var filterCounts: [BookingFilter: Int] {
        var counts: [BookingFilter: Int] = [:]
        counts[.all] = bookings.filter { $0.status != "cancelled" && $0.status != "no_show" }.count
        counts[.pending] = bookings.filter { $0.status == "pending" }.count
        counts[.confirmed] = bookings.filter { $0.status == "confirmed" }.count
        counts[.completed] = bookings.filter { $0.status == "completed" }.count
        counts[.noShow] = bookings.filter { $0.status == "no_show" }.count
        counts[.cancelled] = bookings.filter { $0.status == "cancelled" }.count
        return counts
    }

    // MARK: - Loading

    /// Load bookings with cache-first strategy
    func loadBookings() async {
        // Show cached data immediately
        if bookings.isEmpty, let cache = SharedDataManager.loadBookingsCache() {
            bookings = cache.bookings
        }

        isLoading = bookings.isEmpty
        error = nil

        do {
            let fetched = try await fetcher.fetchBookings(status: nil)
            bookings = fetched
            SharedDataManager.saveBookingsCache(fetched)
            isLoading = false
        } catch {
            isLoading = false
            if bookings.isEmpty {
                self.error = "Kunde inte hämta bokningar"
            }
            AppLogger.network.error("Failed to fetch bookings: \(error.localizedDescription)")
        }
    }

    /// Pull-to-refresh
    func refresh() async {
        error = nil
        do {
            let fetched = try await fetcher.fetchBookings(status: nil)
            bookings = fetched
            SharedDataManager.saveBookingsCache(fetched)
        } catch {
            self.error = "Kunde inte uppdatera bokningar"
            AppLogger.network.error("Failed to refresh bookings: \(error.localizedDescription)")
        }
    }

    // MARK: - Status Actions (Optimistic UI)

    func confirmBooking(id: String) async {
        await updateStatus(id: id, newStatus: "confirmed")
    }

    func declineBooking(id: String) async {
        await updateStatus(id: id, newStatus: "cancelled")
    }

    func completeBooking(id: String) async {
        await updateStatus(id: id, newStatus: "completed")
    }

    func markNoShow(id: String) async {
        await updateStatus(id: id, newStatus: "no_show")
    }

    func cancelBooking(id: String, message: String) async {
        await updateStatus(id: id, newStatus: "cancelled", cancellationMessage: message)
    }

    // MARK: - Review

    func submitReview(bookingId: String, rating: Int, comment: String?) async -> Bool {
        actionInProgress = bookingId
        do {
            let response = try await fetcher.createBookingReview(
                bookingId: bookingId,
                rating: rating,
                comment: comment
            )
            // Update local state with new review
            if let index = bookings.firstIndex(where: { $0.id == bookingId }) {
                let review = BookingReview(id: response.id, rating: response.rating, comment: response.comment)
                bookings[index] = bookings[index].withReview(review)
            }
            actionInProgress = nil
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
            return true
        } catch {
            actionInProgress = nil
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            AppLogger.network.error("Failed to submit review: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - Private

    private func updateStatus(id: String, newStatus: String, cancellationMessage: String? = nil) async {
        guard let index = bookings.firstIndex(where: { $0.id == id }) else { return }

        let oldBooking = bookings[index]
        actionInProgress = id

        // Optimistic update
        bookings[index] = oldBooking.withStatus(newStatus)

        do {
            try await fetcher.updateBookingStatus(
                bookingId: id,
                newStatus: newStatus,
                cancellationMessage: cancellationMessage
            )
            actionInProgress = nil
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
        } catch {
            // Revert on failure
            if let currentIndex = bookings.firstIndex(where: { $0.id == id }) {
                bookings[currentIndex] = oldBooking
            }
            actionInProgress = nil
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            AppLogger.network.error("Failed to update booking status: \(error.localizedDescription)")
        }
    }
}
