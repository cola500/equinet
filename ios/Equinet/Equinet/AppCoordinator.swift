//
//  AppCoordinator.swift
//  Equinet
//
//  Central coordinator that owns shared dependencies and manages tab routing.
//  Observes AuthManager.state for global logout handling.
//

#if os(iOS)
import Observation
import OSLog

/// Tab identifiers for the main tab bar.
enum AppTab: String, CaseIterable, Identifiable {
    case dashboard = "Oversikt"
    case calendar = "Kalender"
    case bookings = "Bokningar"
    case more = "Mer"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .dashboard: return "house"
        case .calendar: return "calendar"
        case .bookings: return "list.bullet"
        case .more: return "ellipsis"
        }
    }

    /// Web path for tabs that still use WebView (nil = native)
    var webPath: String? {
        switch self {
        case .dashboard: return "/provider/dashboard"
        case .calendar: return nil
        case .bookings: return "/provider/bookings"
        case .more: return nil  // Native NativeMoreView
        }
    }
}

@Observable
@MainActor
final class AppCoordinator {

    // MARK: - Tab state

    var selectedTab: AppTab = .calendar

    // MARK: - Shared dependencies

    let bridge: BridgeHandler
    let networkMonitor: NetworkMonitor
    let calendarViewModel: CalendarViewModel

    // MARK: - Init

    init(
        bridge: BridgeHandler? = nil,
        networkMonitor: NetworkMonitor? = nil,
        calendarViewModel: CalendarViewModel? = nil
    ) {
        self.bridge = bridge ?? BridgeHandler()
        self.networkMonitor = networkMonitor ?? NetworkMonitor()
        self.calendarViewModel = calendarViewModel ?? CalendarViewModel()
    }

    // MARK: - Tab routing

    /// Navigate to a specific tab. If the tab uses WebView, navigate the bridge.
    func selectTab(_ tab: AppTab) {
        selectedTab = tab
        AppLogger.app.debug("Tab selected: \(tab.rawValue)")
    }

    // MARK: - Deep linking

    /// Handle deep link URL (e.g. from push notification)
    func handleDeepLink(_ path: String) {
        if path.contains("/calendar") || path.contains("/kalender") {
            selectedTab = .calendar
        } else if path.contains("/bookings") {
            selectedTab = .bookings
        } else if path.contains("/dashboard") {
            selectedTab = .dashboard
        } else {
            selectedTab = .more
        }
        AppLogger.app.debug("Deep link handled: \(path)")
    }
}
#endif
