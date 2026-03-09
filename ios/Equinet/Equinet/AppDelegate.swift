//
//  AppDelegate.swift
//  Equinet
//
//  UIApplicationDelegate for handling APNs callbacks, notification categories,
//  and actionable notification responses.
//

#if os(iOS)
import BackgroundTasks
import OSLog
import UIKit
import UserNotifications
import WidgetKit

class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    /// Background task identifier for widget data refresh
    static let widgetRefreshTaskId = "com.equinet.widget-refresh"

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        registerNotificationCategories()
        registerBackgroundTasks()
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

    // MARK: - Notification Categories

    private func registerNotificationCategories() {
        let confirmAction = UNNotificationAction(
            identifier: "CONFIRM_ACTION",
            title: "Bekräfta",
            options: []
        )

        let declineAction = UNNotificationAction(
            identifier: "DECLINE_ACTION",
            title: "Avvisa",
            options: [.destructive]
        )

        let bookingRequestCategory = UNNotificationCategory(
            identifier: "BOOKING_REQUEST",
            actions: [confirmAction, declineAction],
            intentIdentifiers: [],
            options: []
        )

        UNUserNotificationCenter.current().setNotificationCategories([
            bookingRequestCategory,
        ])
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

    // MARK: - Notification Tap & Actions

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        let actionIdentifier = response.actionIdentifier

        switch actionIdentifier {
        case "CONFIRM_ACTION":
            handleBookingAction(userInfo: userInfo, newStatus: "confirmed")
        case "DECLINE_ACTION":
            handleBookingAction(userInfo: userInfo, newStatus: "cancelled")
        case UNNotificationDefaultActionIdentifier:
            // Standard tap -- navigate to URL in WebView
            if let urlString = userInfo["url"] as? String {
                Task { @MainActor in
                    NotificationCenter.default.post(
                        name: .navigateToURL,
                        object: nil,
                        userInfo: ["url": urlString]
                    )
                }
            }
        default:
            break
        }

        completionHandler()
    }

    // MARK: - Background Tasks

    private func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.widgetRefreshTaskId,
            using: nil
        ) { task in
            self.handleWidgetRefresh(task: task as! BGAppRefreshTask)
        }
    }

    /// Schedule the next background refresh
    func scheduleWidgetRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: Self.widgetRefreshTaskId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 30 * 60) // 30 min
        do {
            try BGTaskScheduler.shared.submit(request)
            AppLogger.push.debug("Scheduled widget background refresh")
        } catch {
            AppLogger.push.error("Failed to schedule widget refresh: \(error.localizedDescription)")
        }
    }

    private func handleWidgetRefresh(task: BGAppRefreshTask) {
        // Schedule the next refresh before starting work
        scheduleWidgetRefresh()

        let fetchTask = Task {
            do {
                let response = try await APIClient.shared.fetchNextBooking()
                let widgetData = WidgetData(
                    booking: response.booking,
                    updatedAt: Date(),
                    hasAuth: true
                )
                await MainActor.run {
                    SharedDataManager.saveWidgetData(widgetData)
                    WidgetCenter.shared.reloadAllTimelines()
                }
                task.setTaskCompleted(success: true)
                AppLogger.push.info("Widget background refresh succeeded")
            } catch {
                task.setTaskCompleted(success: false)
                AppLogger.push.error("Widget background refresh failed: \(error.localizedDescription)")
            }
        }

        task.expirationHandler = {
            fetchTask.cancel()
        }
    }

    // MARK: - Booking Actions

    private nonisolated func handleBookingAction(
        userInfo: [AnyHashable: Any],
        newStatus: String
    ) {
        guard let bookingId = userInfo["bookingId"] as? String else {
            AppLogger.push.warning("No bookingId in notification payload")
            return
        }

        Task.detached {
            do {
                try await APIClient.shared.updateBookingStatus(
                    bookingId: bookingId,
                    newStatus: newStatus
                )
                AppLogger.push.info("Booking \(bookingId) -> \(newStatus)")

                // Sync calendar event after status change
                await MainActor.run {
                    CalendarSyncManager.shared.syncAfterStatusChange(
                        bookingId: bookingId, newStatus: newStatus
                    )
                }

                // Show local confirmation notification
                let content = UNMutableNotificationContent()
                content.title = newStatus == "confirmed" ? "Bokning bekräftad" : "Bokning avvisad"
                content.body = newStatus == "confirmed"
                    ? "Bokningen har bekräftats."
                    : "Bokningen har avvisats."
                content.sound = .default

                let request = UNNotificationRequest(
                    identifier: "feedback-\(bookingId)",
                    content: content,
                    trigger: nil
                )
                try? await UNUserNotificationCenter.current().add(request)
            } catch {
                AppLogger.push.error("Failed to update booking \(bookingId): \(error.localizedDescription)")
                // Save for retry when network returns
                PendingActionStore.save(bookingId: bookingId, status: newStatus)
            }
        }
    }
}

extension Notification.Name {
    static let navigateToURL = Notification.Name("equinet.navigateToURL")
}
#endif
