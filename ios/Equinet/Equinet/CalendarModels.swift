//
//  CalendarModels.swift
//  Equinet
//
//  Codable models for the native calendar API response.
//  Maps to GET /api/native/calendar response shape.
//

import Foundation

struct NativeBooking: Codable, Identifiable {
    let id: String
    let bookingDate: String       // ISO 8601 date
    let startTime: String         // "HH:mm"
    let endTime: String           // "HH:mm"
    let status: String            // pending, confirmed, completed, cancelled, no_show
    let horseName: String?
    let customerFirstName: String
    let customerLastName: String
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

    /// Parse bookingDate string to Date
    var date: Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        // Try ISO date first, then full ISO 8601
        if let d = formatter.date(from: bookingDate) { return d }
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return isoFormatter.date(from: bookingDate)
    }
}

struct NativeAvailability: Codable {
    let dayOfWeek: Int            // 0-6 (0=Monday)
    let startTime: String         // "HH:mm"
    let endTime: String           // "HH:mm"
    let isClosed: Bool
}

struct NativeException: Codable {
    let date: String              // ISO 8601 date
    let isClosed: Bool
    let startTime: String?
    let endTime: String?
    let reason: String?
}

struct CalendarResponse: Codable {
    let bookings: [NativeBooking]
    let availability: [NativeAvailability]
    let exceptions: [NativeException]
}
