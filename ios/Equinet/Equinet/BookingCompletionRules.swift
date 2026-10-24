//
//  BookingCompletionRules.swift
//  Equinet
//
//  BR-BOOK-001 client guidance: a booking can be marked completed at or after
//  its booked end time, in the booking's own timezone (never the device's).
//  The server is authoritative; this only decides button state and texts.
//

import Foundation

enum BookingCompletionRules {

    /// Database default (Booking.timezone). Used when the API omits the field.
    static let defaultTimezone = "Europe/Stockholm"

    private static let isoWithFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    /// Whether "Markera som genomförd" should be enabled at `now`.
    /// Returns false when the end time cannot be determined.
    static func canMarkCompleted(
        bookingDate: String,
        endTime: String,
        timezone: String?,
        now: Date = .now
    ) -> Bool {
        guard let end = endInstant(bookingDate: bookingDate, endTime: endTime, timezone: timezone) else {
            return false
        }
        return now >= end
    }

    /// Absolute end instant: calendar date read in the booking's timezone + local end time.
    static func endInstant(bookingDate: String, endTime: String, timezone: String?) -> Date? {
        let zone = timezone.flatMap(TimeZone.init(identifier:))
            ?? TimeZone(identifier: defaultTimezone)!
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone

        guard let (year, month, day) = calendarDate(bookingDate, in: calendar) else { return nil }

        let parts = endTime.split(separator: ":")
        guard parts.count == 2,
              let hour = Int(parts[0]), (0...23).contains(hour),
              let minute = Int(parts[1]), (0...59).contains(minute) else {
            return nil
        }

        return calendar.date(from: DateComponents(
            year: year, month: month, day: day, hour: hour, minute: minute
        ))
    }

    /// Same rule as the server (`BookingTime.calendarDate`):
    /// - "yyyy-MM-dd" is the calendar date as-is
    /// - a timestamp without zone is UTC
    /// - stored variants (UTC midnight, local midnight, local 10:00) land on the
    ///   right day in the booking's zone east of UTC, and in UTC west of it
    private static func calendarDate(_ raw: String, in calendar: Calendar) -> (Int, Int, Int)? {
        if raw.count == 10 {
            let parts = raw.split(separator: "-").compactMap { Int($0) }
            guard parts.count == 3 else { return nil }
            return (parts[0], parts[1], parts[2])
        }
        let hasZone = raw.hasSuffix("Z") || raw.range(of: #"[+-]\d{2}:?\d{2}$"#, options: .regularExpression) != nil
        let normalized = hasZone ? raw : raw + "Z"
        guard let instant = isoWithFraction.date(from: normalized) ?? isoPlain.date(from: normalized) else {
            return nil
        }
        var dayCalendar = calendar
        if calendar.timeZone.secondsFromGMT(for: instant) < 0 {
            dayCalendar.timeZone = TimeZone(identifier: "UTC")!
        }
        let c = dayCalendar.dateComponents([.year, .month, .day], from: instant)
        guard let y = c.year, let m = c.month, let d = c.day else { return nil }
        return (y, m, d)
    }

    static func completionHint(endTime: String) -> String {
        "Kan markeras som genomförd efter kl. \(endTime)"
    }

    /// Visible error after a failed status update. Mirrors the server texts,
    /// since `APIError.serverError` carries only the status code.
    /// `endTimePassed`: whether the end time has passed on this device. A 400 on
    /// "completed" is only blamed on the end time when it has not passed;
    /// otherwise it has another cause (e.g. the booking was cancelled elsewhere).
    static func statusUpdateErrorMessage(
        for error: Error, newStatus: String, endTime: String, endTimePassed: Bool
    ) -> String {
        if case APIError.serverError(let code) = error {
            if code == 400 && newStatus == "completed" {
                return endTimePassed
                    ? "Bokningens status kunde inte ändras. Ladda om och försök igen."
                    : "Bokningen kan markeras som genomförd först efter bokad sluttid (kl. \(endTime))."
            }
            if code == 409 {
                return "Bokningen ändrades samtidigt. Ladda om och försök igen."
            }
        }
        return "Kunde inte uppdatera bokningen. Försök igen."
    }
}
