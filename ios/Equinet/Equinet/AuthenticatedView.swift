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
    @Environment(\.scenePhase) private var scenePhase
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
                    NativeCalendarView(
                        viewModel: coordinator.calendarViewModel,
                        onNavigateToBooking: { bookingId in
                            coordinator.pendingBookingId = bookingId
                            coordinator.selectedTab = .bookings
                        }
                    ) { path in
                        coordinator.pendingMorePath = path
                        coordinator.selectedTab = .more
                    }
                }

                // Bookings (Native)
                Tab(AppTab.bookings.rawValue, systemImage: AppTab.bookings.icon, value: AppTab.bookings) {
                    NativeBookingsView(
                        viewModel: coordinator.bookingsViewModel,
                        pendingBookingId: $coordinator.pendingBookingId
                    ) { path in
                        coordinator.pendingMorePath = path
                        coordinator.selectedTab = .more
                    }
                }

                // More (Native menu with NavigationStack)
                Tab(AppTab.more.rawValue, systemImage: AppTab.more.icon, value: AppTab.more) {
                    NativeMoreView(
                        bridge: coordinator.bridge,
                        authManager: authManager,
                        customersViewModel: coordinator.customersViewModel,
                        servicesViewModel: coordinator.servicesViewModel,
                        reviewsViewModel: coordinator.reviewsViewModel,
                        profileViewModel: coordinator.profileViewModel,
                        featureFlags: coordinator.featureFlags,
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
            coordinator.loadFeatureFlags()
            // Dismiss splash after brief branded transition
            Task {
                try? await Task.sleep(for: .milliseconds(500))
                initialLoadComplete = true
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                coordinator.loadFeatureFlags()
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
                Task {
                    try? await Task.sleep(for: .seconds(3))
                    showReconnectedBanner = false
                }
                PendingActionStore.retryAll()
            }
        }
    }

    // MARK: - Banners

    private var offlineBanner: some View { NetworkBannerView.Offline() }
    private var reconnectedBanner: some View { NetworkBannerView.Reconnected() }
}
#endif
