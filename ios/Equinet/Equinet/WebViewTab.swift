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
    @Binding var webViewReady: Bool
    /// Called when WebView intercepts a calendar URL -- parent should switch to calendar tab
    var onRequestNativeCalendar: (() -> Void)?

    @State private var canGoBack = false
    @State private var isLoading = false
    @State private var hasNavigationError = false
    @State private var showNativeCalendar = false

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
