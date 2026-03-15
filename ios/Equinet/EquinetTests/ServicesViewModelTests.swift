//
//  ServicesViewModelTests.swift
//  EquinetTests
//
//  Tests for ServicesViewModel: loading, CRUD, optimistic UI.
//

import XCTest
@testable import Equinet

// MARK: - Mock Fetcher

@MainActor
final class MockServicesFetcher: ServicesDataFetching {
    var servicesToReturn: [ServiceItem] = []
    var createdService: ServiceItem?
    var updatedService: ServiceItem?
    var shouldThrow = false
    var lastCreateData: [String: Any]?
    var lastUpdateData: [String: Any]?
    var lastUpdateId: String?
    var lastDeleteId: String?

    func fetchServices() async throws -> [ServiceItem] {
        if shouldThrow { throw APIError.serverError(500) }
        return servicesToReturn
    }

    func createService(_ data: [String: Any]) async throws -> ServiceItem {
        if shouldThrow { throw APIError.serverError(500) }
        lastCreateData = data
        return createdService ?? ServiceItem(
            id: "new-service",
            name: data["name"] as? String ?? "",
            description: data["description"] as? String,
            price: data["price"] as? Double ?? 0,
            durationMinutes: data["durationMinutes"] as? Int ?? 60,
            isActive: data["isActive"] as? Bool ?? true,
            recommendedIntervalWeeks: data["recommendedIntervalWeeks"] as? Int
        )
    }

    func updateService(id: String, data: [String: Any]) async throws -> ServiceItem {
        if shouldThrow { throw APIError.serverError(500) }
        lastUpdateId = id
        lastUpdateData = data
        return updatedService ?? ServiceItem(
            id: id,
            name: data["name"] as? String ?? "",
            description: data["description"] as? String,
            price: data["price"] as? Double ?? 0,
            durationMinutes: data["durationMinutes"] as? Int ?? 60,
            isActive: data["isActive"] as? Bool ?? true,
            recommendedIntervalWeeks: data["recommendedIntervalWeeks"] as? Int
        )
    }

    func deleteService(id: String) async throws {
        if shouldThrow { throw APIError.serverError(500) }
        lastDeleteId = id
    }
}

// MARK: - Test Helpers

@MainActor
func makeServiceItem(
    id: String = "s1",
    name: String = "Hovvård",
    description: String? = nil,
    price: Double = 1200,
    durationMinutes: Int = 60,
    isActive: Bool = true,
    recommendedIntervalWeeks: Int? = 8
) -> ServiceItem {
    ServiceItem(
        id: id,
        name: name,
        description: description,
        price: price,
        durationMinutes: durationMinutes,
        isActive: isActive,
        recommendedIntervalWeeks: recommendedIntervalWeeks
    )
}

// MARK: - Tests

@MainActor
final class ServicesViewModelTests: XCTestCase {

    private var fetcher: MockServicesFetcher!
    private var vm: ServicesViewModel!

    override func setUp() {
        super.setUp()
        fetcher = MockServicesFetcher()
        vm = ServicesViewModel(fetcher: fetcher)
    }

    // MARK: - Loading

    func testLoadServicesSuccess() async {
        let services = [makeServiceItem(), makeServiceItem(id: "s2", name: "Tandvård")]
        fetcher.servicesToReturn = services

        await vm.loadServices()

        XCTAssertEqual(vm.services.count, 2)
        XCTAssertNil(vm.error)
        XCTAssertFalse(vm.isLoading)
    }

    func testLoadServicesError() async {
        fetcher.shouldThrow = true

        await vm.loadServices()

        XCTAssertEqual(vm.error, "Kunde inte hämta tjänster")
        XCTAssertFalse(vm.isLoading)
    }

    func testRefreshSuccess() async {
        fetcher.servicesToReturn = [makeServiceItem()]
        await vm.loadServices()
        XCTAssertEqual(vm.services.count, 1)

        fetcher.servicesToReturn = [makeServiceItem(), makeServiceItem(id: "s2", name: "Tandvård")]
        await vm.refresh()

        XCTAssertEqual(vm.services.count, 2)
        XCTAssertNil(vm.error)
    }

    func testRefreshError() async {
        fetcher.servicesToReturn = [makeServiceItem()]
        await vm.loadServices()

        fetcher.shouldThrow = true
        await vm.refresh()

        XCTAssertEqual(vm.error, "Kunde inte uppdatera tjänster")
    }

    // MARK: - Create

    func testCreateServiceSuccess() async {
        let result = await vm.createService(
            name: "Hovvård",
            description: "Bra",
            price: 1200,
            durationMinutes: 60,
            isActive: true,
            recommendedIntervalWeeks: 8
        )

        XCTAssertTrue(result)
        XCTAssertEqual(vm.services.count, 1)
        XCTAssertFalse(vm.actionInProgress)
    }

    func testCreateServiceFailure() async {
        fetcher.shouldThrow = true

        let result = await vm.createService(
            name: "Hovvård",
            description: nil,
            price: 1200,
            durationMinutes: 60,
            isActive: true,
            recommendedIntervalWeeks: nil
        )

        XCTAssertFalse(result)
        XCTAssertEqual(vm.services.count, 0)
        XCTAssertFalse(vm.actionInProgress)
    }

    // MARK: - Update

    func testUpdateServiceSuccess() async {
        fetcher.servicesToReturn = [makeServiceItem()]
        await vm.loadServices()

        let result = await vm.updateService(
            id: "s1",
            name: "Hovvård Deluxe",
            description: "Uppgraderad",
            price: 1500,
            durationMinutes: 90,
            isActive: true,
            recommendedIntervalWeeks: 6
        )

        XCTAssertTrue(result)
        XCTAssertEqual(vm.services.first?.name, "Hovvård Deluxe")
        XCTAssertFalse(vm.actionInProgress)
    }

    func testUpdateServiceFailure() async {
        fetcher.servicesToReturn = [makeServiceItem()]
        await vm.loadServices()

        fetcher.shouldThrow = true
        let result = await vm.updateService(
            id: "s1",
            name: "Hovvård Deluxe",
            description: nil,
            price: 1500,
            durationMinutes: 90,
            isActive: true,
            recommendedIntervalWeeks: nil
        )

        XCTAssertFalse(result)
        XCTAssertFalse(vm.actionInProgress)
    }

    // MARK: - Delete (optimistic)

    func testDeleteServiceOptimistic() async {
        fetcher.servicesToReturn = [makeServiceItem(), makeServiceItem(id: "s2", name: "Tandvård")]
        await vm.loadServices()
        XCTAssertEqual(vm.services.count, 2)

        let result = await vm.deleteService(id: "s1")

        XCTAssertTrue(result)
        XCTAssertEqual(vm.services.count, 1)
        XCTAssertEqual(vm.services.first?.id, "s2")
    }

    func testDeleteServiceRevertsOnError() async {
        fetcher.servicesToReturn = [makeServiceItem()]
        await vm.loadServices()

        fetcher.shouldThrow = true
        let result = await vm.deleteService(id: "s1")

        XCTAssertFalse(result)
        XCTAssertEqual(vm.services.count, 1)
        XCTAssertEqual(vm.services.first?.id, "s1")
    }

    // MARK: - Toggle Active (optimistic)

    func testToggleActiveOptimistic() async {
        fetcher.servicesToReturn = [makeServiceItem(isActive: true)]
        await vm.loadServices()
        XCTAssertTrue(vm.services.first!.isActive)

        await vm.toggleActive(service: vm.services.first!)

        XCTAssertFalse(vm.services.first!.isActive)
    }

    func testToggleActiveRevertsOnError() async {
        fetcher.servicesToReturn = [makeServiceItem(isActive: true)]
        await vm.loadServices()

        fetcher.shouldThrow = true
        await vm.toggleActive(service: vm.services.first!)

        XCTAssertTrue(vm.services.first!.isActive)
    }

    // MARK: - Reset

    func testReset() async {
        fetcher.servicesToReturn = [makeServiceItem()]
        await vm.loadServices()
        XCTAssertEqual(vm.services.count, 1)

        vm.reset()

        XCTAssertEqual(vm.services.count, 0)
        XCTAssertNil(vm.error)
        XCTAssertFalse(vm.isLoading)
        XCTAssertFalse(vm.actionInProgress)
        XCTAssertNil(vm.activeSheet)
    }

    // MARK: - Model Computed Properties

    func testFormattedPrice() {
        let service = makeServiceItem(price: 1200)
        XCTAssertTrue(service.formattedPrice.contains("1"))
        XCTAssertTrue(service.formattedPrice.contains("200"))
        XCTAssertTrue(service.formattedPrice.hasSuffix("kr"))
    }

    func testFormattedDuration() {
        XCTAssertEqual(makeServiceItem(durationMinutes: 60).formattedDuration, "1 h")
        XCTAssertEqual(makeServiceItem(durationMinutes: 90).formattedDuration, "1 h 30 min")
        XCTAssertEqual(makeServiceItem(durationMinutes: 45).formattedDuration, "45 min")
    }

    func testIntervalLabel() {
        XCTAssertEqual(makeServiceItem(recommendedIntervalWeeks: 2).intervalLabel, "Varannan vecka")
        XCTAssertEqual(makeServiceItem(recommendedIntervalWeeks: 8).intervalLabel, "Var 8:e vecka")
        XCTAssertEqual(makeServiceItem(recommendedIntervalWeeks: 52).intervalLabel, "Varje år")
        XCTAssertNil(makeServiceItem(recommendedIntervalWeeks: nil).intervalLabel)
    }

    func testWithIsActive() {
        let service = makeServiceItem(isActive: true)
        let toggled = service.withIsActive(false)
        XCTAssertFalse(toggled.isActive)
        XCTAssertEqual(toggled.id, service.id)
        XCTAssertEqual(toggled.name, service.name)
    }
}
