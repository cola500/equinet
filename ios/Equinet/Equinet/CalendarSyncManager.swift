//
//  CalendarSyncManager.swift
//  Equinet
//
//  Syncs confirmed bookings to iOS Calendar app via EventKit.
//  Uses a dedicated "Equinet" calendar and maintains a mapping
//  from bookingId -> EKEvent identifier in App Group UserDefaults.
//

import EventKit
import Foundation
import Observation

@MainActor
@Observable
final class CalendarSyncManager {
    static let shared = CalendarSyncManager()

    // MARK: - State

    private(set) var isEnabled = false
    private(set) var lastSyncDate: Date?
    private(set) var syncedCount = 0

    // MARK: - Private

    private let eventStore = EKEventStore()
    private let stockholmTimeZone = TimeZone(identifier: "Europe/Stockholm")!
    private let brandColor = CGColor(red: 34 / 255, green: 139 / 255, blue: 34 / 255, alpha: 1) // Forest green

    private init() {
        isEnabled = SharedDataManager.calendarSyncEnabled
    }

    // MARK: - Permission

    /// Request full calendar access (iOS 17+)
    func requestAccess() async -> Bool {
        do {
            let granted = try await eventStore.requestFullAccessToEvents()
            if granted {
                isEnabled = true
                SharedDataManager.calendarSyncEnabled = true
            }
            return granted
        } catch {
            print("[CalendarSync] Permission request failed: \(error)")
            return false
        }
    }

    // MARK: - Sync

    /// Sync bookings to iOS Calendar. Only confirmed bookings are synced.
    func syncBookings(_ bookings: [NativeBooking]) {
        guard isEnabled else { return }

        do {
            let calendar = try getOrCreateEquinetCalendar()
            var mapping = SharedDataManager.calendarSyncMapping
            var processedIds = Set<String>()

            // Process confirmed bookings
            let confirmedBookings = bookings.filter { $0.status == "confirmed" }

            for booking in confirmedBookings {
                processedIds.insert(booking.id)

                if let existingIdentifier = mapping[booking.id],
                   let existingEvent = eventStore.event(withIdentifier: existingIdentifier) {
                    // Update existing event
                    updateEvent(existingEvent, from: booking, calendar: calendar)
                } else {
                    // Create new event
                    let event = EKEvent(eventStore: eventStore)
                    updateEvent(event, from: booking, calendar: calendar)
                    mapping[booking.id] = event.eventIdentifier
                }
            }

            // Remove events for bookings that are no longer confirmed
            // (cancelled, completed, or no longer in the window)
            let bookingIds = Set(bookings.map(\.id))
            for (bookingId, eventIdentifier) in mapping {
                // Only remove if the booking is in the current data set but not confirmed,
                // OR if it's a confirmed booking that no longer exists
                let isInCurrentData = bookingIds.contains(bookingId)
                let isStillConfirmed = processedIds.contains(bookingId)

                if isInCurrentData && !isStillConfirmed {
                    if let event = eventStore.event(withIdentifier: eventIdentifier) {
                        try eventStore.remove(event, span: .thisEvent)
                    }
                    mapping.removeValue(forKey: bookingId)
                }
            }

            // Commit all changes at once
            try eventStore.commit()

            SharedDataManager.calendarSyncMapping = mapping
            lastSyncDate = Date()
            syncedCount = processedIds.count
        } catch {
            print("[CalendarSync] Sync failed: \(error)")
            eventStore.reset()
        }
    }

    /// Sync after a single booking status change (from push action)
    func syncAfterStatusChange(bookingId: String, newStatus: String) {
        guard isEnabled else { return }

        var mapping = SharedDataManager.calendarSyncMapping

        if newStatus != "confirmed" {
            // Remove the event if it exists
            if let eventIdentifier = mapping[bookingId],
               let event = eventStore.event(withIdentifier: eventIdentifier) {
                do {
                    try eventStore.remove(event, span: .thisEvent)
                    try eventStore.commit()
                    mapping.removeValue(forKey: bookingId)
                    SharedDataManager.calendarSyncMapping = mapping
                } catch {
                    print("[CalendarSync] Failed to remove event: \(error)")
                    eventStore.reset()
                }
            }
        }
        // For "confirmed", the full sync will pick it up on next calendar load
    }

    /// Remove all synced events and clear mappings (called on logout)
    func removeAllSyncedEvents() {
        guard let calendarId = SharedDataManager.equinetCalendarIdentifier,
              let calendar = eventStore.calendar(withIdentifier: calendarId) else {
            SharedDataManager.clearCalendarSyncData()
            return
        }

        do {
            try eventStore.removeCalendar(calendar, commit: true)
        } catch {
            print("[CalendarSync] Failed to remove calendar: \(error)")
        }

        SharedDataManager.clearCalendarSyncData()
        isEnabled = false
        syncedCount = 0
        lastSyncDate = nil
    }

    // MARK: - Calendar Management

    /// Get or create the dedicated Equinet calendar
    private func getOrCreateEquinetCalendar() throws -> EKCalendar {
        // Try to find existing calendar by stored identifier
        if let calendarId = SharedDataManager.equinetCalendarIdentifier,
           let calendar = eventStore.calendar(withIdentifier: calendarId) {
            return calendar
        }

        // Create new calendar
        let calendar = EKCalendar(for: .event, eventStore: eventStore)
        calendar.title = "Equinet"
        calendar.cgColor = brandColor

        // Use the default calendar source (iCloud or local)
        if let defaultSource = eventStore.defaultCalendarForNewEvents?.source {
            calendar.source = defaultSource
        } else if let localSource = eventStore.sources.first(where: { $0.sourceType == .local }) {
            calendar.source = localSource
        } else {
            throw CalendarSyncError.noCalendarSource
        }

        try eventStore.saveCalendar(calendar, commit: true)
        SharedDataManager.equinetCalendarIdentifier = calendar.calendarIdentifier

        return calendar
    }

    // MARK: - Event Mapping

    private func updateEvent(_ event: EKEvent, from booking: NativeBooking, calendar: EKCalendar) {
        // Title: "ServiceName - HorseName" or "ServiceName - CustomerName"
        let subtitle = booking.horseName ?? booking.customerFullName
        event.title = "\(booking.serviceName) - \(subtitle)"

        // Start/end dates
        if let startDate = parseDateTime(date: booking.bookingDate, time: booking.startTime),
           let endDate = parseDateTime(date: booking.bookingDate, time: booking.endTime) {
            event.startDate = startDate
            event.endDate = endDate
            event.timeZone = stockholmTimeZone
        }

        // Notes
        var notes = "Kund: \(booking.customerFullName)"
        notes += "\nTjänst: \(booking.serviceName)"
        notes += "\nPris: \(Int(booking.servicePrice)) kr"
        if let horseName = booking.horseName {
            notes += "\nHäst: \(horseName)"
        }
        notes += "\nBokat via Equinet"
        event.notes = notes

        // Alarm: 1 hour before (good default for field service)
        if event.alarms == nil || event.alarms?.isEmpty == true {
            event.addAlarm(EKAlarm(relativeOffset: -3600))
        }

        event.calendar = calendar
    }

    /// Parse "2026-03-08" + "09:00" into a Date in Stockholm timezone
    private func parseDateTime(date dateString: String, time timeString: String) -> Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        formatter.timeZone = stockholmTimeZone

        // Handle ISO 8601 date strings (take only first 10 chars)
        let dateOnly = String(dateString.prefix(10))
        return formatter.date(from: "\(dateOnly) \(timeString)")
    }
}

// MARK: - Errors

enum CalendarSyncError: Error {
    case noCalendarSource
}
