//
//  AppConfigTests.swift
//  EquinetTests
//
//  Verifies that .local, .staging, and .production environments map to distinct
//  base URLs and Supabase project refs. Catches regressions where staging falls
//  through to production or where prod accidentally points at staging Supabase.
//

@testable import Equinet
import XCTest

final class AppConfigTests: XCTestCase {

    // MARK: - baseURL per environment

    func testLocalBaseURLPointsToLocalhost() {
        let url = AppConfig.baseURL(for: .local)
        XCTAssertEqual(url.absoluteString, "http://localhost:3000")
    }

    func testStagingBaseURLPointsToCustomDomain() {
        let url = AppConfig.baseURL(for: .staging)
        XCTAssertEqual(url.absoluteString, "https://equinet-staging.johanlindengard.com")
    }

    func testProductionBaseURLPointsToCustomDomain() {
        let url = AppConfig.baseURL(for: .production)
        XCTAssertEqual(url.absoluteString, "https://equinet.johanlindengard.com")
    }

    func testStagingAndProductionBaseURLAreDistinct() {
        XCTAssertNotEqual(
            AppConfig.baseURL(for: .staging),
            AppConfig.baseURL(for: .production),
            "Staging and production must not share base URL"
        )
    }

    // MARK: - supabaseURL per environment

    func testLocalSupabaseURLPointsToLocalhost() {
        let url = AppConfig.supabaseURL(for: .local)
        XCTAssertEqual(url.host, "127.0.0.1")
    }

    func testStagingSupabaseURLPointsToStagingProjectRef() {
        let url = AppConfig.supabaseURL(for: .staging)
        XCTAssertTrue(
            url.absoluteString.contains("zzdamokfeenencuggjjp"),
            "Expected staging project ref zzdamokfeenencuggjjp in \(url)"
        )
    }

    func testProductionSupabaseURLPointsToProdProjectRef() {
        let url = AppConfig.supabaseURL(for: .production)
        XCTAssertTrue(
            url.absoluteString.contains("xybyzflfxnqqyxnvjklv"),
            "Expected prod project ref xybyzflfxnqqyxnvjklv in \(url)"
        )
    }

    func testStagingAndProductionSupabaseURLAreDistinct() {
        XCTAssertNotEqual(
            AppConfig.supabaseURL(for: .staging),
            AppConfig.supabaseURL(for: .production),
            "Staging and production must point at different Supabase projects"
        )
    }

    // MARK: - supabaseAnonKey per environment

    func testStagingAnonKeyIsValidJWT() {
        let key = AppConfig.supabaseAnonKey(for: .staging)
        XCTAssertTrue(key.hasPrefix("eyJhbGc"), "Expected JWT prefix")
        XCTAssertEqual(key.split(separator: ".").count, 3, "JWT must have 3 segments")
    }

    func testProductionAnonKeyIsValidJWT() {
        let key = AppConfig.supabaseAnonKey(for: .production)
        XCTAssertTrue(key.hasPrefix("eyJhbGc"), "Expected JWT prefix")
        XCTAssertEqual(key.split(separator: ".").count, 3, "JWT must have 3 segments")
    }

    func testStagingAndProductionAnonKeysAreDistinct() {
        XCTAssertNotEqual(
            AppConfig.supabaseAnonKey(for: .staging),
            AppConfig.supabaseAnonKey(for: .production),
            "Staging and production must have different anon keys"
        )
    }

    // MARK: - Backwards compatibility

    func testCurrentEnvironmentResolvesViaEnvironmentInjection() {
        // baseURL property must still resolve to baseURL(for: .current)
        XCTAssertEqual(AppConfig.baseURL, AppConfig.baseURL(for: AppEnvironment.current))
    }
}
