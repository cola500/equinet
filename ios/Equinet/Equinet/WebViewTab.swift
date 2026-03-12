//
//  WebViewTab.swift
//  Equinet
//
//  Wrapper that shows a WebView for tabs that haven't been migrated to native yet.
//  Loads the appropriate URL path and connects to the shared BridgeHandler.
//

#if os(iOS)
import SwiftUI

struct WebViewTab: View {
    let path: String
    let bridge: BridgeHandler
    let authManager: AuthManager
    /// Called when WebView intercepts a calendar URL -- parent should switch to calendar tab
    var onRequestNativeCalendar: (() -> Void)?
    /// Called once when this tab's WebView finishes its first load
    var onFirstLoad: (() -> Void)?
    /// Pending navigation path from native calendar tap-to-book.
    /// Consumed once the WebView is ready, then set to nil.
    @Binding var pendingNavigation: String?

    @State private var webViewReady = false
    @State private var canGoBack = false
    @State private var isLoading = false
    @State private var hasNavigationError = false
    @State private var showNativeCalendar = false
    @State private var didCallFirstLoad = false

    private var url: URL {
        AppConfig.baseURL.appendingPathComponent(path)
    }

    var body: some View {
        ZStack {
            if hasNavigationError {
                errorView
            } else {
                WebView(
                    url: url,
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

            if isLoading && webViewReady {
                VStack {
                    ProgressView()
                        .progressViewStyle(.linear)
                        .tint(.accentColor)
                    Spacer()
                }
            }
        }
        .onChange(of: showNativeCalendar) { _, isRequested in
            if isRequested {
                showNativeCalendar = false
                onRequestNativeCalendar?()
            }
        }
        .onChange(of: webViewReady) { _, isReady in
            if isReady && !didCallFirstLoad {
                didCallFirstLoad = true
                onFirstLoad?()
            }
            // Consume pending navigation from native calendar tap-to-book
            if isReady, let pending = pendingNavigation {
                bridge.navigateWebView(to: pending)
                pendingNavigation = nil
            }
        }
    }

    private var errorView: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)

            Text("Kunde inte ladda sidan")
                .font(.title3)
                .fontWeight(.semibold)

            Text("Kontrollera din internetanslutning och försök igen.")
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
#endif
