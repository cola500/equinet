//
//  DashboardLayoutRules.swift
//  Equinet
//
//  Pure Dynamic Type layout rules for NativeDashboardView, kept out of the view
//  so they can be unit tested. At standard sizes the layout is unchanged.
//

#if os(iOS)
import SwiftUI

enum DashboardLayoutRules {
    /// KPI cards go single-column at accessibility sizes so labels never break mid-word.
    static func kpiColumnCount(for size: DynamicTypeSize) -> Int {
        size.isAccessibilitySize ? 1 : 2
    }

    /// Today's rows and the priority card stack vertically, and the date becomes a wrapping
    /// heading in the content instead of a truncated large title, at accessibility sizes.
    static func usesAccessibilityLayout(for size: DynamicTypeSize) -> Bool {
        size.isAccessibilitySize
    }

    /// The date moves from the navigation bar into the content only at accessibility sizes
    /// and only while dashboard content is shown (loading and error keep it in the bar).
    static func showsDateInContent(for size: DynamicTypeSize, hasContent: Bool) -> Bool {
        usesAccessibilityLayout(for: size) && hasContent
    }
}
#endif
