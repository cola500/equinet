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

    /// Fetch dashboard data for native dashboard view
    func fetchDashboard() async throws -> DashboardResponse {
        return try await authenticatedRequest(
            path: "/api/native/dashboard",
            responseType: DashboardResponse.self
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
    func updateBookingStatus(bookingId: String, newStatus: String, cancellationMessage: String? = nil) async throws {
        var body: [String: Any] = ["status": newStatus]
        if let cancellationMessage {
            body["cancellationMessage"] = cancellationMessage
        }
        _ = try await performRequest(
            method: "PUT",
            path: "/api/bookings/\(bookingId)",
            body: body
        )
    }

    /// Fetch bookings list for native bookings view
    func fetchBookings(status: String? = nil) async throws -> [BookingsListItem] {
        var path = "/api/native/bookings"
        if let status {
            path += "?status=\(status)"
        }
        return try await authenticatedRequest(path: path, responseType: [BookingsListItem].self)
    }

    /// Save (create/update) an availability exception
    func saveException(_ request: ExceptionSaveRequest) async throws -> NativeException {
        var body: [String: Any] = [
            "date": request.date,
            "isClosed": request.isClosed,
        ]
        if let startTime = request.startTime { body["startTime"] = startTime }
        if let endTime = request.endTime { body["endTime"] = endTime }
        if let reason = request.reason { body["reason"] = reason }
        if let location = request.location { body["location"] = location }

        let (data, _) = try await performRequest(
            method: "POST",
            path: "/api/native/calendar/exceptions",
            body: body
        )
        do {
            return try JSONDecoder().decode(NativeException.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    /// Delete an availability exception for a specific date
    func deleteException(date: String) async throws {
        _ = try await performRequest(
            method: "DELETE",
            path: "/api/native/calendar/exceptions/\(date)"
        )
    }

    /// Create a customer review for a completed booking
    func createBookingReview(bookingId: String, rating: Int, comment: String?) async throws -> CreateReviewResponse {
        var body: [String: Any] = ["rating": rating]
        if let comment {
            body["comment"] = comment
        }
        let (data, _) = try await performRequest(
            method: "POST",
            path: "/api/native/bookings/\(bookingId)/review",
            body: body
        )
        do {
            return try JSONDecoder().decode(CreateReviewResponse.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    /// Save provider notes on a booking
    func saveQuickNote(bookingId: String, providerNotes: String) async throws -> QuickNoteResponse {
        AppLogger.network.debug("APIClient.saveQuickNote: bookingId=\(bookingId)")
        let (data, _) = try await performRequest(
            method: "POST",
            path: "/api/native/bookings/\(bookingId)/quick-note",
            body: ["providerNotes": providerNotes]
        )
        do {
            let response = try JSONDecoder().decode(QuickNoteResponse.self, from: data)
            AppLogger.network.debug("APIClient.saveQuickNote: decoded OK")
            return response
        } catch {
            AppLogger.network.error("APIClient.saveQuickNote: decode failed \(error)")
            throw APIError.decodingError(error)
        }
    }

    // MARK: - Customer Management

    /// Fetch customer list for native customers view
    func fetchCustomers(status: String? = nil, query: String? = nil) async throws -> [CustomerSummary] {
        var path = "/api/native/customers"
        var params: [String] = []
        if let status { params.append("status=\(status)") }
        if let query { params.append("q=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query)") }
        if !params.isEmpty { path += "?" + params.joined(separator: "&") }

        let response: CustomersListResponse = try await authenticatedRequest(path: path, responseType: CustomersListResponse.self)
        return response.customers
    }

    /// Create a new customer manually
    func createCustomer(firstName: String, lastName: String, phone: String?, email: String?) async throws -> String {
        var body: [String: Any] = ["firstName": firstName, "lastName": lastName]
        if let phone { body["phone"] = phone }
        if let email { body["email"] = email }

        let (data, _) = try await performRequest(method: "POST", path: "/api/native/customers", body: body)
        let response = try JSONDecoder().decode(CustomerCreateResponse.self, from: data)
        return response.customer.id
    }

    /// Update customer info
    func updateCustomer(customerId: String, firstName: String, lastName: String, phone: String?, email: String?) async throws -> CustomerUpdateResponse {
        var body: [String: Any] = ["firstName": firstName]
        if !lastName.isEmpty { body["lastName"] = lastName }
        if let phone { body["phone"] = phone }
        if let email { body["email"] = email }

        let (data, _) = try await performRequest(method: "PUT", path: "/api/native/customers/\(customerId)", body: body)
        return try JSONDecoder().decode(CustomerUpdateResponse.self, from: data)
    }

    /// Delete a manually added customer
    func deleteCustomer(customerId: String) async throws {
        _ = try await performRequest(method: "DELETE", path: "/api/native/customers/\(customerId)")
    }

    /// Fetch horses for a customer
    func fetchCustomerHorses(customerId: String) async throws -> [CustomerHorse] {
        let response: CustomerHorsesResponse = try await authenticatedRequest(
            path: "/api/native/customers/\(customerId)/horses",
            responseType: CustomerHorsesResponse.self
        )
        return response.horses
    }

    /// Create a horse for a customer
    func createCustomerHorse(customerId: String, name: String, breed: String?, birthYear: Int?, color: String?, gender: String?, specialNeeds: String?, registrationNumber: String?, microchipNumber: String?) async throws -> CustomerHorse {
        var body: [String: Any] = ["name": name]
        if let breed { body["breed"] = breed }
        if let birthYear { body["birthYear"] = birthYear }
        if let color { body["color"] = color }
        if let gender { body["gender"] = gender }
        if let specialNeeds { body["specialNeeds"] = specialNeeds }
        if let registrationNumber { body["registrationNumber"] = registrationNumber }
        if let microchipNumber { body["microchipNumber"] = microchipNumber }

        let (data, _) = try await performRequest(method: "POST", path: "/api/native/customers/\(customerId)/horses", body: body)
        do {
            return try JSONDecoder().decode(CustomerHorse.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    /// Update a horse
    func updateCustomerHorse(customerId: String, horseId: String, name: String?, breed: String?, birthYear: Int?, color: String?, gender: String?, specialNeeds: String?, registrationNumber: String?, microchipNumber: String?) async throws -> CustomerHorse {
        var body: [String: Any] = [:]
        if let name { body["name"] = name }
        if let breed { body["breed"] = breed }
        if let birthYear { body["birthYear"] = birthYear }
        if let color { body["color"] = color }
        if let gender { body["gender"] = gender }
        if let specialNeeds { body["specialNeeds"] = specialNeeds }
        if let registrationNumber { body["registrationNumber"] = registrationNumber }
        if let microchipNumber { body["microchipNumber"] = microchipNumber }

        let (data, _) = try await performRequest(method: "PUT", path: "/api/native/customers/\(customerId)/horses/\(horseId)", body: body)
        do {
            return try JSONDecoder().decode(CustomerHorse.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    /// Soft-delete a horse
    func deleteCustomerHorse(customerId: String, horseId: String) async throws {
        _ = try await performRequest(method: "DELETE", path: "/api/native/customers/\(customerId)/horses/\(horseId)")
    }

    /// Fetch notes for a customer
    func fetchCustomerNotes(customerId: String) async throws -> [CustomerNote] {
        let response: CustomerNotesResponse = try await authenticatedRequest(
            path: "/api/native/customers/\(customerId)/notes",
            responseType: CustomerNotesResponse.self
        )
        return response.notes
    }

    /// Create a note for a customer
    func createCustomerNote(customerId: String, content: String) async throws -> CustomerNote {
        let (data, _) = try await performRequest(
            method: "POST",
            path: "/api/native/customers/\(customerId)/notes",
            body: ["content": content]
        )
        do {
            return try JSONDecoder().decode(CustomerNote.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    /// Update a note
    func updateCustomerNote(customerId: String, noteId: String, content: String) async throws -> CustomerNote {
        let (data, _) = try await performRequest(
            method: "PUT",
            path: "/api/native/customers/\(customerId)/notes/\(noteId)",
            body: ["content": content]
        )
        do {
            return try JSONDecoder().decode(CustomerNote.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    /// Delete a note
    func deleteCustomerNote(customerId: String, noteId: String) async throws {
        _ = try await performRequest(method: "DELETE", path: "/api/native/customers/\(customerId)/notes/\(noteId)")
    }

    // MARK: - Services

    /// Fetch all services for current provider
    func fetchServices() async throws -> [ServiceItem] {
        let response = try await authenticatedRequest(
            path: "/api/native/services",
            responseType: ServicesListResponse.self
        )
        return response.services
    }

    /// Create a new service
    func createService(_ data: [String: Any]) async throws -> ServiceItem {
        let (responseData, _) = try await performRequest(method: "POST", path: "/api/native/services", body: data)
        do {
            let response = try JSONDecoder().decode(ServiceCreateResponse.self, from: responseData)
            return response.service
        } catch {
            throw APIError.decodingError(error)
        }
    }

    /// Update an existing service
    func updateService(id: String, data: [String: Any]) async throws -> ServiceItem {
        let (responseData, _) = try await performRequest(method: "PUT", path: "/api/native/services/\(id)", body: data)
        do {
            let response = try JSONDecoder().decode(ServiceUpdateResponse.self, from: responseData)
            return response.service
        } catch {
            throw APIError.decodingError(error)
        }
    }

    /// Delete a service
    func deleteService(id: String) async throws {
        _ = try await performRequest(method: "DELETE", path: "/api/native/services/\(id)")
    }

    // MARK: - Profile

    /// Fetch provider profile for native profile view
    func fetchProfile() async throws -> ProviderProfile {
        return try await authenticatedRequest(
            path: "/api/native/provider/profile",
            responseType: ProviderProfile.self
        )
    }

    /// Update provider profile (supports both provider and user fields)
    func updateProfile(_ data: [String: Any]) async throws -> ProviderProfile {
        let (responseData, _) = try await performRequest(
            method: "PUT",
            path: "/api/native/provider/profile",
            body: data
        )
        do {
            return try JSONDecoder().decode(ProviderProfile.self, from: responseData)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    /// Delete user account (GDPR Art. 17)
    func deleteAccount(password: String, confirmation: String) async throws {
        _ = try await performRequest(
            method: "DELETE",
            path: "/api/account",
            body: ["password": password, "confirmation": confirmation]
        )
    }

    // MARK: - Reviews

    /// Fetch paginated reviews for native reviews view
    func fetchReviews(page: Int = 1) async throws -> ReviewsResponse {
        return try await authenticatedRequest(
            path: "/api/native/reviews?page=\(page)",
            responseType: ReviewsResponse.self
        )
    }

    /// Submit a reply to a review (returns reply + repliedAt)
    func submitReply(reviewId: String, text: String) async throws -> ReplyResponse {
        let (data, _) = try await performRequest(
            method: "POST",
            path: "/api/reviews/\(reviewId)/reply",
            body: ["reply": text]
        )
        do {
            return try JSONDecoder().decode(ReplyResponse.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    /// Delete a reply from a review
    func deleteReply(reviewId: String) async throws {
        _ = try await performRequest(
            method: "DELETE",
            path: "/api/reviews/\(reviewId)/reply"
        )
    }

    // MARK: - Feature Flags (public endpoint, no auth)

    private struct FeatureFlagsResponse: Codable {
        let flags: [String: Bool]
    }

    /// Fetch feature flags from public endpoint (no Bearer token required)
    func fetchFeatureFlags() async throws -> [String: Bool] {
        guard let url = URL(string: "/api/feature-flags", relativeTo: baseURL) else {
            throw APIError.networkError(URLError(.badURL))
        }
        let (data, response) = try await URLSession.shared.data(from: url)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw APIError.serverError((response as? HTTPURLResponse)?.statusCode ?? 0)
        }
        do {
            let decoded = try JSONDecoder().decode(FeatureFlagsResponse.self, from: data)
            return decoded.flags
        } catch {
            throw APIError.decodingError(error)
        }
    }

    /// Refresh the mobile token (rotation: old token revoked, new one returned)
    func refreshToken() async throws {
        guard let currentJwt = KeychainHelper.loadMobileToken() else {
            throw APIError.noToken
        }

        guard let url = URL(string: "/api/auth/mobile-token/refresh", relativeTo: baseURL) else {
            throw APIError.networkError(URLError(.badURL))
        }
        var request = URLRequest(url: url)
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
        body: [String: Any]? = nil
    ) async throws -> (Data, HTTPURLResponse) {
        guard let jwt = KeychainHelper.loadMobileToken() else {
            throw APIError.noToken
        }

        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIError.networkError(URLError(.badURL))
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15

        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        AppLogger.network.debug("performRequest: \(method) \(path)")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch let urlError as URLError where urlError.code == .timedOut {
            AppLogger.network.error("performRequest: timeout \(method) \(path)")
            throw APIError.timeout
        } catch {
            AppLogger.network.error("performRequest: network error \(method) \(path): \(error.localizedDescription)")
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

// MARK: - Protocol conformances

extension APIClient: ReviewsDataFetching {}
extension APIClient: ProfileDataFetching {}

// MARK: - Response types

private struct TokenResponse: Codable, Sendable {
    let token: String
    let expiresAt: String
}
