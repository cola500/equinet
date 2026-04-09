//
//  ProfileViewModel.swift
//  Equinet
//
//  MVVM ViewModel for native provider profile.
//  Handles loading, updating personal/business/settings info, and account deletion.
//  Dependencies injected via protocol for testability.
//

import Foundation
import OSLog
import Observation
#if os(iOS)
import UIKit
#endif

// MARK: - DI Protocol

@MainActor
protocol ProfileDataFetching: Sendable {
    func fetchProfile() async throws -> ProviderProfile
    func updateProfile(_ data: [String: Any]) async throws -> ProviderProfile
    func deleteAccount(password: String, confirmation: String) async throws
}

// MARK: - Production Adapter

struct APIProfileFetcher: ProfileDataFetching {
    func fetchProfile() async throws -> ProviderProfile {
        try await APIClient.shared.fetchProfile()
    }

    func updateProfile(_ data: [String: Any]) async throws -> ProviderProfile {
        try await APIClient.shared.updateProfile(data)
    }

    func deleteAccount(password: String, confirmation: String) async throws {
        try await APIClient.shared.deleteAccount(password: password, confirmation: confirmation)
    }
}

// MARK: - ViewModel

@Observable
@MainActor
final class ProfileViewModel {

    // MARK: - State

    var profile: ProviderProfile?
    private(set) var isLoading = false
    private(set) var error: String?
    private(set) var isSaving = false

    // MARK: - Dependencies

    private let fetcher: ProfileDataFetching

    // MARK: - Init

    init(fetcher: ProfileDataFetching? = nil) {
        self.fetcher = fetcher ?? APIProfileFetcher()
    }

    // MARK: - Loading

    func loadProfile() async {
        isLoading = profile == nil
        error = nil

        do {
            let fetched = try await fetcher.fetchProfile()
            profile = fetched
            isLoading = false
        } catch {
            isLoading = false
            if profile == nil {
                self.error = "Kunde inte hämta profil"
            }
            AppLogger.network.error("Failed to fetch profile: \(error.localizedDescription)")
        }
    }

    // MARK: - Update Personal Info

    func updatePersonalInfo(firstName: String, lastName: String, phone: String?) async -> Bool {
        isSaving = true

        var data: [String: Any] = [
            "firstName": firstName,
            "lastName": lastName,
        ]
        if let phone, !phone.isEmpty {
            data["phone"] = phone
        } else {
            data["phone"] = NSNull()
        }

        do {
            let updated = try await fetcher.updateProfile(data)
            profile = updated
            isSaving = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
            return true
        } catch {
            isSaving = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            AppLogger.network.error("Failed to update personal info: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - Update Business Info

    func updateBusinessInfo(
        businessName: String,
        description: String?,
        address: String?,
        city: String?,
        postalCode: String?,
        serviceArea: String?,
        latitude: Double?,
        longitude: Double?,
        serviceAreaKm: Double?
    ) async -> Bool {
        isSaving = true

        var data: [String: Any] = ["businessName": businessName]
        data["description"] = description ?? NSNull()
        data["address"] = address ?? NSNull()
        data["city"] = city ?? NSNull()
        data["postalCode"] = postalCode ?? NSNull()
        data["serviceArea"] = serviceArea ?? NSNull()
        if let latitude {
            data["latitude"] = latitude
        } else {
            data["latitude"] = NSNull()
        }
        if let longitude {
            data["longitude"] = longitude
        } else {
            data["longitude"] = NSNull()
        }
        if let serviceAreaKm {
            data["serviceAreaKm"] = serviceAreaKm
        } else {
            data["serviceAreaKm"] = NSNull()
        }

        do {
            let updated = try await fetcher.updateProfile(data)
            profile = updated
            isSaving = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
            return true
        } catch {
            isSaving = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            AppLogger.network.error("Failed to update business info: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - Update Settings

    func updateSettings(_ data: [String: Any]) async -> Bool {
        isSaving = true

        do {
            let updated = try await fetcher.updateProfile(data)
            profile = updated
            isSaving = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
            return true
        } catch {
            isSaving = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            AppLogger.network.error("Failed to update settings: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - Delete Account

    func deleteAccount(password: String, confirmation: String) async -> Bool {
        isSaving = true

        do {
            try await fetcher.deleteAccount(password: password, confirmation: confirmation)
            isSaving = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
            return true
        } catch {
            isSaving = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            AppLogger.network.error("Failed to delete account: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - Upload Profile Image

    private(set) var isUploading = false

    /// Upload profile image data (JPEG). Returns true on success.
    func uploadProfileImage(_ imageData: Data) async -> Bool {
        isUploading = true

        do {
            let url = try await APIClient.shared.uploadProfileImage(imageData: imageData)
            // Update local profile with new image URL
            if var p = profile {
                p.profileImageUrl = url
                profile = p
            }
            isUploading = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
            return true
        } catch {
            isUploading = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            AppLogger.network.error("Failed to upload profile image: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - Reset (for logout)

    func reset() {
        profile = nil
        isLoading = false
        error = nil
        isSaving = false
    }
}
