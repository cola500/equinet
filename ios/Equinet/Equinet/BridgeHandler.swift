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
