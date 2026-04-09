//
//  GroupBookingsViewModel.swift
//  Equinet
//
//  MVVM ViewModel for provider's group bookings view.
//

#if os(iOS)
import Foundation
import OSLog
import Observation
import UIKit

@Observable
@MainActor
final class GroupBookingsViewModel {

    // MARK: - State

    var requests: [GroupBookingRequest] = []
    private(set) var isLoading = false
    private(set) var error: String?

    var detail: GroupBookingRequest?
    private(set) var isLoadingDetail = false

    private(set) var isMatching = false
    var matchResult: GroupBookingMatchResponse?

    // MARK: - Loading

    func loadAvailable() async {
        isLoading = requests.isEmpty
        error = nil

        do {
            let response: GroupBookingsListResponse = try await APIClient.shared.authenticatedGet(
                path: "/api/native/group-bookings/available"
            )
            requests = response.requests
            isLoading = false
        } catch {
            isLoading = false
            if requests.isEmpty {
                self.error = "Kunde inte hämta grupprequests"
            }
            AppLogger.network.error("Failed to fetch group bookings: \(error.localizedDescription)")
        }
    }

    func refresh() async {
        error = nil
        do {
            let response: GroupBookingsListResponse = try await APIClient.shared.authenticatedGet(
                path: "/api/native/group-bookings/available"
            )
            requests = response.requests
        } catch {
            self.error = "Kunde inte uppdatera"
            AppLogger.network.error("Failed to refresh group bookings: \(error.localizedDescription)")
        }
    }

    // MARK: - Detail

    func loadDetail(id: String) async {
        isLoadingDetail = true
        do {
            detail = try await APIClient.shared.authenticatedGet(
                path: "/api/native/group-bookings/\(id)"
            )
            isLoadingDetail = false
        } catch {
            isLoadingDetail = false
            AppLogger.network.error("Failed to fetch group booking detail: \(error.localizedDescription)")
        }
    }

    // MARK: - Match

    func match(id: String, serviceId: String, bookingDate: String, startTime: String) async -> Bool {
        isMatching = true
        matchResult = nil

        do {
            let response: GroupBookingMatchResponse = try await APIClient.shared.authenticatedPost(
                path: "/api/native/group-bookings/\(id)/match",
                body: [
                    "serviceId": serviceId,
                    "bookingDate": bookingDate,
                    "startTime": startTime,
                ]
            )
            matchResult = response
            isMatching = false
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            // Reload to get updated status
            await loadAvailable()
            return true
        } catch {
            isMatching = false
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            AppLogger.network.error("Failed to match group booking: \(error.localizedDescription)")
            return false
        }
    }
}
#endif
