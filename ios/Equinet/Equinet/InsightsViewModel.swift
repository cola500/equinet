//
//  InsightsViewModel.swift
//  Equinet
//
//  MVVM ViewModel for native business insights.
//  Handles period selection, data loading, and heatmap pre-computation.
//  Dependencies injected via protocol for testability.
//

import Foundation
import OSLog
import Observation

// MARK: - DI Protocol

@MainActor
protocol InsightsDataFetching: Sendable {
    func fetchInsights(months: Int) async throws -> InsightsResponse
}

// MARK: - Production Adapter

struct APIInsightsFetcher: InsightsDataFetching {
    func fetchInsights(months: Int) async throws -> InsightsResponse {
        try await APIClient.shared.fetchInsights(months: months)
    }
}

// MARK: - Period

enum InsightsPeriod: Int, CaseIterable, Identifiable {
    case threeMonths = 3
    case sixMonths = 6
    case twelveMonths = 12

    var id: Int { rawValue }

    var label: String {
        switch self {
        case .threeMonths: "3 mån"
        case .sixMonths: "6 mån"
        case .twelveMonths: "12 mån"
        }
    }
}

// MARK: - ViewModel

@Observable
@MainActor
final class InsightsViewModel {

    // MARK: - State

    var selectedPeriod: InsightsPeriod = .sixMonths
    private(set) var response: InsightsResponse?
    private(set) var heatmapMatrix: HeatmapMatrix = .empty
    private(set) var isLoading = false
    private(set) var error: String?

    // MARK: - Dependencies

    private let fetcher: InsightsDataFetching

    // MARK: - Init

    init(fetcher: InsightsDataFetching? = nil) {
        self.fetcher = fetcher ?? APIInsightsFetcher()
    }

    // MARK: - Loading

    func loadInsights() async {
        isLoading = response == nil
        error = nil

        // Cache-first
        if response == nil, let cached = SharedDataManager.loadInsightsCache(months: selectedPeriod.rawValue) {
            response = cached.insights
            heatmapMatrix = HeatmapMatrix.from(entries: cached.insights.timeHeatmap)
        }

        do {
            let fetched = try await fetcher.fetchInsights(months: selectedPeriod.rawValue)
            response = fetched
            heatmapMatrix = HeatmapMatrix.from(entries: fetched.timeHeatmap)
            SharedDataManager.saveInsightsCache(fetched, months: selectedPeriod.rawValue)
            isLoading = false
        } catch {
            isLoading = false
            if response == nil {
                self.error = "Kunde inte hämta insikter"
            }
            AppLogger.network.error("Failed to fetch insights: \(error.localizedDescription)")
        }
    }

    func refresh() async {
        error = nil
        do {
            let fetched = try await fetcher.fetchInsights(months: selectedPeriod.rawValue)
            response = fetched
            heatmapMatrix = HeatmapMatrix.from(entries: fetched.timeHeatmap)
            SharedDataManager.saveInsightsCache(fetched, months: selectedPeriod.rawValue)
        } catch {
            self.error = "Kunde inte uppdatera insikter"
            AppLogger.network.error("Failed to refresh insights: \(error.localizedDescription)")
        }
    }

    func changePeriod(to period: InsightsPeriod) async {
        selectedPeriod = period
        await loadInsights()
    }

    // MARK: - Reset (for logout)

    func reset() {
        response = nil
        heatmapMatrix = .empty
        isLoading = false
        error = nil
        selectedPeriod = .sixMonths
        SharedDataManager.clearAllInsightsCache()
    }
}
