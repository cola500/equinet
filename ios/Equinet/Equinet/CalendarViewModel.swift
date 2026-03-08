//
//  CalendarViewModel.swift
//  Equinet
//
//  MVVM ViewModel for the native day calendar.
//  Fetches 7-day windows, caches in memory, supports day navigation.
//

import Foundation
import Observation

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

    // MARK: - Private

    private var cache: [String: CalendarResponse] = [:]
    private let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

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
                let response = try await APIClient.shared.fetchCalendar(from: from, to: to)
                cache[cacheKey] = response
                applyResponse(response)

                // Save to offline cache
                SharedDataManager.saveCalendarCache(response, from: from, to: to)
                isOffline = false
            } catch APIError.noToken, APIError.unauthorized {
                error = "Du behöver logga in igen"
            } catch {
                // Try offline cache
                if let cached = SharedDataManager.loadCalendarCache() {
                    applyResponse(cached.response)
                    isOffline = true
                } else {
                    self.error = "Kunde inte hämta kalenderdata"
                }
            }
            isLoading = false
        }
    }

    // MARK: - Helpers

    /// Get bookings for a specific date
    func bookingsForDate(_ date: Date) -> [NativeBooking] {
        let dateString = dateFormatter.string(from: date)
        return bookings.filter { booking in
            // Compare by date string prefix (bookingDate might be ISO 8601 with time)
            booking.bookingDate.hasPrefix(dateString)
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
    }
}
