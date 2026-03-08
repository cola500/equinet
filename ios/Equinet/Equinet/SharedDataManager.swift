//
//  SharedDataManager.swift
//  Equinet
//
//  Manages shared data between main app and widget extension via App Group UserDefaults.
//  Token storage uses Keychain (via KeychainHelper).
//

import Foundation
import WidgetKit

enum SharedDataManager {
    private static let suiteName = "group.com.equinet.shared"
    private static let widgetDataKey = "widget_booking_data"

    private static var userDefaults: UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }

    // MARK: - Widget Data

    /// Save widget booking data (called after API fetch)
    static func saveWidgetData(_ data: WidgetData) {
        guard let defaults = userDefaults else { return }
        if let encoded = try? JSONEncoder().encode(data) {
            defaults.set(encoded, forKey: widgetDataKey)
        }
    }

    /// Load widget booking data (called by widget TimelineProvider)
    static func loadWidgetData() -> WidgetData? {
        guard let defaults = userDefaults,
              let data = defaults.data(forKey: widgetDataKey) else {
            return nil
        }
        return try? JSONDecoder().decode(WidgetData.self, from: data)
    }

    /// Clear widget data (on logout)
    static func clearWidgetData() {
        userDefaults?.removeObject(forKey: widgetDataKey)
    }

    // MARK: - Calendar Cache

    private static let calendarCacheKey = "calendar_cache_data"

    /// Cached calendar data with metadata
    struct CalendarCache: Codable {
        let response: CalendarResponse
        let from: String
        let to: String
        let cachedAt: Date
    }

    /// Save calendar data for offline use
    static func saveCalendarCache(_ response: CalendarResponse, from: String, to: String) {
        guard let defaults = userDefaults else { return }
        let cache = CalendarCache(response: response, from: from, to: to, cachedAt: Date())
        if let encoded = try? JSONEncoder().encode(cache) {
            defaults.set(encoded, forKey: calendarCacheKey)
        }
    }

    /// Load cached calendar data (max 4 hours old)
    static func loadCalendarCache() -> CalendarCache? {
        guard let defaults = userDefaults,
              let data = defaults.data(forKey: calendarCacheKey),
              let cache = try? JSONDecoder().decode(CalendarCache.self, from: data) else {
            return nil
        }
        // Expire after 4 hours
        let maxAge: TimeInterval = 4 * 60 * 60
        guard Date().timeIntervalSince(cache.cachedAt) < maxAge else {
            defaults.removeObject(forKey: calendarCacheKey)
            return nil
        }
        return cache
    }

    /// Clear calendar cache (on logout)
    static func clearCalendarCache() {
        userDefaults?.removeObject(forKey: calendarCacheKey)
    }

    // MARK: - Token Convenience

    /// Check if we have a valid mobile token
    static var hasValidToken: Bool {
        KeychainHelper.loadMobileToken() != nil
    }

    // MARK: - Widget Refresh

    /// Notify widgets to reload their timelines
    static func reloadWidgets() {
        WidgetCenter.shared.reloadAllTimelines()
    }
}
