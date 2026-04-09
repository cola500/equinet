//
//  GroupBookingModels.swift
//  Equinet
//
//  Codable models for native group bookings.
//

#if os(iOS)
import Foundation

// MARK: - List Response

struct GroupBookingsListResponse: Codable, Sendable {
    let requests: [GroupBookingRequest]
}

// MARK: - Group Booking Request

struct GroupBookingRequest: Codable, Identifiable, Hashable, Sendable {
    static func == (lhs: GroupBookingRequest, rhs: GroupBookingRequest) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    let id: String
    let serviceType: String
    let locationName: String
    let address: String
    let latitude: Double?
    let longitude: Double?
    let dateFrom: String
    let dateTo: String
    let maxParticipants: Int
    let status: String
    let notes: String?
    let inviteCode: String?
    let participants: [GroupBookingParticipant]?
    let _count: ParticipantCount?

    struct ParticipantCount: Codable, Sendable {
        let participants: Int
    }

    var participantCount: Int {
        _count?.participants ?? participants?.count ?? 0
    }

    var statusLabel: String {
        switch status {
        case "open": return "Öppen"
        case "matched": return "Matchad"
        case "completed": return "Slutförd"
        case "cancelled": return "Avbruten"
        default: return status
        }
    }

    var isOpen: Bool { status == "open" }

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

    var totalHorses: Int {
        participants?.reduce(0) { $0 + $1.numberOfHorses } ?? 0
    }
}

// MARK: - Participant

struct GroupBookingParticipant: Codable, Identifiable, Sendable {
    let id: String
    let numberOfHorses: Int
    let horseName: String?
    let horseInfo: String?
    let notes: String?
    let status: String
    let user: ParticipantUser?

    struct ParticipantUser: Codable, Sendable {
        let firstName: String?
    }

    var displayName: String {
        user?.firstName ?? "Deltagare"
    }
}

// MARK: - Match Request/Response

struct GroupBookingMatchRequest: Codable, Sendable {
    let serviceId: String
    let bookingDate: String
    let startTime: String
}

struct GroupBookingMatchResponse: Codable, Sendable {
    let message: String
    let bookingsCreated: Int
    let errors: [String]
}
#endif
