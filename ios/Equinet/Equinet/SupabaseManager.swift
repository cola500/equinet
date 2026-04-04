//
//  SupabaseManager.swift
//  Equinet
//
//  Singleton wrapper for the Supabase Swift SDK client.
//  Uses App Group Keychain for session storage so the widget extension can access tokens.
//

import Foundation
import Supabase

enum SupabaseManager {
    static let client = SupabaseClient(
        supabaseURL: AppConfig.supabaseURL,
        supabaseKey: AppConfig.supabaseAnonKey,
        options: .init(
            auth: .init(
                storage: KeychainLocalStorage(
                    service: "com.equinet.supabase-auth",
                    accessGroup: "group.com.equinet.shared"
                ),
                autoRefreshToken: true
            )
        )
    )
}
