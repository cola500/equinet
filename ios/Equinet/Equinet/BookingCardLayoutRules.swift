//
//  BookingCardLayoutRules.swift
//  Equinet
//
//  Pure Dynamic Type layout rules for BookingCard, kept out of the view so they can be
//  unit tested. At and below the default text size the layout is unchanged.
//

#if os(iOS)
import SwiftUI

enum BookingCardLayoutRules {
    enum ConfirmedActions: Equatable {
        /// Complete / No-show / Cancel on one row, note below (the original layout).
        case sideBySide
        /// Complete on its own row, No-show and Cancel together, note below.
        case twoRows
        /// One button per row.
        case stacked
    }

    /// Service name and price stack from xxLarge, where the name otherwise breaks mid-word.
    static func stacksHeader(for size: DynamicTypeSize) -> Bool {
        size >= .xxLarge
    }

    /// Date/time, horse/breed, badges and simple action rows stack at accessibility sizes.
    static func stacksDetails(for size: DynamicTypeSize) -> Bool {
        size.isAccessibilitySize
    }

    /// Measured card content width (pt) below which "Genomförd / Uteblev / Avboka" cannot share one
    /// row at the default text size without truncating ("Geno…"). Natural widths sum to about 347 pt.
    static let minWidthForConfirmedRow: CGFloat = 350

    /// True when the measured card content is too narrow for the three confirmed-row buttons
    /// to share one row at their default-size natural width.
    static func isNarrowCard(contentWidth: CGFloat) -> Bool {
        contentWidth < minWidthForConfirmedRow
    }

    static func confirmedActions(for size: DynamicTypeSize, isNarrow: Bool) -> ConfirmedActions {
        if size.isAccessibilitySize { return .stacked }
        if size >= .xLarge || isNarrow { return .twoRows }
        return .sideBySide
    }
}
#endif
