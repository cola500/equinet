//
//  EquinetApp.swift
//  Equinet
//
//  Main app entry point. Sets up AppDelegate for push notification handling.
//

import SwiftUI

@main
struct EquinetApp: App {
    #if os(iOS)
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @Environment(\.scenePhase) private var scenePhase
    #endif

    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.light) // Force light mode until web app supports dark mode
        }
        #if os(iOS)
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .background {
                appDelegate.scheduleWidgetRefresh()
            }
        }
        #endif
    }
}
