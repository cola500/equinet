//
//  CustomerWebView.swift
//  Equinet
//
//  Simple full-screen WebView for customer users.
//  Customers use the web UI directly without native tabs.
//

#if os(iOS)
import OSLog
import SwiftUI

struct CustomerWebView: View {
    let bridge: BridgeHandler
    let authManager: AuthManager
    let networkMonitor: NetworkMonitor

    @State private var canGoBack = false
    @State private var isLoading = false
    @State private var hasNavigationError = false
    @State private var webViewReady = false
    @State private var showReconnectedBanner = false

    private var url: URL {
        URL(string: "/", relativeTo: AppConfig.baseURL) ?? AppConfig.baseURL
    }

    var body: some View {
        ZStack(alignment: .top) {
            if hasNavigationError {
                errorView
            } else {
                WebView(
                    url: url,
                    bridge: bridge,
                    authManager: authManager,
                    hideWebNavigation: false,
                    canGoBack: $canGoBack,
                    isLoading: $isLoading,
                    hasNavigationError: $hasNavigationError,
                    webViewReady: $webViewReady,
                    showNativeCalendar: .constant(false),
                    navigateTo: .constant(nil)
                )
                .ignoresSafeArea()
            }

            // Splash until WebView loads
            if !webViewReady {
                SplashView()
                    .transition(.opacity)
            }

            // Network banners
            VStack(spacing: 0) {
                if !networkMonitor.isConnected {
                    offlineBanner
                } else if showReconnectedBanner {
                    reconnectedBanner
                }
                Spacer()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: webViewReady)
        .animation(.easeInOut(duration: 0.3), value: networkMonitor.isConnected)
        .onAppear {
            setupNetworkMonitoring()
            networkMonitor.start()
        }
        .onDisappear {
            networkMonitor.stop()
        }
    }

    // MARK: - Network

    private func setupNetworkMonitoring() {
        networkMonitor.onStatusChanged = { isOnline in
            bridge.sendNetworkStatus(isOnline: isOnline)
            if isOnline {
                showReconnectedBanner = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                    showReconnectedBanner = false
                }
            }
        }
    }

    // MARK: - Banners

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

    // MARK: - Error

    private var errorView: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)

            Text("Kunde inte ladda sidan")
                .font(.title3)
                .fontWeight(.semibold)

            Text("Kontrollera din internetanslutning och forsok igen.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button {
                hasNavigationError = false
            } label: {
                Text("Forsok igen")
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
#endif
