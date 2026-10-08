//
//  MoreMenuTests.swift
//  EquinetTests
//
//  Tests for MoreMenuItem feature flag filtering and menu section logic.
//

import XCTest
@testable import Equinet

@MainActor
final class MoreMenuTests: XCTestCase {

    // MARK: - allMenuSections structure

    func testAllMenuSectionsHasThreeSections() {
        XCTAssertEqual(allMenuSections.count, 3)
        XCTAssertEqual(allMenuSections[0].name, "Dagligt arbete")
        XCTAssertEqual(allMenuSections[1].name, "Planering")
        XCTAssertEqual(allMenuSections[2].name, "Mitt företag")
    }

    func testAllMenuSectionsHasTwelveItems() {
        let totalItems = allMenuSections.flatMap(\.items).count
        XCTAssertEqual(totalItems, 12)
    }

    func testDagligtArbeteSectionItems() {
        let items = allMenuSections[0].items
        XCTAssertEqual(items.count, 4)
        XCTAssertEqual(items[0].label, "Mina tjänster")
        XCTAssertNil(items[0].featureFlag)
        // Messaging is GA (flag retired in backend 2026-06-12): must not be flag-gated,
        // otherwise the item is hidden because /api/feature-flags no longer returns it.
        XCTAssertEqual(items[1].label, "Meddelanden")
        XCTAssertEqual(items[1].path, "/provider/messages")
        XCTAssertNil(items[1].featureFlag)
        XCTAssertEqual(items[2].label, "Logga arbete")
        XCTAssertEqual(items[2].featureFlag, "voice_logging")
        XCTAssertEqual(items[3].label, "Kunder")
        XCTAssertNil(items[3].featureFlag)
    }

    func testPlaneringsSectionItems() {
        let items = allMenuSections[1].items
        XCTAssertEqual(items.count, 4)
        XCTAssertEqual(items[0].label, "Ruttplanering")
        XCTAssertEqual(items[0].featureFlag, "route_planning")
        XCTAssertEqual(items[1].label, "Rutt-annonser")
        XCTAssertEqual(items[1].featureFlag, "route_announcements")
        XCTAssertEqual(items[2].label, "Besöksplanering")
        XCTAssertEqual(items[2].featureFlag, "due_for_service")
        XCTAssertEqual(items[3].label, "Gruppbokningar")
        XCTAssertEqual(items[3].featureFlag, "group_bookings")
    }

    func testMittForetagSectionItems() {
        let items = allMenuSections[2].items
        XCTAssertEqual(items.count, 4)
        XCTAssertEqual(items[0].label, "Insikter")
        XCTAssertEqual(items[0].featureFlag, "business_insights")
        XCTAssertEqual(items[1].label, "Recensioner")
        XCTAssertNil(items[1].featureFlag)
        XCTAssertEqual(items[2].label, "Hjälp")
        XCTAssertEqual(items[2].featureFlag, "help_center")
        XCTAssertEqual(items[3].label, "Min profil")
        XCTAssertNil(items[3].featureFlag)
    }

    // MARK: - Feature flag filtering

    func testFilterWithAllFlagsTrue() {
        let flags: [String: Bool] = [
            "voice_logging": true,
            "route_planning": true,
            "route_announcements": true,
            "due_for_service": true,
            "group_bookings": true,
            "business_insights": true,
            "help_center": true,
        ]

        let visible = filteredSections(flags: flags)

        XCTAssertEqual(visible.count, 3, "All 3 sections should be visible")
        let totalItems = visible.flatMap(\.items).count
        XCTAssertEqual(totalItems, 12, "All 12 items should be visible")
    }

    func testFilterWithAllFlagsFalse() {
        let flags: [String: Bool] = [
            "voice_logging": false,
            "route_planning": false,
            "route_announcements": false,
            "due_for_service": false,
            "group_bookings": false,
            "business_insights": false,
            "help_center": false,
        ]

        let visible = filteredSections(flags: flags)

        // Planering section should be completely hidden (all items flagged)
        XCTAssertEqual(visible.count, 2, "Only Dagligt arbete + Mitt företag")
        XCTAssertEqual(visible[0].name, "Dagligt arbete")
        XCTAssertEqual(visible[1].name, "Mitt företag")

        // Only non-flagged items remain: Mina tjänster, Meddelanden, Kunder, Recensioner, Min profil
        let totalItems = visible.flatMap(\.items).count
        XCTAssertEqual(totalItems, 5, "5 non-flagged items")
    }

    func testMessagesItemVisibleWithoutAnyFlag() {
        let visible = filteredSections(flags: [:])
        let labels = visible.flatMap(\.items).map(\.label)
        XCTAssertTrue(labels.contains("Meddelanden"), "Meddelanden must be visible without a feature flag")
    }

    func testFilterWithEmptyFlagsDictHidesAllFlagged() {
        let flags: [String: Bool] = [:]

        let visible = filteredSections(flags: flags)

        // Same as all-false: empty dict means flag not found -> hidden
        XCTAssertEqual(visible.count, 2)
        let totalItems = visible.flatMap(\.items).count
        XCTAssertEqual(totalItems, 5)
    }

    func testFilterWithPartialFlags() {
        let flags: [String: Bool] = [
            "voice_logging": true,
            "business_insights": true,
        ]

        let visible = filteredSections(flags: flags)

        // Planering still hidden (all its items need flags that are missing)
        XCTAssertEqual(visible.count, 2)

        // Dagligt arbete: 4 items (Mina tjänster + Meddelanden + Logga arbete + Kunder)
        XCTAssertEqual(visible[0].items.count, 4)
        XCTAssertEqual(visible[0].items[1].label, "Meddelanden")
        XCTAssertEqual(visible[0].items[2].label, "Logga arbete")

        // Mitt företag: 3 items (Insikter + Recensioner + Min profil, not Hjälp)
        XCTAssertEqual(visible[1].items.count, 3)
        XCTAssertEqual(visible[1].items[0].label, "Insikter")
    }

    // MARK: - MoreMenuItem identity

    func testMoreMenuItemIdIsPath() {
        let item = MoreMenuItem(label: "Test", icon: "star", path: "/test", section: "Test")
        XCTAssertEqual(item.id, "/test")
    }

    func testMoreMenuItemDefaultFeatureFlagIsNil() {
        let item = MoreMenuItem(label: "Test", icon: "star", path: "/test", section: "Test")
        XCTAssertNil(item.featureFlag)
    }

    // MARK: - handlePendingPath searches allMenuSections

    func testAllMenuSectionsContainsFlaggedItemsForPendingPath() {
        // handlePendingPath should find items even if they'd be filtered out
        let allItems = allMenuSections.flatMap(\.items)

        // Flagged items should be findable
        XCTAssertNotNil(allItems.first(where: { $0.path == "/provider/voice-log" }))
        XCTAssertNotNil(allItems.first(where: { $0.path == "/provider/route-planning" }))
        XCTAssertNotNil(allItems.first(where: { $0.path == "/provider/announcements" }))
        XCTAssertNotNil(allItems.first(where: { $0.path == "/provider/due-for-service" }))
        XCTAssertNotNil(allItems.first(where: { $0.path == "/provider/group-bookings" }))
        XCTAssertNotNil(allItems.first(where: { $0.path == "/provider/insights" }))
    }

    // MARK: - Helpers

    /// Replicates NativeMoreView.visibleSections logic for testing without View
    private func filteredSections(flags: [String: Bool]) -> [(name: String, items: [MoreMenuItem])] {
        allMenuSections.compactMap { section in
            let visible = section.items.filter { item in
                guard let flag = item.featureFlag else { return true }
                return flags[flag] == true
            }
            return visible.isEmpty ? nil : (section.name, visible)
        }
    }
}
