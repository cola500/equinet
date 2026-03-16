import Foundation

// MARK: - Priority Action Type

/// Enum with unknown-fallback for future server-side action types
enum PriorityActionType: String, Codable, Sendable {
    case pendingBookings = "pending_bookings"
    case incompleteOnboarding = "incomplete_onboarding"
    case none = "none"
    case unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = PriorityActionType(rawValue: raw) ?? .unknown
    }
}

// MARK: - Dashboard Models

struct DashboardTodayBooking: Codable, Sendable, Identifiable {
    let id: String
    let startTime: String
    let endTime: String
    let customerFirstName: String
    let customerLastName: String
    let serviceName: String
    let status: String
}

struct DashboardReviewStats: Codable, Sendable {
    let averageRating: Double?
    let totalCount: Int
}

struct DashboardOnboarding: Codable, Sendable {
    let profileComplete: Bool?
    let hasServices: Bool?
    let hasAvailability: Bool?
    let isActive: Bool?
    let allComplete: Bool?
}

struct DashboardPriorityAction: Codable, Sendable {
    let type: PriorityActionType
    let count: Int?
    let label: String
}

struct DashboardResponse: Codable, Sendable {
    let todayBookings: [DashboardTodayBooking]
    let todayBookingCount: Int
    let upcomingBookingCount: Int
    let pendingBookingCount: Int
    let reviewStats: DashboardReviewStats
    let onboarding: DashboardOnboarding
    let priorityAction: DashboardPriorityAction
}
