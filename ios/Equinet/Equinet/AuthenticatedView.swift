//
//  AuthenticatedView.swift
//  Equinet
//
//  Main authenticated view with TabView, overlays (offline banner,
//  reconnected banner, splash screen), and network monitoring.
//  Replaces the inline authenticatedView from ContentView.
//

#if os(iOS)
import OSLog
import SwiftUI

struct AuthenticatedView: View {
    let authManager: AuthManager
    @Bindable var coordinator: AppCoordinator
    @State private var webViewReady = false
    @State private var showReconnectedBanner = false

    var body: some View {
        ZStack(alignment: .top) {
            // Main TabView
            TabView(selection: $coordinator.selectedTab) {
                // Dashboard (WebView)
                Tab(AppTab.dashboard.rawValue, systemImage: AppTab.dashboard.icon, value: AppTab.dashboard) {
                    WebViewTab(
                        path: AppTab.dashboard.webPath!,
                        bridge: coordinator.bridge,
                        authManager: authManager,
                        webViewReady: $webViewReady,
                        onRequestNativeCalendar: { coordinator.selectedTab = .calendar }
                    )
                }

                // Calendar (Native)
                Tab(AppTab.calendar.rawValue, systemImage: AppTab.calendar.icon, value: AppTab.calendar) {
                    NativeCalendarView(viewModel: coordinator.calendarViewModel) { path in
                        coordinator.bridge.navigateWebView(to: path)
                    }
                }

                // Bookings (WebView for now)
                Tab(AppTab.bookings.rawValue, systemImage: AppTab.bookings.icon, value: AppTab.bookings) {
                    WebViewTab(
                        path: AppTab.bookings.webPath!,
                        bridge: coordinator.bridge,
                        authManager: authManager,
                        webViewReady: $webViewReady,
                        onRequestNativeCalendar: { coordinator.selectedTab = .calendar }
                    )
                }

                // More (WebView)
                Tab(AppTab.more.rawValue, systemImage: AppTab.more.icon, value: AppTab.more) {
                    WebViewTab(
                        path: AppTab.more.webPath!,
                        bridge: coordinator.bridge,
                        authManager: authManager,
                        webViewReady: $webViewReady,
                        onRequestNativeCalendar: { coordinator.selectedTab = .calendar }
                    )
                }
            }

            // Top overlays
            VStack(spacing: 0) {
                if !coordinator.networkMonitor.isConnected {
                    offlineBanner
                } else if showReconnectedBanner {
                    reconnectedBanner
                }
                Spacer()
            }

            // Splash overlay -- shown until first WebView finishes loading
            if !webViewReady && coordinator.selectedTab != .calendar {
                SplashView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: webViewReady)
        .animation(.easeInOut(duration: 0.3), value: coordinator.networkMonitor.isConnected)
        .animation(.easeInOut(duration: 0.3), value: showReconnectedBanner)
        .onAppear {
            setupNetworkMonitoring()
            coordinator.networkMonitor.start()
        }
        .onDisappear {
            coordinator.networkMonitor.stop()
        }
    }

    // MARK: - Network Monitoring

    private func setupNetworkMonitoring() {
        coordinator.networkMonitor.onStatusChanged = { isOnline in
            coordinator.bridge.sendNetworkStatus(isOnline: isOnline)

            if isOnline {
                showReconnectedBanner = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                    showReconnectedBanner = false
                }
                PendingActionStore.retryAll()
            }
        }
    }

    // MARK: - Offline Banner

    private var offlineBanner: some View {
        HStack(spacing: 6) {
            Image(systemName: "wifi.slash")
                .font(.caption)
            Text("Ingen internetanslutning")
                .font(.caption)
                .fontWeight(.medium)
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(Color.orange)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Ingen internetanslutning")
    }

    // MARK: - Reconnected Banner

    private var reconnectedBanner: some View {
        HStack(spacing: 6) {
            Image(systemName: "wifi")
                .font(.caption)
            Text("Ansluten igen")
                .font(.caption)
                .fontWeight(.medium)
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(Color.green)
        .transition(.move(edge: .top).combined(with: .opacity))
    }
}
#endif
