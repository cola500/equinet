//
//  AppConfig.swift
//  Equinet
//
//  URL configuration for dev/staging/prod environments.
//
//  To switch to staging in Xcode:
//  Product → Scheme → Edit Scheme → Run → Arguments → Add "-STAGING"
//

import Foundation

// MARK: - Environment

enum AppEnvironment: String {
    case local       // localhost + local Supabase (supabase start)
    case staging     // Vercel staging custom domain + staging Supabase
    case production  // Vercel prod custom domain + prod Supabase

    static var current: AppEnvironment {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-STAGING") {
            return .staging
        }
        return .local
        #else
        return .production
        #endif
    }
}

// MARK: - Config

enum AppConfig {

    static var environment: AppEnvironment { .current }

    // MARK: Web server

    static func baseURL(for env: AppEnvironment) -> URL {
        switch env {
        case .local:
            return URL(string: "http://localhost:3000")!
        case .staging:
            return URL(string: "https://equinet-staging.johanlindengard.com")!
        case .production:
            return URL(string: "https://equinet.johanlindengard.com")!
        }
    }

    static var baseURL: URL { baseURL(for: .current) }

    /// Start URL -- skip landing page, go straight to login/dashboard
    static var startURL: URL {
        URL(string: "login", relativeTo: baseURL)!
    }

    /// Dashboard URL -- loaded after native auth (bypasses login page)
    static var dashboardURL: URL {
        URL(string: "dashboard", relativeTo: baseURL)!
    }

    static let bridgeHandlerName = "equinet"

    // MARK: - Supabase Auth

    static func supabaseURL(for env: AppEnvironment) -> URL {
        switch env {
        case .local:
            return URL(string: "http://127.0.0.1:54321")!
        case .staging:
            return URL(string: "https://zzdamokfeenencuggjjp.supabase.co")!
        case .production:
            return URL(string: "https://xybyzflfxnqqyxnvjklv.supabase.co")!
        }
    }

    static var supabaseURL: URL { supabaseURL(for: .current) }

    static func supabaseAnonKey(for env: AppEnvironment) -> String {
        switch env {
        case .local:
            // Standard supabase start demo key (same for all local projects)
            return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
        case .staging:
            return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6ZGFtb2tmZWVuZW5jdWdnampwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDE1NjQsImV4cCI6MjA5MDcxNzU2NH0.ugROkgUOuq1fLte2wbt16TDugfUZW7qYro-nQgobVxQ"
        case .production:
            return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5Ynl6ZmxmeG5xcXl4bnZqa2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5Njk3NDAsImV4cCI6MjA4NDU0NTc0MH0.wlkcjzDthqvRV-6cV-pkNd8JQ7WFCYC5kznFeVZRRlc"
        }
    }

    static var supabaseAnonKey: String { supabaseAnonKey(for: .current) }

    /// Server endpoint for exchanging Supabase token to web session cookies
    static let sessionExchangePath = "api/auth/native-session-exchange"
}
