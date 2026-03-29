//
//  DashboardViewModel.swift
//  Equinet
//
//  MVVM ViewModel for the native dashboard.
//  Handles cache-first loading, error mapping, and onboarding dismiss state.
//  Dependencies injected via protocol for testability.
//

import Foundation
import OSLog
import Observation

// MARK: - DI Protocol

@MainActor
protocol DashboardDataFetching: Sendable {
    func fetchDashboard() async throws -> DashboardResponse
}

// MARK: - Production Adapter

struct APIDashboardFetcher: DashboardDataFetching {
    func fetchDashboard() async throws -> DashboardResponse {
        try await APIClient.shared.fetchDashboard()
    }
}

// MARK: - ViewModel

@Observable
@MainActor
final class DashboardViewModel {

    // MARK: - State

    private(set) var dashboard: DashboardResponse?
    private(set) var isLoading = true
    private(set) var error: String?
    var onboardingDismissed = false

    // MARK: - Dependencies

    private let fetcher: DashboardDataFetching

    // MARK: - Onboarding Keys

    private static let dismissUntilKey = "dashboard_onboarding_dismiss_until"
    private static let dismissPermanentKey = "dashboard_onboarding_dismiss_permanent"

    // MARK: - Init

    init(fetcher: DashboardDataFetching? = nil) {
        self.fetcher = fetcher ?? APIDashboardFetcher()
    }

    // MARK: - Loading

    /// Load dashboard with cache-first strategy
    func loadDashboard() async {
        // Show cached data immediately
        if let cached = SharedDataManager.loadDashboardCache() {
            dashboard = cached.response
            isLoading = false
            // Refresh in background if cache exists
            await fetchDashboard()
            return
        }
        // No cache -- show loading state
        isLoading = true
        await fetchDashboard()
        isLoading = false
    }

    /// Pull-to-refresh (no loading spinner, just fetch)
    func refresh() async {
        await fetchDashboard()
    }

    // MARK: - Onboarding Dismiss

    func isOnboardingDismissed() -> Bool {
        if onboardingDismissed { return true }
        let defaults = UserDefaults.standard
        if defaults.bool(forKey: Self.dismissPermanentKey) { return true }
        if let until = defaults.object(forKey: Self.dismissUntilKey) as? Date {
            return Date.now < until
        }
        return false
    }

    func dismissOnboarding(permanent: Bool) {
        onboardingDismissed = true
        if permanent {
            UserDefaults.standard.set(true, forKey: Self.dismissPermanentKey)
        } else {
            let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: .now) ?? .now
            UserDefaults.standard.set(tomorrow, forKey: Self.dismissUntilKey)
        }
    }

    /// Reset state (for logout)
    func reset() {
        dashboard = nil
        isLoading = true
        error = nil
        onboardingDismissed = false
    }

    // MARK: - Private

    private func fetchDashboard() async {
        do {
            let response = try await fetcher.fetchDashboard()
            dashboard = response
            error = nil
            SharedDataManager.saveDashboardCache(response)
        } catch let apiError as APIError {
            // Only show error if we have no cached data
            if dashboard == nil {
                switch apiError {
                case .networkError, .timeout:
                    error = "Kontrollera din internetanslutning och försök igen."
                case .unauthorized:
                    error = "Du behöver logga in igen."
                case .rateLimited:
                    error = "För många förfrågningar. Försök igen om en stund."
                default:
                    error = "Något gick fel. Försök igen."
                }
            }
            AppLogger.network.error("Dashboard fetch failed: \(String(describing: apiError))")
        } catch {
            if dashboard == nil {
                self.error = "Något gick fel. Försök igen."
            }
            AppLogger.network.error("Dashboard fetch failed: \(error.localizedDescription)")
        }
    }
}
