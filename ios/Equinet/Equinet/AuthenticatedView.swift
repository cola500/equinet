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
    @State private var initialLoadComplete = false
    @State private var showReconnectedBanner = false

    var body: some View {
        ZStack(alignment: .top) {
            // Main TabView
            TabView(selection: $coordinator.selectedTab) {
                // Dashboard (Native)
                Tab(AppTab.dashboard.rawValue, systemImage: AppTab.dashboard.icon, value: AppTab.dashboard) {
                    NativeDashboardView(
                        onNavigateToTab: { tab in coordinator.selectedTab = tab },
                        onNavigateToWebPath: { path in
                            coordinator.pendingMorePath = path
                            coordinator.selectedTab = .more
                        }
                    )
                }

                // Calendar (Native)
                Tab(AppTab.calendar.rawValue, systemImage: AppTab.calendar.icon, value: AppTab.calendar) {
                    NativeCalendarView(viewModel: coordinator.calendarViewModel) { path in
                        coordinator.selectedTab = .dashboard
                        coordinator.pendingWebPath = path
                    }
                }

                // Bookings (Native)
                Tab(AppTab.bookings.rawValue, systemImage: AppTab.bookings.icon, value: AppTab.bookings) {
                    NativeBookingsView(viewModel: coordinator.bookingsViewModel) { path in
                        coordinator.pendingMorePath = path
                        coordinator.selectedTab = .more
                    }
                }

                // More (Native menu with NavigationStack)
                Tab(AppTab.more.rawValue, systemImage: AppTab.more.icon, value: AppTab.more) {
                    NativeMoreView(
                        bridge: coordinator.bridge,
                        authManager: authManager,
                        pendingPath: $coordinator.pendingMorePath
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

            // Splash overlay -- brief branded transition after login
            if !initialLoadComplete {
                SplashView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: initialLoadComplete)
        .animation(.easeInOut(duration: 0.3), value: coordinator.networkMonitor.isConnected)
        .animation(.easeInOut(duration: 0.3), value: showReconnectedBanner)
        .onAppear {
            setupNetworkMonitoring()
            coordinator.networkMonitor.start()
            // Dismiss splash after brief branded transition
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                initialLoadComplete = true
            }
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
