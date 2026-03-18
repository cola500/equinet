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
import OSLog
import Observation

// MARK: - DI Protocols

@MainActor
protocol CalendarEventStoring {
    func requestFullAccess() async throws -> Bool
    func calendarExists(identifier: String) -> Bool
    func eventExists(identifier: String) -> Bool
    func createCalendar(title: String, color: CGColor) throws -> String
    func upsertEvent(identifier: String?, title: String, start: Date, end: Date, timeZone: TimeZone, notes: String, alarmOffset: TimeInterval, calendarId: String) throws -> String
    func removeEvent(identifier: String) throws
    func removeCalendar(identifier: String) throws
    func commitChanges() throws
    func resetChanges()
    var hasDefaultSource: Bool { get }
}

@MainActor
protocol CalendarSyncStorage {
    var calendarSyncEnabled: Bool { get set }
    var calendarSyncMapping: [String: String] { get set }
    var equinetCalendarIdentifier: String? { get set }
    func clearCalendarSyncData()
}

// MARK: - Adapters

struct EKEventStoreAdapter: CalendarEventStoring {
    let store = EKEventStore()

    func requestFullAccess() async throws -> Bool {
        try await store.requestFullAccessToEvents()
    }

    func calendarExists(identifier: String) -> Bool {
        store.calendar(withIdentifier: identifier) != nil
    }

    func eventExists(identifier: String) -> Bool {
        store.event(withIdentifier: identifier) != nil
    }

    func createCalendar(title: String, color: CGColor) throws -> String {
        let calendar = EKCalendar(for: .event, eventStore: store)
        calendar.title = title
        calendar.cgColor = color
        if let defaultSource = store.defaultCalendarForNewEvents?.source {
            calendar.source = defaultSource
        } else if let localSource = store.sources.first(where: { $0.sourceType == .local }) {
            calendar.source = localSource
        } else {
            throw CalendarSyncError.noCalendarSource
        }
        try store.saveCalendar(calendar, commit: true)
        return calendar.calendarIdentifier
    }

    func upsertEvent(identifier: String?, title: String, start: Date, end: Date, timeZone: TimeZone, notes: String, alarmOffset: TimeInterval, calendarId: String) throws -> String {
        let event: EKEvent
        if let id = identifier, let existing = store.event(withIdentifier: id) {
            event = existing
        } else {
            event = EKEvent(eventStore: store)
        }
        event.title = title
        event.startDate = start
        event.endDate = end
        event.timeZone = timeZone
        event.notes = notes
        if event.alarms == nil || event.alarms?.isEmpty == true {
            event.addAlarm(EKAlarm(relativeOffset: alarmOffset))
        }
        if let cal = store.calendar(withIdentifier: calendarId) {
            event.calendar = cal
        }
        return event.eventIdentifier ?? ""
    }

    func removeEvent(identifier: String) throws {
        if let event = store.event(withIdentifier: identifier) {
            try store.remove(event, span: .thisEvent)
        }
    }

    func removeCalendar(identifier: String) throws {
        if let calendar = store.calendar(withIdentifier: identifier) {
            try store.removeCalendar(calendar, commit: true)
        }
    }

    func commitChanges() throws {
        try store.commit()
    }

    func resetChanges() {
        store.reset()
    }

    var hasDefaultSource: Bool {
        store.defaultCalendarForNewEvents?.source != nil || store.sources.contains(where: { $0.sourceType == .local })
    }
}

struct SharedDataCalendarStorage: CalendarSyncStorage {
    var calendarSyncEnabled: Bool {
        get { SharedDataManager.calendarSyncEnabled }
        set { SharedDataManager.calendarSyncEnabled = newValue }
    }

    var calendarSyncMapping: [String: String] {
        get { SharedDataManager.calendarSyncMapping }
        set { SharedDataManager.calendarSyncMapping = newValue }
    }

    var equinetCalendarIdentifier: String? {
        get { SharedDataManager.equinetCalendarIdentifier }
        set { SharedDataManager.equinetCalendarIdentifier = newValue }
    }

    func clearCalendarSyncData() {
        SharedDataManager.clearCalendarSyncData()
    }
}

// MARK: - CalendarSyncManager

@MainActor
@Observable
final class CalendarSyncManager {
    static let shared = CalendarSyncManager()

    // MARK: - State

    private(set) var isEnabled = false
    private(set) var lastSyncDate: Date?
    private(set) var syncedCount = 0

    // MARK: - Dependencies

    private let eventStore: CalendarEventStoring
    private var storage: CalendarSyncStorage
    private let stockholmTimeZone = TimeZone(identifier: "Europe/Stockholm")!
    private let brandColor = CGColor(red: 34 / 255, green: 139 / 255, blue: 34 / 255, alpha: 1) // Forest green

    private init() {
        self.eventStore = EKEventStoreAdapter()
        self.storage = SharedDataCalendarStorage()
        isEnabled = storage.calendarSyncEnabled
    }

    init(eventStore: CalendarEventStoring, storage: CalendarSyncStorage) {
        self.eventStore = eventStore
        self.storage = storage
        isEnabled = storage.calendarSyncEnabled
    }

    // MARK: - Permission

    /// Request full calendar access (iOS 17+)
    func requestAccess() async -> Bool {
        do {
            let granted = try await eventStore.requestFullAccess()
            if granted {
                isEnabled = true
                storage.calendarSyncEnabled = true
            }
            return granted
        } catch {
            AppLogger.calendar.error("Permission request failed: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - Sync

    /// Sync bookings to iOS Calendar. Only confirmed bookings are synced.
    func syncBookings(_ bookings: [NativeBooking]) {
        guard isEnabled else { return }

        do {
            let calendarId = try getOrCreateCalendarId()
            var mapping = storage.calendarSyncMapping
            var processedIds = Set<String>()

            // Process confirmed bookings
            let confirmedBookings = bookings.filter { $0.status == "confirmed" }

            for booking in confirmedBookings {
                processedIds.insert(booking.id)

                let existingId = mapping[booking.id]
                let eventId = try eventStore.upsertEvent(
                    identifier: existingId,
                    title: eventTitle(for: booking),
                    start: parseDateTime(date: booking.bookingDate, time: booking.startTime) ?? .now,
                    end: parseDateTime(date: booking.bookingDate, time: booking.endTime) ?? .now,
                    timeZone: stockholmTimeZone,
                    notes: eventNotes(for: booking),
                    alarmOffset: -3600,
                    calendarId: calendarId
                )
                mapping[booking.id] = eventId
            }

            // Remove events for bookings that are no longer confirmed
            let bookingIds = Set(bookings.map(\.id))
            for (bookingId, eventIdentifier) in mapping {
                let isInCurrentData = bookingIds.contains(bookingId)
                let isStillConfirmed = processedIds.contains(bookingId)

                if isInCurrentData && !isStillConfirmed {
                    if eventStore.eventExists(identifier: eventIdentifier) {
                        try eventStore.removeEvent(identifier: eventIdentifier)
                    }
                    mapping.removeValue(forKey: bookingId)
                }
            }

            try eventStore.commitChanges()

            storage.calendarSyncMapping = mapping
            lastSyncDate = .now
            syncedCount = processedIds.count
        } catch {
            AppLogger.calendar.error("Sync failed: \(error.localizedDescription)")
            eventStore.resetChanges()
        }
    }

    /// Sync after a single booking status change (from push action)
    func syncAfterStatusChange(bookingId: String, newStatus: String) {
        guard isEnabled else { return }

        var mapping = storage.calendarSyncMapping

        if newStatus != "confirmed" {
            if let eventIdentifier = mapping[bookingId],
               eventStore.eventExists(identifier: eventIdentifier) {
                do {
                    try eventStore.removeEvent(identifier: eventIdentifier)
                    try eventStore.commitChanges()
                    mapping.removeValue(forKey: bookingId)
                    storage.calendarSyncMapping = mapping
                } catch {
                    AppLogger.calendar.error("Failed to remove event: \(error.localizedDescription)")
                    eventStore.resetChanges()
                }
            }
        }
    }

    /// Remove all synced events and clear mappings (called on logout)
    func removeAllSyncedEvents() {
        if let calendarId = storage.equinetCalendarIdentifier,
           eventStore.calendarExists(identifier: calendarId) {
            do {
                try eventStore.removeCalendar(identifier: calendarId)
            } catch {
                AppLogger.calendar.error("Failed to remove calendar: \(error.localizedDescription)")
            }
        }

        storage.clearCalendarSyncData()
        isEnabled = false
        syncedCount = 0
        lastSyncDate = nil
    }

    // MARK: - Calendar Management

    private func getOrCreateCalendarId() throws -> String {
        if let calendarId = storage.equinetCalendarIdentifier,
           eventStore.calendarExists(identifier: calendarId) {
            return calendarId
        }

        let calendarId = try eventStore.createCalendar(title: "Equinet", color: brandColor)
        storage.equinetCalendarIdentifier = calendarId
        return calendarId
    }

    // MARK: - Event Formatting

    func eventTitle(for booking: NativeBooking) -> String {
        let subtitle = booking.horseName ?? booking.customerFullName
        return "\(booking.serviceName) - \(subtitle)"
    }

    func eventNotes(for booking: NativeBooking) -> String {
        var notes = "Kund: \(booking.customerFullName)"
        notes += "\nTjänst: \(booking.serviceName)"
        notes += "\nPris: \(Int(booking.servicePrice)) kr"
        if let horseName = booking.horseName {
            notes += "\nHäst: \(horseName)"
        }
        notes += "\nBokat via Equinet"
        return notes
    }

    /// Parse "2026-03-08" + "09:00" into a Date in Stockholm timezone
    func parseDateTime(date dateString: String, time timeString: String) -> Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        formatter.timeZone = stockholmTimeZone

        let dateOnly = String(dateString.prefix(10))
        return formatter.date(from: "\(dateOnly) \(timeString)")
    }
}

// MARK: - Errors

enum CalendarSyncError: Error {
    case noCalendarSource
}
