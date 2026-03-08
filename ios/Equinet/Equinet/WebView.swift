//
//  WebView.swift
//  Equinet
//
//  WKWebView wrapper that loads the Equinet web app.
//  Includes native-web bridge via WKScriptMessageHandler.
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

        // Inject bridge detection script so the web app knows it's running in native
        let bridgeScript = WKUserScript(
            source: """
                window.isEquinetApp = true;
                window.equinetNative = {
                    onMessage: function(msg) {
                        // Override this in the web app to receive messages from Swift
                        console.log('[EquinetNative] Received:', JSON.stringify(msg));
                    }
                };
                """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(bridgeScript)

        // Allow inline media playback (useful for video content)
        config.allowsInlineMediaPlayback = true

        // Enable offline application cache
        config.websiteDataStore = .default()

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true

        // Make WebView scrolling feel native
        webView.scrollView.bounces = true
        webView.scrollView.contentInsetAdjustmentBehavior = .always

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

    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
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

            // Network-related errors -> show offline error view
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
