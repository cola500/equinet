//
//  AnnouncementModels.swift
//  Equinet
//
//  Codable models for native announcements (/api/native/announcements).
//

import Foundation

// MARK: - Announcement Item

struct AnnouncementItem: Codable, Identifiable, Sendable {
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
