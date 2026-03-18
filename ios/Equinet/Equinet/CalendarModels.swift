//
//  CalendarModels.swift
//  Equinet
//
//  Codable models for the native calendar API response.
//  Maps to GET /api/native/calendar response shape.
//

import Foundation

struct NativeBooking: Codable, Identifiable, Sendable {
    let id: String
    let bookingDate: String       // ISO 8601 date
    let startTime: String         // "HH:mm"
    let endTime: String           // "HH:mm"
    let status: String            // pending, confirmed, completed, cancelled, no_show
    let horseName: String?
    let customerFirstName: String
    let customerLastName: String
    let customerPhone: String?     // nil for cached data before this field was added
    let serviceName: String
    let serviceId: String?       // nil for cached data before this field was added
    let servicePrice: Double
    let isManualBooking: Bool
    let isPaid: Bool
    let bookingSeriesId: String?
    let customerNotes: String?
    let providerNotes: String?

    var customerFullName: String {
        "\(customerFirstName) \(customerLastName)"
    }

    /// Return a copy with updated status (for optimistic UI updates)
    func withStatus(_ newStatus: String) -> NativeBooking {
        NativeBooking(
            id: id,
            bookingDate: bookingDate,
            startTime: startTime,
            endTime: endTime,
            status: newStatus,
            horseName: horseName,
            customerFirstName: customerFirstName,
            customerLastName: customerLastName,
            customerPhone: customerPhone,
            serviceName: serviceName,
            serviceId: serviceId,
            servicePrice: servicePrice,
            isManualBooking: isManualBooking,
            isPaid: isPaid,
            bookingSeriesId: bookingSeriesId,
            customerNotes: customerNotes,
            providerNotes: providerNotes
        )
    }

    private static let bookingDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static let bookingISOFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    /// Parse bookingDate string to Date
    var date: Date? {
        if let d = Self.bookingDateFormatter.date(from: bookingDate) { return d }
        return Self.bookingISOFormatter.date(from: bookingDate)
    }
}

struct NativeAvailability: Codable, Sendable {
    let dayOfWeek: Int            // 0-6 (0=Monday)
    let startTime: String         // "HH:mm"
    let endTime: String           // "HH:mm"
    let isClosed: Bool
}

struct NativeException: Codable, Sendable {
    let date: String              // ISO 8601 date
    let isClosed: Bool
    let startTime: String?
    let endTime: String?
    let reason: String?
    let location: String?         // Optional for backward compat with cache
}

struct ExceptionSaveRequest: Encodable, Sendable {
    let date: String              // YYYY-MM-DD
    let isClosed: Bool
    let startTime: String?
    let endTime: String?
    let reason: String?
    let location: String?
}

struct CalendarResponse: Codable, Sendable {
    let bookings: [NativeBooking]
    let availability: [NativeAvailability]
    let exceptions: [NativeException]
}
