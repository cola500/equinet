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
    #endif

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
