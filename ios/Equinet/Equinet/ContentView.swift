//
//  ContentView.swift
//  Equinet
//
//  Main content view with state-driven navigation:
//  - .checking: SplashView (checking Keychain)
//  - .loggedOut: NativeLoginView (email + password)
//  - .biometricPrompt: BiometricPromptView (Face ID / Touch ID)
//  - .authenticated: WebView with injected session cookie
//

import SwiftUI

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var authManager = AuthManager()
    @State private var canGoBack = false
    @State private var isLoading = false
    @State private var hasNavigationError = false
    @State private var webViewReady = false
    @State private var showReconnectedBanner = false
    @State private var showNativeCalendar = false
    @State private var bridge = BridgeHandler()
    @State private var networkMonitor = NetworkMonitor()
    @State private var calendarViewModel = CalendarViewModel()

    var body: some View {
        #if os(iOS)
        Group {
            switch authManager.state {
            case .checking:
                SplashView()

            case .loggedOut:
                NativeLoginView(authManager: authManager)

            case .biometricPrompt:
                BiometricPromptView(authManager: authManager)

            case .authenticated:
                authenticatedView
            }
        }
        .animation(.easeInOut(duration: 0.3), value: authManager.state == .authenticated)
        .onAppear {
            authManager.checkExistingAuth()
        }
        .onChange(of: scenePhase) { _, newPhase in
            guard authManager.state == .authenticated else { return }
            switch newPhase {
            case .active:
                bridge.sendToWeb(type: .appDidBecomeActive)
                Task { await bridge.refreshTokenIfNeeded() }
                PendingActionStore.retryAll()
                calendarViewModel.loadDataForSelectedDate()
                UIApplication.shared.applicationIconBadgeNumber = 0
            case .background:
                bridge.sendToWeb(type: .appDidEnterBackground)
            default:
                break
            }
        }
        #else
        Text("Equinet is available on iOS")
            .padding()
        #endif
    }

    // MARK: - Authenticated View (WebView + overlays)

    private var authenticatedView: some View {
        ZStack(alignment: .top) {
            if showNativeCalendar {
                // Native calendar view with tab bar
                VStack(spacing: 0) {
                    NativeCalendarView(viewModel: calendarViewModel) { path in
                        showNativeCalendar = false
                        bridge.navigateWebView(to: path)
                    }
                    NativeTabBar(activeTab: .calendar) { tab in
                        if let path = tab.webPath {
                            showNativeCalendar = false
                            bridge.navigateWebView(to: path)
                        }
                    }
                }
            } else if hasNavigationError {
                errorView
            } else {
                WebView(
                    url: AppConfig.dashboardURL,
                    bridge: bridge,
                    authManager: authManager,
                    canGoBack: $canGoBack,
                    isLoading: $isLoading,
                    hasNavigationError: $hasNavigationError,
                    webViewReady: $webViewReady,
                    showNativeCalendar: $showNativeCalendar
                )
                .ignoresSafeArea()
            }

            // Top overlays (only on WebView)
            if !showNativeCalendar {
                VStack(spacing: 0) {
                    if !networkMonitor.isConnected {
                        offlineBanner
                    } else if showReconnectedBanner {
                        reconnectedBanner
                    }

                    if isLoading && webViewReady {
                        ProgressView()
                            .progressViewStyle(.linear)
                            .tint(.accentColor)
                    }

                    Spacer()
                }
            }

            // Splash overlay -- shown until WebView finishes first load
            if !webViewReady && !showNativeCalendar {
                SplashView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: webViewReady)
        .animation(.easeInOut(duration: 0.3), value: networkMonitor.isConnected)
        .animation(.easeInOut(duration: 0.3), value: showReconnectedBanner)
        .animation(.easeInOut(duration: 0.2), value: showNativeCalendar)
        .onAppear {
            networkMonitor.onStatusChanged = { isOnline in
                bridge.sendNetworkStatus(isOnline: isOnline)

                if isOnline {
                    showReconnectedBanner = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                        showReconnectedBanner = false
                    }

                    if hasNavigationError {
                        hasNavigationError = false
                    }

                    PendingActionStore.retryAll()
                }
            }
            networkMonitor.start()
        }
        .onDisappear {
            networkMonitor.stop()
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

    // MARK: - Error View

    private var errorView: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: networkMonitor.isConnected ? "exclamationmark.triangle" : "wifi.exclamationmark")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)

            Text("Kunde inte ladda sidan")
                .font(.title3)
                .fontWeight(.semibold)

            Text(networkMonitor.isConnected
                ? "Servern svarar inte. Kontrollera att den är igång och försök igen."
                : "Kontrollera din internetanslutning och försök igen.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button {
                hasNavigationError = false
            } label: {
                Text("Försök igen")
                    .fontWeight(.medium)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .frame(minHeight: 44)
            }
            .buttonStyle(.borderedProminent)

            Spacer()
        }
    }
}

#Preview {
    ContentView()
}
