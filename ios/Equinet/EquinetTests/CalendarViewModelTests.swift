//
//  CalendarViewModelTests.swift
//  EquinetTests
//
//  Tests for CalendarViewModel using mock dependencies.
//

@testable import Equinet
import XCTest

// MARK: - Mocks

final class MockCalendarFetcher: CalendarDataFetching, @unchecked Sendable {
    var fetchResult: Result<CalendarResponse, Error> = .success(
        CalendarResponse(bookings: [], availability: [], exceptions: [])
    )
    var updateResult: Result<Void, Error> = .success(())
    var saveExceptionResult: Result<NativeException, Error> = .success(
        NativeException(date: "2026-03-15", isClosed: true, startTime: nil, endTime: nil, reason: nil, location: nil)
    )
    var deleteExceptionResult: Result<Void, Error> = .success(())
    var fetchCallCount = 0
    var updateCalls: [(bookingId: String, newStatus: String)] = []
    var saveExceptionCalls: [ExceptionSaveRequest] = []
    var deleteExceptionCalls: [String] = []

    func fetchCalendar(from: String, to: String) async throws -> CalendarResponse {
        fetchCallCount += 1
        return try fetchResult.get()
    }

    func updateBookingStatus(bookingId: String, newStatus: String) async throws {
        updateCalls.append((bookingId, newStatus))
        try updateResult.get()
    }

    func saveException(_ request: ExceptionSaveRequest) async throws -> NativeException {
        saveExceptionCalls.append(request)
        return try saveExceptionResult.get()
    }

    func deleteException(date: String) async throws {
        deleteExceptionCalls.append(date)
        try deleteExceptionResult.get()
    }
}

final class MockCalendarCache: CalendarCaching {
    var savedResponses: [(CalendarResponse, String, String)] = []
    var loadResult: SharedDataManager.CalendarCache?

    func saveCalendarCache(_ response: CalendarResponse, from: String, to: String) {
        savedResponses.append((response, from, to))
    }

    func loadCalendarCache() -> SharedDataManager.CalendarCache? {
        loadResult
    }
}

final class MockCalendarSync: CalendarSyncing {
    var syncBookingsCalls: [[NativeBooking]] = []
    var statusChangeCalls: [(bookingId: String, newStatus: String)] = []

    func syncBookings(_ bookings: [NativeBooking]) {
        syncBookingsCalls.append(bookings)
    }

    func syncAfterStatusChange(bookingId: String, newStatus: String) {
        statusChangeCalls.append((bookingId, newStatus))
    }
}

// MARK: - Test Helpers

private func makeBooking(
    id: String = "b1",
    date: String = "2026-03-09",
    startTime: String = "10:00",
    endTime: String = "11:00",
    status: String = "confirmed",
    serviceId: String? = "s1",
    serviceName: String = "Hovvård"
) -> NativeBooking {
    NativeBooking(
        id: id,
        bookingDate: date,
        startTime: startTime,
        endTime: endTime,
        status: status,
        horseName: "Blansen",
        customerFirstName: "Anna",
        customerLastName: "Svensson",
        customerPhone: "070-123 4567",
        serviceName: serviceName,
        serviceId: serviceId,
        servicePrice: 800,
        isManualBooking: false,
        isPaid: false,
        bookingSeriesId: nil,
        customerNotes: nil,
        providerNotes: nil
    )
}

private func makeResponse(
    bookings: [NativeBooking] = [],
    exceptions: [NativeException] = []
) -> CalendarResponse {
    CalendarResponse(bookings: bookings, availability: [], exceptions: exceptions)
}

private func makeException(
    date: String = "2026-03-09",
    isClosed: Bool = true,
    reason: String? = "Semester",
    location: String? = nil
) -> NativeException {
    NativeException(
        date: date,
        isClosed: isClosed,
        startTime: isClosed ? nil : "10:00",
        endTime: isClosed ? nil : "14:00",
        reason: reason,
        location: location
    )
}

// MARK: - Tests

@MainActor
final class CalendarViewModelTests: XCTestCase {

    private var fetcher: MockCalendarFetcher!
    private var cache: MockCalendarCache!
    private var sync: MockCalendarSync!
    private var sut: CalendarViewModel!

    override func setUp() {
        super.setUp()
        fetcher = MockCalendarFetcher()
        cache = MockCalendarCache()
        sync = MockCalendarSync()
        sut = CalendarViewModel(fetcher: fetcher, cache: cache, sync: sync)
    }

    override func tearDown() {
        sut = nil
        sync = nil
        cache = nil
        fetcher = nil
        super.tearDown()
    }

    // MARK: - Loading

    func testLoadDataFetchesFromAPI() async {
        let booking = makeBooking()
        fetcher.fetchResult = .success(makeResponse(bookings: [booking]))

        sut.loadDataForSelectedDate()
        // Wait for async Task
        try? await Task.sleep(for: .milliseconds(50))

        XCTAssertEqual(sut.bookings.count, 1)
        XCTAssertEqual(sut.bookings.first?.id, "b1")
        XCTAssertEqual(fetcher.fetchCallCount, 1)
        XCTAssertFalse(sut.isLoading)
    }

    func testLoadDataUsesCacheOnSecondCall() async {
        fetcher.fetchResult = .success(makeResponse(bookings: [makeBooking()]))

        sut.loadDataForSelectedDate()
        try? await Task.sleep(for: .milliseconds(50))

        // Second call should use in-memory cache
        sut.loadDataForSelectedDate()
        try? await Task.sleep(for: .milliseconds(50))

        XCTAssertEqual(fetcher.fetchCallCount, 1)
    }

    func testRefreshClearsCacheAndRefetches() async {
        fetcher.fetchResult = .success(makeResponse(bookings: [makeBooking()]))

        sut.loadDataForSelectedDate()
        try? await Task.sleep(for: .milliseconds(50))

        sut.refresh()
        try? await Task.sleep(for: .milliseconds(50))

        XCTAssertEqual(fetcher.fetchCallCount, 2)
    }

    func testLoadDataFallsBackToOfflineCache() async {
        let cachedBooking = makeBooking(id: "cached-1")
        cache.loadResult = SharedDataManager.CalendarCache(
            response: makeResponse(bookings: [cachedBooking]),
            from: "2026-03-06",
            to: "2026-03-12",
            cachedAt: Date()
        )
        fetcher.fetchResult = .failure(URLError(.notConnectedToInternet))

        sut.loadDataForSelectedDate()
        try? await Task.sleep(for: .milliseconds(50))

        XCTAssertEqual(sut.bookings.count, 1)
        XCTAssertEqual(sut.bookings.first?.id, "cached-1")
        XCTAssertTrue(sut.isOffline)
    }

    func testLoadDataShowsErrorWhenNoCache() async {
        cache.loadResult = nil
        fetcher.fetchResult = .failure(URLError(.notConnectedToInternet))

        sut.loadDataForSelectedDate()
        try? await Task.sleep(for: .milliseconds(50))

        XCTAssertEqual(sut.error, "Kunde inte hämta kalenderdata")
    }

    func testLoadDataSavesToOfflineCache() async {
        let booking = makeBooking()
        fetcher.fetchResult = .success(makeResponse(bookings: [booking]))

        sut.loadDataForSelectedDate()
        try? await Task.sleep(for: .milliseconds(50))

        XCTAssertEqual(cache.savedResponses.count, 1)
    }

    func testLoadDataSyncsBookings() async {
        let booking = makeBooking()
        fetcher.fetchResult = .success(makeResponse(bookings: [booking]))

        sut.loadDataForSelectedDate()
        try? await Task.sleep(for: .milliseconds(50))

        XCTAssertEqual(sync.syncBookingsCalls.count, 1)
        XCTAssertEqual(sync.syncBookingsCalls.first?.count, 1)
    }

    // MARK: - Booking Actions

    func testUpdateBookingStatusOptimisticUpdate() async {
        sut.bookings = [makeBooking(id: "b1", status: "pending")]

        sut.updateBookingStatus(bookingId: "b1", newStatus: "confirmed")
        // Optimistic update happens synchronously
        XCTAssertEqual(sut.bookings.first?.status, "confirmed")
        XCTAssertEqual(sut.actionInProgress, "b1")

        try? await Task.sleep(for: .milliseconds(50))

        XCTAssertNil(sut.actionInProgress)
        XCTAssertEqual(fetcher.updateCalls.count, 1)
        XCTAssertEqual(fetcher.updateCalls.first?.bookingId, "b1")
    }

    func testUpdateBookingStatusRevertsOnFailure() async {
        sut.bookings = [makeBooking(id: "b1", status: "pending")]
        fetcher.updateResult = .failure(URLError(.notConnectedToInternet))

        sut.updateBookingStatus(bookingId: "b1", newStatus: "confirmed")
        try? await Task.sleep(for: .milliseconds(50))

        // Should revert to original status
        XCTAssertEqual(sut.bookings.first?.status, "pending")
        XCTAssertNil(sut.actionInProgress)
    }

    func testUpdateBookingStatusSyncsCalendar() async {
        sut.bookings = [makeBooking(id: "b1", status: "pending")]

        sut.updateBookingStatus(bookingId: "b1", newStatus: "confirmed")
        try? await Task.sleep(for: .milliseconds(50))

        XCTAssertEqual(sync.statusChangeCalls.count, 1)
        XCTAssertEqual(sync.statusChangeCalls.first?.bookingId, "b1")
    }

    func testUpdateBlocksWhileInProgress() async {
        sut.bookings = [
            makeBooking(id: "b1", status: "pending"),
            makeBooking(id: "b2", status: "pending"),
        ]

        sut.updateBookingStatus(bookingId: "b1", newStatus: "confirmed")
        sut.updateBookingStatus(bookingId: "b2", newStatus: "confirmed")

        // Second call should be ignored
        try? await Task.sleep(for: .milliseconds(50))

        XCTAssertEqual(fetcher.updateCalls.count, 1)
    }

    // MARK: - Filtering

    func testBookingsForDateFiltersCorrectly() {
        sut.bookings = [
            makeBooking(id: "b1", date: "2026-03-09"),
            makeBooking(id: "b2", date: "2026-03-10"),
        ]

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let date = formatter.date(from: "2026-03-09")!

        let result = sut.bookingsForDate(date)
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.id, "b1")
    }

    func testServiceFilterFiltersBookings() {
        sut.bookings = [
            makeBooking(id: "b1", date: "2026-03-09", serviceId: "s1"),
            makeBooking(id: "b2", date: "2026-03-09", serviceId: "s2"),
        ]
        sut.selectedServiceFilter = "s1"

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let date = formatter.date(from: "2026-03-09")!

        let result = sut.bookingsForDate(date)
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.id, "b1")
    }

    func testAvailableServicesDeduplicates() {
        sut.bookings = [
            makeBooking(id: "b1", serviceId: "s1", serviceName: "Hovvård"),
            makeBooking(id: "b2", serviceId: "s1", serviceName: "Hovvård"),
            makeBooking(id: "b3", serviceId: "s2", serviceName: "Ridlektion"),
        ]

        XCTAssertEqual(sut.availableServices.count, 2)
    }

    // MARK: - Navigation

    func testGoToTodaySetsSelectedDate() {
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: .now)!
        sut.selectedDate = tomorrow

        sut.goToToday()

        XCTAssertTrue(Calendar.current.isDateInToday(sut.selectedDate))
    }

    func testNavigateToDayUpdatesSelectedDate() {
        let date = Calendar.current.date(byAdding: .day, value: 5, to: .now)!
        sut.navigateToDay(date)

        XCTAssertEqual(
            Calendar.current.dateComponents([.day], from: sut.selectedDate),
            Calendar.current.dateComponents([.day], from: date)
        )
    }

    // MARK: - Date Range (Scroll Paging)

    func testDateRangeContains61Days() {
        // +/- 30 days = 61 total
        XCTAssertEqual(sut.dateRange.count, 61)
    }

    func testDateRangeIsCenteredOnToday() {
        let cal = Calendar.current
        let range = sut.dateRange
        let first = range.first!
        let last = range.last!

        // Anchored on today at init
        let expectedFirst = cal.startOfDay(for: cal.date(byAdding: .day, value: -30, to: .now)!)
        let expectedLast = cal.startOfDay(for: cal.date(byAdding: .day, value: 30, to: .now)!)

        XCTAssertEqual(first, expectedFirst)
        XCTAssertEqual(last, expectedLast)
    }

    func testDateRangeStableOnSmallNavigation() {
        let cal = Calendar.current
        let rangeBefore = sut.dateRange

        // Navigate 5 days forward -- should NOT re-center
        let futureDate = cal.date(byAdding: .day, value: 5, to: .now)!
        sut.navigateToDay(futureDate)

        let rangeAfter = sut.dateRange
        XCTAssertEqual(rangeBefore, rangeAfter, "dateRange should not re-center for small navigation")
    }

    func testDateRangeReCentersOnLargeNavigation() {
        let cal = Calendar.current

        // Navigate 26+ days forward -- should re-center
        let farFuture = cal.date(byAdding: .day, value: 26, to: .now)!
        sut.navigateToDay(farFuture)

        let range = sut.dateRange
        let expectedCenter = cal.startOfDay(for: farFuture)
        // The center of the range should now be near farFuture
        XCTAssertTrue(range.contains(expectedCenter), "dateRange should contain the far future date after re-center")
    }

    func testDateRangeAllDatesAreStartOfDay() {
        let cal = Calendar.current
        for date in sut.dateRange {
            XCTAssertEqual(date, cal.startOfDay(for: date), "Date \(date) is not startOfDay")
        }
    }

    // MARK: - Selected Date ID (Scroll Position Sync)

    func testSelectedDateIdIsStartOfDay() {
        let cal = Calendar.current
        // Set selectedDate to a time in the middle of the day
        var components = cal.dateComponents([.year, .month, .day], from: .now)
        components.hour = 14
        components.minute = 30
        let midday = cal.date(from: components)!
        sut.selectedDate = midday

        XCTAssertEqual(sut.selectedDateId, cal.startOfDay(for: midday))
    }

    func testNavigateToDayNormalizesToStartOfDay() {
        let cal = Calendar.current
        var components = cal.dateComponents([.year, .month, .day], from: .now)
        components.hour = 15
        components.minute = 45
        let afternoon = cal.date(from: components)!

        sut.navigateToDay(afternoon)

        XCTAssertEqual(sut.selectedDateId, cal.startOfDay(for: afternoon))
    }

    func testGoToTodaySetsSelectedDateIdToTodayStartOfDay() {
        // Navigate away first
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: .now)!
        sut.navigateToDay(tomorrow)

        sut.goToToday()

        let todayStart = Calendar.current.startOfDay(for: .now)
        XCTAssertEqual(sut.selectedDateId, todayStart)
    }

    // MARK: - Exception Management

    func testSaveExceptionOptimisticUpdate() async {
        let request = ExceptionSaveRequest(
            date: "2026-03-09", isClosed: true,
            startTime: nil, endTime: nil, reason: "Sjuk", location: nil
        )
        fetcher.saveExceptionResult = .success(makeException(date: "2026-03-09", reason: "Sjuk"))

        sut.saveException(request)
        // Optimistic update happens synchronously
        XCTAssertEqual(sut.exceptions.count, 1)
        XCTAssertEqual(sut.exceptions.first?.date, "2026-03-09")
        XCTAssertEqual(sut.exceptions.first?.reason, "Sjuk")
    }

    func testSaveExceptionRevertsOnFailure() async {
        fetcher.saveExceptionResult = .failure(URLError(.notConnectedToInternet))

        let request = ExceptionSaveRequest(
            date: "2026-03-09", isClosed: true,
            startTime: nil, endTime: nil, reason: "Sjuk", location: nil
        )
        sut.saveException(request)
        try? await Task.sleep(for: .milliseconds(50))

        // Should revert -- exceptions back to empty
        XCTAssertTrue(sut.exceptions.isEmpty)
    }

    func testDeleteExceptionOptimisticUpdate() {
        sut.exceptions = [makeException(date: "2026-03-09")]

        sut.deleteException(date: "2026-03-09")
        // Optimistic removal happens synchronously
        XCTAssertTrue(sut.exceptions.isEmpty)
    }

    func testDeleteExceptionRevertsOnFailure() async {
        sut.exceptions = [makeException(date: "2026-03-09")]
        fetcher.deleteExceptionResult = .failure(URLError(.notConnectedToInternet))

        sut.deleteException(date: "2026-03-09")
        try? await Task.sleep(for: .milliseconds(50))

        // Should revert -- exception restored
        XCTAssertEqual(sut.exceptions.count, 1)
        XCTAssertEqual(sut.exceptions.first?.date, "2026-03-09")
    }

    func testSaveExceptionUpsertReplacesExisting() {
        sut.exceptions = [makeException(date: "2026-03-09", reason: "Semester")]

        let request = ExceptionSaveRequest(
            date: "2026-03-09", isClosed: true,
            startTime: nil, endTime: nil, reason: "Sjuk", location: nil
        )
        fetcher.saveExceptionResult = .success(makeException(date: "2026-03-09", reason: "Sjuk"))

        sut.saveException(request)
        XCTAssertEqual(sut.exceptions.count, 1)
        XCTAssertEqual(sut.exceptions.first?.reason, "Sjuk")
    }

    func testSaveExceptionCallsAPIWithCorrectData() async {
        let request = ExceptionSaveRequest(
            date: "2026-03-15", isClosed: false,
            startTime: "10:00", endTime: "14:00", reason: nil, location: "Sollebrunn"
        )
        fetcher.saveExceptionResult = .success(
            makeException(date: "2026-03-15", isClosed: false, reason: nil, location: "Sollebrunn")
        )

        sut.saveException(request)
        try? await Task.sleep(for: .milliseconds(50))

        XCTAssertEqual(fetcher.saveExceptionCalls.count, 1)
        XCTAssertEqual(fetcher.saveExceptionCalls.first?.date, "2026-03-15")
        XCTAssertEqual(fetcher.saveExceptionCalls.first?.isClosed, false)
        XCTAssertEqual(fetcher.saveExceptionCalls.first?.location, "Sollebrunn")
    }

    // MARK: - Week Strip Helpers

    func testWeekDatesReturns7Days() {
        let week = sut.weekDates
        XCTAssertEqual(week.count, 7)
    }

    func testWeekDatesContainSelectedDate() {
        let cal = Calendar.current
        let week = sut.weekDates
        let expected = cal.startOfDay(for: sut.selectedDate)
        XCTAssertTrue(week.contains(expected), "Week should contain the selected date")
    }

    func testWeekDatesAreConsecutive() {
        let cal = Calendar.current
        let week = sut.weekDates
        for i in 1..<week.count {
            let diff = cal.dateComponents([.day], from: week[i - 1], to: week[i])
            XCTAssertEqual(diff.day, 1, "Days should be consecutive")
        }
    }
}
