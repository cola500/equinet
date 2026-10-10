//
//  DashboardLayoutRulesTests.swift
//  EquinetTests
//
//  Tests for the pure Dynamic Type layout rules used by NativeDashboardView.
//

@testable import Equinet
import SwiftUI
import XCTest

final class DashboardLayoutRulesTests: XCTestCase {
    private let standardSizes: [DynamicTypeSize] = [
        .xSmall, .small, .medium, .large, .xLarge, .xxLarge, .xxxLarge,
    ]
    private let accessibilitySizes: [DynamicTypeSize] = [
        .accessibility1, .accessibility2, .accessibility3, .accessibility4, .accessibility5,
    ]

    func testKpiColumnCount_standardSizes_isTwo() {
        for size in standardSizes {
            XCTAssertEqual(DashboardLayoutRules.kpiColumnCount(for: size), 2, "\(size)")
        }
    }

    func testKpiColumnCount_accessibilitySizes_isOne() {
        for size in accessibilitySizes {
            XCTAssertEqual(DashboardLayoutRules.kpiColumnCount(for: size), 1, "\(size)")
        }
    }

    func testUsesAccessibilityLayout_onlyAtAccessibilitySizes() {
        for size in standardSizes {
            XCTAssertFalse(DashboardLayoutRules.usesAccessibilityLayout(for: size), "\(size)")
        }
        for size in accessibilitySizes {
            XCTAssertTrue(DashboardLayoutRules.usesAccessibilityLayout(for: size), "\(size)")
        }
    }

    func testShowsDateInContent_onlyAtAccessibilitySizesWithContent() {
        for size in standardSizes {
            XCTAssertFalse(DashboardLayoutRules.showsDateInContent(for: size, hasContent: true), "\(size)")
            XCTAssertFalse(DashboardLayoutRules.showsDateInContent(for: size, hasContent: false), "\(size)")
        }
        for size in accessibilitySizes {
            XCTAssertTrue(DashboardLayoutRules.showsDateInContent(for: size, hasContent: true), "\(size)")
            XCTAssertFalse(DashboardLayoutRules.showsDateInContent(for: size, hasContent: false), "\(size)")
        }
    }
}
