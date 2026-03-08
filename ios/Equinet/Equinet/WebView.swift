//
//  WebView.swift
//  Equinet
//
//  WKWebView wrapper that loads the Equinet web app.
//  Configured to feel native rather than browser-like.
//

#if os(iOS)
import SwiftUI
import WebKit

struct WebView: UIViewRepresentable {
    let url: URL
    let bridge: BridgeHandler
    @Binding var canGoBack: Bool
    @Binding var isLoading: Bool
    @Binding var hasNavigationError: Bool

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()

        // Register bridge message handler
        config.userContentController.add(
            context.coordinator,
            name: AppConfig.bridgeHandlerName
        )

        // Inject bridge detection + native-feel CSS/JS
        let bridgeScript = WKUserScript(
            source: """
                // Bridge setup
                window.isEquinetApp = true;
                window.equinetNative = {
                    onMessage: function(msg) {
                        console.log('[EquinetNative] Received:', JSON.stringify(msg));
                    }
                };

                // Disable long-press context menu (save image, copy link etc)
                document.addEventListener('contextmenu', function(e) { e.preventDefault(); });

                // Disable text selection on non-input elements
                var style = document.createElement('style');
                style.textContent = `
                    * {
                        -webkit-user-select: none;
                        user-select: none;
                        -webkit-touch-callout: none;
                    }
                    input, textarea, [contenteditable="true"] {
                        -webkit-user-select: auto;
                        user-select: auto;
                    }
                `;
                document.head.appendChild(style);
                """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(bridgeScript)

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

        // Disable zoom (apps don't pinch-to-zoom)
        webView.scrollView.minimumZoomScale = 1.0
        webView.scrollView.maximumZoomScale = 1.0
        webView.scrollView.bouncesZoom = false

        // Smooth scrolling
        webView.scrollView.bounces = true
        webView.scrollView.contentInsetAdjustmentBehavior = .always
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

        // Attach bridge to WebView
        bridge.attach(to: webView)
        PushManager.shared.bridge = bridge

        // Store reference for navigation from push notifications
        context.coordinator.webView = webView

        // Load the initial URL
        webView.load(URLRequest(url: url))

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // Retry loading when hasNavigationError is cleared (user tapped "retry" or came back online)
        if !hasNavigationError && context.coordinator.lastLoadFailed {
            context.coordinator.lastLoadFailed = false
            webView.load(URLRequest(url: url))
        }
    }

    // MARK: - Coordinator

    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        let parent: WebView
        weak var webView: WKWebView?
        var lastLoadFailed = false
        private var navigationObserver: NSObjectProtocol?

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
        }

        // MARK: - Pull-to-refresh

        @objc func handleRefresh(_ refreshControl: UIRefreshControl) {
            webView?.reload()
            // End refreshing after a short delay (page load will handle the rest)
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                refreshControl.endRefreshing()
            }
        }

        // MARK: - WKNavigationDelegate

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            parent.isLoading = true
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.canGoBack = webView.canGoBack
            parent.isLoading = false
            lastLoadFailed = false
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            parent.isLoading = false
            print("[WebView] Navigation failed: \(error.localizedDescription)")
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
                    print("[WebView] Network error: \(nsError.code) - \(error.localizedDescription)")
                    return
                }
            }

            print("[WebView] Provisional navigation failed: \(error.localizedDescription)")
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

            // Allow navigation within the Equinet domain
            if url.host == AppConfig.baseURL.host || url.host == "localhost" {
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
            Task { @MainActor in
                parent.bridge.handleMessage(message)
            }
        }
    }
}
#endif
