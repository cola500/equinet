//
//  ContentView.swift
//  Equinet
//
//  Main content view that wraps the WebView with navigation controls
//  and an offline banner.
//

import SwiftUI

struct ContentView: View {
    @State private var canGoBack = false
    @State private var isLoading = false
    @State private var hasNavigationError = false
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
                    url: AppConfig.baseURL,
                    bridge: bridge,
                    canGoBack: $canGoBack,
                    isLoading: $isLoading,
                    hasNavigationError: $hasNavigationError
                )
                .ignoresSafeArea()
            }

            // Top overlays
            VStack(spacing: 0) {
                // Offline banner
                if !networkMonitor.isConnected {
                    offlineBanner
                }

                // Loading indicator
                if isLoading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.accentColor)
                        .padding(.top, 4)
                }

                Spacer()
            }
        }
        .onAppear {
            networkMonitor.onStatusChanged = { isOnline in
                bridge.sendNetworkStatus(isOnline: isOnline)

                // Auto-retry when coming back online after a navigation error
                if isOnline && hasNavigationError {
                    hasNavigationError = false
                }
            }
            networkMonitor.start()
        }
        .onDisappear {
            networkMonitor.stop()
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
                ? "Servern svarar inte. Kontrollera att den ar igång och försök igen."
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
            }
            .buttonStyle(.borderedProminent)

            Spacer()
        }
    }
}

#Preview {
    ContentView()
}
