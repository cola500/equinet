//
//  InsightsModels.swift
//  Equinet
//
//  Codable models for native business insights (/api/native/insights).
//

import Foundation

// MARK: - KPIs

struct InsightsKPIs: Codable, Sendable {
    let cancellationRate: Int
    let noShowRate: Int
    let averageBookingValue: Int
    let uniqueCustomers: Int
    let manualBookingRate: Int
}

// MARK: - Service Breakdown

struct ServiceBreakdownItem: Codable, Identifiable, Sendable {
    let serviceName: String
    let count: Int
    let revenue: Int

    var id: String { serviceName }

    private static let priceFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = "\u{00A0}"
        f.maximumFractionDigits = 0
        return f
    }()

    var formattedRevenue: String {
        let formatted = Self.priceFormatter.string(from: NSNumber(value: revenue)) ?? "\(revenue)"
        return "\(formatted) kr"
    }
}

// MARK: - Time Heatmap

struct TimeHeatmapEntry: Codable, Sendable {
    let day: String
    let dayIndex: Int
    let hour: Int
    let count: Int
}

/// Pre-computed heatmap matrix for efficient rendering in view body
struct HeatmapMatrix: Sendable {
    let days: [String]          // 7 day labels (Mon-Sun)
    let hours: [Int]            // Sorted hour range
    let cells: [[Int]]          // [dayIndex][hourIndex] -> count
    let maxCount: Int           // For color gradient calculation

    /// Color intensity 0.0-1.0 for a cell
    func intensity(day: Int, hour: Int) -> Double {
        guard maxCount > 0 else { return 0 }
        return Double(cells[day][hour]) / Double(maxCount)
    }

    static let empty = HeatmapMatrix(days: [], hours: [], cells: [], maxCount: 0)

    /// Build from API response entries
    static func from(entries: [TimeHeatmapEntry]) -> HeatmapMatrix {
        guard !entries.isEmpty else { return .empty }

        // Swedish day order: Mon-Sun (dayIndex 1-6, 0)
        let dayLabels = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"]
        // Map API dayIndex (0=Sun) to display index (0=Mon)
        func displayIndex(apiDayIndex: Int) -> Int {
            apiDayIndex == 0 ? 6 : apiDayIndex - 1
        }

        let allHours = Set(entries.map(\.hour)).sorted()
        guard let minHour = allHours.first, let maxHour = allHours.last else {
            return .empty
        }
        let hourRange = Array(minHour...maxHour)

        // Build 7 x hourRange.count matrix
        var cells = Array(repeating: Array(repeating: 0, count: hourRange.count), count: 7)
        var maxCount = 0

        for entry in entries {
            let dIdx = displayIndex(apiDayIndex: entry.dayIndex)
            if let hIdx = hourRange.firstIndex(of: entry.hour) {
                cells[dIdx][hIdx] = entry.count
                maxCount = max(maxCount, entry.count)
            }
        }

        return HeatmapMatrix(
            days: dayLabels,
            hours: hourRange,
            cells: cells,
            maxCount: maxCount
        )
    }
}

// MARK: - Customer Retention

struct CustomerRetentionMonth: Codable, Identifiable, Sendable {
    let month: String
    let newCustomers: Int
    let returningCustomers: Int

    var id: String { month }
}

// MARK: - API Response

struct InsightsResponse: Codable, Sendable {
    let serviceBreakdown: [ServiceBreakdownItem]
    let timeHeatmap: [TimeHeatmapEntry]
    let customerRetention: [CustomerRetentionMonth]
    let kpis: InsightsKPIs
}
