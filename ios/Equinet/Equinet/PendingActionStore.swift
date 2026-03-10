//
//  PendingActionStore.swift
//  Equinet
//
//  Stores pending booking actions (confirm/decline) when offline.
//  Retried when network returns or app becomes active.
//

import Foundation
import OSLog

struct PendingBookingAction: Codable {
    let bookingId: String
    let status: String     // "confirmed" | "cancelled"
    let createdAt: Date
}

enum PendingActionStore {
    private static let key = "pending_booking_actions"

    static func save(bookingId: String, status: String, to defaults: UserDefaults = .standard) {
        var actions = load(from: defaults)
        actions.append(PendingBookingAction(
            bookingId: bookingId,
            status: status,
            createdAt: Date()
        ))
        if let data = try? JSONEncoder().encode(actions) {
            defaults.set(data, forKey: key)
        }
    }

    static func load(from defaults: UserDefaults = .standard) -> [PendingBookingAction] {
        guard let data = defaults.data(forKey: key),
              let actions = try? JSONDecoder().decode([PendingBookingAction].self, from: data) else {
            return []
        }
        // Discard actions older than 24h
        return actions.filter { Date().timeIntervalSince($0.createdAt) < 86400 }
    }

    static func clear(from defaults: UserDefaults = .standard) {
        defaults.removeObject(forKey: key)
    }

    /// Retry all pending actions. Called on network restored and app-start.
    @MainActor
    static func retryAll() {
        let actions = load()
        guard !actions.isEmpty else { return }

        Task {
            var remaining: [PendingBookingAction] = []

            for action in actions {
                do {
                    try await APIClient.shared.updateBookingStatus(
                        bookingId: action.bookingId,
                        newStatus: action.status
                    )
                    AppLogger.network.info("Retried pending action: \(action.bookingId) -> \(action.status)")
                } catch {
                    remaining.append(action)
                    AppLogger.network.error("Retry failed: \(error.localizedDescription)")
                }
            }

            if remaining.isEmpty {
                clear()
            } else if let data = try? JSONEncoder().encode(remaining) {
                UserDefaults.standard.set(data, forKey: key)
            }
        }
    }
}
