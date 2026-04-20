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
    case staging     // Vercel + remote Supabase staging
    case production  // Vercel + remote Supabase (same as staging until separate prod project)

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

    static var baseURL: URL {
        switch AppEnvironment.current {
        case .local:
            return URL(string: "http://localhost:3000")!
        case .staging:
            // Stabil Vercel branch-preview för staging-branchen.
            // URL-mönster: equinet-git-<branch>-<github-user>.vercel.app — uppdatera vid org-flytt.
            return URL(string: "https://equinet-git-staging-cola500.vercel.app")!
        case .production:
            return URL(string: "https://equinet-app.vercel.app")!
        }
    }

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

    static var supabaseURL: URL {
        switch AppEnvironment.current {
        case .local:
            return URL(string: "http://127.0.0.1:54321")!
        case .staging, .production:
            return URL(string: "https://zzdamokfeenencuggjjp.supabase.co")!
        }
    }

    static var supabaseAnonKey: String {
        switch AppEnvironment.current {
        case .local:
            // Standard supabase start demo key (same for all local projects)
            return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
        case .staging, .production:
            return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6ZGFtb2tmZWVuZW5jdWdnampwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDE1NjQsImV4cCI6MjA5MDcxNzU2NH0.ugROkgUOuq1fLte2wbt16TDugfUZW7qYro-nQgobVxQ"
        }
    }

    /// Server endpoint for exchanging Supabase token to web session cookies
    static let sessionExchangePath = "api/auth/native-session-exchange"
}
