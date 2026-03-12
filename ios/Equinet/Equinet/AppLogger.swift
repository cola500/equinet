//
//  AppLogger.swift
//  Equinet
//
//  Structured logging using os.Logger with categories.
//  Each subsystem maps to a functional area of the app.
//
//  IMPORTANT: Every file that uses AppLogger MUST have `import OSLog`
//  because Swift resolves os.Logger string interpolation at the call site.
//
//  NOTE: This file is NOT included in the widget extension target.
//  KeychainHelper.swift (shared with widget) must use print() instead.
//

import OSLog

enum AppLogger {
    static let app      = Logger(subsystem: "com.equinet.Equinet", category: "app")
    static let auth     = Logger(subsystem: "com.equinet.Equinet", category: "auth")
    static let bridge   = Logger(subsystem: "com.equinet.Equinet", category: "bridge")
    static let calendar = Logger(subsystem: "com.equinet.Equinet", category: "calendar")
    static let network  = Logger(subsystem: "com.equinet.Equinet", category: "network")
    static let push     = Logger(subsystem: "com.equinet.Equinet", category: "push")
    static let speech   = Logger(subsystem: "com.equinet.Equinet", category: "speech")
    static let sync     = Logger(subsystem: "com.equinet.Equinet", category: "sync")
    static let webview  = Logger(subsystem: "com.equinet.Equinet", category: "webview")
}
