//
//  WebView.swift
//  Equinet
//
//  WKWebView wrapper that loads the Equinet web app.
//  Configured to feel native rather than browser-like.
//

#if os(iOS)
import OSLog
import Supabase
import SwiftUI
import WebKit

/// Weak wrapper to break retain cycle between WKUserContentController and Coordinator.
/// WKUserContentController.add(_:name:) holds a STRONG reference to the handler.
/// Without this wrapper, Coordinator is never deallocated.
private class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?

    init(delegate: WKScriptMessageHandler) {
        self.delegate = delegate
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}

struct WebView: UIViewRepresentable {
    let url: URL
    let bridge: BridgeHandler
    let authManager: AuthManager
    var hideWebNavigation: Bool = true
    @Binding var canGoBack: Bool
    @Binding var isLoading: Bool
    @Binding var hasNavigationError: Bool
    @Binding var webViewReady: Bool
    @Binding var showNativeCalendar: Bool
    @Binding var navigateTo: String?

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()

        // Register bridge message handler (via weak wrapper to prevent retain cycle)
        config.userContentController.add(
            WeakScriptMessageHandler(delegate: context.coordinator),
            name: AppConfig.bridgeHandlerName
        )

        // Script A: Bridge setup (atDocumentStart -- must run before page JS)
        let bridgeScript = WKUserScript(
            source: """
                window.isEquinetApp = true;
                window.equinetNative = {
                    onMessage: function(msg) {
                        console.log('[EquinetNative] Received:', JSON.stringify(msg));
                    }
                };
                localStorage.setItem('equinet-cookie-notice-dismissed', 'true');
                document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
                """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(bridgeScript)

        // Script B: CSS + viewport (atDocumentEnd -- document.head exists now)
        // Navigation-hiding CSS is only injected for provider views (hideWebNavigation=true).
        // Customer views keep the web nav elements visible.
        var navHidingCSS = ""
        if hideWebNavigation {
            navHidingCSS = """
                    /* Hide web BottomTabBar -- native TabView replaces it */
                    nav[class*="fixed"][class*="bottom-0"] {
                        display: none !important;
                    }
                    /* Hide web Header -- native NavigationStack replaces it */
                    header.border-b {
                        display: none !important;
                    }
                    /* Hide ProviderNav -- native TabView replaces it */
                    nav.border-b:not([class*="fixed"]) {
                        display: none !important;
                    }
                    /* No extra padding at bottom -- SwiftUI TabView handles safe area */
                    body {
                        padding-bottom: 0 !important;
                    }
                    /* Compensate for hidden header -- use safe area inset for status bar */
                    main.container {
                        padding-top: calc(env(safe-area-inset-top, 20px) + 1rem) !important;
                    }
                """
        }

        let cssScript = WKUserScript(
            source: """
                var style = document.createElement('style');
                style.textContent = `
                    /* Force light mode -- web app lacks dark mode support */
                    :root {
                        color-scheme: light;
                    }
                    * {
                        -webkit-user-select: none;
                        user-select: none;
                        -webkit-touch-callout: none;
                    }
                    input, textarea, [contenteditable="true"] {
                        -webkit-user-select: auto;
                        user-select: auto;
                    }
                    \(navHidingCSS)
                `;
                document.head.appendChild(style);

                var viewport = document.querySelector('meta[name="viewport"]');
                if (viewport) {
                    var content = viewport.getAttribute('content');
                    if (!content.includes('viewport-fit=cover')) {
                        viewport.setAttribute('content', content + ', viewport-fit=cover');
                    }
                }
                """,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(cssScript)

        // Allow inline media playback
        config.allowsInlineMediaPlayback = true

        // Enable offline application cache
        config.websiteDataStore = .default()

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true

        // -- Native feel --

        // Match background color to app (prevents white flash on bounce/scroll)
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        webView.scrollView.backgroundColor = .systemBackground
        webView.underPageBackgroundColor = .systemBackground

        // Disable zoom (apps don't pinch-to-zoom)
        webView.scrollView.minimumZoomScale = 1.0
        webView.scrollView.maximumZoomScale = 1.0
        webView.scrollView.bouncesZoom = false

        // Scrolling -- no bounce to avoid revealing background
        webView.scrollView.bounces = false
        webView.scrollView.alwaysBounceVertical = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.showsHorizontalScrollIndicator = false

        // Pull-to-refresh
        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(
            context.coordinator,
            action: #selector(Coordinator.handleRefresh(_:)),
            for: .valueChanged
        )
        webView.scrollView.refreshControl = refreshControl

        // Disable link preview (peek/pop on long press)
        webView.allowsLinkPreview = false

        // Attach bridge to WebView (with authManager for logout handling)
        bridge.attach(to: webView, authManager: authManager)
        PushManager.shared.bridge = bridge

        // Store reference for navigation from push notifications
        context.coordinator.webView = webView

        // Observe cookie changes for session expiry detection
        context.coordinator.startObservingCookies(for: webView)

        // Exchange Supabase token for web session cookies BEFORE loading the page.
        // [weak webView] prevents crash if view deallocates during 10s exchange timeout.
        Task { [weak webView, weak coordinator = context.coordinator] in
            guard let webView else { return }
            await authManager.exchangeSessionForWebCookies(into: webView.configuration.websiteDataStore.httpCookieStore)
            webView.load(URLRequest(url: url))
            // Start JWT-rotation observer after first exchange.
            coordinator?.startAuthStateObserver(authManager: authManager, webView: webView)
        }

        return webView
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: AppConfig.bridgeHandlerName
        )
        webView.configuration.userContentController.removeAllUserScripts()
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // Handle pending navigation (tap-to-book from native calendar)
        if let path = navigateTo {
            if let navURL = URL(string: path, relativeTo: AppConfig.baseURL) {
                AppLogger.webview.debug("navigateTo: \(path)")
                webView.load(URLRequest(url: navURL))
            }
            DispatchQueue.main.async { self.navigateTo = nil }
        }

        // Retry loading when hasNavigationError is cleared (user tapped "retry" or came back online)
        if !hasNavigationError && context.coordinator.lastLoadFailed {
            context.coordinator.lastLoadFailed = false
            webView.load(URLRequest(url: url))
        }
    }

    // MARK: - Coordinator

    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, WKHTTPCookieStoreObserver {
        let parent: WebView
        weak var webView: WKWebView?
        var lastLoadFailed = false
        private var navigationObserver: NSObjectProtocol?
        private var authStateTask: Task<Void, Never>?

        init(parent: WebView) {
            self.parent = parent
            super.init()

            // Listen for push notification navigation requests
            navigationObserver = NotificationCenter.default.addObserver(
                forName: .navigateToURL,
                object: nil,
                queue: .main
            ) { [weak self] notification in
                if let urlString = notification.userInfo?["url"] as? String,
                   let url = URL(string: urlString, relativeTo: AppConfig.baseURL) {
                    self?.webView?.load(URLRequest(url: url))
                }
            }
        }

        deinit {
            if let observer = navigationObserver {
                NotificationCenter.default.removeObserver(observer)
            }
            // Cancel JWT-rotation observer
            authStateTask?.cancel()
            // Unregister cookie observer
            webView?.configuration.websiteDataStore.httpCookieStore.remove(self)
        }

        /// Start observing cookie changes (called after webView is set up)
        func startObservingCookies(for webView: WKWebView) {
            webView.configuration.websiteDataStore.httpCookieStore.add(self)
        }

        /// Listen for Supabase token refreshes and re-exchange cookies so WKWebView stays authenticated.
        @MainActor
        func startAuthStateObserver(authManager: AuthManager, webView: WKWebView) {
            authStateTask = Task { @MainActor [weak authManager, weak webView] in
                defer { AppLogger.auth.warning("authStateChanges stream ended — JWT rotation no longer monitored") }
                for await (event, _) in SupabaseManager.client.auth.authStateChanges {
                    guard !Task.isCancelled else { break }
                    guard event == .tokenRefreshed else { continue }
                    // Use continue (not break) so transient nil during view reconstruction doesn't kill the loop.
                    guard let authManager, let webView else { continue }
                    AppLogger.auth.debug("JWT rotated — re-exchanging web cookies")
                    await authManager.exchangeSessionForWebCookies(
                        into: webView.configuration.websiteDataStore.httpCookieStore
                    )
                }
            }
        }

        // MARK: - WKHTTPCookieStoreObserver

        func cookiesDidChange(in cookieStore: WKHTTPCookieStore) {
            Task { @MainActor in
                let cookies = await cookieStore.allCookies()
                // Look for Supabase auth cookie (sb-<ref>-auth-token)
                let hasSupabaseCookie = cookies.contains { cookie in
                    cookie.name.hasPrefix("sb-") && cookie.name.hasSuffix("-auth-token")
                        && (cookie.domain.hasSuffix(AppConfig.baseURL.host ?? "")
                            || cookie.domain == "localhost")
                }

                // Supabase cookie disappeared -> user logged out in web
                if !hasSupabaseCookie && parent.webViewReady {
                    AppLogger.auth.info("Supabase cookie removed, triggering logout")
                    parent.authManager.logout()
                }
            }
        }

        // MARK: - Pull-to-refresh

        private var refreshTimeoutWork: DispatchWorkItem?

        @objc func handleRefresh(_ refreshControl: UIRefreshControl) {
            // Haptic feedback
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()

            webView?.reload()

            // Timeout safety -- end refreshing after 10s max
            refreshTimeoutWork?.cancel()
            let timeout = DispatchWorkItem { [weak refreshControl] in
                refreshControl?.endRefreshing()
            }
            refreshTimeoutWork = timeout
            DispatchQueue.main.asyncAfter(deadline: .now() + 10.0, execute: timeout)
        }

        private func endRefreshingIfNeeded() {
            refreshTimeoutWork?.cancel()
            refreshTimeoutWork = nil
            webView?.scrollView.refreshControl?.endRefreshing()
        }

        // MARK: - WKNavigationDelegate

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            parent.isLoading = true
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.canGoBack = webView.canGoBack
            parent.isLoading = false
            lastLoadFailed = false
            endRefreshingIfNeeded()


            // Signal first load complete (dismisses splash screen)
            if !parent.webViewReady {
                parent.webViewReady = true
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            parent.isLoading = false
            AppLogger.webview.warning("Navigation failed: \(error.localizedDescription)")
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            parent.isLoading = false
            let nsError = error as NSError

            // Network-related errors -> show error view
            if nsError.domain == NSURLErrorDomain {
                let networkErrors: Set<Int> = [
                    NSURLErrorNotConnectedToInternet,
                    NSURLErrorNetworkConnectionLost,
                    NSURLErrorTimedOut,
                    NSURLErrorCannotFindHost,
                    NSURLErrorCannotConnectToHost,
                    NSURLErrorDNSLookupFailed,
                ]

                if networkErrors.contains(nsError.code) {
                    lastLoadFailed = true
                    parent.hasNavigationError = true
                    AppLogger.webview.warning("Network error \(nsError.code): \(error.localizedDescription)")
                    return
                }
            }

            AppLogger.webview.warning("Provisional navigation failed: \(error.localizedDescription)")
        }

        // Catch HTTP 401/5xx errors
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationResponse: WKNavigationResponse,
            decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
        ) {
            if let httpResponse = navigationResponse.response as? HTTPURLResponse {
                // 401 -> session expired, auto-logout
                if httpResponse.statusCode == 401 {
                    AppLogger.auth.info("HTTP 401 detected, triggering logout")
                    decisionHandler(.cancel)
                    Task { @MainActor in
                        parent.authManager.logout()
                    }
                    return
                }

                // 5xx -> show native error view
                if httpResponse.statusCode >= 500 {
                    parent.isLoading = false
                    lastLoadFailed = true
                    parent.hasNavigationError = true
                    decisionHandler(.cancel)
                    AppLogger.webview.error("Server error: \(httpResponse.statusCode)")
                    return
                }
            }
            decisionHandler(.allow)
        }

        // Keep navigation within the app (don't open external links in Safari)
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            // Intercept calendar URL -- show native calendar instead
            if url.host == AppConfig.baseURL.host || url.host == "localhost" {
                if url.path == "/provider/calendar" || url.path.hasPrefix("/provider/calendar/") {
                    // Allow navigation when opening ManualBookingDialog from native calendar tap-to-book
                    let hasNewBooking = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                        .queryItems?.contains(where: { $0.name == "newBooking" && $0.value == "true" }) ?? false
                    AppLogger.webview.debug("Calendar URL intercepted: \(url.absoluteString), hasNewBooking=\(hasNewBooking)")
                    if !hasNewBooking {
                        decisionHandler(.cancel)
                        parent.showNativeCalendar = true
                        return
                    }
                }

                // Detect navigation to /login -- means session expired or user logged out in web
                if url.path == "/login" {
                    decisionHandler(.cancel)
                    Task { @MainActor in
                        parent.authManager.logout()
                    }
                    return
                }

                // Block navigation to the marketing landing page -- redirect to dashboard
                if url.path == "/" || url.path.isEmpty {
                    decisionHandler(.cancel)
                    webView.load(URLRequest(url: AppConfig.dashboardURL))
                    return
                }
                decisionHandler(.allow)
                return
            }

            // Open external links in Safari
            if navigationAction.navigationType == .linkActivated {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }

        // MARK: - WKScriptMessageHandler

        nonisolated func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            // Validate origin -- only accept messages from our own domain
            if let messageURL = message.frameInfo.request.url,
               let host = messageURL.host {
                let allowedHosts: Set<String> = [
                    AppConfig.baseURL.host ?? "",
                    "localhost",
                ]
                guard allowedHosts.contains(host) else {
                    Task { @MainActor in
                        AppLogger.bridge.warning("Rejected bridge message from untrusted origin: \(host)")
                    }
                    return
                }
            }

            Task { @MainActor in
                parent.bridge.handleMessage(message)
            }
        }
    }
}
#endif
