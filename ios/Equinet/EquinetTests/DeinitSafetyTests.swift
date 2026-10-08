//
//  DeinitSafetyTests.swift
//  EquinetTests
//
//  Regression tests for a Swift runtime crash on iOS 26.2.
//
//  With SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor the app's classes get an implicitly
//  isolated deinit (swift_task_deinitOnExecutor). On the iOS 26.2 runtime that path aborts
//  with "malloc: pointer being freed was not allocated" (TaskLocal::StopLookupScope) when
//  the last reference is released. Every project class therefore declares
//  `nonisolated deinit { }`. These tests deallocate the objects synchronously, which crashes
//  the test host on an affected runtime (the CI simulator runs iOS 26.2).
//  See docs/sprints/backlog.md ("iOS: deinit-krasch på iOS 26.2-runtime").
//

import XCTest
@testable import Equinet

@MainActor
final class DeinitSafetyTests: XCTestCase {

    func testNetworkMonitorCanBeDeallocated() {
        weak var weakRef: NetworkMonitor?
        autoreleasepool {
            let object = NetworkMonitor()
            weakRef = object
        }
        XCTAssertNil(weakRef)
    }

    func testDashboardViewModelCanBeDeallocated() {
        weak var weakRef: DashboardViewModel?
        autoreleasepool {
            let object = DashboardViewModel()
            weakRef = object
        }
        XCTAssertNil(weakRef)
    }

    func testSpeechRecognizerCanBeDeallocated() {
        weak var weakRef: SpeechRecognizer?
        autoreleasepool {
            let object = SpeechRecognizer()
            weakRef = object
        }
        XCTAssertNil(weakRef)
    }

    func testBridgeHandlerCanBeDeallocated() {
        weak var weakRef: BridgeHandler?
        autoreleasepool {
            let object = BridgeHandler()
            weakRef = object
        }
        XCTAssertNil(weakRef)
    }

    func testViewModelsCanBeDeallocated() {
        weak var bookings: BookingsViewModel?
        weak var customers: CustomersViewModel?
        weak var services: ServicesViewModel?
        weak var profile: ProfileViewModel?
        autoreleasepool {
            let b = BookingsViewModel()
            let c = CustomersViewModel()
            let s = ServicesViewModel()
            let p = ProfileViewModel()
            bookings = b
            customers = c
            services = s
            profile = p
        }
        XCTAssertNil(bookings)
        XCTAssertNil(customers)
        XCTAssertNil(services)
        XCTAssertNil(profile)
    }
}
