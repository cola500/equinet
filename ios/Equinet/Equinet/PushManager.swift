//
//  PushManager.swift
//  Equinet
//
//  Manages push notification registration and permissions.
//

import Foundation
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
                    print("[Push] Permission error: \(error.localizedDescription)")
                    self.bridge?.sendPushPermissionDenied()
                    return
                }

                if granted {
                    print("[Push] Permission granted")
                    self.registerForRemoteNotifications()
                } else {
                    print("[Push] Permission denied")
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
        print("[Push] Device token: \(token)")
        bridge?.sendPushToken(token)

        // Register token with backend directly (fire-and-forget)
        Task.detached {
            do {
                try await APIClient.shared.registerDeviceToken(token)
                print("[Push] Token registered with backend")
            } catch {
                print("[Push] Failed to register token with backend: \(error)")
            }
        }
    }

    func didFailToRegisterForRemoteNotifications(with error: Error) {
        print("[Push] Registration failed: \(error.localizedDescription)")
    }
}
