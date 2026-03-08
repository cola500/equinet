//
//  AppDelegate.swift
//  Equinet
//
//  UIApplicationDelegate for handling APNs callbacks and notification presentation.
//

#if os(iOS)
import UIKit
import UserNotifications

class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    // MARK: - APNs Token

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        PushManager.shared.didRegisterForRemoteNotifications(with: deviceToken)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        PushManager.shared.didFailToRegisterForRemoteNotifications(with: error)
    }

    // MARK: - Notification Presentation (foreground)

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show notification banner even when app is in foreground
        completionHandler([.banner, .badge, .sound])
    }

    // MARK: - Notification Tap

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo

        // If the push contains a URL, navigate to it in the WebView
        if let urlString = userInfo["url"] as? String {
            Task { @MainActor in
                NotificationCenter.default.post(
                    name: .navigateToURL,
                    object: nil,
                    userInfo: ["url": urlString]
                )
            }
        }

        completionHandler()
    }
}

extension Notification.Name {
    static let navigateToURL = Notification.Name("equinet.navigateToURL")
}
#endif
