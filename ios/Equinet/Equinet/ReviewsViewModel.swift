import Foundation
import OSLog
#if os(iOS)
import UIKit
#endif

// MARK: - Protocol

@MainActor
protocol ReviewsDataFetching: Sendable {
    func fetchReviews(page: Int) async throws -> ReviewsResponse
    func submitReply(reviewId: String, text: String) async throws -> ReplyResponse
    func deleteReply(reviewId: String) async throws
}

// MARK: - ViewModel

@Observable
@MainActor
final class ReviewsViewModel {
    // State
    var reviews: [ReviewItem] = []
    var totalCount: Int = 0
    var averageRating: Double?
    var currentPage: Int = 1
    var isLoading: Bool = false
    var isLoadingMore: Bool = false
    var error: String?
    var actionInProgress: String?

    var hasMorePages: Bool {
        currentPage * limit < totalCount
    }

    private let fetcher: ReviewsDataFetching
    private var limit: Int = 10

    init(fetcher: ReviewsDataFetching) {
        self.fetcher = fetcher
    }

    // MARK: - Load

    func loadReviews() async {
        isLoading = true
        error = nil
        currentPage = 1

        do {
            let response = try await fetcher.fetchReviews(page: 1)
            reviews = response.reviews
            totalCount = response.totalCount
            averageRating = response.averageRating
            limit = response.limit
        } catch {
            AppLogger.network.error("Failed to load reviews: \(error.localizedDescription)")
            self.error = "Kunde inte hämta recensioner"
            reviews = []
        }

        isLoading = false
    }

    func loadMore() async {
        guard !isLoadingMore, hasMorePages else { return }
        isLoadingMore = true

        let nextPage = currentPage + 1
        do {
            let response = try await fetcher.fetchReviews(page: nextPage)
            reviews.append(contentsOf: response.reviews)
            totalCount = response.totalCount
            averageRating = response.averageRating
            currentPage = nextPage
        } catch {
            AppLogger.network.error("Failed to load more reviews: \(error.localizedDescription)")
            self.error = "Kunde inte hämta fler recensioner"
        }

        isLoadingMore = false
    }

    func refresh() async {
        await loadReviews()
    }

    // MARK: - Mutations

    /// Submit reply -- NOT optimistic: uses server response to update.
    /// Returns true on success, false on error.
    func submitReply(reviewId: String, text: String) async -> Bool {
        actionInProgress = reviewId

        do {
            let response = try await fetcher.submitReply(reviewId: reviewId, text: text)

            if let index = reviews.firstIndex(where: { $0.id == reviewId }) {
                reviews[index] = reviews[index].withReply(response.reply, repliedAt: response.repliedAt)
            }

            #if os(iOS)
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            #endif

            actionInProgress = nil
            return true
        } catch {
            AppLogger.network.error("Failed to submit reply: \(error.localizedDescription)")
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
            actionInProgress = nil
            return false
        }
    }

    /// Delete reply -- optimistic with rollback.
    func deleteReply(reviewId: String) async {
        guard let index = reviews.firstIndex(where: { $0.id == reviewId }) else { return }

        let oldReview = reviews[index]
        reviews[index] = oldReview.withoutReply()
        actionInProgress = reviewId

        do {
            try await fetcher.deleteReply(reviewId: reviewId)
            #if os(iOS)
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            #endif
        } catch {
            AppLogger.network.error("Failed to delete reply: \(error.localizedDescription)")
            // Rollback
            if let idx = reviews.firstIndex(where: { $0.id == reviewId }) {
                reviews[idx] = oldReview
            }
            #if os(iOS)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            #endif
        }

        actionInProgress = nil
    }

    // MARK: - Reset

    func reset() {
        reviews = []
        totalCount = 0
        averageRating = nil
        currentPage = 1
        isLoading = false
        isLoadingMore = false
        error = nil
        actionInProgress = nil
    }
}
