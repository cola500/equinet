//
//  AppConfig.swift
//  Equinet
//
//  URL configuration for dev/prod environments.
//

import Foundation

enum AppConfig {
    #if DEBUG
    static let baseURL = URL(string: "http://localhost:3000")!
    #else
    static let baseURL = URL(string: "https://equinet.vercel.app")!
    #endif

    /// Start URL -- skip landing page, go straight to login/dashboard
    static let startURL = baseURL.appendingPathComponent("login")

    static let bridgeHandlerName = "equinet"
}
