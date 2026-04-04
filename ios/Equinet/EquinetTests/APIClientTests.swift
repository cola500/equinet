//
//  APIClientTests.swift
//  EquinetTests
//
//  Tests for APIClient using URLProtocol-based mocking.
//  Verifies request flow, error mapping, and decoding.
//  Uses testAccessToken override to avoid needing real Supabase session.
//

@testable import Equinet
import XCTest

// MARK: - URLProtocol Mock

private class MockURLProtocol: URLProtocol {
    nonisolated(unsafe) static var mockHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.mockHandler else {
            client?.urlProtocolDidFinishLoading(self)
            return
        }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

// MARK: - Tests

@MainActor
final class APIClientTests: XCTestCase {

    private var sut: APIClient!
    private var session: URLSession!

    override func setUp() {
        super.setUp()
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        session = URLSession(configuration: config)
        sut = APIClient(session: session)
        sut.testAccessToken = "test-jwt-token"
    }

    override func tearDown() {
        MockURLProtocol.mockHandler = nil
        sut = nil
        super.tearDown()
    }

    // MARK: - Successful Request

    func testFetchDashboardSuccess() async throws {
        let json = """
        {
            "todayBookings": [],
            "todayBookingCount": 3,
            "upcomingBookingCount": 7,
            "pendingBookingCount": 1,
            "reviewStats": { "averageRating": 4.5, "totalCount": 10 },
            "onboarding": { "profileComplete": true, "hasServices": true, "hasAvailability": true, "isActive": true, "allComplete": true },
            "priorityAction": { "type": "pending_bookings", "count": 1, "label": "1 bokning väntar" }
        }
        """.data(using: .utf8)!

        MockURLProtocol.mockHandler = { request in
            XCTAssertEqual(request.httpMethod, "GET")
            XCTAssertTrue(request.url?.path.contains("/api/native/dashboard") ?? false)
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer test-jwt-token")

            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (response, json)
        }

        let dashboard = try await sut.fetchDashboard()

        XCTAssertEqual(dashboard.todayBookingCount, 3)
        XCTAssertEqual(dashboard.upcomingBookingCount, 7)
        XCTAssertEqual(dashboard.pendingBookingCount, 1)
    }

    // MARK: - Network Error

    func testPerformRequestNetworkError() async {
        MockURLProtocol.mockHandler = { _ in
            throw URLError(.notConnectedToInternet)
        }

        do {
            _ = try await sut.fetchDashboard()
            XCTFail("Expected networkError")
        } catch let error as APIError {
            if case .networkError = error {
                // Expected
            } else {
                XCTFail("Expected networkError, got \(error)")
            }
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    // MARK: - Timeout

    func testPerformRequestTimeout() async {
        MockURLProtocol.mockHandler = { _ in
            throw URLError(.timedOut)
        }

        do {
            _ = try await sut.fetchDashboard()
            XCTFail("Expected timeout")
        } catch let error as APIError {
            if case .timeout = error {
                // Expected
            } else {
                XCTFail("Expected timeout, got \(error)")
            }
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    // MARK: - Server Error

    func testPerformRequestServerError() async {
        MockURLProtocol.mockHandler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 500, httpVersion: nil, headerFields: nil)!
            return (response, Data())
        }

        do {
            _ = try await sut.fetchDashboard()
            XCTFail("Expected serverError")
        } catch let error as APIError {
            if case .serverError(let code) = error {
                XCTAssertEqual(code, 500)
            } else {
                XCTFail("Expected serverError(500), got \(error)")
            }
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    // MARK: - Rate Limited

    func testPerformRequestRateLimited() async {
        MockURLProtocol.mockHandler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 429, httpVersion: nil, headerFields: ["Retry-After": "30"])!
            return (response, Data())
        }

        do {
            _ = try await sut.fetchDashboard()
            XCTFail("Expected rateLimited")
        } catch let error as APIError {
            if case .rateLimited(let retryAfter) = error {
                XCTAssertEqual(retryAfter, 30)
            } else {
                XCTFail("Expected rateLimited, got \(error)")
            }
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    // MARK: - Decoding Error

    func testDecodingErrorOnInvalidJSON() async {
        MockURLProtocol.mockHandler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (response, "not json".data(using: .utf8)!)
        }

        do {
            _ = try await sut.fetchDashboard()
            XCTFail("Expected decodingError")
        } catch let error as APIError {
            if case .decodingError = error {
                // Expected
            } else {
                XCTFail("Expected decodingError, got \(error)")
            }
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    // MARK: - No Token

    func testNoTokenThrowsError() async {
        sut.testAccessToken = nil  // No Supabase session either

        do {
            _ = try await sut.fetchDashboard()
            XCTFail("Expected noToken")
        } catch let error as APIError {
            if case .noToken = error {
                // Expected
            } else {
                XCTFail("Expected noToken, got \(error)")
            }
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    // MARK: - Feature Flags (Public Endpoint)

    func testFetchFeatureFlagsSuccess() async throws {
        MockURLProtocol.mockHandler = { request in
            XCTAssertTrue(request.url?.path.contains("/api/feature-flags") ?? false)
            // Feature flags endpoint should NOT have Authorization header
            XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))

            let json = """
            { "flags": { "offline_mode": true, "recurring_bookings": false } }
            """.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (response, json)
        }

        let flags = try await sut.fetchFeatureFlags()

        XCTAssertEqual(flags["offline_mode"], true)
        XCTAssertEqual(flags["recurring_bookings"], false)
    }

    // MARK: - Request Headers

    func testAuthenticatedRequestIncludesBearerToken() async throws {
        let json = """
        { "todayBookings": [], "todayBookingCount": 0, "upcomingBookingCount": 0, "pendingBookingCount": 0, "reviewStats": { "averageRating": null, "totalCount": 0 }, "onboarding": { "profileComplete": false, "hasServices": false, "hasAvailability": false, "isActive": false, "allComplete": false }, "priorityAction": { "type": "none", "count": 0, "label": "" } }
        """.data(using: .utf8)!

        var capturedRequest: URLRequest?
        MockURLProtocol.mockHandler = { request in
            capturedRequest = request
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (response, json)
        }

        _ = try await sut.fetchDashboard()

        XCTAssertEqual(capturedRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer test-jwt-token")
    }
}
