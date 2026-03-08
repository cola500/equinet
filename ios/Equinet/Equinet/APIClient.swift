//
//  APIClient.swift
//  Equinet
//
//  Native HTTP client with Bearer auth, 401 handling, and token refresh.
//  Reusable for widgets and future native screens.
//

import Foundation

enum APIError: Error {
    case noToken
    case unauthorized
    case networkError(Error)
    case serverError(Int)
    case decodingError(Error)
}

actor APIClient {
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

    private func authenticatedRequest<T: Decodable>(
        path: String,
        responseType: T.Type
    ) async throws -> T {
        guard let jwt = KeychainHelper.loadMobileToken() else {
            throw APIError.noToken
        }

        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError(URLError(.badServerResponse))
        }

        // Handle 401: try token refresh once
        if httpResponse.statusCode == 401 && !isRefreshing {
            isRefreshing = true
            defer { isRefreshing = false }

            do {
                try await refreshToken()
                // Retry with new token
                return try await authenticatedRequest(path: path, responseType: responseType)
            } catch {
                KeychainHelper.clearMobileToken()
                throw APIError.unauthorized
            }
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.serverError(httpResponse.statusCode)
        }

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }
}

// MARK: - Response types

private struct TokenResponse: Codable {
    let token: String
    let expiresAt: String
}
