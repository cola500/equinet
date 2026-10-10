//
//  CalendarLayoutRulesTests.swift
//  EquinetTests
//
//  Tests for the pure Dynamic Type layout rules used by NativeCalendarView.
//

@testable import Equinet
import SwiftUI
import XCTest

final class CalendarLayoutRulesTests: XCTestCase {
    private let standardSizes: [DynamicTypeSize] = [
        .xSmall, .small, .medium, .large, .xLarge, .xxLarge, .xxxLarge,
    ]
    private let accessibilitySizes: [DynamicTypeSize] = [
        .accessibility1, .accessibility2, .accessibility3, .accessibility4, .accessibility5,
    ]

    func testStacksDateHeader_onlyAtAccessibilitySizes() {
        for size in standardSizes {
            XCTAssertFalse(CalendarLayoutRules.usesAccessibilityLayout(for: size), "\(size)")
        }
        for size in accessibilitySizes {
            XCTAssertTrue(CalendarLayoutRules.usesAccessibilityLayout(for: size), "\(size)")
        }
    }

    func testWeekStripTypeSizeLimit_keepsSevenColumnsReadable() {
        // Seven columns on a ~390 pt screen cannot hold accessibility-size text.
        XCTAssertEqual(CalendarLayoutRules.weekStripMaxTypeSize, .xxxLarge)
    }

    func testTimeLabelColumn_addsGapToLabelWidth() {
        XCTAssertEqual(CalendarLayoutRules.timeLabelColumn(labelWidth: 44), 52)
        XCTAssertEqual(CalendarLayoutRules.timeLabelColumn(labelWidth: 114), 122)
    }

    func testBookingBlockLeading_sitsAfterLabelColumn() {
        XCTAssertEqual(CalendarLayoutRules.bookingBlockLeading(labelWidth: 44), 56)
        XCTAssertEqual(CalendarLayoutRules.bookingBlockLeading(labelWidth: 114), 126)
    }

    func testTimeLabelWidth_isClampedSoBlocksKeepWidth() {
        // Unchanged at and around the default size...
        XCTAssertEqual(CalendarLayoutRules.timeLabelWidth(scaled: 44), 44)
        XCTAssertEqual(CalendarLayoutRules.timeLabelWidth(scaled: 60), 60)
        // ...but never wider than the cap at accessibility sizes.
        XCTAssertEqual(CalendarLayoutRules.timeLabelWidth(scaled: 114), CalendarLayoutRules.maxTimeLabelWidth)
    }

    func testTimeLabelTypeSizeLimit_isAccessibility1() {
        XCTAssertEqual(CalendarLayoutRules.timeLabelMaxTypeSize, .accessibility1)
    }

    func testBlockTextMinScale_onlyShrinksAtAccessibilitySizes() {
        for size in standardSizes {
            XCTAssertEqual(CalendarLayoutRules.blockTextMinScale(for: size), 1.0, "\(size)")
        }
        for size in accessibilitySizes {
            XCTAssertEqual(CalendarLayoutRules.blockTextMinScale(for: size), 0.75, "\(size)")
        }
    }
}
