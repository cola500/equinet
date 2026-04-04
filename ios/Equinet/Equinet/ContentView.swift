//
//  ContentView.swift
//  Equinet
//
//  Main content view with state-driven navigation:
//  - .checking: SplashView (checking for Supabase session)
//  - .loggedOut: NativeLoginView (email + password)
//  - .authenticated: AuthenticatedView with TabView
//

import SwiftUI
import UserNotifications

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var authManager = AuthManager.createDefault()
    @State private var coordinator = AppCoordinator()

    var body: some View {
        #if os(iOS)
        Group {
            switch authManager.state {
            case .checking:
                SplashView()

            case .loggedOut:
                NativeLoginView(authManager: authManager)

            case .authenticated:
                if authManager.userType == "provider" {
                    AuthenticatedView(
                        authManager: authManager,
                        coordinator: coordinator
                    )
                } else {
                    CustomerWebView(
                        bridge: coordinator.bridge,
                        authManager: authManager,
                        networkMonitor: coordinator.networkMonitor
                    )
                }
            }
        }
        .animation(.easeInOut(duration: 0.3), value: authManager.state == .authenticated)
        .onAppear {
            authManager.checkExistingAuth()
        }
        .onChange(of: authManager.state == .authenticated) { _, isAuthenticated in
            if isAuthenticated {
                PushManager.shared.requestPermission()
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            guard authManager.state == .authenticated else { return }
            switch newPhase {
            case .active:
                coordinator.bridge.sendToWeb(type: .appDidBecomeActive)
                PendingActionStore.retryAll()
                coordinator.calendarViewModel.loadDataForSelectedDate()
                Task { try? await UNUserNotificationCenter.current().setBadgeCount(0) }
            case .background:
                coordinator.bridge.sendToWeb(type: .appDidEnterBackground)
            default:
                break
            }
        }
        #else
        Text("Equinet is available on iOS")
            .padding()
        #endif
    }
}

#Preview {
    ContentView()
}
