//
//  APIClient.swift
//  Equinet
//
//  Native HTTP client with Bearer auth, 401 handling, and token refresh.
//  Reusable for widgets and future native screens.
//

import Foundation
import OSLog

enum APIError: Error {
    case noToken
    case unauthorized
    case networkError(Error)
    case serverError(Int)
    case decodingError(Error)
    case rateLimited(retryAfter: Int?)
    case timeout
}

@MainActor
final class APIClient {
    static let shared = APIClient()

    private var isRefreshing = false

    private var baseURL: URL {
        AppConfig.baseURL
    }

    // MARK: - Public API

    /// Fetch next booking for widget display
    func fetchNextBooking() async throws -> WidgetBookingResponse {
        return try await authenticatedRequest(
            path: "/api/widget/next-booking",
            responseType: WidgetBookingResponse.self
        )
    }

    /// Fetch calendar data for a date range (native calendar view)
    func fetchCalendar(from: String, to: String) async throws -> CalendarResponse {
        return try await authenticatedRequest(
            path: "/api/native/calendar?from=\(from)&to=\(to)",
            responseType: CalendarResponse.self
        )
    }

    /// Register APNs device token with backend
    func registerDeviceToken(_ token: String) async throws {
        _ = try await performRequest(
            method: "POST",
            path: "/api/device-tokens",
            body: ["token": token, "platform": "ios"]
        )
    }

    /// Unregister device token on logout
    func unregisterDeviceToken(_ token: String) async throws {
        _ = try await performRequest(
            method: "DELETE",
            path: "/api/device-tokens",
            body: ["token": token]
        )
    }

    /// Update booking status (confirm/decline from notification action)
    func updateBookingStatus(bookingId: String, newStatus: String) async throws {
        _ = try await performRequest(
            method: "PUT",
            path: "/api/bookings/\(bookingId)",
            body: ["status": newStatus]
        )
    }

    /// Refresh the mobile token (rotation: old token revoked, new one returned)
    func refreshToken() async throws {
        guard let currentJwt = KeychainHelper.loadMobileToken() else {
            throw APIError.noToken
        }

        var request = URLRequest(url: baseURL.appendingPathComponent("/api/auth/mobile-token/refresh"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(currentJwt)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError(URLError(.badServerResponse))
        }

        if httpResponse.statusCode == 401 {
            KeychainHelper.clearMobileToken()
            throw APIError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.serverError(httpResponse.statusCode)
        }

        let tokenResponse = try JSONDecoder().decode(TokenResponse.self, from: data)
        KeychainHelper.saveMobileToken(jwt: tokenResponse.token, expiresAt: tokenResponse.expiresAt)
    }

    // MARK: - Private

    /// Generic authenticated request with token refresh on 401
    private func performRequest(
        method: String,
        path: String,
        body: [String: String]? = nil
    ) async throws -> (Data, HTTPURLResponse) {
        guard let jwt = KeychainHelper.loadMobileToken() else {
            throw APIError.noToken
        }

        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = method
        request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15

        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch let urlError as URLError where urlError.code == .timedOut {
            throw APIError.timeout
        } catch {
            throw APIError.networkError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError(URLError(.badServerResponse))
        }

        // Log non-2xx responses for debugging
        if !(200...299).contains(httpResponse.statusCode) {
            let bodyPreview = String(data: data.prefix(500), encoding: .utf8) ?? "<binary>"
            AppLogger.network.error("HTTP \(httpResponse.statusCode) for \(path): \(bodyPreview)")
        }

        // Handle 401: try token refresh once
        if httpResponse.statusCode == 401 && !isRefreshing {
            isRefreshing = true
            defer { isRefreshing = false }

            do {
                try await refreshToken()
                return try await performRequest(method: method, path: path, body: body)
            } catch {
                KeychainHelper.clearMobileToken()
                throw APIError.unauthorized
            }
        }

        // Handle 429: rate limited
        if httpResponse.statusCode == 429 {
            let retryAfter = httpResponse.value(forHTTPHeaderField: "Retry-After")
                .flatMap { Int($0) }
            throw APIError.rateLimited(retryAfter: retryAfter)
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.serverError(httpResponse.statusCode)
        }

        return (data, httpResponse)
    }

    /// Authenticated GET request with JSON decoding
    private func authenticatedRequest<T: Decodable>(
        path: String,
        responseType: T.Type
    ) async throws -> T {
        let (data, _) = try await performRequest(method: "GET", path: path)

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }
}

// MARK: - Response types

private struct TokenResponse: Codable, Sendable {
    let token: String
    let expiresAt: String
}
