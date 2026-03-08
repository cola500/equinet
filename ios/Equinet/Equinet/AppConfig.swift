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

    static let bridgeHandlerName = "equinet"
}
