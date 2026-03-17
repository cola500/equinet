//
//  ProfileViewModelTests.swift
//  EquinetTests
//
//  Tests for ProfileViewModel: loading, update personal/business/settings, delete account.
//

import XCTest
@testable import Equinet

// MARK: - Mock Fetcher

@MainActor
final class MockProfileFetcher: ProfileDataFetching {
    var profileToReturn: ProviderProfile?
    var updatedProfile: ProviderProfile?
    var shouldThrow = false
    var lastUpdateData: [String: Any]?
    var deleteAccountCalled = false
    var lastDeletePassword: String?

    func fetchProfile() async throws -> ProviderProfile {
        if shouldThrow { throw APIError.serverError(500) }
        guard let profile = profileToReturn else {
            throw APIError.serverError(404)
        }
        return profile
    }

    func updateProfile(_ data: [String: Any]) async throws -> ProviderProfile {
        if shouldThrow { throw APIError.serverError(500) }
        lastUpdateData = data
        guard let profile = updatedProfile ?? profileToReturn else {
            throw APIError.serverError(404)
        }
        return profile
    }

    func deleteAccount(password: String, confirmation: String) async throws {
        if shouldThrow { throw APIError.serverError(500) }
        deleteAccountCalled = true
        lastDeletePassword = password
    }
}

// MARK: - Test Helpers

@MainActor
func makeProviderProfile(
    id: String = "provider-1",
    businessName: String = "Hovslageriet AB",
    description: String? = "Erfaren hovslagare",
    address: String? = "Storgatan 1",
    city: String? = "Stockholm",
    postalCode: String? = "11122",
    serviceArea: String? = nil,
    latitude: Double? = 59.3293,
    longitude: Double? = 18.0686,
    serviceAreaKm: Double? = 50,
    profileImageUrl: String? = nil,
    isActive: Bool = true,
    acceptingNewCustomers: Bool = true,
    rescheduleEnabled: Bool = true,
    rescheduleWindowHours: Int = 24,
    maxReschedules: Int = 2,
    rescheduleRequiresApproval: Bool = false,
    recurringEnabled: Bool = true,
    maxSeriesOccurrences: Int = 12,
    isVerified: Bool = false,
    firstName: String = "Erik",
    lastName: String = "Svensson",
    email: String = "erik@example.com",
    phone: String? = "0701234567"
) -> ProviderProfile {
    ProviderProfile(
        id: id,
        businessName: businessName,
        description: description,
        address: address,
        city: city,
        postalCode: postalCode,
        serviceArea: serviceArea,
        latitude: latitude,
        longitude: longitude,
        serviceAreaKm: serviceAreaKm,
        profileImageUrl: profileImageUrl,
        isActive: isActive,
        acceptingNewCustomers: acceptingNewCustomers,
        rescheduleEnabled: rescheduleEnabled,
        rescheduleWindowHours: rescheduleWindowHours,
        maxReschedules: maxReschedules,
        rescheduleRequiresApproval: rescheduleRequiresApproval,
        recurringEnabled: recurringEnabled,
        maxSeriesOccurrences: maxSeriesOccurrences,
        isVerified: isVerified,
        user: ProfileUser(
            firstName: firstName,
            lastName: lastName,
            email: email,
            phone: phone
        )
    )
}

// MARK: - Tests

@MainActor
final class ProfileViewModelTests: XCTestCase {

    private var fetcher: MockProfileFetcher!
    private var vm: ProfileViewModel!

    override func setUp() {
        super.setUp()
        fetcher = MockProfileFetcher()
        vm = ProfileViewModel(fetcher: fetcher)
    }

    // MARK: - Loading

    func testLoadProfileSuccess() async {
        fetcher.profileToReturn = makeProviderProfile()

        await vm.loadProfile()

        XCTAssertNotNil(vm.profile)
        XCTAssertEqual(vm.profile?.businessName, "Hovslageriet AB")
        XCTAssertEqual(vm.profile?.user.firstName, "Erik")
        XCTAssertNil(vm.error)
        XCTAssertFalse(vm.isLoading)
    }

    func testLoadProfileError() async {
        fetcher.shouldThrow = true

        await vm.loadProfile()

        XCTAssertNil(vm.profile)
        XCTAssertEqual(vm.error, "Kunde inte hämta profil")
        XCTAssertFalse(vm.isLoading)
    }

    // MARK: - Update Personal Info

    func testUpdatePersonalInfoSuccess() async {
        let updated = makeProviderProfile(firstName: "Anna", lastName: "Johansson", phone: "0709876543")
        fetcher.profileToReturn = makeProviderProfile()
        fetcher.updatedProfile = updated
        await vm.loadProfile()

        let result = await vm.updatePersonalInfo(firstName: "Anna", lastName: "Johansson", phone: "0709876543")

        XCTAssertTrue(result)
        XCTAssertEqual(vm.profile?.user.firstName, "Anna")
        XCTAssertEqual(vm.profile?.user.lastName, "Johansson")
        XCTAssertFalse(vm.isSaving)
    }

    func testUpdatePersonalInfoFailure() async {
        fetcher.profileToReturn = makeProviderProfile()
        await vm.loadProfile()

        fetcher.shouldThrow = true
        let result = await vm.updatePersonalInfo(firstName: "Anna", lastName: "Johansson", phone: nil)

        XCTAssertFalse(result)
        XCTAssertEqual(vm.profile?.user.firstName, "Erik") // unchanged
        XCTAssertFalse(vm.isSaving)
    }

    // MARK: - Update Business Info

    func testUpdateBusinessInfoSuccess() async {
        let updated = makeProviderProfile(businessName: "Nytt AB", city: "Göteborg")
        fetcher.profileToReturn = makeProviderProfile()
        fetcher.updatedProfile = updated
        await vm.loadProfile()

        let result = await vm.updateBusinessInfo(
            businessName: "Nytt AB",
            description: nil,
            address: nil,
            city: "Göteborg",
            postalCode: nil,
            serviceArea: nil,
            latitude: nil,
            longitude: nil,
            serviceAreaKm: nil
        )

        XCTAssertTrue(result)
        XCTAssertEqual(vm.profile?.businessName, "Nytt AB")
        XCTAssertEqual(vm.profile?.city, "Göteborg")
        XCTAssertFalse(vm.isSaving)
    }

    // MARK: - Update Settings

    func testUpdateSettingsToggleAcceptingNewCustomers() async {
        let updated = makeProviderProfile(acceptingNewCustomers: false)
        fetcher.profileToReturn = makeProviderProfile()
        fetcher.updatedProfile = updated
        await vm.loadProfile()

        let result = await vm.updateSettings(["acceptingNewCustomers": false])

        XCTAssertTrue(result)
        XCTAssertEqual(vm.profile?.acceptingNewCustomers, false)
        XCTAssertFalse(vm.isSaving)
    }

    func testUpdateSettingsFailure() async {
        fetcher.profileToReturn = makeProviderProfile()
        await vm.loadProfile()

        fetcher.shouldThrow = true
        let result = await vm.updateSettings(["acceptingNewCustomers": false])

        XCTAssertFalse(result)
        XCTAssertEqual(vm.profile?.acceptingNewCustomers, true) // unchanged
        XCTAssertFalse(vm.isSaving)
    }

    // MARK: - Delete Account

    func testDeleteAccountSuccess() async {
        fetcher.profileToReturn = makeProviderProfile()
        await vm.loadProfile()

        let result = await vm.deleteAccount(password: "secret123", confirmation: "RADERA")

        XCTAssertTrue(result)
        XCTAssertTrue(fetcher.deleteAccountCalled)
        XCTAssertEqual(fetcher.lastDeletePassword, "secret123")
        XCTAssertFalse(vm.isSaving)
    }

    func testDeleteAccountFailure() async {
        fetcher.profileToReturn = makeProviderProfile()
        await vm.loadProfile()

        fetcher.shouldThrow = true
        let result = await vm.deleteAccount(password: "wrong", confirmation: "RADERA")

        XCTAssertFalse(result)
        XCTAssertFalse(vm.isSaving)
    }

    // MARK: - Profile Completion

    func testProfileCompletionFullProfile() {
        let profile = makeProviderProfile(profileImageUrl: "https://example.com/img.jpg")
        // All 9 fields filled: businessName, description, address, city, postalCode, profileImageUrl, firstName, lastName, phone
        XCTAssertEqual(profile.profileCompletion, 100)
    }

    func testProfileCompletionPartialProfile() {
        // Missing: description, address, postalCode, profileImageUrl, phone = 5 missing out of 9
        let profile = makeProviderProfile(
            description: nil,
            address: nil,
            postalCode: nil,
            profileImageUrl: nil,
            phone: nil
        )
        // Filled: businessName, city, firstName, lastName = 4 out of 9
        XCTAssertEqual(profile.profileCompletion, 44) // 4/9 = 44%
    }

    func testProfileCompletionMinimalProfile() {
        let profile = makeProviderProfile(
            description: nil,
            address: nil,
            city: nil,
            postalCode: nil,
            profileImageUrl: nil,
            phone: nil
        )
        // Only businessName, firstName, lastName = 3 out of 9
        XCTAssertEqual(profile.profileCompletion, 33) // 3/9 = 33%
    }

    // MARK: - Reset

    func testReset() async {
        fetcher.profileToReturn = makeProviderProfile()
        await vm.loadProfile()
        XCTAssertNotNil(vm.profile)

        vm.reset()

        XCTAssertNil(vm.profile)
        XCTAssertNil(vm.error)
        XCTAssertFalse(vm.isLoading)
        XCTAssertFalse(vm.isSaving)
    }
}
