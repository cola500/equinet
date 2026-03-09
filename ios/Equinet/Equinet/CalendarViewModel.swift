//
//  CalendarViewModel.swift
//  Equinet
//
//  MVVM ViewModel for the native day calendar.
//  Fetches 7-day windows, caches in memory, supports day navigation.
//  Dependencies are injected via protocols for testability.
//

import Foundation
import OSLog
import Observation
#if os(iOS)
import UIKit
#endif

// MARK: - DI Protocols

@MainActor
protocol CalendarDataFetching: Sendable {
    func fetchCalendar(from: String, to: String) async throws -> CalendarResponse
    func updateBookingStatus(bookingId: String, newStatus: String) async throws
}

@MainActor
protocol CalendarCaching {
    func saveCalendarCache(_ response: CalendarResponse, from: String, to: String)
    func loadCalendarCache() -> SharedDataManager.CalendarCache?
}

@MainActor
protocol CalendarSyncing {
    func syncBookings(_ bookings: [NativeBooking])
    func syncAfterStatusChange(bookingId: String, newStatus: String)
}

// MARK: - Adapters (production defaults)

struct APICalendarFetcher: CalendarDataFetching {
    func fetchCalendar(from: String, to: String) async throws -> CalendarResponse {
        try await APIClient.shared.fetchCalendar(from: from, to: to)
    }

    func updateBookingStatus(bookingId: String, newStatus: String) async throws {
        try await APIClient.shared.updateBookingStatus(bookingId: bookingId, newStatus: newStatus)
    }
}

struct SharedDataCalendarCache: CalendarCaching {
    func saveCalendarCache(_ response: CalendarResponse, from: String, to: String) {
        SharedDataManager.saveCalendarCache(response, from: from, to: to)
    }

    func loadCalendarCache() -> SharedDataManager.CalendarCache? {
        SharedDataManager.loadCalendarCache()
    }
}

struct EventKitCalendarSync: CalendarSyncing {
    func syncBookings(_ bookings: [NativeBooking]) {
        CalendarSyncManager.shared.syncBookings(bookings)
    }

    func syncAfterStatusChange(bookingId: String, newStatus: String) {
        CalendarSyncManager.shared.syncAfterStatusChange(bookingId: bookingId, newStatus: newStatus)
    }
}

// MARK: - ViewModel

@Observable
@MainActor
final class CalendarViewModel {

    // MARK: - Published state

    var selectedDate: Date = .now
    var bookings: [NativeBooking] = []
    var availability: [NativeAvailability] = []
    var exceptions: [NativeException] = []
    var isLoading = false
    var error: String?
    var isOffline = false
    var actionInProgress: String?
    var selectedServiceFilter: String?

    // MARK: - Dependencies

    private let fetcher: CalendarDataFetching
    private let cacheProvider: CalendarCaching
    private let sync: CalendarSyncing

    // MARK: - Private

    private var cache: [String: CalendarResponse] = [:]
    private let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    // MARK: - Init

    init(
        fetcher: CalendarDataFetching? = nil,
        cache: CalendarCaching? = nil,
        sync: CalendarSyncing? = nil
    ) {
        self.fetcher = fetcher ?? APICalendarFetcher()
        self.cacheProvider = cache ?? SharedDataCalendarCache()
        self.sync = sync ?? EventKitCalendarSync()
    }

    // MARK: - Computed

    /// Unique services from current bookings, for filter pills
    var availableServices: [(id: String, name: String)] {
        var seen = Set<String>()
        return bookings.compactMap { booking in
            guard let serviceId = booking.serviceId, !seen.contains(serviceId) else { return nil }
            seen.insert(serviceId)
            return (id: serviceId, name: booking.serviceName)
        }
    }

    // MARK: - Public API

    /// Navigate to a specific day and load data
    func navigateToDay(_ date: Date) {
        selectedDate = date
        loadDataForSelectedDate()
    }

    /// Jump to today
    func goToToday() {
        navigateToDay(.now)
    }

    /// Refresh data (pull-to-refresh or manual)
    func refresh() {
        // Clear cache for current window to force re-fetch
        let (from, to) = windowDates(for: selectedDate)
        let cacheKey = "\(from)_\(to)"
        cache.removeValue(forKey: cacheKey)
        loadDataForSelectedDate()
    }

    /// Load data for the currently selected date
    func loadDataForSelectedDate() {
        let (from, to) = windowDates(for: selectedDate)
        let cacheKey = "\(from)_\(to)"

        // Use cache if available
        if let cached = cache[cacheKey] {
            applyResponse(cached)
            return
        }

        // Fetch from API
        isLoading = true
        error = nil

        Task {
            do {
                let response = try await fetcher.fetchCalendar(from: from, to: to)
                cache[cacheKey] = response
                applyResponse(response)

                // Save to offline cache
                cacheProvider.saveCalendarCache(response, from: from, to: to)
                isOffline = false
            } catch APIError.noToken, APIError.unauthorized {
                error = "Du behöver logga in igen"
            } catch APIError.rateLimited(let retryAfter) {
                if let seconds = retryAfter {
                    error = "För många förfrågningar, försök igen om \(seconds) sekunder"
                } else {
                    error = "För många förfrågningar, vänta en stund"
                }
            } catch APIError.timeout {
                // Try offline cache on timeout
                if let cached = cacheProvider.loadCalendarCache() {
                    applyResponse(cached.response)
                    isOffline = true
                } else {
                    error = "Anslutningen tog för lång tid"
                }
            } catch APIError.serverError(let code) {
                AppLogger.calendar.error("Server error \(code) fetching calendar")
                if let cached = cacheProvider.loadCalendarCache() {
                    applyResponse(cached.response)
                    isOffline = true
                } else {
                    error = "Serverfel, försök igen senare"
                }
            } catch {
                // Try offline cache for network errors
                if let cached = cacheProvider.loadCalendarCache() {
                    applyResponse(cached.response)
                    isOffline = true
                } else {
                    self.error = "Kunde inte hämta kalenderdata"
                }
            }
            isLoading = false
        }
    }

    /// Update booking status with optimistic UI and offline fallback
    func updateBookingStatus(bookingId: String, newStatus: String) {
        guard actionInProgress == nil else { return }

        // Save old status for rollback
        guard let index = bookings.firstIndex(where: { $0.id == bookingId }) else { return }
        let oldStatus = bookings[index].status

        // Optimistic update
        bookings[index] = bookings[index].withStatus(newStatus)
        actionInProgress = bookingId

        Task {
            do {
                try await fetcher.updateBookingStatus(bookingId: bookingId, newStatus: newStatus)
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                sync.syncAfterStatusChange(bookingId: bookingId, newStatus: newStatus)

                // Invalidate cache to pick up changes on next fetch
                cache.removeAll()
            } catch {
                // Revert on failure
                if let idx = bookings.firstIndex(where: { $0.id == bookingId }) {
                    bookings[idx] = bookings[idx].withStatus(oldStatus)
                }
                UINotificationFeedbackGenerator().notificationOccurred(.error)
                AppLogger.calendar.error("Failed to update booking status: \(error.localizedDescription)")

                // Save for offline retry
                PendingActionStore.save(bookingId: bookingId, status: newStatus)
            }
            actionInProgress = nil
        }
    }

    // MARK: - Helpers

    /// Get bookings for a specific date, optionally filtered by service
    func bookingsForDate(_ date: Date) -> [NativeBooking] {
        let dateString = dateFormatter.string(from: date)
        return bookings.filter { booking in
            let matchesDate = booking.bookingDate.hasPrefix(dateString)
            let matchesService = selectedServiceFilter == nil || booking.serviceId == selectedServiceFilter
            return matchesDate && matchesService
        }
    }

    /// Get availability for a specific weekday (0=Monday, 6=Sunday)
    func availabilityForWeekday(_ weekday: Int) -> NativeAvailability? {
        availability.first { $0.dayOfWeek == weekday }
    }

    /// Get exception for a specific date
    func exceptionForDate(_ date: Date) -> NativeException? {
        let dateString = dateFormatter.string(from: date)
        return exceptions.first { $0.date.hasPrefix(dateString) }
    }

    /// Calculate 7-day window: selected date +/- 3 days
    private func windowDates(for date: Date) -> (from: String, to: String) {
        let calendar = Calendar.current
        let from = calendar.date(byAdding: .day, value: -3, to: date)!
        let to = calendar.date(byAdding: .day, value: 3, to: date)!
        return (dateFormatter.string(from: from), dateFormatter.string(from: to))
    }

    private func applyResponse(_ response: CalendarResponse) {
        bookings = response.bookings
        availability = response.availability
        exceptions = response.exceptions

        // Sync confirmed bookings to iOS Calendar if enabled
        sync.syncBookings(response.bookings)
    }
}
