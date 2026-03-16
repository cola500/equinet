//
//  CalendarSyncManagerTests.swift
//  EquinetTests
//
//  Tests for CalendarSyncManager with injected EventStore and Storage.
//

@testable import Equinet
import XCTest

// MARK: - Mock Event Store

@MainActor
final class MockCalendarEventStore: CalendarEventStoring {
    var accessGranted = true
    var calendars: Set<String> = []
    var events: [String: (title: String, calendarId: String)] = [:]
    var removedEvents: [String] = []
    var removedCalendars: [String] = []
    var commitCount = 0
    var resetCount = 0
    var nextEventId = 1
    var shouldFailCommit = false
    var hasDefaultSource = true

    func requestFullAccess() async throws -> Bool {
        accessGranted
    }

    func calendarExists(identifier: String) -> Bool {
        calendars.contains(identifier)
    }

    func eventExists(identifier: String) -> Bool {
        events[identifier] != nil
    }

    func createCalendar(title: String, color: CGColor) throws -> String {
        let id = "cal-\(title.lowercased())"
        calendars.insert(id)
        return id
    }

    func upsertEvent(identifier: String?, title: String, start: Date, end: Date, timeZone: TimeZone, notes: String, alarmOffset: TimeInterval, calendarId: String) throws -> String {
        let id = identifier ?? "event-\(nextEventId)"
        nextEventId += 1
        events[id] = (title: title, calendarId: calendarId)
        return id
    }

    func removeEvent(identifier: String) throws {
        events.removeValue(forKey: identifier)
        removedEvents.append(identifier)
    }

    func removeCalendar(identifier: String) throws {
        calendars.remove(identifier)
        removedCalendars.append(identifier)
    }

    func commitChanges() throws {
        commitCount += 1
        if shouldFailCommit {
            throw NSError(domain: "TestError", code: 1, userInfo: nil)
        }
    }

    func resetChanges() {
        resetCount += 1
    }
}

// MARK: - Mock Storage

@MainActor
final class MockCalendarSyncStorage: CalendarSyncStorage {
    var calendarSyncEnabled = false
    var calendarSyncMapping: [String: String] = [:]
    var equinetCalendarIdentifier: String?
    var clearCalled = false

    func clearCalendarSyncData() {
        clearCalled = true
        calendarSyncMapping = [:]
        equinetCalendarIdentifier = nil
        calendarSyncEnabled = false
    }
}

// MARK: - Test Helpers

private func makeBooking(
    id: String = "b1",
    date: String = "2026-03-09",
    startTime: String = "10:00",
    endTime: String = "11:00",
    status: String = "confirmed",
    horseName: String? = "Blansen",
    serviceName: String = "Hovvård",
    servicePrice: Double = 800
) -> NativeBooking {
    NativeBooking(
        id: id,
        bookingDate: date,
        startTime: startTime,
        endTime: endTime,
        status: status,
        horseName: horseName,
        customerFirstName: "Anna",
        customerLastName: "Svensson",
        customerPhone: nil,
        serviceName: serviceName,
        serviceId: "s1",
        servicePrice: servicePrice,
        isManualBooking: false,
        isPaid: false,
        bookingSeriesId: nil,
        customerNotes: nil,
        providerNotes: nil
    )
}

// MARK: - Tests

@MainActor
final class CalendarSyncManagerTests: XCTestCase {

    private var mockStore: MockCalendarEventStore!
    private var mockStorage: MockCalendarSyncStorage!
    private var sut: CalendarSyncManager!

    override func setUp() {
        super.setUp()
        mockStore = MockCalendarEventStore()
        mockStorage = MockCalendarSyncStorage()
        mockStorage.calendarSyncEnabled = true
        sut = CalendarSyncManager(eventStore: mockStore, storage: mockStorage)
    }

    override func tearDown() {
        sut = nil
        mockStorage = nil
        mockStore = nil
        super.tearDown()
    }

    // MARK: - Initial State

    func testInitialStateReadsFromStorage() {
        let storage = MockCalendarSyncStorage()
        storage.calendarSyncEnabled = false
        let manager = CalendarSyncManager(eventStore: mockStore, storage: storage)
        XCTAssertFalse(manager.isEnabled)

        let storage2 = MockCalendarSyncStorage()
        storage2.calendarSyncEnabled = true
        let manager2 = CalendarSyncManager(eventStore: mockStore, storage: storage2)
        XCTAssertTrue(manager2.isEnabled)
    }

    func testInitialSyncCountIsZero() {
        XCTAssertEqual(sut.syncedCount, 0)
        XCTAssertNil(sut.lastSyncDate)
    }

    // MARK: - Request Access

    func testRequestAccessGranted() async {
        mockStore.accessGranted = true
        // Start with disabled
        mockStorage.calendarSyncEnabled = false
        sut = CalendarSyncManager(eventStore: mockStore, storage: mockStorage)

        let granted = await sut.requestAccess()

        XCTAssertTrue(granted)
        XCTAssertTrue(sut.isEnabled)
        XCTAssertTrue(mockStorage.calendarSyncEnabled)
    }

    func testRequestAccessDenied() async {
        mockStore.accessGranted = false
        mockStorage.calendarSyncEnabled = false
        sut = CalendarSyncManager(eventStore: mockStore, storage: mockStorage)

        let granted = await sut.requestAccess()

        XCTAssertFalse(granted)
        XCTAssertFalse(sut.isEnabled)
    }

    // MARK: - Sync Bookings

    func testSyncBookingsWhenDisabled() {
        mockStorage.calendarSyncEnabled = false
        sut = CalendarSyncManager(eventStore: mockStore, storage: mockStorage)

        sut.syncBookings([makeBooking()])

        XCTAssertEqual(mockStore.commitCount, 0)
        XCTAssertEqual(sut.syncedCount, 0)
    }

    func testSyncOnlyConfirmedBookings() {
        let bookings = [
            makeBooking(id: "b1", status: "confirmed"),
            makeBooking(id: "b2", status: "pending"),
            makeBooking(id: "b3", status: "cancelled"),
            makeBooking(id: "b4", status: "confirmed"),
        ]

        sut.syncBookings(bookings)

        XCTAssertEqual(sut.syncedCount, 2)
        XCTAssertEqual(mockStore.events.count, 2)
    }

    func testSyncCreatesEventsForConfirmedBookings() {
        let bookings = [makeBooking(id: "b1", status: "confirmed")]

        sut.syncBookings(bookings)

        XCTAssertEqual(mockStore.events.count, 1)
        XCTAssertEqual(mockStore.commitCount, 1)
        XCTAssertNotNil(mockStorage.calendarSyncMapping["b1"])
    }

    func testSyncUpdatesExistingEvents() {
        // Pre-populate mapping
        let existingEventId = "existing-event-1"
        mockStorage.calendarSyncMapping = ["b1": existingEventId]
        mockStore.events[existingEventId] = (title: "Old title", calendarId: "cal-equinet")
        sut = CalendarSyncManager(eventStore: mockStore, storage: mockStorage)

        sut.syncBookings([makeBooking(id: "b1", status: "confirmed")])

        // Should update, not create a new one
        XCTAssertNotNil(mockStore.events[existingEventId])
        XCTAssertEqual(sut.syncedCount, 1)
    }

    func testSyncRemovesCancelledBookingEvents() {
        // Pre-populate: b1 was confirmed, now cancelled
        mockStorage.calendarSyncMapping = ["b1": "event-1"]
        mockStore.events["event-1"] = (title: "Old", calendarId: "cal-equinet")
        sut = CalendarSyncManager(eventStore: mockStore, storage: mockStorage)

        sut.syncBookings([makeBooking(id: "b1", status: "cancelled")])

        XCTAssertTrue(mockStore.removedEvents.contains("event-1"))
        XCTAssertNil(mockStorage.calendarSyncMapping["b1"])
    }

    func testSyncUpdatesLastSyncDate() {
        sut.syncBookings([makeBooking()])

        XCTAssertNotNil(sut.lastSyncDate)
    }

    func testSyncResetsOnCommitFailure() {
        mockStore.shouldFailCommit = true

        sut.syncBookings([makeBooking()])

        XCTAssertEqual(mockStore.resetCount, 1)
        XCTAssertEqual(sut.syncedCount, 0)
    }

    // MARK: - Sync After Status Change

    func testSyncAfterStatusChangeRemovesNonConfirmed() {
        mockStorage.calendarSyncMapping = ["b1": "event-1"]
        mockStore.events["event-1"] = (title: "Test", calendarId: "cal-equinet")
        sut = CalendarSyncManager(eventStore: mockStore, storage: mockStorage)

        sut.syncAfterStatusChange(bookingId: "b1", newStatus: "cancelled")

        XCTAssertTrue(mockStore.removedEvents.contains("event-1"))
        XCTAssertNil(mockStorage.calendarSyncMapping["b1"])
    }

    func testSyncAfterStatusChangeConfirmedDoesNothing() {
        mockStorage.calendarSyncMapping = ["b1": "event-1"]
        mockStore.events["event-1"] = (title: "Test", calendarId: "cal-equinet")
        sut = CalendarSyncManager(eventStore: mockStore, storage: mockStorage)

        sut.syncAfterStatusChange(bookingId: "b1", newStatus: "confirmed")

        XCTAssertTrue(mockStore.removedEvents.isEmpty)
        XCTAssertNotNil(mockStorage.calendarSyncMapping["b1"])
    }

    func testSyncAfterStatusChangeWhenDisabled() {
        mockStorage.calendarSyncEnabled = false
        sut = CalendarSyncManager(eventStore: mockStore, storage: mockStorage)

        sut.syncAfterStatusChange(bookingId: "b1", newStatus: "cancelled")

        XCTAssertTrue(mockStore.removedEvents.isEmpty)
    }

    // MARK: - Remove All

    func testRemoveAllSyncedEvents() {
        mockStorage.equinetCalendarIdentifier = "cal-equinet"
        mockStore.calendars.insert("cal-equinet")
        sut = CalendarSyncManager(eventStore: mockStore, storage: mockStorage)

        sut.removeAllSyncedEvents()

        XCTAssertTrue(mockStore.removedCalendars.contains("cal-equinet"))
        XCTAssertTrue(mockStorage.clearCalled)
        XCTAssertFalse(sut.isEnabled)
        XCTAssertEqual(sut.syncedCount, 0)
        XCTAssertNil(sut.lastSyncDate)
    }

    func testRemoveAllWhenNoCalendar() {
        // No calendar exists
        sut.removeAllSyncedEvents()

        XCTAssertTrue(mockStorage.clearCalled)
        XCTAssertTrue(mockStore.removedCalendars.isEmpty)
    }

    // MARK: - Event Formatting

    func testEventTitleWithHorse() {
        let booking = makeBooking(horseName: "Blansen", serviceName: "Hovvård")
        XCTAssertEqual(sut.eventTitle(for: booking), "Hovvård - Blansen")
    }

    func testEventTitleWithoutHorse() {
        let booking = makeBooking(horseName: nil, serviceName: "Ridlektion")
        XCTAssertEqual(sut.eventTitle(for: booking), "Ridlektion - Anna Svensson")
    }

    func testEventNotesContainsAllFields() {
        let booking = makeBooking(horseName: "Blansen", serviceName: "Hovvård", servicePrice: 800)
        let notes = sut.eventNotes(for: booking)

        XCTAssertTrue(notes.contains("Kund: Anna Svensson"))
        XCTAssertTrue(notes.contains("Tjänst: Hovvård"))
        XCTAssertTrue(notes.contains("Pris: 800 kr"))
        XCTAssertTrue(notes.contains("Häst: Blansen"))
        XCTAssertTrue(notes.contains("Bokat via Equinet"))
    }

    func testEventNotesWithoutHorse() {
        let booking = makeBooking(horseName: nil)
        let notes = sut.eventNotes(for: booking)

        XCTAssertFalse(notes.contains("Häst:"))
    }

    // MARK: - Date Parsing

    func testParseDateTimeValid() {
        let date = sut.parseDateTime(date: "2026-03-09", time: "10:00")
        XCTAssertNotNil(date)
    }

    func testParseDateTimeISOFormat() {
        // Should handle full ISO 8601 date strings (take first 10 chars)
        let date = sut.parseDateTime(date: "2026-03-09T00:00:00.000Z", time: "14:30")
        XCTAssertNotNil(date)
    }

    func testParseDateTimeInvalid() {
        let date = sut.parseDateTime(date: "invalid", time: "10:00")
        XCTAssertNil(date)
    }
}
