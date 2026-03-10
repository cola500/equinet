//
//  AppConfig.swift
//  Equinet
//
//  URL configuration for dev/prod environments.
//

import Foundation

enum AppConfig {
    #if DEBUG
    static let baseURL = URL(string: "http://192.168.1.37:3000")!
    #else
    static let baseURL = URL(string: "https://equinet.vercel.app")!
    #endif

    /// Start URL -- skip landing page, go straight to login/dashboard
    static let startURL = baseURL.appendingPathComponent("login")

    /// Dashboard URL -- loaded after native auth (bypasses login page)
    static let dashboardURL = baseURL.appendingPathComponent("dashboard")

    /// Native login API endpoint path
    static let nativeLoginPath = "api/auth/native-login"

    static let bridgeHandlerName = "equinet"
}
