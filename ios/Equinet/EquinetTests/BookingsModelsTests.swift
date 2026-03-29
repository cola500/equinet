//
//  BookingsModelsTests.swift
//  EquinetTests
//
//  Decoding tests for BookingsModels to verify CodingKeys mapping.
//

@testable import Equinet
import XCTest

final class BookingsModelsTests: XCTestCase {

    // MARK: - BookingsListItem

    func testDecodeBookingsListItemFullPayload() throws {
        let json = """
        {
            "id": "b1",
            "bookingDate": "2026-03-14",
            "startTime": "10:00",
            "endTime": "11:00",
            "status": "confirmed",
            "serviceName": "Ridlektion",
            "servicePrice": 450.0,
            "customerFirstName": "Anna",
            "customerLastName": "Andersson",
            "customerEmail": "anna@example.com",
            "customerPhone": "070-1234567",
            "horseName": "Blansen",
            "horseId": "h1",
            "horseBreed": "Halvblod",
            "isPaid": true,
            "invoiceNumber": "INV-001",
            "isManualBooking": false,
            "bookingSeriesId": "series-1",
            "customerNotes": "Nybörjare",
            "providerNotes": "Bra lektion",
            "cancellationMessage": null,
            "customerReview": {
                "id": "r1",
                "rating": 5,
                "comment": "Toppen!"
            }
        }
        """.data(using: .utf8)!

        let item = try JSONDecoder().decode(BookingsListItem.self, from: json)

        XCTAssertEqual(item.id, "b1")
        XCTAssertEqual(item.bookingDate, "2026-03-14")
        XCTAssertEqual(item.startTime, "10:00")
        XCTAssertEqual(item.endTime, "11:00")
        XCTAssertEqual(item.status, "confirmed")
        XCTAssertEqual(item.serviceName, "Ridlektion")
        XCTAssertEqual(item.servicePrice, 450.0)
        XCTAssertEqual(item.customerFirstName, "Anna")
        XCTAssertEqual(item.customerLastName, "Andersson")
        XCTAssertEqual(item.customerEmail, "anna@example.com")
        XCTAssertEqual(item.customerPhone, "070-1234567")
        XCTAssertEqual(item.horseName, "Blansen")
        XCTAssertEqual(item.horseId, "h1")
        XCTAssertEqual(item.horseBreed, "Halvblod")
        XCTAssertTrue(item.isPaid)
        XCTAssertEqual(item.invoiceNumber, "INV-001")
        XCTAssertFalse(item.isManualBooking)
        XCTAssertEqual(item.bookingSeriesId, "series-1")
        XCTAssertEqual(item.customerNotes, "Nybörjare")
        XCTAssertEqual(item.providerNotes, "Bra lektion")
        XCTAssertNil(item.cancellationMessage)
        XCTAssertEqual(item.customerReview?.id, "r1")
        XCTAssertEqual(item.customerReview?.rating, 5)
        XCTAssertEqual(item.customerReview?.comment, "Toppen!")
    }

    func testDecodeBookingsListItemMinimalPayload() throws {
        let json = """
        {
            "id": "b2",
            "bookingDate": "2026-03-15",
            "startTime": "14:00",
            "endTime": "15:00",
            "status": "pending",
            "serviceName": "Hovslagning",
            "servicePrice": 800.0,
            "customerFirstName": "Erik",
            "customerLastName": "Svensson",
            "customerEmail": "erik@example.com",
            "customerPhone": null,
            "horseName": null,
            "horseId": null,
            "horseBreed": null,
            "isPaid": false,
            "invoiceNumber": null,
            "isManualBooking": false,
            "bookingSeriesId": null,
            "customerNotes": null,
            "providerNotes": null,
            "cancellationMessage": null,
            "customerReview": null
        }
        """.data(using: .utf8)!

        let item = try JSONDecoder().decode(BookingsListItem.self, from: json)

        XCTAssertEqual(item.id, "b2")
        XCTAssertNil(item.customerPhone)
        XCTAssertNil(item.horseName)
        XCTAssertNil(item.customerReview)
        XCTAssertEqual(item.customerFullName, "Erik Svensson")
    }

    func testDecodeBookingsListItemFailsOnMissingRequiredField() {
        let json = """
        {
            "id": "b3",
            "bookingDate": "2026-03-16",
            "status": "confirmed"
        }
        """.data(using: .utf8)!

        XCTAssertThrowsError(try JSONDecoder().decode(BookingsListItem.self, from: json))
    }

    // MARK: - BookingReview

    func testDecodeBookingReview() throws {
        let json = """
        { "id": "r1", "rating": 4, "comment": "Bra!" }
        """.data(using: .utf8)!

        let review = try JSONDecoder().decode(BookingReview.self, from: json)

        XCTAssertEqual(review.id, "r1")
        XCTAssertEqual(review.rating, 4)
        XCTAssertEqual(review.comment, "Bra!")
    }

    func testDecodeBookingReviewWithoutComment() throws {
        let json = """
        { "id": "r2", "rating": 3, "comment": null }
        """.data(using: .utf8)!

        let review = try JSONDecoder().decode(BookingReview.self, from: json)
        XCTAssertNil(review.comment)
    }

    // MARK: - CreateReviewResponse

    func testDecodeCreateReviewResponse() throws {
        let json = """
        { "id": "r3", "rating": 5, "comment": "Fantastiskt!" }
        """.data(using: .utf8)!

        let response = try JSONDecoder().decode(CreateReviewResponse.self, from: json)

        XCTAssertEqual(response.id, "r3")
        XCTAssertEqual(response.rating, 5)
        XCTAssertEqual(response.comment, "Fantastiskt!")
    }

    // MARK: - QuickNoteResponse

    func testDecodeQuickNoteResponse() throws {
        let json = """
        { "providerNotes": "Kunden var sen" }
        """.data(using: .utf8)!

        let response = try JSONDecoder().decode(QuickNoteResponse.self, from: json)
        XCTAssertEqual(response.providerNotes, "Kunden var sen")
    }

    // MARK: - Copy Constructors

    func testWithStatusPreservesOtherFields() {
        let item = BookingsListItem(
            id: "b1", bookingDate: "2026-03-14", startTime: "10:00", endTime: "11:00",
            status: "pending", serviceName: "Ridlektion", servicePrice: 450,
            customerFirstName: "Anna", customerLastName: "Andersson",
            customerEmail: "anna@test.com", customerPhone: "070-123",
            horseName: "Blansen", horseId: "h1", horseBreed: "Halvblod",
            isPaid: false, invoiceNumber: nil, isManualBooking: false,
            bookingSeriesId: nil, customerNotes: nil, providerNotes: "Anteckning",
            cancellationMessage: nil, customerReview: nil
        )

        let updated = item.withStatus("confirmed")

        XCTAssertEqual(updated.status, "confirmed")
        XCTAssertEqual(updated.id, "b1")
        XCTAssertEqual(updated.providerNotes, "Anteckning")
        XCTAssertEqual(updated.serviceName, "Ridlektion")
    }
}
