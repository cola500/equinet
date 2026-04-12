//
//  PushManager.swift
//  Equinet
//
//  Manages push notification registration and permissions.
//

import Foundation
import OSLog
import UserNotifications
#if os(iOS)
import UIKit
#endif

@MainActor
final class PushManager {

    static let shared = PushManager()

    var bridge: BridgeHandler?
    private(set) var deviceToken: String?

    private init() {}

    // MARK: - Permission

    func requestPermission() {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            Task { @MainActor in
                if let error {
                    AppLogger.push.error("Permission error: \(error.localizedDescription)")
                    self.bridge?.sendPushPermissionDenied()
                    return
                }

                if granted {
                    AppLogger.push.info("Permission granted")
                    self.registerForRemoteNotifications()
                } else {
                    AppLogger.push.info("Permission denied")
                    self.bridge?.sendPushPermissionDenied()
                }
            }
        }
    }

    private func registerForRemoteNotifications() {
        #if os(iOS)
        UIApplication.shared.registerForRemoteNotifications()
        #endif
    }

    // MARK: - Token handling

    func didRegisterForRemoteNotifications(with deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        self.deviceToken = token
        AppLogger.push.info("Device token received")
        bridge?.sendPushToken(token)

        // Register token with backend directly (fire-and-forget)
        Task {
            do {
                try await APIClient.shared.registerDeviceToken(token)
                AppLogger.push.info("Token registered with backend")
            } catch {
                AppLogger.push.error("Failed to register token with backend: \(error)")
            }
        }
    }

    func didFailToRegisterForRemoteNotifications(with error: Error) {
        AppLogger.push.error("Registration failed: \(error.localizedDescription)")
    }

    /// Clear the stored device token (called during logout).
    func clearDeviceToken() {
        deviceToken = nil
        AppLogger.push.info("Device token cleared")
    }

    // MARK: - Testing

    #if DEBUG
    /// Set device token directly for testing purposes.
    func setDeviceTokenForTesting(_ token: String?) {
        deviceToken = token
    }
    #endif
}
