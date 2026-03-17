import Foundation

// MARK: - API Response

struct ReviewsResponse: Codable, Sendable {
    let reviews: [ReviewItem]
    let totalCount: Int
    let averageRating: Double?
    let page: Int
    let limit: Int
}

struct ReviewItem: Codable, Identifiable, Sendable {
    let id: String
    let rating: Int
    let comment: String?
    let reply: String?
    let repliedAt: String?
    let createdAt: String
    let customerName: String
    let serviceName: String?

    var hasReply: Bool { reply != nil }

    /// Optimistic delete -- remove reply locally
    func withoutReply() -> ReviewItem {
        ReviewItem(
            id: id,
            rating: rating,
            comment: comment,
            reply: nil,
            repliedAt: nil,
            createdAt: createdAt,
            customerName: customerName,
            serviceName: serviceName
        )
    }

    /// Merge server reply into existing item
    func withReply(_ newReply: String, repliedAt newRepliedAt: String) -> ReviewItem {
        ReviewItem(
            id: id,
            rating: rating,
            comment: comment,
            reply: newReply,
            repliedAt: newRepliedAt,
            createdAt: createdAt,
            customerName: customerName,
            serviceName: serviceName
        )
    }
}

// MARK: - Reply response (minimal -- only what server returns for POST reply)

struct ReplyResponse: Codable, Sendable {
    let reply: String
    let repliedAt: String
}

// MARK: - Sheet state

enum ReviewSheetType: Identifiable {
    case reply(ReviewItem)

    var id: String {
        switch self {
        case .reply(let review): return "reply-\(review.id)"
        }
    }
}
