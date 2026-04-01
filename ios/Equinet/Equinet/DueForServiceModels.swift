import Foundation

// MARK: - API Response

struct DueForServiceResponse: Codable, Sendable {
    let items: [DueForServiceItem]
}

// MARK: - Item

struct DueForServiceItem: Codable, Identifiable, Sendable {
    let horseId: String
    let horseName: String
    let serviceId: String
    let serviceName: String
    let lastServiceDate: String      // ISO 8601
    let daysSinceService: Int
    let intervalWeeks: Int
    let dueDate: String              // ISO 8601
    let daysUntilDue: Int
    let status: DueStatus
    let ownerName: String

    var id: String { "\(horseId):\(serviceId)" }

    var formattedLastServiceDate: String {
        Self.displayFormatter.string(from: Self.isoDate(lastServiceDate) ?? Date())
    }

    var formattedDueDate: String {
        Self.displayFormatter.string(from: Self.isoDate(dueDate) ?? Date())
    }

    var urgencyText: String {
        if daysUntilDue < 0 {
            let days = abs(daysUntilDue)
            return "\(days) \(days == 1 ? "dag" : "dagar") försenad"
        } else if daysUntilDue == 0 {
            return "Idag"
        } else {
            return "om \(daysUntilDue) \(daysUntilDue == 1 ? "dag" : "dagar")"
        }
    }

    // MARK: - Static formatters (performance: reuse)

    private static let displayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "sv_SE")
        f.dateFormat = "d MMM yyyy"
        return f
    }()

    private static func isoDate(_ string: String) -> Date? {
        try? Date(string, strategy: .iso8601)
    }
}

// MARK: - Hashable

extension DueForServiceItem: Hashable {
    func hash(into hasher: inout Hasher) {
        hasher.combine(horseId)
        hasher.combine(serviceId)
    }

    static func == (lhs: DueForServiceItem, rhs: DueForServiceItem) -> Bool {
        lhs.horseId == rhs.horseId && lhs.serviceId == rhs.serviceId
    }
}

// MARK: - Status enum

enum DueStatus: String, Codable, Sendable {
    case overdue
    case upcoming
    case ok

    /// Fallback for unknown values from API
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let value = try container.decode(String.self)
        self = DueStatus(rawValue: value) ?? .ok
    }

    var label: String {
        switch self {
        case .overdue: "Försenad"
        case .upcoming: "Inom 2 veckor"
        case .ok: "Ej aktuell"
        }
    }
}

// MARK: - Filter enum

enum DueForServiceFilter: String, CaseIterable, Sendable {
    case all
    case overdue
    case upcoming

    var label: String {
        switch self {
        case .all: "Alla"
        case .overdue: "Försenade"
        case .upcoming: "Inom 2 veckor"
        }
    }
}
