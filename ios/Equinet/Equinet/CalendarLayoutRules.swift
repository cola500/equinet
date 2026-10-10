//
//  CalendarLayoutRules.swift
//  Equinet
//
//  Pure Dynamic Type layout rules for NativeCalendarView, kept out of the view
//  so they can be unit tested. At standard sizes the layout is unchanged.
//

#if os(iOS)
import SwiftUI

enum CalendarLayoutRules {
    /// Gap between the time label and the grid lines / booking blocks.
    private static let labelGap: CGFloat = 8
    /// Extra inset of booking blocks after the label column.
    private static let blockInset: CGFloat = 4

    /// The day header stacks title above the controls, and the exception badge stacks, at accessibility sizes.
    static func usesAccessibilityLayout(for size: DynamicTypeSize) -> Bool {
        size.isAccessibilitySize
    }

    /// Booking block text may shrink slightly before truncating, but only at
    /// accessibility sizes, so blocks at standard sizes render exactly as before.
    static func blockTextMinScale(for size: DynamicTypeSize) -> CGFloat {
        size.isAccessibilitySize ? 0.75 : 1.0
    }

    /// Seven day columns cannot hold accessibility-size text on an iPhone width.
    /// The week strip stays compact; the selected date shows at full size in the header.
    static let weekStripMaxTypeSize: DynamicTypeSize = .xxxLarge

    /// Time labels stop growing at accessibility1 so booking blocks keep their width.
    static let timeLabelMaxTypeSize: DynamicTypeSize = .accessibility1

    /// Upper bound for the time label width (pt), measured text width at accessibility1 is about 51 pt. Above this the scaled width is clamped.
    static let maxTimeLabelWidth: CGFloat = 64

    static func timeLabelWidth(scaled: CGFloat) -> CGFloat {
        min(scaled, maxTimeLabelWidth)
    }

    /// Width of the label column (label + gap). 52 pt at the default label width of 44 pt.
    static func timeLabelColumn(labelWidth: CGFloat) -> CGFloat {
        labelWidth + labelGap
    }

    /// Leading inset of booking blocks. 56 pt at the default label width of 44 pt.
    static func bookingBlockLeading(labelWidth: CGFloat) -> CGFloat {
        timeLabelColumn(labelWidth: labelWidth) + blockInset
    }
}
#endif
