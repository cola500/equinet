//
//  ServicesViewModel.swift
//  Equinet
//
//  MVVM ViewModel for native service management.
//  Handles listing, CRUD, and optimistic UI for services.
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
protocol ServicesDataFetching: Sendable {
    func fetchServices() async throws -> [ServiceItem]
    func createService(_ data: [String: Any]) async throws -> ServiceItem
    func updateService(id: String, data: [String: Any]) async throws -> ServiceItem
    func deleteService(id: String) async throws
}

// MARK: - Production Adapter

struct APIServicesFetcher: ServicesDataFetching {
    func fetchServices() async throws -> [ServiceItem] {
        try await APIClient.shared.fetchServices()
    }

    func createService(_ data: [String: Any]) async throws -> ServiceItem {
        try await APIClient.shared.createService(data)
    }

    func updateService(id: String, data: [String: Any]) async throws -> ServiceItem {
        try await APIClient.shared.updateService(id: id, data: data)
    }

    func deleteService(id: String) async throws {
        try await APIClient.shared.deleteService(id: id)
    }
}

// MARK: - ViewModel

@Observable
@MainActor
final class ServicesViewModel {

    // MARK: - State

    var services: [ServiceItem] = []
    private(set) var isLoading = false
    private(set) var error: String?
    private(set) var actionInProgress = false

    // Sheet
    var activeSheet: ServiceSheetType?

    // Delete confirmation
    var serviceToDelete: ServiceItem?

    // MARK: - Dependencies

    private let fetcher: ServicesDataFetching

    // MARK: - Init

    init(fetcher: ServicesDataFetching? = nil) {
        self.fetcher = fetcher ?? APIServicesFetcher()
    }

    // MARK: - Loading

    func loadServices() async {
        isLoading = services.isEmpty
        error = nil

        do {
            let fetched = try await fetcher.fetchServices()
            services = fetched
            isLoading = false
        } catch {
            isLoading = false
            if services.isEmpty {
                self.error = "Kunde inte hämta tjänster"
            }
            AppLogger.network.error("Failed to fetch services: \(error.localizedDescription)")
        }
    }

    func refresh() async {
        error = nil
        do {
            let fetched = try await fetcher.fetchServices()
            services = fetched
        } catch {
            self.error = "Kunde inte uppdatera tjänster"
            AppLogger.network.error("Failed to refresh services: \(error.localizedDescription)")
        }
    }

    // MARK: - CRUD

    func createService(name: String, description: String?, price: Double, durationMinutes: Int, isActive: Bool, recommendedIntervalWeeks: Int?) async -> Bool {
        actionInProgress = true

        var data: [String: Any] = [
            "name": name,
            "price": price,
            "durationMinutes": durationMinutes,
            "isActive": isActive,
        ]
        if let description, !description.isEmpty {
            data["description"] = description
        }
        if let recommendedIntervalWeeks {
            data["recommendedIntervalWeeks"] = recommendedIntervalWeeks
        }

        do {
            let service = try await fetcher.createService(data)
            services.insert(service, at: 0)
            actionInProgress = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
            return true
        } catch {
            actionInProgress = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            AppLogger.network.error("Failed to create service: \(error.localizedDescription)")
            return false
        }
    }

    func updateService(id: String, name: String, description: String?, price: Double, durationMinutes: Int, isActive: Bool, recommendedIntervalWeeks: Int?) async -> Bool {
        actionInProgress = true

        var data: [String: Any] = [
            "name": name,
            "price": price,
            "durationMinutes": durationMinutes,
            "isActive": isActive,
        ]
        if let description, !description.isEmpty {
            data["description"] = description
        } else {
            data["description"] = NSNull()
        }
        if let recommendedIntervalWeeks {
            data["recommendedIntervalWeeks"] = recommendedIntervalWeeks
        } else {
            data["recommendedIntervalWeeks"] = NSNull()
        }

        do {
            let updated = try await fetcher.updateService(id: id, data: data)
            if let index = services.firstIndex(where: { $0.id == id }) {
                services[index] = updated
            }
            actionInProgress = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
            return true
        } catch {
            actionInProgress = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            AppLogger.network.error("Failed to update service: \(error.localizedDescription)")
            return false
        }
    }

    func deleteService(id: String) async -> Bool {
        // Optimistic: remove from list
        let oldServices = services
        services.removeAll { $0.id == id }

        do {
            try await fetcher.deleteService(id: id)
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
            return true
        } catch {
            // Revert
            services = oldServices
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            AppLogger.network.error("Failed to delete service: \(error.localizedDescription)")
            return false
        }
    }

    func toggleActive(service: ServiceItem) async {
        // Optimistic toggle
        let newActive = !service.isActive
        let oldServices = services
        if let index = services.firstIndex(where: { $0.id == service.id }) {
            services[index] = service.withIsActive(newActive)
        }

        var data: [String: Any] = [
            "name": service.name,
            "price": service.price,
            "durationMinutes": service.durationMinutes,
            "isActive": newActive,
        ]
        if let desc = service.description {
            data["description"] = desc
        }
        if let interval = service.recommendedIntervalWeeks {
            data["recommendedIntervalWeeks"] = interval
        }

        do {
            let updated = try await fetcher.updateService(id: service.id, data: data)
            if let index = services.firstIndex(where: { $0.id == service.id }) {
                services[index] = updated
            }
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
        } catch {
            // Revert
            services = oldServices
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            AppLogger.network.error("Failed to toggle service active: \(error.localizedDescription)")
        }
    }

    // MARK: - Reset (for logout)

    func reset() {
        services = []
        isLoading = false
        error = nil
        actionInProgress = false
        activeSheet = nil
        serviceToDelete = nil
    }
}
