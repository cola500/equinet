//
//  BookingsModels.swift
//  Equinet
//
//  Codable models for the native bookings list (/api/native/bookings).
//

import Foundation

// MARK: - Booking List Item

struct BookingsListItem: Codable, Identifiable, Sendable {
    let id: String
    let bookingDate: String
    let startTime: String
    let endTime: String
    let status: String
    let serviceName: String
    let servicePrice: Double
    let customerFirstName: String
    let customerLastName: String
    let customerEmail: String
    let customerPhone: String?
    let horseName: String?
    let horseBreed: String?
    let isPaid: Bool
    let invoiceNumber: String?
    let isManualBooking: Bool
    let bookingSeriesId: String?
    let customerNotes: String?
    let providerNotes: String?
    let cancellationMessage: String?
    let customerReview: BookingReview?

    var customerFullName: String {
        "\(customerFirstName) \(customerLastName)"
    }

    /// Create a copy with a new status (for optimistic UI updates)
    func withStatus(_ newStatus: String) -> BookingsListItem {
        BookingsListItem(
            id: id,
            bookingDate: bookingDate,
            startTime: startTime,
            endTime: endTime,
            status: newStatus,
            serviceName: serviceName,
            servicePrice: servicePrice,
            customerFirstName: customerFirstName,
            customerLastName: customerLastName,
            customerEmail: customerEmail,
            customerPhone: customerPhone,
            horseName: horseName,
            horseBreed: horseBreed,
            isPaid: isPaid,
            invoiceNumber: invoiceNumber,
            isManualBooking: isManualBooking,
            bookingSeriesId: bookingSeriesId,
            customerNotes: customerNotes,
            providerNotes: providerNotes,
            cancellationMessage: cancellationMessage,
            customerReview: customerReview
        )
    }

    /// Create a copy with a review added
    func withReview(_ review: BookingReview) -> BookingsListItem {
        BookingsListItem(
            id: id,
            bookingDate: bookingDate,
            startTime: startTime,
            endTime: endTime,
            status: status,
            serviceName: serviceName,
            servicePrice: servicePrice,
            customerFirstName: customerFirstName,
            customerLastName: customerLastName,
            customerEmail: customerEmail,
            customerPhone: customerPhone,
            horseName: horseName,
            horseBreed: horseBreed,
            isPaid: isPaid,
            invoiceNumber: invoiceNumber,
            isManualBooking: isManualBooking,
            bookingSeriesId: bookingSeriesId,
            customerNotes: customerNotes,
            providerNotes: providerNotes,
            cancellationMessage: cancellationMessage,
            customerReview: review
        )
    }
}

// MARK: - Booking Review

struct BookingReview: Codable, Sendable {
    let id: String
    let rating: Int
    let comment: String?
}

// MARK: - Booking Filter

enum BookingFilter: String, CaseIterable, Sendable {
    case all
    case pending
    case confirmed
    case completed
    case noShow = "no_show"
    case cancelled

    var label: String {
        switch self {
        case .all: return "Alla"
        case .pending: return "Förfrågningar"
        case .confirmed: return "Bekräftade"
        case .completed: return "Genomförda"
        case .noShow: return "Uteblivna"
        case .cancelled: return "Avbokade"
        }
    }
}

// MARK: - Review Creation Response

struct CreateReviewResponse: Codable, Sendable {
    let id: String
    let rating: Int
    let comment: String?
}
