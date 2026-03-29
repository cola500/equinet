//
//  DateFormatters.swift
//  Equinet
//
//  Shared date formatters to avoid duplication across views and view models.
//  DateFormatter is expensive to create -- reuse static instances.
//

import Foundation

enum EquinetDateFormatters {

    // MARK: - ISO Parsing

    /// ISO8601 with fractional seconds (e.g. "2026-06-06T12:30:00.000Z").
    /// JavaScript's toISOString() always includes milliseconds.
    static let isoWithFractionalSeconds: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    /// ISO date-only format: "yyyy-MM-dd"
    static let isoDate: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    // MARK: - Swedish Display

    /// Swedish medium date (e.g. "15 mars 2026"). Uses .dateStyle = .medium.
    static let swedishMediumDate: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.locale = Locale(identifier: "sv_SE")
        return f
    }()

    /// Swedish full date: "d MMMM yyyy" (e.g. "15 mars 2026")
    static let swedishFullDate: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "sv_SE")
        f.dateFormat = "d MMMM yyyy"
        return f
    }()

    /// Swedish full weekday name: "EEEE" (e.g. "måndag")
    static let swedishDayName: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "sv_SE")
        f.dateFormat = "EEEE"
        return f
    }()
}
