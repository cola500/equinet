//
//  ContentView.swift
//  Equinet
//
//  Main content view that wraps the WebView with navigation controls
//  and an offline banner.
//

import SwiftUI

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var canGoBack = false
    @State private var isLoading = false
    @State private var hasNavigationError = false
    @State private var webViewReady = false
    @State private var showReconnectedBanner = false
    @State private var bridge = BridgeHandler()
    @State private var networkMonitor = NetworkMonitor()

    var body: some View {
        #if os(iOS)
        ZStack(alignment: .top) {
            if hasNavigationError {
                // Error view -- shown when page failed to load (offline or server down)
                errorView
            } else {
                WebView(
                    url: AppConfig.startURL,
                    bridge: bridge,
                    canGoBack: $canGoBack,
                    isLoading: $isLoading,
                    hasNavigationError: $hasNavigationError,
                    webViewReady: $webViewReady
                )
                .ignoresSafeArea()
            }

            // Top overlays
            VStack(spacing: 0) {
                // Offline / reconnected banner
                if !networkMonitor.isConnected {
                    offlineBanner
                } else if showReconnectedBanner {
                    reconnectedBanner
                }

                // Linear progress indicator (only visible after splash is dismissed)
                if isLoading && webViewReady {
                    ProgressView()
                        .progressViewStyle(.linear)
                        .tint(.accentColor)
                }

                Spacer()
            }

            // Splash overlay -- shown until WebView finishes first load
            if !webViewReady {
                SplashView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: webViewReady)
        .animation(.easeInOut(duration: 0.3), value: networkMonitor.isConnected)
        .animation(.easeInOut(duration: 0.3), value: showReconnectedBanner)
        .onAppear {
            networkMonitor.onStatusChanged = { isOnline in
                bridge.sendNetworkStatus(isOnline: isOnline)

                if isOnline {
                    // Show green "reconnected" banner for 3 seconds
                    showReconnectedBanner = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                        showReconnectedBanner = false
                    }

                    // Auto-retry when coming back online after a navigation error
                    if hasNavigationError {
                        hasNavigationError = false
                    }
                }
            }
            networkMonitor.start()
        }
        .onDisappear {
            networkMonitor.stop()
        }
        .onChange(of: scenePhase) { _, newPhase in
            switch newPhase {
            case .active:
                bridge.sendToWeb(type: .appDidBecomeActive)
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
