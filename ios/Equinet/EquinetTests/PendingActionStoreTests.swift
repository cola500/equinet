//
//  PendingActionStoreTests.swift
//  EquinetTests
//
//  Tests for PendingActionStore using an isolated UserDefaults suite.
//

@testable import Equinet
import XCTest

final class PendingActionStoreTests: XCTestCase {

    private var testDefaults: UserDefaults!

    override func setUp() {
        super.setUp()
        testDefaults = UserDefaults(suiteName: "PendingActionStoreTests")!
        testDefaults.removePersistentDomain(forName: "PendingActionStoreTests")
    }

    override func tearDown() {
        testDefaults.removePersistentDomain(forName: "PendingActionStoreTests")
        testDefaults = nil
        super.tearDown()
    }

    func testLoadReturnsEmptyArrayWithoutData() {
        let actions = PendingActionStore.load(from: testDefaults)
        XCTAssertTrue(actions.isEmpty)
    }

    func testSaveAndLoadOneAction() {
        PendingActionStore.save(bookingId: "b1", status: "confirmed", to: testDefaults)

        let actions = PendingActionStore.load(from: testDefaults)
        XCTAssertEqual(actions.count, 1)
        XCTAssertEqual(actions.first?.bookingId, "b1")
        XCTAssertEqual(actions.first?.status, "confirmed")
    }

    func testSaveMultipleActionsAndLoadAll() {
        PendingActionStore.save(bookingId: "b1", status: "confirmed", to: testDefaults)
        PendingActionStore.save(bookingId: "b2", status: "cancelled", to: testDefaults)
        PendingActionStore.save(bookingId: "b3", status: "confirmed", to: testDefaults)

        let actions = PendingActionStore.load(from: testDefaults)
        XCTAssertEqual(actions.count, 3)
        XCTAssertEqual(actions[0].bookingId, "b1")
        XCTAssertEqual(actions[1].bookingId, "b2")
        XCTAssertEqual(actions[2].bookingId, "b3")
    }

    func testActionsOlderThan24HoursAreFiltered() {
        // Manually write an action with createdAt > 24h ago
        let oldAction = PendingBookingAction(
            bookingId: "old-1",
            status: "confirmed",
            createdAt: Date().addingTimeInterval(-86401) // 24h + 1s ago
        )
        let recentAction = PendingBookingAction(
            bookingId: "new-1",
            status: "cancelled",
            createdAt: Date()
        )

        let data = try! JSONEncoder().encode([oldAction, recentAction])
        testDefaults.set(data, forKey: "pending_booking_actions")

        let loaded = PendingActionStore.load(from: testDefaults)
        XCTAssertEqual(loaded.count, 1)
        XCTAssertEqual(loaded.first?.bookingId, "new-1")
    }

    func testClearRemovesAllActions() {
        PendingActionStore.save(bookingId: "b1", status: "confirmed", to: testDefaults)
        PendingActionStore.save(bookingId: "b2", status: "cancelled", to: testDefaults)
        XCTAssertEqual(PendingActionStore.load(from: testDefaults).count, 2)

        PendingActionStore.clear(from: testDefaults)
        XCTAssertTrue(PendingActionStore.load(from: testDefaults).isEmpty)
    }
}
