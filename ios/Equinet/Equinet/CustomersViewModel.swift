//
//  CustomersViewModel.swift
//  Equinet
//
//  MVVM ViewModel for native customer management.
//  Handles listing, filtering, search, CRUD for customers, horses, and notes.
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
protocol CustomersDataFetching: Sendable {
    func fetchCustomers(status: String?, query: String?) async throws -> [CustomerSummary]
    func createCustomer(firstName: String, lastName: String, phone: String?, email: String?) async throws -> String
    func updateCustomer(customerId: String, firstName: String, lastName: String, phone: String?, email: String?) async throws -> CustomerUpdateResponse
    func deleteCustomer(customerId: String) async throws
    func fetchHorses(customerId: String) async throws -> [CustomerHorse]
    func createHorse(customerId: String, name: String, breed: String?, birthYear: Int?, color: String?, gender: String?, specialNeeds: String?, registrationNumber: String?, microchipNumber: String?) async throws -> CustomerHorse
    func updateHorse(customerId: String, horseId: String, name: String?, breed: String?, birthYear: Int?, color: String?, gender: String?, specialNeeds: String?, registrationNumber: String?, microchipNumber: String?) async throws -> CustomerHorse
    func deleteHorse(customerId: String, horseId: String) async throws
    func fetchNotes(customerId: String) async throws -> [CustomerNote]
    func createNote(customerId: String, content: String) async throws -> CustomerNote
    func updateNote(customerId: String, noteId: String, content: String) async throws -> CustomerNote
    func deleteNote(customerId: String, noteId: String) async throws
}

// MARK: - Production Adapter

struct APICustomersFetcher: CustomersDataFetching {
    func fetchCustomers(status: String?, query: String?) async throws -> [CustomerSummary] {
        try await APIClient.shared.fetchCustomers(status: status, query: query)
    }

    func createCustomer(firstName: String, lastName: String, phone: String?, email: String?) async throws -> String {
        try await APIClient.shared.createCustomer(firstName: firstName, lastName: lastName, phone: phone, email: email)
    }

    func updateCustomer(customerId: String, firstName: String, lastName: String, phone: String?, email: String?) async throws -> CustomerUpdateResponse {
        try await APIClient.shared.updateCustomer(customerId: customerId, firstName: firstName, lastName: lastName, phone: phone, email: email)
    }

    func deleteCustomer(customerId: String) async throws {
        try await APIClient.shared.deleteCustomer(customerId: customerId)
    }

    func fetchHorses(customerId: String) async throws -> [CustomerHorse] {
        try await APIClient.shared.fetchCustomerHorses(customerId: customerId)
    }

    func createHorse(customerId: String, name: String, breed: String?, birthYear: Int?, color: String?, gender: String?, specialNeeds: String?, registrationNumber: String?, microchipNumber: String?) async throws -> CustomerHorse {
        try await APIClient.shared.createCustomerHorse(customerId: customerId, name: name, breed: breed, birthYear: birthYear, color: color, gender: gender, specialNeeds: specialNeeds, registrationNumber: registrationNumber, microchipNumber: microchipNumber)
    }

    func updateHorse(customerId: String, horseId: String, name: String?, breed: String?, birthYear: Int?, color: String?, gender: String?, specialNeeds: String?, registrationNumber: String?, microchipNumber: String?) async throws -> CustomerHorse {
        try await APIClient.shared.updateCustomerHorse(customerId: customerId, horseId: horseId, name: name, breed: breed, birthYear: birthYear, color: color, gender: gender, specialNeeds: specialNeeds, registrationNumber: registrationNumber, microchipNumber: microchipNumber)
    }

    func deleteHorse(customerId: String, horseId: String) async throws {
        try await APIClient.shared.deleteCustomerHorse(customerId: customerId, horseId: horseId)
    }

    func fetchNotes(customerId: String) async throws -> [CustomerNote] {
        try await APIClient.shared.fetchCustomerNotes(customerId: customerId)
    }

    func createNote(customerId: String, content: String) async throws -> CustomerNote {
        try await APIClient.shared.createCustomerNote(customerId: customerId, content: content)
    }

    func updateNote(customerId: String, noteId: String, content: String) async throws -> CustomerNote {
        try await APIClient.shared.updateCustomerNote(customerId: customerId, noteId: noteId, content: content)
    }

    func deleteNote(customerId: String, noteId: String) async throws {
        try await APIClient.shared.deleteCustomerNote(customerId: customerId, noteId: noteId)
    }
}

// MARK: - Sheet Type

enum CustomerSheetType: Identifiable {
    case addCustomer
    case editCustomer(CustomerSummary)
    case addHorse(String)  // customerId
    case editHorse(String, CustomerHorse)  // customerId, horse
    case addNote(String)  // customerId
    case editNote(String, CustomerNote)  // customerId, note

    var id: String {
        switch self {
        case .addCustomer: return "addCustomer"
        case .editCustomer(let c): return "editCustomer-\(c.id)"
        case .addHorse(let id): return "addHorse-\(id)"
        case .editHorse(let cId, let h): return "editHorse-\(cId)-\(h.id)"
        case .addNote(let id): return "addNote-\(id)"
        case .editNote(let cId, let n): return "editNote-\(cId)-\(n.id)"
        }
    }
}

// MARK: - ViewModel

@Observable
@MainActor
final class CustomersViewModel {

    // MARK: - State

    var customers: [CustomerSummary] = []
    var selectedFilter: CustomerFilter = .all
    var searchQuery = ""
    private(set) var isLoading = false
    private(set) var error: String?

    // Detail state
    var horses: [CustomerHorse] = []
    var notes: [CustomerNote] = []
    private(set) var isLoadingDetail = false
    private(set) var detailError: String?
    private(set) var actionInProgress = false

    // Sheet
    var activeSheet: CustomerSheetType?

    // MARK: - Dependencies

    private let fetcher: CustomersDataFetching

    // MARK: - Init

    init(fetcher: CustomersDataFetching? = nil) {
        self.fetcher = fetcher ?? APICustomersFetcher()
    }

    // MARK: - Computed

    var filteredCustomers: [CustomerSummary] {
        var result = customers

        // Filter by status
        if selectedFilter != .all {
            result = result.filter { c in
                let filterParam = selectedFilter.rawValue
                if filterParam == "active" {
                    // Active = has booking within last 12 months
                    guard let last = c.lastBookingDate else { return false }
                    let twelveMonthsAgo = Calendar.current.date(byAdding: .month, value: -12, to: Date()) ?? Date()
                    let isoFormatter = ISO8601DateFormatter()
                    guard let lastDate = isoFormatter.date(from: last) else { return false }
                    return lastDate >= twelveMonthsAgo
                } else {
                    // Inactive = no booking or last booking > 12 months ago
                    guard let last = c.lastBookingDate else { return true }
                    let twelveMonthsAgo = Calendar.current.date(byAdding: .month, value: -12, to: Date()) ?? Date()
                    let isoFormatter = ISO8601DateFormatter()
                    guard let lastDate = isoFormatter.date(from: last) else { return true }
                    return lastDate < twelveMonthsAgo
                }
            }
        }

        // Filter by search
        if !searchQuery.isEmpty {
            let q = searchQuery.lowercased()
            result = result.filter { c in
                c.fullName.lowercased().contains(q) ||
                c.email.lowercased().contains(q)
            }
        }

        return result
    }

    // MARK: - Loading

    func loadCustomers() async {
        isLoading = customers.isEmpty
        error = nil

        do {
            let fetched = try await fetcher.fetchCustomers(status: nil, query: nil)
            customers = fetched
            isLoading = false
        } catch {
            isLoading = false
            if customers.isEmpty {
                self.error = "Kunde inte hämta kunder"
            }
            AppLogger.network.error("Failed to fetch customers: \(error.localizedDescription)")
        }
    }

    func refresh() async {
        error = nil
        do {
            let fetched = try await fetcher.fetchCustomers(status: nil, query: nil)
            customers = fetched
        } catch {
            self.error = "Kunde inte uppdatera kundlistan"
            AppLogger.network.error("Failed to refresh customers: \(error.localizedDescription)")
        }
    }

    // MARK: - Customer CRUD

    func createCustomer(firstName: String, lastName: String, phone: String?, email: String?) async -> Bool {
        actionInProgress = true
        do {
            _ = try await fetcher.createCustomer(firstName: firstName, lastName: lastName, phone: phone, email: email)
            actionInProgress = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
            await loadCustomers()
            return true
        } catch {
            actionInProgress = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            AppLogger.network.error("Failed to create customer: \(error.localizedDescription)")
            return false
        }
    }

    func updateCustomer(customerId: String, firstName: String, lastName: String, phone: String?, email: String?) async -> Bool {
        actionInProgress = true
        do {
            _ = try await fetcher.updateCustomer(customerId: customerId, firstName: firstName, lastName: lastName, phone: phone, email: email)
            actionInProgress = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
            await loadCustomers()
            return true
        } catch {
            actionInProgress = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            AppLogger.network.error("Failed to update customer: \(error.localizedDescription)")
            return false
        }
    }

    func deleteCustomer(customerId: String) async -> Bool {
        // Optimistic: remove from list
        let oldCustomers = customers
        customers.removeAll { $0.id == customerId }

        do {
            try await fetcher.deleteCustomer(customerId: customerId)
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
            return true
        } catch {
            // Revert
            customers = oldCustomers
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            AppLogger.network.error("Failed to delete customer: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - Detail Loading

    func loadDetail(customerId: String) async {
        isLoadingDetail = true
        detailError = nil

        do {
            async let horsesResult = fetcher.fetchHorses(customerId: customerId)
            async let notesResult = fetcher.fetchNotes(customerId: customerId)
            let (h, n) = try await (horsesResult, notesResult)
            horses = h
            notes = n
            isLoadingDetail = false
        } catch {
            isLoadingDetail = false
            detailError = "Kunde inte hämta detaljer"
            AppLogger.network.error("Failed to fetch customer detail: \(error.localizedDescription)")
        }
    }

    // MARK: - Horse CRUD

    func createHorse(customerId: String, name: String, breed: String?, birthYear: Int?, color: String?, gender: String?, specialNeeds: String?, registrationNumber: String?, microchipNumber: String?) async -> Bool {
        actionInProgress = true
        do {
            let horse = try await fetcher.createHorse(customerId: customerId, name: name, breed: breed, birthYear: birthYear, color: color, gender: gender, specialNeeds: specialNeeds, registrationNumber: registrationNumber, microchipNumber: microchipNumber)
            horses.append(horse)
            horses.sort { $0.name < $1.name }
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
            AppLogger.network.error("Failed to create horse: \(error.localizedDescription)")
            return false
        }
    }

    func updateHorse(customerId: String, horseId: String, name: String?, breed: String?, birthYear: Int?, color: String?, gender: String?, specialNeeds: String?, registrationNumber: String?, microchipNumber: String?) async -> Bool {
        actionInProgress = true
        do {
            let updated = try await fetcher.updateHorse(customerId: customerId, horseId: horseId, name: name, breed: breed, birthYear: birthYear, color: color, gender: gender, specialNeeds: specialNeeds, registrationNumber: registrationNumber, microchipNumber: microchipNumber)
            if let index = horses.firstIndex(where: { $0.id == horseId }) {
                horses[index] = updated
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
            AppLogger.network.error("Failed to update horse: \(error.localizedDescription)")
            return false
        }
    }

    func deleteHorse(customerId: String, horseId: String) async -> Bool {
        let oldHorses = horses
        horses.removeAll { $0.id == horseId }

        do {
            try await fetcher.deleteHorse(customerId: customerId, horseId: horseId)
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
            return true
        } catch {
            horses = oldHorses
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            AppLogger.network.error("Failed to delete horse: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - Note CRUD

    func createNote(customerId: String, content: String) async -> Bool {
        actionInProgress = true
        do {
            let note = try await fetcher.createNote(customerId: customerId, content: content)
            notes.insert(note, at: 0)
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
            AppLogger.network.error("Failed to create note: \(error.localizedDescription)")
            return false
        }
    }

    func updateNote(customerId: String, noteId: String, content: String) async -> Bool {
        actionInProgress = true
        do {
            let updated = try await fetcher.updateNote(customerId: customerId, noteId: noteId, content: content)
            if let index = notes.firstIndex(where: { $0.id == noteId }) {
                notes[index] = updated
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
            AppLogger.network.error("Failed to update note: \(error.localizedDescription)")
            return false
        }
    }

    func deleteNote(customerId: String, noteId: String) async -> Bool {
        let oldNotes = notes
        notes.removeAll { $0.id == noteId }

        do {
            try await fetcher.deleteNote(customerId: customerId, noteId: noteId)
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
            return true
        } catch {
            notes = oldNotes
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            AppLogger.network.error("Failed to delete note: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - Reset (for logout)

    func reset() {
        customers = []
        horses = []
        notes = []
        selectedFilter = .all
        searchQuery = ""
        isLoading = false
        error = nil
        isLoadingDetail = false
        detailError = nil
        actionInProgress = false
        activeSheet = nil
    }
}
