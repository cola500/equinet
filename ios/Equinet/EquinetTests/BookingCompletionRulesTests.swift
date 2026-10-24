//
//  BookingCompletionRulesTests.swift
//  EquinetTests
//
//  BR-BOOK-001 client guidance: when the "Markera som genomförd" button is enabled.
//  The server is authoritative; these rules only decide the button state and texts.
//

@testable import Equinet
import XCTest

final class BookingCompletionRulesTests: XCTestCase {

    // Base example: 10 Nov 2026, 10:00–11:00 Stockholm (UTC+1) => ends 10:00 UTC
    private let winterDate = "2026-11-10T00:00:00.000Z"
    private let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private func at(_ s: String) -> Date { iso.date(from: s)! }

    func testSCBOOK004_disabledOneMinuteBeforeEndTime() {
        XCTAssertFalse(BookingCompletionRules.canMarkCompleted(
            bookingDate: winterDate, endTime: "11:00", timezone: "Europe/Stockholm",
            now: at("2026-11-10T09:59:00Z")
        ))
    }

    func testSCBOOK005_enabledExactlyAtEndTime() {
        XCTAssertTrue(BookingCompletionRules.canMarkCompleted(
            bookingDate: winterDate, endTime: "11:00", timezone: "Europe/Stockholm",
            now: at("2026-11-10T10:00:00Z")
        ))
    }

    func testSCBOOK007_followsLocalTimeOnFirstDayOfSummerTime() {
        let date = "2027-03-28T00:00:00.000Z"
        XCTAssertFalse(BookingCompletionRules.canMarkCompleted(
            bookingDate: date, endTime: "11:00", timezone: "Europe/Stockholm",
            now: at("2027-03-28T08:30:00Z")
        ))
        XCTAssertTrue(BookingCompletionRules.canMarkCompleted(
            bookingDate: date, endTime: "11:00", timezone: "Europe/Stockholm",
            now: at("2027-03-28T09:05:00Z")
        ))
    }

    func testSameEndTimeForAllStorageVariants() {
        for stored in ["2026-11-10T00:00:00.000Z", "2026-11-09T23:00:00.000Z", "2026-11-10T09:00:00.000Z", "2026-11-10"] {
            XCTAssertFalse(BookingCompletionRules.canMarkCompleted(
                bookingDate: stored, endTime: "11:00", timezone: "Europe/Stockholm",
                now: at("2026-11-10T09:59:00Z")
            ), "stored=\(stored)")
            XCTAssertTrue(BookingCompletionRules.canMarkCompleted(
                bookingDate: stored, endTime: "11:00", timezone: "Europe/Stockholm",
                now: at("2026-11-10T10:00:00Z")
            ), "stored=\(stored)")
        }
    }

    func testUsesBookingTimezoneNotDeviceTimezone() {
        // A booking in Helsinki (UTC+2 in November) ends 11:00 local = 09:00 UTC.
        XCTAssertTrue(BookingCompletionRules.canMarkCompleted(
            bookingDate: winterDate, endTime: "11:00", timezone: "Europe/Helsinki",
            now: at("2026-11-10T09:30:00Z")
        ))
        XCTAssertFalse(BookingCompletionRules.canMarkCompleted(
            bookingDate: winterDate, endTime: "11:00", timezone: "Europe/Stockholm",
            now: at("2026-11-10T09:30:00Z")
        ))
    }

    func testMissingOrInvalidTimezoneFallsBackToStockholm() {
        for tz in [nil, "Nope/Nope"] as [String?] {
            XCTAssertFalse(BookingCompletionRules.canMarkCompleted(
                bookingDate: winterDate, endTime: "11:00", timezone: tz,
                now: at("2026-11-10T09:59:00Z")
            ))
            XCTAssertTrue(BookingCompletionRules.canMarkCompleted(
                bookingDate: winterDate, endTime: "11:00", timezone: tz,
                now: at("2026-11-10T10:00:00Z")
            ))
        }
    }

    func testUnparseableDataDisablesButton() {
        XCTAssertFalse(BookingCompletionRules.canMarkCompleted(
            bookingDate: "not-a-date", endTime: "11:00", timezone: "Europe/Stockholm",
            now: at("2030-01-01T00:00:00Z")
        ))
    }

    func testHintText() {
        XCTAssertEqual(
            BookingCompletionRules.completionHint(endTime: "11:00"),
            "Kan markeras som genomförd efter kl. 11:00"
        )
    }

    // MARK: - Error messages

    func testSCBOOK002_rejectedCompletionMessage() {
        XCTAssertEqual(
            BookingCompletionRules.statusUpdateErrorMessage(
                for: APIError.serverError(400), newStatus: "completed", endTime: "11:00"
            ),
            "Bokningen kan markeras som genomförd först efter bokad sluttid (kl. 11:00)."
        )
    }

    func testConcurrentChangeMessage() {
        XCTAssertEqual(
            BookingCompletionRules.statusUpdateErrorMessage(
                for: APIError.serverError(409), newStatus: "completed", endTime: "11:00"
            ),
            "Bokningen ändrades samtidigt. Ladda om och försök igen."
        )
    }

    func testGenericMessageForOtherErrors() {
        XCTAssertEqual(
            BookingCompletionRules.statusUpdateErrorMessage(
                for: APIError.serverError(500), newStatus: "confirmed", endTime: "11:00"
            ),
            "Kunde inte uppdatera bokningen. Försök igen."
        )
    }
}
