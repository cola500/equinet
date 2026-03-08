//
//  WidgetBooking.swift
//  Equinet
//
//  Codable struct shared between main app and widget extension.
//  Represents the next upcoming booking for widget display.
//

import Foundation

struct WidgetBooking: Codable {
    let id: String
    let bookingDate: String       // ISO 8601 date
    let startTime: String         // "HH:mm"
    let endTime: String           // "HH:mm"
    let status: String            // "confirmed" | "pending"
    let horseName: String?
    let customerFirstName: String
    let customerLastName: String
    let serviceName: String
}

struct WidgetBookingResponse: Codable {
    let booking: WidgetBooking?
    let updatedAt: String
}

/// Widget data stored in App Group UserDefaults
struct WidgetData: Codable {
    let booking: WidgetBooking?
    let updatedAt: Date
    let hasAuth: Bool
}
