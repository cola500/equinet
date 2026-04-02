//
//  AnnouncementsViewModel.swift
//  Equinet
//
//  MVVM ViewModel for native route announcements.
//  Handles listing and cancellation with optimistic UI.
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
protocol AnnouncementsDataFetching: Sendable {
    func fetchAnnouncements() async throws -> [AnnouncementItem]
    func cancelAnnouncement(id: String) async throws
}

// MARK: - Production Adapter

struct APIAnnouncementsFetcher: AnnouncementsDataFetching {
    func fetchAnnouncements() async throws -> [AnnouncementItem] {
        try await APIClient.shared.fetchAnnouncements()
    }

    func cancelAnnouncement(id: String) async throws {
        try await APIClient.shared.cancelAnnouncement(id: id)
    }
}

// MARK: - ViewModel

@Observable
@MainActor
final class AnnouncementsViewModel {

    // MARK: - State

    var announcements: [AnnouncementItem] = []
    private(set) var isLoading = false
    private(set) var error: String?
    private(set) var actionInProgress = false

    // Cancel confirmation
    var announcementToCancel: AnnouncementItem?

    // MARK: - Dependencies

    private let fetcher: AnnouncementsDataFetching

    // MARK: - Init

    init(fetcher: AnnouncementsDataFetching? = nil) {
        self.fetcher = fetcher ?? APIAnnouncementsFetcher()
    }

    // MARK: - Loading

    func loadAnnouncements() async {
        // Cache-first: show cached data immediately
        if announcements.isEmpty, let cached = SharedDataManager.loadAnnouncementsCache() {
            announcements = cached.announcements
        }

        isLoading = announcements.isEmpty
        error = nil

        do {
            let fetched = try await fetcher.fetchAnnouncements()
            announcements = fetched
            SharedDataManager.saveAnnouncementsCache(fetched)
            isLoading = false
        } catch {
            isLoading = false
            if announcements.isEmpty {
                self.error = "Kunde inte hämta annonser"
            }
            AppLogger.network.error("Failed to fetch announcements: \(error.localizedDescription)")
        }
    }

    func refresh() async {
        error = nil
        do {
            let fetched = try await fetcher.fetchAnnouncements()
            announcements = fetched
            SharedDataManager.saveAnnouncementsCache(fetched)
        } catch {
            self.error = "Kunde inte uppdatera annonser"
            AppLogger.network.error("Failed to refresh announcements: \(error.localizedDescription)")
        }
    }

    // MARK: - Cancel

    func cancelAnnouncement(id: String) async -> Bool {
        actionInProgress = true
        let oldAnnouncements = announcements

        do {
            try await fetcher.cancelAnnouncement(id: id)
            SharedDataManager.clearAnnouncementsCache()
            // Reload to get fresh state from server
            let fetched = try await fetcher.fetchAnnouncements()
            announcements = fetched
            SharedDataManager.saveAnnouncementsCache(fetched)
            actionInProgress = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            #endif
            return true
        } catch {
            // Revert
            announcements = oldAnnouncements
            actionInProgress = false
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            AppLogger.network.error("Failed to cancel announcement: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - Computed

    var openAnnouncements: [AnnouncementItem] {
        announcements.filter { $0.status == "open" }
    }

    var closedAnnouncements: [AnnouncementItem] {
        announcements.filter { $0.status != "open" }
    }

    // MARK: - Reset (for logout)

    func reset() {
        announcements = []
        isLoading = false
        error = nil
        actionInProgress = false
        announcementToCancel = nil
    }
}
