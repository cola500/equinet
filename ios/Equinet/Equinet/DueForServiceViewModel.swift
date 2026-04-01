import Foundation
import OSLog

// MARK: - DI Protocol

@MainActor
protocol DueForServiceDataFetching: Sendable {
    func fetchDueForService(filter: DueForServiceFilter) async throws -> [DueForServiceItem]
}

// MARK: - Production Adapter

struct APIDueForServiceFetcher: DueForServiceDataFetching {
    func fetchDueForService(filter: DueForServiceFilter) async throws -> [DueForServiceItem] {
        try await APIClient.shared.fetchDueForService(filter: filter)
    }
}

// MARK: - ViewModel

@Observable
@MainActor
final class DueForServiceViewModel {
    private let fetcher: DueForServiceDataFetching

    var items: [DueForServiceItem] = []
    var selectedFilter: DueForServiceFilter = .all
    private(set) var isLoading = false
    private(set) var error: String?

    init(fetcher: DueForServiceDataFetching? = nil) {
        self.fetcher = fetcher ?? APIDueForServiceFetcher()
    }

    // MARK: - Computed

    var filteredItems: [DueForServiceItem] {
        switch selectedFilter {
        case .all: items
        case .overdue: items.filter { $0.status == .overdue }
        case .upcoming: items.filter { $0.status == .upcoming }
        }
    }

    var overdueCount: Int {
        items.filter { $0.status == .overdue }.count
    }

    var upcomingCount: Int {
        items.filter { $0.status == .upcoming }.count
    }

    // MARK: - Actions

    func loadItems() async {
        isLoading = items.isEmpty
        error = nil

        do {
            let fetched = try await fetcher.fetchDueForService(filter: .all)
            items = fetched
            isLoading = false
        } catch {
            isLoading = false
            if items.isEmpty {
                self.error = "Kunde inte hämta besöksplanering"
            }
            AppLogger.network.error("Failed to fetch due-for-service: \(error.localizedDescription)")
        }
    }

    func refresh() async {
        do {
            let fetched = try await fetcher.fetchDueForService(filter: .all)
            items = fetched
        } catch {
            AppLogger.network.error("Failed to refresh due-for-service: \(error.localizedDescription)")
        }
    }
}
