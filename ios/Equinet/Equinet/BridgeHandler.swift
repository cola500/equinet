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
import WebKit

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
    case requestMobileToken = "requestMobileToken"
    case mobileTokenReceived = "mobileTokenReceived"
    case mobileTokenError = "mobileTokenError"
    case navigateToNativeCalendar = "navigateToNativeCalendar"
    case navigateToWebView = "navigateToWebView"
    case requestCalendarSync = "requestCalendarSync"
    case calendarSyncEnabled = "calendarSyncEnabled"
    case calendarSyncDenied = "calendarSyncDenied"
    case calendarSyncStatus = "calendarSyncStatus"
}

@MainActor
@Observable
final class BridgeHandler {

    private weak var webView: WKWebView?
    private let speechRecognizer = SpeechRecognizer()

    func attach(to webView: WKWebView) {
        self.webView = webView
        setupSpeechCallbacks()
    }

    // MARK: - Incoming (JS -> Swift)

    func handleMessage(_ message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else {
            print("[Bridge] Invalid message format: \(message.body)")
            return
        }

        _ = body["payload"] as? [String: Any]
        print("[Bridge] Received: \(type)")

        switch type {
        case BridgeMessageType.requestPush.rawValue:
            PushManager.shared.requestPermission()
        case BridgeMessageType.startSpeechRecognition.rawValue:
            speechRecognizer.start()
        case BridgeMessageType.stopSpeechRecognition.rawValue:
            speechRecognizer.stop()
        case BridgeMessageType.requestMobileToken.rawValue:
            handleMobileTokenReceived(body["payload"] as? [String: Any])
        case BridgeMessageType.requestCalendarSync.rawValue:
            handleCalendarSyncRequest()
        default:
            print("[Bridge] Unknown message type: \(type)")
        }
    }

    // MARK: - Outgoing (Swift -> JS)

    func sendToWeb(type: BridgeMessageType, payload: [String: Any]? = nil) {
        guard let webView else {
            print("[Bridge] No WebView attached, cannot send \(type.rawValue)")
            return
        }

        var message: [String: Any] = ["type": type.rawValue]
        if let payload {
            message["payload"] = payload
        }

        guard let jsonData = try? JSONSerialization.data(withJSONObject: message),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            print("[Bridge] Failed to serialize message")
            return
        }

        let js = "window.equinetNative?.onMessage(\(jsonString))"
        webView.evaluateJavaScript(js) { _, error in
            if let error {
                print("[Bridge] JS eval error: \(error.localizedDescription)")
            }
        }
    }

    private func setupSpeechCallbacks() {
        speechRecognizer.onStarted = { [weak self] in
            self?.sendToWeb(type: .speechRecognitionStarted)
        }

        speechRecognizer.onTranscript = { [weak self] text, isFinal in
            self?.sendToWeb(type: .speechTranscript, payload: [
                "text": text,
                "isFinal": isFinal,
            ])
        }

        speechRecognizer.onEnded = { [weak self] reason in
            self?.sendToWeb(type: .speechRecognitionEnded, payload: ["reason": reason])
        }

        speechRecognizer.onError = { [weak self] error in
            self?.sendToWeb(type: .speechRecognitionError, payload: ["error": error.rawValue])
        }
    }

    // MARK: - Mobile Token

    private func handleMobileTokenReceived(_ payload: [String: Any]?) {
        guard let token = payload?["token"] as? String,
              let expiresAt = payload?["expiresAt"] as? String else {
            print("[Bridge] Invalid mobile token payload")
            sendToWeb(type: .mobileTokenError, payload: ["error": "Invalid payload"])
            return
        }

        KeychainHelper.saveMobileToken(jwt: token, expiresAt: expiresAt)
        print("[Bridge] Mobile token stored in Keychain")

        // Confirm to web
        sendToWeb(type: .mobileTokenReceived)

        // Fetch widget data in background
        Task {
            await fetchAndStoreWidgetData()
        }
    }

    /// Fetch next booking from API and store in App Group for widget
    func fetchAndStoreWidgetData() async {
        do {
            let response = try await APIClient.shared.fetchNextBooking()
            let widgetData = WidgetData(
                booking: response.booking,
                updatedAt: Date(),
                hasAuth: true
            )
            SharedDataManager.saveWidgetData(widgetData)
            SharedDataManager.reloadWidgets()
            print("[Bridge] Widget data updated")
        } catch APIError.noToken, APIError.unauthorized {
            let widgetData = WidgetData(booking: nil, updatedAt: Date(), hasAuth: false)
            SharedDataManager.saveWidgetData(widgetData)
            SharedDataManager.reloadWidgets()
            print("[Bridge] No valid token for widget data")
        } catch {
            print("[Bridge] Failed to fetch widget data: \(error)")
        }
    }

    /// Refresh token if nearing expiry and update widget data
    func refreshTokenIfNeeded() async {
        // Refresh if expiring within 7 days
        guard KeychainHelper.tokenExpiresWithinDays(7),
              KeychainHelper.loadMobileToken() != nil else {
            return
        }

        do {
            try await APIClient.shared.refreshToken()
            print("[Bridge] Mobile token refreshed")
        } catch {
            print("[Bridge] Token refresh failed: \(error)")
        }

        await fetchAndStoreWidgetData()
    }

    /// Clear token, widget data, and calendar sync (called on logout)
    func clearMobileToken() {
        KeychainHelper.clearMobileToken()
        SharedDataManager.clearWidgetData()
        SharedDataManager.clearCalendarCache()
        SharedDataManager.reloadWidgets()
        CalendarSyncManager.shared.removeAllSyncedEvents()
        print("[Bridge] Mobile token, widget data, calendar cache, and calendar sync cleared")
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
