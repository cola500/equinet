//
//  ProfileModels.swift
//  Equinet
//
//  Codable models for native provider profile (/api/native/provider/profile).
//

import Foundation

// MARK: - Profile User

struct ProfileUser: Codable, Sendable {
    let firstName: String
    let lastName: String
    let email: String
    let phone: String?
}

// MARK: - Provider Profile

struct ProviderProfile: Codable, Sendable, Identifiable {
    let id: String
    let businessName: String
    let description: String?
    let address: String?
    let city: String?
    let postalCode: String?
    let serviceArea: String?
    let latitude: Double?
    let longitude: Double?
    let serviceAreaKm: Double?
    let profileImageUrl: String?
    let isActive: Bool
    let acceptingNewCustomers: Bool
    let rescheduleEnabled: Bool
    let rescheduleWindowHours: Int
    let maxReschedules: Int
    let rescheduleRequiresApproval: Bool
    let recurringEnabled: Bool
    let maxSeriesOccurrences: Int
    let isVerified: Bool
    let user: ProfileUser

    /// Profile completion percentage (0-100).
    /// Counts key fields that are filled in.
    var profileCompletion: Int {
        var filled = 0
        var total = 0

        let checks: [Bool] = [
            !businessName.isEmpty,
            description != nil && !description!.isEmpty,
            address != nil && !address!.isEmpty,
            city != nil && !city!.isEmpty,
            postalCode != nil && !postalCode!.isEmpty,
            profileImageUrl != nil && !profileImageUrl!.isEmpty,
            !user.firstName.isEmpty,
            !user.lastName.isEmpty,
            user.phone != nil && !user.phone!.isEmpty,
        ]

        total = checks.count
        filled = checks.filter { $0 }.count

        guard total > 0 else { return 100 }
        return (filled * 100) / total
    }
}

// MARK: - Geocode Result

struct GeocodeResult: Codable, Sendable {
    let latitude: Double
    let longitude: Double
}
