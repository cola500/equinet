//
//  ServiceModels.swift
//  Equinet
//
//  Codable models for native service management (/api/native/services).
//

import Foundation

// MARK: - Service Item

struct ServiceItem: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let description: String?
    let price: Double
    let durationMinutes: Int
    let isActive: Bool
    let recommendedIntervalWeeks: Int?

    func withIsActive(_ value: Bool) -> ServiceItem {
        ServiceItem(
            id: id,
            name: name,
            description: description,
            price: price,
            durationMinutes: durationMinutes,
            isActive: value,
            recommendedIntervalWeeks: recommendedIntervalWeeks
        )
    }

    // MARK: - Computed

    private static let priceFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = "\u{00A0}" // non-breaking space
        f.maximumFractionDigits = 0
        return f
    }()

    var formattedPrice: String {
        let formatted = Self.priceFormatter.string(from: NSNumber(value: price)) ?? "\(Int(price))"
        return "\(formatted) kr"
    }

    var formattedDuration: String {
        let hours = durationMinutes / 60
        let mins = durationMinutes % 60
        if hours > 0 && mins > 0 {
            return "\(hours) h \(mins) min"
        } else if hours > 0 {
            return "\(hours) h"
        }
        return "\(mins) min"
    }

    var intervalLabel: String? {
        guard let weeks = recommendedIntervalWeeks else { return nil }
        switch weeks {
        case 1: return "Varje vecka"
        case 2: return "Varannan vecka"
        case 3: return "Var 3:e vecka"
        case 4: return "Var 4:e vecka"
        case 6: return "Var 6:e vecka"
        case 8: return "Var 8:e vecka"
        case 12: return "Var 12:e vecka"
        case 26: return "Var 26:e vecka"
        case 52: return "Varje år"
        default: return "Var \(weeks):e vecka"
        }
    }
}

extension ServiceItem: Hashable {
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: ServiceItem, rhs: ServiceItem) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Sheet Type

enum ServiceSheetType: Identifiable {
    case add
    case edit(ServiceItem)

    var id: String {
        switch self {
        case .add: return "addService"
        case .edit(let s): return "editService-\(s.id)"
        }
    }
}

// MARK: - API Response Wrappers

struct ServicesListResponse: Codable, Sendable {
    let services: [ServiceItem]
}

struct ServiceCreateResponse: Codable, Sendable {
    let service: ServiceItem
}

struct ServiceUpdateResponse: Codable, Sendable {
    let service: ServiceItem
}
