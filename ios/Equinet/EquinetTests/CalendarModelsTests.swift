//
//  CalendarModelsTests.swift
//  EquinetTests
//
//  Tests for CalendarModels (NativeBooking, NativeAvailability, NativeException,
//  CalendarResponse) and WidgetBooking/WidgetData Codable types.
//

@testable import Equinet
import XCTest

final class CalendarModelsTests: XCTestCase {

    // MARK: - NativeBooking

    func testNativeBookingDecodesFromValidJSON() throws {
        let json = """
        {
            "id": "booking-1",
            "bookingDate": "2026-03-15",
            "startTime": "10:00",
            "endTime": "11:00",
            "status": "confirmed",
            "horseName": "Blansen",
            "customerFirstName": "Anna",
            "customerLastName": "Svensson",
            "serviceName": "Ridlektion",
            "servicePrice": 450.0,
            "isManualBooking": false,
            "isPaid": true
        }
        """.data(using: .utf8)!

        let booking = try JSONDecoder().decode(NativeBooking.self, from: json)

        XCTAssertEqual(booking.id, "booking-1")
        XCTAssertEqual(booking.bookingDate, "2026-03-15")
        XCTAssertEqual(booking.startTime, "10:00")
        XCTAssertEqual(booking.endTime, "11:00")
        XCTAssertEqual(booking.status, "confirmed")
        XCTAssertEqual(booking.horseName, "Blansen")
        XCTAssertEqual(booking.customerFirstName, "Anna")
        XCTAssertEqual(booking.customerLastName, "Svensson")
        XCTAssertEqual(booking.serviceName, "Ridlektion")
        XCTAssertEqual(booking.servicePrice, 450.0)
        XCTAssertFalse(booking.isManualBooking)
        XCTAssertTrue(booking.isPaid)
    }

    func testNativeBookingDecodesWithNilHorseName() throws {
        let json = """
        {
            "id": "booking-2",
            "bookingDate": "2026-03-15",
            "startTime": "10:00",
            "endTime": "11:00",
            "status": "pending",
            "horseName": null,
            "customerFirstName": "Erik",
            "customerLastName": "Johansson",
            "serviceName": "Hovvård",
            "servicePrice": 800.0,
            "isManualBooking": true,
            "isPaid": false
        }
        """.data(using: .utf8)!

        let booking = try JSONDecoder().decode(NativeBooking.self, from: json)

        XCTAssertNil(booking.horseName)
        XCTAssertTrue(booking.isManualBooking)
    }

    func testCustomerFullNameConcatenatesFirstAndLastName() throws {
        let json = """
        {
            "id": "b1",
            "bookingDate": "2026-03-15",
            "startTime": "10:00",
            "endTime": "11:00",
            "status": "confirmed",
            "horseName": null,
            "customerFirstName": "Anna",
            "customerLastName": "Svensson",
            "serviceName": "Ridlektion",
            "servicePrice": 450.0,
            "isManualBooking": false,
            "isPaid": false
        }
        """.data(using: .utf8)!

        let booking = try JSONDecoder().decode(NativeBooking.self, from: json)
        XCTAssertEqual(booking.customerFullName, "Anna Svensson")
    }

    func testDatePropertyParsesYYYYMMDD() throws {
        let json = """
        {
            "id": "b1",
            "bookingDate": "2026-03-15",
            "startTime": "10:00",
            "endTime": "11:00",
            "status": "confirmed",
            "horseName": null,
            "customerFirstName": "A",
            "customerLastName": "B",
            "serviceName": "S",
            "servicePrice": 0,
            "isManualBooking": false,
            "isPaid": false
        }
        """.data(using: .utf8)!

        let booking = try JSONDecoder().decode(NativeBooking.self, from: json)
        let date = try XCTUnwrap(booking.date)

        let calendar = Calendar(identifier: .gregorian)
        XCTAssertEqual(calendar.component(.year, from: date), 2026)
        XCTAssertEqual(calendar.component(.month, from: date), 3)
        XCTAssertEqual(calendar.component(.day, from: date), 15)
    }

    func testDatePropertyParsesISO8601WithFractionalSeconds() throws {
        let json = """
        {
            "id": "b1",
            "bookingDate": "2026-03-15T10:30:00.000Z",
            "startTime": "10:00",
            "endTime": "11:00",
            "status": "confirmed",
            "horseName": null,
            "customerFirstName": "A",
            "customerLastName": "B",
            "serviceName": "S",
            "servicePrice": 0,
            "isManualBooking": false,
            "isPaid": false
        }
        """.data(using: .utf8)!

        let booking = try JSONDecoder().decode(NativeBooking.self, from: json)
        XCTAssertNotNil(booking.date, "Should parse full ISO 8601 with fractional seconds")
    }

    func testDatePropertyReturnsNilForInvalidInput() throws {
        let json = """
        {
            "id": "b1",
            "bookingDate": "not-a-date",
            "startTime": "10:00",
            "endTime": "11:00",
            "status": "confirmed",
            "horseName": null,
            "customerFirstName": "A",
            "customerLastName": "B",
            "serviceName": "S",
            "servicePrice": 0,
            "isManualBooking": false,
            "isPaid": false
        }
        """.data(using: .utf8)!

        let booking = try JSONDecoder().decode(NativeBooking.self, from: json)
        XCTAssertNil(booking.date)
    }

    // MARK: - NativeAvailability

    func testNativeAvailabilityDecodes() throws {
        let json = """
        {"dayOfWeek": 0, "startTime": "08:00", "endTime": "17:00", "isClosed": false}
        """.data(using: .utf8)!

        let avail = try JSONDecoder().decode(NativeAvailability.self, from: json)
        XCTAssertEqual(avail.dayOfWeek, 0)
        XCTAssertEqual(avail.startTime, "08:00")
        XCTAssertEqual(avail.endTime, "17:00")
        XCTAssertFalse(avail.isClosed)
    }

    // MARK: - NativeException

    func testNativeExceptionDecodes() throws {
        let json = """
        {"date": "2026-03-20", "isClosed": true, "startTime": null, "endTime": null, "reason": "Semester"}
        """.data(using: .utf8)!

        let exc = try JSONDecoder().decode(NativeException.self, from: json)
        XCTAssertEqual(exc.date, "2026-03-20")
        XCTAssertTrue(exc.isClosed)
        XCTAssertNil(exc.startTime)
        XCTAssertEqual(exc.reason, "Semester")
    }

    // MARK: - CalendarResponse

    func testCalendarResponseDecodesFullResponse() throws {
        let json = """
        {
            "bookings": [
                {
                    "id": "b1",
                    "bookingDate": "2026-03-15",
                    "startTime": "10:00",
                    "endTime": "11:00",
                    "status": "confirmed",
                    "horseName": "Blansen",
                    "customerFirstName": "Anna",
                    "customerLastName": "Svensson",
                    "serviceName": "Ridlektion",
                    "servicePrice": 450.0,
                    "isManualBooking": false,
                    "isPaid": true
                }
            ],
            "availability": [
                {"dayOfWeek": 0, "startTime": "08:00", "endTime": "17:00", "isClosed": false}
            ],
            "exceptions": [
                {"date": "2026-03-20", "isClosed": true, "startTime": null, "endTime": null, "reason": null}
            ]
        }
        """.data(using: .utf8)!

        let response = try JSONDecoder().decode(CalendarResponse.self, from: json)
        XCTAssertEqual(response.bookings.count, 1)
        XCTAssertEqual(response.availability.count, 1)
        XCTAssertEqual(response.exceptions.count, 1)
    }

    // MARK: - WidgetBooking

    func testWidgetBookingRoundTrips() throws {
        let booking = WidgetBooking(
            id: "wb-1",
            bookingDate: "2026-03-15",
            startTime: "10:00",
            endTime: "11:00",
            status: "confirmed",
            horseName: "Blansen",
            customerFirstName: "Anna",
            customerLastName: "Svensson",
            serviceName: "Ridlektion"
        )

        let data = try JSONEncoder().encode(booking)
        let decoded = try JSONDecoder().decode(WidgetBooking.self, from: data)

        XCTAssertEqual(decoded.id, "wb-1")
        XCTAssertEqual(decoded.bookingDate, "2026-03-15")
        XCTAssertEqual(decoded.horseName, "Blansen")
        XCTAssertEqual(decoded.serviceName, "Ridlektion")
    }

    // MARK: - WidgetData

    func testWidgetDataEncodesAndDecodesWithNilBooking() throws {
        let widgetData = WidgetData(
            booking: nil,
            updatedAt: Date(timeIntervalSince1970: 1_000_000),
            hasAuth: true
        )

        let data = try JSONEncoder().encode(widgetData)
        let decoded = try JSONDecoder().decode(WidgetData.self, from: data)

        XCTAssertNil(decoded.booking)
        XCTAssertTrue(decoded.hasAuth)
        XCTAssertEqual(decoded.updatedAt.timeIntervalSince1970, 1_000_000, accuracy: 1)
    }

    // MARK: - PendingBookingAction

    func testPendingBookingActionEncodesAndDecodes() throws {
        let action = PendingBookingAction(
            bookingId: "action-1",
            status: "confirmed",
            createdAt: Date(timeIntervalSince1970: 2_000_000)
        )

        let data = try JSONEncoder().encode(action)
        let decoded = try JSONDecoder().decode(PendingBookingAction.self, from: data)

        XCTAssertEqual(decoded.bookingId, "action-1")
        XCTAssertEqual(decoded.status, "confirmed")
        XCTAssertEqual(decoded.createdAt.timeIntervalSince1970, 2_000_000, accuracy: 1)
    }
}
