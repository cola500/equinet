//
//  CustomersViewModelTests.swift
//  EquinetTests
//
//  Tests for CustomersViewModel: loading, filtering, search, CRUD.
//

import XCTest
@testable import Equinet

// MARK: - Mock Fetcher

@MainActor
final class MockCustomersFetcher: CustomersDataFetching {
    var customersToReturn: [CustomerSummary] = []
    var horsesToReturn: [CustomerHorse] = []
    var notesToReturn: [CustomerNote] = []
    var createdCustomerId = "new-cust-1"
    var shouldThrow = false

    func fetchCustomers(status: String?, query: String?) async throws -> [CustomerSummary] {
        if shouldThrow { throw APIError.serverError(500) }
        return customersToReturn
    }

    func createCustomer(firstName: String, lastName: String, phone: String?, email: String?) async throws -> String {
        if shouldThrow { throw APIError.serverError(500) }
        return createdCustomerId
    }

    func updateCustomer(customerId: String, firstName: String, lastName: String, phone: String?, email: String?) async throws -> CustomerUpdateResponse {
        if shouldThrow { throw APIError.serverError(500) }
        return CustomerUpdateResponse(id: customerId, firstName: firstName, lastName: lastName, email: email ?? "", phone: phone)
    }

    func deleteCustomer(customerId: String) async throws {
        if shouldThrow { throw APIError.serverError(500) }
    }

    func fetchHorses(customerId: String) async throws -> [CustomerHorse] {
        if shouldThrow { throw APIError.serverError(500) }
        return horsesToReturn
    }

    func createHorse(customerId: String, name: String, breed: String?, birthYear: Int?, color: String?, gender: String?, specialNeeds: String?, registrationNumber: String?, microchipNumber: String?) async throws -> CustomerHorse {
        if shouldThrow { throw APIError.serverError(500) }
        return CustomerHorse(id: "new-horse", name: name, breed: breed, birthYear: birthYear, color: color, gender: gender, specialNeeds: specialNeeds, registrationNumber: registrationNumber, microchipNumber: microchipNumber)
    }

    func updateHorse(customerId: String, horseId: String, name: String?, breed: String?, birthYear: Int?, color: String?, gender: String?, specialNeeds: String?, registrationNumber: String?, microchipNumber: String?) async throws -> CustomerHorse {
        if shouldThrow { throw APIError.serverError(500) }
        return CustomerHorse(id: horseId, name: name ?? "Updated", breed: breed, birthYear: birthYear, color: color, gender: gender, specialNeeds: specialNeeds, registrationNumber: registrationNumber, microchipNumber: microchipNumber)
    }

    func deleteHorse(customerId: String, horseId: String) async throws {
        if shouldThrow { throw APIError.serverError(500) }
    }

    func fetchNotes(customerId: String) async throws -> [CustomerNote] {
        if shouldThrow { throw APIError.serverError(500) }
        return notesToReturn
    }

    func createNote(customerId: String, content: String) async throws -> CustomerNote {
        if shouldThrow { throw APIError.serverError(500) }
        return CustomerNote(id: "new-note", content: content, createdAt: "2026-03-15T10:00:00Z", updatedAt: "2026-03-15T10:00:00Z")
    }

    func updateNote(customerId: String, noteId: String, content: String) async throws -> CustomerNote {
        if shouldThrow { throw APIError.serverError(500) }
        return CustomerNote(id: noteId, content: content, createdAt: "2026-03-15T10:00:00Z", updatedAt: "2026-03-15T11:00:00Z")
    }

    func deleteNote(customerId: String, noteId: String) async throws {
        if shouldThrow { throw APIError.serverError(500) }
    }
}

// MARK: - Test Helpers

private func makeCustomer(
    id: String = "c-1",
    firstName: String = "Anna",
    lastName: String = "Svensson",
    email: String = "anna@test.se",
    phone: String? = "070-1234567",
    bookingCount: Int = 5,
    noShowCount: Int = 0,
    lastBookingDate: String? = "2026-03-01T00:00:00.000Z",
    isManuallyAdded: Bool? = nil
) -> CustomerSummary {
    CustomerSummary(
        id: id,
        firstName: firstName,
        lastName: lastName,
        email: email,
        phone: phone,
        bookingCount: bookingCount,
        noShowCount: noShowCount,
        lastBookingDate: lastBookingDate,
        horses: [],
        isManuallyAdded: isManuallyAdded
    )
}

// MARK: - Tests

@MainActor
final class CustomersViewModelTests: XCTestCase {

    private var mockFetcher: MockCustomersFetcher!
    private var viewModel: CustomersViewModel!

    override func setUp() {
        super.setUp()
        mockFetcher = MockCustomersFetcher()
        viewModel = CustomersViewModel(fetcher: mockFetcher)
    }

    // MARK: - Loading

    func testLoadCustomersSetsCustomersOnSuccess() async {
        mockFetcher.customersToReturn = [makeCustomer()]
        await viewModel.loadCustomers()
        XCTAssertEqual(viewModel.customers.count, 1)
        XCTAssertEqual(viewModel.customers[0].firstName, "Anna")
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNil(viewModel.error)
    }

    func testLoadCustomersSetsErrorOnFailure() async {
        mockFetcher.shouldThrow = true
        await viewModel.loadCustomers()
        XCTAssertNotNil(viewModel.error)
        XCTAssertTrue(viewModel.customers.isEmpty)
    }

    func testRefreshUpdatesCustomers() async {
        mockFetcher.customersToReturn = [makeCustomer(id: "c-1")]
        await viewModel.loadCustomers()
        XCTAssertEqual(viewModel.customers.count, 1)

        mockFetcher.customersToReturn = [makeCustomer(id: "c-1"), makeCustomer(id: "c-2")]
        await viewModel.refresh()
        XCTAssertEqual(viewModel.customers.count, 2)
    }

    // MARK: - Filtering

    func testFilteredCustomersReturnsAllByDefault() async {
        mockFetcher.customersToReturn = [makeCustomer(id: "c-1"), makeCustomer(id: "c-2")]
        await viewModel.loadCustomers()
        XCTAssertEqual(viewModel.filteredCustomers.count, 2)
    }

    func testSearchFiltersByName() async {
        mockFetcher.customersToReturn = [
            makeCustomer(id: "c-1", firstName: "Anna", email: "a@test.se"),
            makeCustomer(id: "c-2", firstName: "Bo", lastName: "Ek", email: "bo@test.se"),
        ]
        await viewModel.loadCustomers()

        viewModel.searchQuery = "anna"
        XCTAssertEqual(viewModel.filteredCustomers.count, 1)
        XCTAssertEqual(viewModel.filteredCustomers[0].firstName, "Anna")
    }

    func testSearchFiltersByEmail() async {
        mockFetcher.customersToReturn = [
            makeCustomer(id: "c-1", email: "anna@test.se"),
            makeCustomer(id: "c-2", email: "bo@test.se"),
        ]
        await viewModel.loadCustomers()

        viewModel.searchQuery = "bo@"
        XCTAssertEqual(viewModel.filteredCustomers.count, 1)
    }

    // MARK: - Customer CRUD

    func testCreateCustomerReloadsListOnSuccess() async {
        mockFetcher.customersToReturn = [makeCustomer()]
        let result = await viewModel.createCustomer(firstName: "Ny", lastName: "Kund", phone: nil, email: nil)
        XCTAssertTrue(result)
        XCTAssertEqual(viewModel.customers.count, 1) // Reloaded from mock
    }

    func testCreateCustomerReturnsFalseOnError() async {
        mockFetcher.shouldThrow = true
        let result = await viewModel.createCustomer(firstName: "Ny", lastName: "Kund", phone: nil, email: nil)
        XCTAssertFalse(result)
    }

    func testDeleteCustomerOptimisticUI() async {
        mockFetcher.customersToReturn = [makeCustomer(id: "c-1"), makeCustomer(id: "c-2")]
        await viewModel.loadCustomers()
        XCTAssertEqual(viewModel.customers.count, 2)

        let result = await viewModel.deleteCustomer(customerId: "c-1")
        XCTAssertTrue(result)
        XCTAssertEqual(viewModel.customers.count, 1)
        XCTAssertEqual(viewModel.customers[0].id, "c-2")
    }

    func testDeleteCustomerRevertsOnError() async {
        mockFetcher.customersToReturn = [makeCustomer(id: "c-1")]
        await viewModel.loadCustomers()

        mockFetcher.shouldThrow = true
        let result = await viewModel.deleteCustomer(customerId: "c-1")
        XCTAssertFalse(result)
        XCTAssertEqual(viewModel.customers.count, 1) // Reverted
    }

    // MARK: - Horse CRUD

    func testCreateHorseAppendsToList() async {
        let result = await viewModel.createHorse(
            customerId: "c-1", name: "Nyansen", breed: nil, birthYear: nil,
            color: nil, gender: nil, specialNeeds: nil, registrationNumber: nil, microchipNumber: nil
        )
        XCTAssertTrue(result)
        XCTAssertEqual(viewModel.horses.count, 1)
        XCTAssertEqual(viewModel.horses[0].name, "Nyansen")
    }

    func testDeleteHorseOptimisticUI() async {
        viewModel.horses = [
            CustomerHorse(id: "h-1", name: "Blansen", breed: nil, birthYear: nil, color: nil, gender: nil, specialNeeds: nil, registrationNumber: nil, microchipNumber: nil),
        ]
        let result = await viewModel.deleteHorse(customerId: "c-1", horseId: "h-1")
        XCTAssertTrue(result)
        XCTAssertTrue(viewModel.horses.isEmpty)
    }

    // MARK: - Note CRUD

    func testCreateNoteInsertsAtBeginning() async {
        let result = await viewModel.createNote(customerId: "c-1", content: "Bra ryttare")
        XCTAssertTrue(result)
        XCTAssertEqual(viewModel.notes.count, 1)
        XCTAssertEqual(viewModel.notes[0].content, "Bra ryttare")
    }

    func testDeleteNoteOptimisticUI() async {
        viewModel.notes = [
            CustomerNote(id: "n-1", content: "Test", createdAt: "2026-03-15", updatedAt: "2026-03-15"),
        ]
        let result = await viewModel.deleteNote(customerId: "c-1", noteId: "n-1")
        XCTAssertTrue(result)
        XCTAssertTrue(viewModel.notes.isEmpty)
    }

    func testDeleteNoteRevertsOnError() async {
        viewModel.notes = [
            CustomerNote(id: "n-1", content: "Test", createdAt: "2026-03-15", updatedAt: "2026-03-15"),
        ]
        mockFetcher.shouldThrow = true
        let result = await viewModel.deleteNote(customerId: "c-1", noteId: "n-1")
        XCTAssertFalse(result)
        XCTAssertEqual(viewModel.notes.count, 1) // Reverted
    }

    // MARK: - Detail Loading

    func testLoadDetailFetchesHorsesAndNotes() async {
        mockFetcher.horsesToReturn = [
            CustomerHorse(id: "h-1", name: "Blansen", breed: "Halvblod", birthYear: 2015, color: nil, gender: "mare", specialNeeds: nil, registrationNumber: nil, microchipNumber: nil),
        ]
        mockFetcher.notesToReturn = [
            CustomerNote(id: "n-1", content: "Bra kund", createdAt: "2026-03-15", updatedAt: "2026-03-15"),
        ]

        await viewModel.loadDetail(customerId: "c-1")
        XCTAssertEqual(viewModel.horses.count, 1)
        XCTAssertEqual(viewModel.notes.count, 1)
        XCTAssertFalse(viewModel.isLoadingDetail)
    }

    // MARK: - Reset

    func testResetClearsAllState() async {
        mockFetcher.customersToReturn = [makeCustomer()]
        await viewModel.loadCustomers()
        viewModel.searchQuery = "test"
        viewModel.selectedFilter = .active

        viewModel.reset()
        XCTAssertTrue(viewModel.customers.isEmpty)
        XCTAssertTrue(viewModel.searchQuery.isEmpty)
        XCTAssertEqual(viewModel.selectedFilter, .all)
    }

    // MARK: - Model Tests

    func testCustomerSummaryFullName() {
        let c1 = makeCustomer(firstName: "Anna", lastName: "Svensson")
        XCTAssertEqual(c1.fullName, "Anna Svensson")

        let c2 = makeCustomer(firstName: "Bo", lastName: "")
        XCTAssertEqual(c2.fullName, "Bo")
    }

    func testCustomerSummaryHashable() {
        let c1 = makeCustomer(id: "c-1")
        let c2 = makeCustomer(id: "c-1")
        XCTAssertEqual(c1, c2)
        XCTAssertEqual(c1.hashValue, c2.hashValue)
    }

    func testNoShowWarning() {
        let safe = makeCustomer(noShowCount: 1)
        XCTAssertFalse(safe.hasNoShowWarning)

        let warning = makeCustomer(noShowCount: 2)
        XCTAssertTrue(warning.hasNoShowWarning)
    }

    func testHorseGenderLabel() {
        let mare = CustomerHorse(id: "h", name: "Test", breed: nil, birthYear: nil, color: nil, gender: "mare", specialNeeds: nil, registrationNumber: nil, microchipNumber: nil)
        XCTAssertEqual(mare.genderLabel, "Sto")

        let unknown = CustomerHorse(id: "h", name: "Test", breed: nil, birthYear: nil, color: nil, gender: nil, specialNeeds: nil, registrationNumber: nil, microchipNumber: nil)
        XCTAssertEqual(unknown.genderLabel, "Okänt")
    }
}
