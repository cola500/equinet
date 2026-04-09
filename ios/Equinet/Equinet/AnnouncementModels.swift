//
//  AnnouncementModels.swift
//  Equinet
//
//  Codable models for native announcements (/api/native/announcements).
//

import Foundation

// MARK: - Announcement Item

struct AnnouncementItem: Codable, Identifiable, Hashable, Sendable {
    static func == (lhs: AnnouncementItem, rhs: AnnouncementItem) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    let id: String
    let serviceType: String
    let municipality: String?
    let dateFrom: String
    let dateTo: String
    let status: String
    let specialInstructions: String?
    let createdAt: String
    let routeStops: [AnnouncementRouteStop]
    let services: [AnnouncementService]
    let bookingCount: Int

    // MARK: - Computed

    var statusLabel: String {
        switch status {
        case "open": return "Öppen"
        case "in_route": return "På rutt"
        case "completed": return "Avslutad"
        case "cancelled": return "Avbruten"
        default: return status
        }
    }

    var isOpen: Bool {
        status == "open"
    }

    var locationSummary: String {
        if let municipality {
            return municipality
        }
        if let first = routeStops.first {
            return first.locationName ?? first.address
        }
        return "Okänd plats"
    }

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "d MMM"
        f.locale = Locale(identifier: "sv_SE")
        return f
    }()

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    var dateRangeLabel: String {
        guard let from = Self.isoFormatter.date(from: dateFrom),
              let to = Self.isoFormatter.date(from: dateTo) else {
            return "\(dateFrom) – \(dateTo)"
        }
        return "\(Self.dateFormatter.string(from: from)) – \(Self.dateFormatter.string(from: to))"
    }

    var serviceNames: String {
        services.map(\.name).joined(separator: ", ")
    }
}

// MARK: - Route Stop

struct AnnouncementRouteStop: Codable, Identifiable, Sendable {
    let id: String
    let stopOrder: Int
    let locationName: String?
    let address: String
}

// MARK: - Service (minimal)

struct AnnouncementService: Codable, Identifiable, Sendable {
    let id: String
    let name: String
}

// MARK: - API Response

struct AnnouncementsListResponse: Codable, Sendable {
    let announcements: [AnnouncementItem]
}

// MARK: - Cancel Response

struct AnnouncementCancelResponse: Codable, Sendable {
    let success: Bool
}

// MARK: - Create Request

struct CreateAnnouncementRequest: Codable, Sendable {
    let serviceIds: [String]
    let dateFrom: String
    let dateTo: String
    let municipality: String
    let specialInstructions: String?
}

// MARK: - Detail Response

struct AnnouncementDetailResponse: Codable, Sendable {
    let announcement: AnnouncementDetailInfo
    let bookings: [AnnouncementBooking]
    let summary: AnnouncementSummary
}

struct AnnouncementDetailInfo: Codable, Sendable {
    let id: String
    let serviceType: String
    let municipality: String?
    let dateFrom: String
    let dateTo: String
    let status: String
    let specialInstructions: String?
    let createdAt: String
    let services: [AnnouncementService]
}

struct AnnouncementBooking: Codable, Identifiable, Sendable {
    let id: String
    let bookingDate: String
    let startTime: String?
    let endTime: String?
    let status: String
    let horseName: String?
    let customerNotes: String?
    let customerName: String
    let customerPhone: String?
    let serviceName: String?
    let servicePrice: Double?

    var statusLabel: String {
        switch status {
        case "pending": return "Väntar"
        case "confirmed": return "Bekräftad"
        case "cancelled": return "Avbokad"
        case "completed": return "Genomförd"
        default: return status
        }
    }

    var isPending: Bool { status == "pending" }

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        f.locale = Locale(identifier: "sv_SE")
        return f
    }()

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "d MMM"
        f.locale = Locale(identifier: "sv_SE")
        return f
    }()

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    var formattedDate: String {
        guard let date = Self.isoFormatter.date(from: bookingDate) else { return bookingDate }
        return Self.dateFormatter.string(from: date)
    }

    var timeRange: String {
        [startTime, endTime].compactMap { $0 }.joined(separator: " – ")
    }
}

struct AnnouncementSummary: Codable, Sendable {
    let total: Int
    let pending: Int
    let confirmed: Int
}

// MARK: - Booking Status Update

struct BookingStatusUpdateResponse: Codable, Sendable {
    let id: String
    let status: String
}
