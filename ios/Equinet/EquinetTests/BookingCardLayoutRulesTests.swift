//
//  BookingCardLayoutRulesTests.swift
//  EquinetTests
//
//  Tests for the pure Dynamic Type layout rules used by BookingCard (NativeBookingsView).
//

@testable import Equinet
import SwiftUI
import XCTest

final class BookingCardLayoutRulesTests: XCTestCase {
    func testStacksHeader_fromXxLarge() {
        let unchanged: [DynamicTypeSize] = [.xSmall, .small, .medium, .large, .xLarge]
        let stacked: [DynamicTypeSize] = [.xxLarge, .xxxLarge, .accessibility1, .accessibility3, .accessibility5]
        for size in unchanged { XCTAssertFalse(BookingCardLayoutRules.stacksHeader(for: size), "\(size)") }
        for size in stacked { XCTAssertTrue(BookingCardLayoutRules.stacksHeader(for: size), "\(size)") }
    }

    func testStacksDetails_onlyAtAccessibilitySizes() {
        for size in [DynamicTypeSize.xSmall, .large, .xxxLarge] {
            XCTAssertFalse(BookingCardLayoutRules.stacksDetails(for: size), "\(size)")
        }
        for size in [DynamicTypeSize.accessibility1, .accessibility3, .accessibility5] {
            XCTAssertTrue(BookingCardLayoutRules.stacksDetails(for: size), "\(size)")
        }
    }

    func testConfirmedActions_progressiveLayout() {
        for size in [DynamicTypeSize.xSmall, .medium, .large] {
            XCTAssertEqual(BookingCardLayoutRules.confirmedActions(for: size, isNarrow: false), .sideBySide, "\(size)")
        }
        for size in [DynamicTypeSize.xLarge, .xxLarge, .xxxLarge] {
            XCTAssertEqual(BookingCardLayoutRules.confirmedActions(for: size, isNarrow: false), .twoRows, "\(size)")
        }
        for size in [DynamicTypeSize.accessibility1, .accessibility5] {
            XCTAssertEqual(BookingCardLayoutRules.confirmedActions(for: size, isNarrow: false), .stacked, "\(size)")
        }
    }

    func testConfirmedActions_narrowCardUsesTwoRowsAtDefaultSize() {
        XCTAssertEqual(BookingCardLayoutRules.confirmedActions(for: .large, isNarrow: true), .twoRows)
    }

    func testIsNarrowCard_threshold() {
        XCTAssertTrue(BookingCardLayoutRules.isNarrowCard(contentWidth: 334))  // iPhone 17e
        XCTAssertTrue(BookingCardLayoutRules.isNarrowCard(contentWidth: 346))  // iPhone 17
        XCTAssertTrue(BookingCardLayoutRules.isNarrowCard(contentWidth: 349.9))
        XCTAssertFalse(BookingCardLayoutRules.isNarrowCard(contentWidth: 350))
        XCTAssertFalse(BookingCardLayoutRules.isNarrowCard(contentWidth: 384)) // iPhone 17 Pro Max
    }
}
