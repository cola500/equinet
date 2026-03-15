//
//  CustomerModels.swift
//  Equinet
//
//  Codable models for native customer management (/api/native/customers).
//

import Foundation

// MARK: - Customer Summary (List Item)

struct CustomerSummary: Codable, Identifiable, Sendable {
    let id: String
    let firstName: String
    let lastName: String
    let email: String
    let phone: String?
    let bookingCount: Int
    let noShowCount: Int
    let lastBookingDate: String?
    let horses: [CustomerHorseSummary]
    let isManuallyAdded: Bool?

    var fullName: String {
        lastName.isEmpty ? firstName : "\(firstName) \(lastName)"
    }

    var hasNoShowWarning: Bool {
        noShowCount >= 2
    }
}

extension CustomerSummary: Hashable {
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: CustomerSummary, rhs: CustomerSummary) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Customer Horse Summary (in list)

struct CustomerHorseSummary: Codable, Identifiable, Sendable, Hashable {
    let id: String
    let name: String
}

// MARK: - Customer Horse (full detail)

struct CustomerHorse: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let breed: String?
    let birthYear: Int?
    let color: String?
    let gender: String?
    let specialNeeds: String?
    let registrationNumber: String?
    let microchipNumber: String?

    var genderLabel: String {
        guard let gender else { return "Okänt" }
        switch gender {
        case "mare": return "Sto"
        case "gelding": return "Valack"
        case "stallion": return "Hingst"
        default: return "Okänt"
        }
    }
}

// MARK: - Customer Note

struct CustomerNote: Codable, Identifiable, Sendable {
    let id: String
    let content: String
    let createdAt: String
    let updatedAt: String
}

// MARK: - Customer Filter

enum CustomerFilter: String, CaseIterable, Sendable {
    case all
    case active
    case inactive

    var label: String {
        switch self {
        case .all: return "Alla"
        case .active: return "Aktiva"
        case .inactive: return "Inaktiva"
        }
    }
}

// MARK: - Customer Detail Tab

enum CustomerDetailTab: String, CaseIterable, Sendable {
    case overview
    case horses
    case notes

    var label: String {
        switch self {
        case .overview: return "Översikt"
        case .horses: return "Hästar"
        case .notes: return "Anteckningar"
        }
    }
}

// MARK: - API Response Wrappers

struct CustomersListResponse: Codable, Sendable {
    let customers: [CustomerSummary]
}

struct CustomerHorsesResponse: Codable, Sendable {
    let horses: [CustomerHorse]
}

struct CustomerNotesResponse: Codable, Sendable {
    let notes: [CustomerNote]
}

struct CustomerCreateResponse: Codable, Sendable {
    let customer: CustomerIdResponse
}

struct CustomerIdResponse: Codable, Sendable {
    let id: String
}

struct CustomerUpdateResponse: Codable, Sendable {
    let id: String
    let firstName: String
    let lastName: String
    let email: String
    let phone: String?
}

struct MessageResponse: Codable, Sendable {
    let message: String
}
