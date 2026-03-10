//
//  NativeTabBar.swift
//  Equinet
//
//  Minimal tab bar shown when native calendar is active.
//  Matches the web app's BottomTabBar design.
//  Tap on other tabs navigates back to WebView.
//

#if os(iOS)
import SwiftUI

struct NativeTabBar: View {
    let activeTab: Tab
    let onTabSelected: (Tab) -> Void

    enum Tab: String, CaseIterable {
        case dashboard = "Översikt"
        case calendar = "Kalender"
        case bookings = "Bokningar"
        case more = "Mer"

        var icon: String {
            switch self {
            case .dashboard: return "house"
            case .calendar: return "calendar"
            case .bookings: return "list.bullet"
            case .more: return "ellipsis"
            }
        }

        /// WebView path for this tab (nil = stay in native)
        var webPath: String? {
            switch self {
            case .dashboard: return "/provider/dashboard"
            case .calendar: return nil // Native
            case .bookings: return "/provider/bookings"
            case .more: return "/provider/menu"
            }
        }
    }

    var body: some View {
        HStack {
            ForEach(Tab.allCases, id: \.self) { tab in
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    onTabSelected(tab)
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: tab.icon)
                            .font(.title3)
                        Text(tab.rawValue)
                            .font(.caption2)
                    }
                    .foregroundStyle(tab == activeTab ? Color.accentColor : .secondary)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 44)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(tab == activeTab ? .isSelected : [])
                    .accessibilityHint(tab == activeTab ? "" : "Dubbelklicka för att byta till \(tab.rawValue)")
                }
            }
        }
        .padding(.top, 8)
        .padding(.bottom, 4)
        .background(
            Color(.systemBackground)
                .shadow(color: .black.opacity(0.08), radius: 1, y: -1)
        )
    }
}
#endif
