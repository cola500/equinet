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
    static let baseURL = URL(string: "https://equinet-app.vercel.app")!
    #endif

    /// Start URL -- skip landing page, go straight to login/dashboard
    static let startURL = baseURL.appendingPathComponent("login")

    /// Dashboard URL -- loaded after native auth (bypasses login page)
    static let dashboardURL = baseURL.appendingPathComponent("dashboard")

    static let bridgeHandlerName = "equinet"

    // MARK: - Supabase Auth

    static let supabaseURL = URL(string: "https://zzdamokfeenencuggjjp.supabase.co")!
    static let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6ZGFtb2tmZWVuZW5jdWdnampwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDE1NjQsImV4cCI6MjA5MDcxNzU2NH0.ugROkgUOuq1fLte2wbt16TDugfUZW7qYro-nQgobVxQ"

    /// Server endpoint for exchanging Supabase token to web session cookies
    static let sessionExchangePath = "api/auth/native-session-exchange"
}
