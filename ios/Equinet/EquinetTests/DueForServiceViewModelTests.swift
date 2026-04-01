import XCTest
@testable import Equinet

@MainActor
final class MockDueForServiceFetcher: DueForServiceDataFetching {
    var itemsToReturn: [DueForServiceItem] = []
    var shouldThrow = false

    func fetchDueForService(filter: DueForServiceFilter) async throws -> [DueForServiceItem] {
        if shouldThrow { throw APIError.serverError(500) }
        return itemsToReturn
    }
}

@MainActor
final class DueForServiceViewModelTests: XCTestCase {

    private var mockFetcher: MockDueForServiceFetcher!
    private var viewModel: DueForServiceViewModel!

    override func setUp() {
        super.setUp()
        mockFetcher = MockDueForServiceFetcher()
        viewModel = DueForServiceViewModel(fetcher: mockFetcher)
    }

    // MARK: - Helpers

    private func makeItem(
        horseId: String = "h1",
        horseName: String = "Blansen",
        serviceName: String = "Hovslagning",
        status: DueStatus = .overdue,
        daysUntilDue: Int = -5,
        ownerName: String = "Anna Svensson"
    ) -> DueForServiceItem {
        DueForServiceItem(
            horseId: horseId,
            horseName: horseName,
            serviceId: "s1",
            serviceName: serviceName,
            lastServiceDate: "2026-01-01T00:00:00Z",
            daysSinceService: 90,
            intervalWeeks: 6,
            dueDate: "2026-02-12T00:00:00Z",
            daysUntilDue: daysUntilDue,
            status: status,
            ownerName: ownerName
        )
    }

    // MARK: - Tests

    func testLoadItemsSetsItemsOnSuccess() async {
        mockFetcher.itemsToReturn = [makeItem()]
        await viewModel.loadItems()

        XCTAssertEqual(viewModel.items.count, 1)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNil(viewModel.error)
    }

    func testLoadItemsSetsErrorOnFailure() async {
        mockFetcher.shouldThrow = true
        await viewModel.loadItems()

        XCTAssertTrue(viewModel.items.isEmpty)
        XCTAssertNotNil(viewModel.error)
        XCTAssertFalse(viewModel.isLoading)
    }

    func testLoadItemsKeepsOldDataOnRefreshFailure() async {
        mockFetcher.itemsToReturn = [makeItem()]
        await viewModel.loadItems()
        XCTAssertEqual(viewModel.items.count, 1)

        mockFetcher.shouldThrow = true
        await viewModel.loadItems()

        // Should keep old data and not show error
        XCTAssertEqual(viewModel.items.count, 1)
        XCTAssertNil(viewModel.error)
    }

    func testFilteredItemsReturnsAllByDefault() async {
        mockFetcher.itemsToReturn = [
            makeItem(horseId: "h1", status: .overdue),
            makeItem(horseId: "h2", status: .upcoming, daysUntilDue: 5),
            makeItem(horseId: "h3", status: .ok, daysUntilDue: 20),
        ]
        await viewModel.loadItems()

        XCTAssertEqual(viewModel.filteredItems.count, 3)
    }

    func testFilteredItemsByOverdue() async {
        mockFetcher.itemsToReturn = [
            makeItem(horseId: "h1", status: .overdue),
            makeItem(horseId: "h2", status: .upcoming, daysUntilDue: 5),
        ]
        await viewModel.loadItems()

        viewModel.selectedFilter = .overdue
        XCTAssertEqual(viewModel.filteredItems.count, 1)
        XCTAssertEqual(viewModel.filteredItems[0].status, .overdue)
    }

    func testFilteredItemsByUpcoming() async {
        mockFetcher.itemsToReturn = [
            makeItem(horseId: "h1", status: .overdue),
            makeItem(horseId: "h2", status: .upcoming, daysUntilDue: 5),
        ]
        await viewModel.loadItems()

        viewModel.selectedFilter = .upcoming
        XCTAssertEqual(viewModel.filteredItems.count, 1)
        XCTAssertEqual(viewModel.filteredItems[0].status, .upcoming)
    }

    func testOverdueCount() async {
        mockFetcher.itemsToReturn = [
            makeItem(horseId: "h1", status: .overdue),
            makeItem(horseId: "h2", status: .overdue, daysUntilDue: -10),
            makeItem(horseId: "h3", status: .upcoming, daysUntilDue: 5),
        ]
        await viewModel.loadItems()

        XCTAssertEqual(viewModel.overdueCount, 2)
    }

    func testUpcomingCount() async {
        mockFetcher.itemsToReturn = [
            makeItem(horseId: "h1", status: .overdue),
            makeItem(horseId: "h2", status: .upcoming, daysUntilDue: 5),
            makeItem(horseId: "h3", status: .upcoming, daysUntilDue: 10),
        ]
        await viewModel.loadItems()

        XCTAssertEqual(viewModel.upcomingCount, 2)
    }

    func testRefreshReloadsData() async {
        mockFetcher.itemsToReturn = [makeItem()]
        await viewModel.loadItems()
        XCTAssertEqual(viewModel.items.count, 1)

        mockFetcher.itemsToReturn = [makeItem(horseId: "h1"), makeItem(horseId: "h2")]
        await viewModel.refresh()

        XCTAssertEqual(viewModel.items.count, 2)
    }
}
