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
        let cache = CalendarCache(response: response, from: from, to: to, cachedAt: .now)
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
        guard Date.now.timeIntervalSince(cache.cachedAt) < maxAge else {
            defaults.removeObject(forKey: calendarCacheKey)
            return nil
        }
        return cache
    }

    /// Clear calendar cache (on logout)
    static func clearCalendarCache() {
        userDefaults?.removeObject(forKey: calendarCacheKey)
    }

    // MARK: - Dashboard Cache

    private static let dashboardCacheKey = "dashboard_cache_data"

    /// Cached dashboard data with timestamp
    struct DashboardCache: Codable {
        let response: DashboardResponse
        let cachedAt: Date
    }

    /// Save dashboard data for instant display on next launch
    static func saveDashboardCache(_ response: DashboardResponse) {
        guard let defaults = userDefaults else { return }
        let cache = DashboardCache(response: response, cachedAt: .now)
        if let encoded = try? JSONEncoder().encode(cache) {
            defaults.set(encoded, forKey: dashboardCacheKey)
        }
    }

    /// Load cached dashboard data (max 5 min old)
    static func loadDashboardCache() -> DashboardCache? {
        guard let defaults = userDefaults,
              let data = defaults.data(forKey: dashboardCacheKey),
              let cache = try? JSONDecoder().decode(DashboardCache.self, from: data) else {
            return nil
        }
        let maxAge: TimeInterval = 5 * 60
        guard Date.now.timeIntervalSince(cache.cachedAt) < maxAge else {
            defaults.removeObject(forKey: dashboardCacheKey)
            return nil
        }
        return cache
    }

    /// Clear dashboard cache (on logout)
    static func clearDashboardCache() {
        userDefaults?.removeObject(forKey: dashboardCacheKey)
    }

    // MARK: - Bookings Cache (5 min TTL)

    private static let bookingsCacheKey = "bookings_cache_data"

    struct BookingsCache: Codable {
        let bookings: [BookingsListItem]
        let cachedAt: Date
    }

    /// Save bookings data for cache-first loading
    static func saveBookingsCache(_ bookings: [BookingsListItem]) {
        guard let defaults = userDefaults else { return }
        let cache = BookingsCache(bookings: bookings, cachedAt: .now)
        if let encoded = try? JSONEncoder().encode(cache) {
            defaults.set(encoded, forKey: bookingsCacheKey)
        }
    }

    /// Load cached bookings data (max 5 minutes old)
    static func loadBookingsCache() -> BookingsCache? {
        guard let defaults = userDefaults,
              let data = defaults.data(forKey: bookingsCacheKey),
              let cache = try? JSONDecoder().decode(BookingsCache.self, from: data) else {
            return nil
        }
        let maxAge: TimeInterval = 5 * 60
        guard Date.now.timeIntervalSince(cache.cachedAt) < maxAge else {
            defaults.removeObject(forKey: bookingsCacheKey)
            return nil
        }
        return cache
    }

    /// Clear bookings cache (on logout)
    static func clearBookingsCache() {
        userDefaults?.removeObject(forKey: bookingsCacheKey)
    }

    // MARK: - Insights Cache (5 min TTL, per period)

    private static func insightsCacheKey(months: Int) -> String {
        "insights_cache_\(months)"
    }

    struct InsightsCache: Codable {
        let insights: InsightsResponse
        let cachedAt: Date
    }

    static func saveInsightsCache(_ insights: InsightsResponse, months: Int) {
        guard let defaults = userDefaults else { return }
        let cache = InsightsCache(insights: insights, cachedAt: .now)
        if let encoded = try? JSONEncoder().encode(cache) {
            defaults.set(encoded, forKey: insightsCacheKey(months: months))
        }
    }

    static func loadInsightsCache(months: Int) -> InsightsCache? {
        guard let defaults = userDefaults,
              let data = defaults.data(forKey: insightsCacheKey(months: months)),
              let cache = try? JSONDecoder().decode(InsightsCache.self, from: data) else {
            return nil
        }
        let maxAge: TimeInterval = 5 * 60
        guard Date.now.timeIntervalSince(cache.cachedAt) < maxAge else {
            defaults.removeObject(forKey: insightsCacheKey(months: months))
            return nil
        }
        return cache
    }

    static func clearAllInsightsCache() {
        for months in [3, 6, 12] {
            userDefaults?.removeObject(forKey: insightsCacheKey(months: months))
        }
    }

    // MARK: - Announcements Cache (5 min TTL)

    private static let announcementsCacheKey = "announcements_cache_data"

    struct AnnouncementsCache: Codable {
        let announcements: [AnnouncementItem]
        let cachedAt: Date
    }

    static func saveAnnouncementsCache(_ announcements: [AnnouncementItem]) {
        guard let defaults = userDefaults else { return }
        let cache = AnnouncementsCache(announcements: announcements, cachedAt: .now)
        if let encoded = try? JSONEncoder().encode(cache) {
            defaults.set(encoded, forKey: announcementsCacheKey)
        }
    }

    static func loadAnnouncementsCache() -> AnnouncementsCache? {
        guard let defaults = userDefaults,
              let data = defaults.data(forKey: announcementsCacheKey),
              let cache = try? JSONDecoder().decode(AnnouncementsCache.self, from: data) else {
            return nil
        }
        let maxAge: TimeInterval = 5 * 60
        guard Date.now.timeIntervalSince(cache.cachedAt) < maxAge else {
            defaults.removeObject(forKey: announcementsCacheKey)
            return nil
        }
        return cache
    }

    static func clearAnnouncementsCache() {
        userDefaults?.removeObject(forKey: announcementsCacheKey)
    }

    // MARK: - Calendar Sync

    private static let calendarSyncMappingKey = "calendar_sync_mapping"
    private static let equinetCalendarIdKey = "equinet_calendar_id"
    private static let calendarSyncEnabledKey = "calendar_sync_enabled"

    /// Mapping from bookingId -> EKEvent identifier
    static var calendarSyncMapping: [String: String] {
        get {
            userDefaults?.dictionary(forKey: calendarSyncMappingKey) as? [String: String] ?? [:]
        }
        set {
            userDefaults?.set(newValue, forKey: calendarSyncMappingKey)
        }
    }

    /// Identifier of the dedicated Equinet calendar
    static var equinetCalendarIdentifier: String? {
        get { userDefaults?.string(forKey: equinetCalendarIdKey) }
        set { userDefaults?.set(newValue, forKey: equinetCalendarIdKey) }
    }

    /// Whether calendar sync is enabled by the user
    static var calendarSyncEnabled: Bool {
        get { userDefaults?.bool(forKey: calendarSyncEnabledKey) ?? false }
        set { userDefaults?.set(newValue, forKey: calendarSyncEnabledKey) }
    }

    /// Clear all calendar sync data (on logout)
    static func clearCalendarSyncData() {
        userDefaults?.removeObject(forKey: calendarSyncMappingKey)
        userDefaults?.removeObject(forKey: equinetCalendarIdKey)
        userDefaults?.removeObject(forKey: calendarSyncEnabledKey)
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
