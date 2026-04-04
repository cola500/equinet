//
//  BridgeHandler.swift
//  Equinet
//
//  Handles messages between JavaScript and Swift.
//
//  Bridge protocol:
//    JS -> Swift: window.webkit.messageHandlers.equinet.postMessage({ type: "...", payload: {...} })
//    Swift -> JS: window.equinetNative?.onMessage({ type: "...", payload: {...} })
//

import Foundation
import Observation
import OSLog
import Supabase
import WebKit

/// Protocol to abstract WKScriptMessage for testability.
/// WKScriptMessage cannot be subclassed safely (no public init).
protocol ScriptMessageProtocol {
    var body: Any { get }
}

extension WKScriptMessage: ScriptMessageProtocol {}

enum BridgeMessageType: String {
    case requestPush = "requestPush"
    case pushTokenReceived = "pushTokenReceived"
    case pushPermissionDenied = "pushPermissionDenied"
    case networkStatus = "networkStatus"
    case appDidBecomeActive = "appDidBecomeActive"
    case appDidEnterBackground = "appDidEnterBackground"
    case startSpeechRecognition = "startSpeechRecognition"
    case stopSpeechRecognition = "stopSpeechRecognition"
    case speechRecognitionStarted = "speechRecognitionStarted"
    case speechTranscript = "speechTranscript"
    case speechRecognitionEnded = "speechRecognitionEnded"
    case speechRecognitionError = "speechRecognitionError"
    case speechAudioLevel = "speechAudioLevel"
    case navigateToNativeCalendar = "navigateToNativeCalendar"
    case navigateToWebView = "navigateToWebView"
    case requestCalendarSync = "requestCalendarSync"
    case calendarSyncEnabled = "calendarSyncEnabled"
    case calendarSyncDenied = "calendarSyncDenied"
    case calendarSyncStatus = "calendarSyncStatus"
    case userDidLogout = "userDidLogout"
}

@MainActor
@Observable
final class BridgeHandler {

    private weak var webView: WKWebView?
    private let speechRecognizer: SpeechRecognizable
    private weak var authManager: AuthManager?

    init(speechRecognizer: SpeechRecognizable? = nil) {
        self.speechRecognizer = speechRecognizer ?? SpeechRecognizer()
    }

    /// Whether a WebView is currently attached (mounted and alive).
    var hasWebView: Bool { webView != nil }


    func attach(to webView: WKWebView, authManager: AuthManager? = nil) {
        self.webView = webView
        if let authManager { self.authManager = authManager }
        setupSpeechCallbacks()
    }

    // MARK: - Incoming (JS -> Swift)

    func handleMessage(_ message: ScriptMessageProtocol) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else {
            AppLogger.bridge.warning("Invalid message format")
            return
        }

        _ = body["payload"] as? [String: Any]
        AppLogger.bridge.debug("Received: \(type)")

        switch type {
        case BridgeMessageType.requestPush.rawValue:
            PushManager.shared.requestPermission()
        case BridgeMessageType.startSpeechRecognition.rawValue:
            speechRecognizer.start()
        case BridgeMessageType.stopSpeechRecognition.rawValue:
            speechRecognizer.stop()
        case BridgeMessageType.requestCalendarSync.rawValue:
            handleCalendarSyncRequest()
        case BridgeMessageType.userDidLogout.rawValue:
            handleUserDidLogout()
        default:
            AppLogger.bridge.warning("Unknown message type: \(type)")
        }
    }

    // MARK: - Outgoing (Swift -> JS)

    func sendToWeb(type: BridgeMessageType, payload: [String: Any]? = nil) {
        guard let webView else {
            AppLogger.bridge.debug("No WebView attached, cannot send \(type.rawValue)")
            return
        }

        var message: [String: Any] = ["type": type.rawValue]
        if let payload {
            message["payload"] = payload
        }

        guard let jsonData = try? JSONSerialization.data(withJSONObject: message),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            AppLogger.bridge.error("Failed to serialize message")
            return
        }

        let js = "window.equinetNative?.onMessage(\(jsonString))"
        webView.evaluateJavaScript(js) { _, error in
            if let error {
                AppLogger.bridge.error("JS eval error: \(error.localizedDescription)")
            }
        }
    }

    private func setupSpeechCallbacks() {
        speechRecognizer.onStarted = { [weak self] in
            self?.sendToWeb(type: .speechRecognitionStarted)
        }

        speechRecognizer.onTranscript = { [weak self] text, isFinal, confidence in
            var payload: [String: Any] = [
                "text": text,
                "isFinal": isFinal,
            ]
            if let confidence {
                payload["confidence"] = confidence
            }
            self?.sendToWeb(type: .speechTranscript, payload: payload)
        }

        speechRecognizer.onAudioLevel = { [weak self] level in
            self?.sendToWeb(type: .speechAudioLevel, payload: ["level": level])
        }

        speechRecognizer.onEnded = { [weak self] reason in
            self?.sendToWeb(type: .speechRecognitionEnded, payload: ["reason": reason])
        }

        speechRecognizer.onError = { [weak self] error in
            self?.sendToWeb(type: .speechRecognitionError, payload: ["error": error.rawValue])
        }
    }

    /// Fetch next booking from API and store in App Group for widget
    func fetchAndStoreWidgetData() async {
        do {
            let response = try await APIClient.shared.fetchNextBooking()
            let widgetData = WidgetData(
                booking: response.booking,
                updatedAt: .now,
                hasAuth: true
            )
            SharedDataManager.saveWidgetData(widgetData)
            SharedDataManager.reloadWidgets()
            AppLogger.bridge.info("Widget data updated")
        } catch APIError.noToken, APIError.unauthorized {
            let widgetData = WidgetData(booking: nil, updatedAt: .now, hasAuth: false)
            SharedDataManager.saveWidgetData(widgetData)
            SharedDataManager.reloadWidgets()
            AppLogger.bridge.debug("No valid token for widget data")
        } catch {
            AppLogger.bridge.error("Failed to fetch widget data: \(error.localizedDescription)")
        }
    }

    /// Refresh Supabase session if needed and update widget data.
    /// Supabase SDK auto-refreshes, but we call this to ensure widget data is up to date.
    func refreshTokenIfNeeded() async {
        guard SupabaseManager.client.auth.currentSession != nil else { return }

        do {
            _ = try await SupabaseManager.client.auth.refreshSession()
            AppLogger.bridge.info("Supabase session refreshed")
        } catch {
            AppLogger.bridge.error("Session refresh failed: \(error.localizedDescription)")
        }

        await fetchAndStoreWidgetData()
    }

    /// Clear cached data and calendar sync (called on logout)
    func clearCachedData() {
        SharedDataManager.clearWidgetData()
        SharedDataManager.clearCalendarCache()
        SharedDataManager.reloadWidgets()
        CalendarSyncManager.shared.removeAllSyncedEvents()
        AppLogger.bridge.info("Cleared widget data, calendar cache, and calendar sync")
    }

    /// Handle logout message from web app
    private func handleUserDidLogout() {
        AppLogger.bridge.info("User logged out from web")
        authManager?.logout()
    }

    // MARK: - Calendar Sync

    private func handleCalendarSyncRequest() {
        Task {
            let granted = await CalendarSyncManager.shared.requestAccess()
            if granted {
                sendToWeb(type: .calendarSyncEnabled)
            } else {
                sendToWeb(type: .calendarSyncDenied, payload: [
                    "hint": "Öppna Inställningar > Equinet > Kalendrar för att aktivera",
                ])
            }
        }
    }

    /// Navigate the WebView to a specific path (called from native views)
    func navigateWebView(to path: String) {
        guard let url = URL(string: path, relativeTo: AppConfig.baseURL) else { return }
        webView?.load(URLRequest(url: url))
    }

    func sendPushToken(_ token: String) {
        sendToWeb(type: .pushTokenReceived, payload: ["token": token])
    }

    func sendPushPermissionDenied() {
        sendToWeb(type: .pushPermissionDenied)
    }

    func sendNetworkStatus(isOnline: Bool) {
        sendToWeb(type: .networkStatus, payload: ["isOnline": isOnline])
    }
}
