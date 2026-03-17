//
//  ReviewsViewModelTests.swift
//  EquinetTests
//
//  Tests for ReviewsViewModel using mock dependencies.
//

@testable import Equinet
import XCTest

// MARK: - Mock

final class MockReviewsFetcher: ReviewsDataFetching, @unchecked Sendable {
    var fetchResult: Result<ReviewsResponse, Error> = .success(
        ReviewsResponse(reviews: [], totalCount: 0, averageRating: nil, page: 1, limit: 10)
    )
    var submitReplyResult: Result<ReplyResponse, Error> = .success(
        ReplyResponse(reply: "Tack!", repliedAt: "2026-03-17T12:00:00.000Z")
    )
    var deleteReplyResult: Result<Void, Error> = .success(())

    var fetchCallCount = 0
    var lastFetchPage: Int?
    var submitReplyCalls: [(reviewId: String, text: String)] = []
    var deleteReplyCalls: [String] = []

    func fetchReviews(page: Int) async throws -> ReviewsResponse {
        fetchCallCount += 1
        lastFetchPage = page
        return try fetchResult.get()
    }

    func submitReply(reviewId: String, text: String) async throws -> ReplyResponse {
        submitReplyCalls.append((reviewId, text))
        return try submitReplyResult.get()
    }

    func deleteReply(reviewId: String) async throws {
        deleteReplyCalls.append(reviewId)
        try deleteReplyResult.get()
    }
}

// MARK: - Helpers

private func makeReview(
    id: String = "review-1",
    rating: Int = 5,
    comment: String? = "Bra!",
    reply: String? = nil,
    repliedAt: String? = nil,
    customerName: String = "Anna Andersson",
    serviceName: String? = "Hovverkning"
) -> ReviewItem {
    ReviewItem(
        id: id,
        rating: rating,
        comment: comment,
        reply: reply,
        repliedAt: repliedAt,
        createdAt: "2026-03-08T09:15:00.000Z",
        customerName: customerName,
        serviceName: serviceName
    )
}

private func makeResponse(
    reviews: [ReviewItem] = [],
    totalCount: Int = 0,
    averageRating: Double? = nil,
    page: Int = 1,
    limit: Int = 10
) -> ReviewsResponse {
    ReviewsResponse(reviews: reviews, totalCount: totalCount, averageRating: averageRating, page: page, limit: limit)
}

// MARK: - Tests

@MainActor
final class ReviewsViewModelTests: XCTestCase {

    private var fetcher: MockReviewsFetcher!
    private var vm: ReviewsViewModel!

    override func setUp() {
        super.setUp()
        fetcher = MockReviewsFetcher()
        vm = ReviewsViewModel(fetcher: fetcher)
    }

    // MARK: - loadReviews

    func testLoadReviewsSetsLoadingAndClearsError() async {
        fetcher.fetchResult = .success(makeResponse(reviews: [makeReview()], totalCount: 1, averageRating: 5.0))

        await vm.loadReviews()

        XCTAssertFalse(vm.isLoading)
        XCTAssertNil(vm.error)
        XCTAssertEqual(vm.reviews.count, 1)
        XCTAssertEqual(vm.totalCount, 1)
        XCTAssertEqual(vm.averageRating, 5.0)
        XCTAssertEqual(vm.currentPage, 1)
    }

    func testLoadReviewsHandlesError() async {
        fetcher.fetchResult = .failure(NSError(domain: "test", code: 500))

        await vm.loadReviews()

        XCTAssertFalse(vm.isLoading)
        XCTAssertNotNil(vm.error)
        XCTAssertTrue(vm.reviews.isEmpty)
    }

    // MARK: - loadMore

    func testLoadMoreAppendsAndIncrementsPage() async {
        let firstPage = [makeReview(id: "r1"), makeReview(id: "r2")]
        fetcher.fetchResult = .success(makeResponse(reviews: firstPage, totalCount: 15, averageRating: 4.0, page: 1))
        await vm.loadReviews()

        let secondPage = [makeReview(id: "r3")]
        fetcher.fetchResult = .success(makeResponse(reviews: secondPage, totalCount: 15, averageRating: 4.0, page: 2))
        await vm.loadMore()

        XCTAssertEqual(vm.reviews.count, 3)
        XCTAssertEqual(vm.currentPage, 2)
        XCTAssertEqual(fetcher.lastFetchPage, 2)
    }

    func testLoadMoreSetsIsLoadingMoreNotIsLoading() async {
        fetcher.fetchResult = .success(makeResponse(reviews: [makeReview()], totalCount: 20, averageRating: 4.0))
        await vm.loadReviews()

        // loadMore should use isLoadingMore
        fetcher.fetchResult = .success(makeResponse(reviews: [], totalCount: 20, averageRating: 4.0, page: 2))
        await vm.loadMore()

        XCTAssertFalse(vm.isLoadingMore)
        XCTAssertFalse(vm.isLoading)
    }

    // MARK: - refresh

    func testRefreshResetsToPageOne() async {
        // Load first page
        fetcher.fetchResult = .success(makeResponse(reviews: [makeReview()], totalCount: 20, averageRating: 4.0))
        await vm.loadReviews()

        // Load more to advance page
        fetcher.fetchResult = .success(makeResponse(reviews: [makeReview(id: "r2")], totalCount: 20, averageRating: 4.0, page: 2))
        await vm.loadMore()
        XCTAssertEqual(vm.currentPage, 2)

        // Refresh should reset
        fetcher.fetchResult = .success(makeResponse(reviews: [makeReview(id: "r3")], totalCount: 20, averageRating: 4.0, page: 1))
        await vm.refresh()

        XCTAssertEqual(vm.currentPage, 1)
        XCTAssertEqual(vm.reviews.count, 1)
        XCTAssertEqual(vm.reviews.first?.id, "r3")
    }

    // MARK: - submitReply

    func testSubmitReplyUpdatesReviewWithServerResponse() async {
        let review = makeReview(id: "r1")
        fetcher.fetchResult = .success(makeResponse(reviews: [review], totalCount: 1, averageRating: 5.0))
        await vm.loadReviews()

        fetcher.submitReplyResult = .success(ReplyResponse(reply: "Tack!", repliedAt: "2026-03-17T12:00:00.000Z"))

        let success = await vm.submitReply(reviewId: "r1", text: "Tack!")

        XCTAssertTrue(success)
        XCTAssertEqual(vm.reviews.first?.reply, "Tack!")
        XCTAssertEqual(vm.reviews.first?.repliedAt, "2026-03-17T12:00:00.000Z")
        XCTAssertEqual(fetcher.submitReplyCalls.count, 1)
        XCTAssertEqual(fetcher.submitReplyCalls.first?.text, "Tack!")
    }

    func testSubmitReplySetsActionInProgress() async {
        let review = makeReview(id: "r1")
        fetcher.fetchResult = .success(makeResponse(reviews: [review], totalCount: 1))
        await vm.loadReviews()

        fetcher.submitReplyResult = .success(ReplyResponse(reply: "Tack!", repliedAt: "2026-03-17T12:00:00.000Z"))

        _ = await vm.submitReply(reviewId: "r1", text: "Tack!")

        // After completion, actionInProgress should be cleared
        XCTAssertNil(vm.actionInProgress)
    }

    func testSubmitReplyDoesNotChangeOnError() async {
        let review = makeReview(id: "r1")
        fetcher.fetchResult = .success(makeResponse(reviews: [review], totalCount: 1))
        await vm.loadReviews()

        fetcher.submitReplyResult = .failure(NSError(domain: "test", code: 500))

        let success = await vm.submitReply(reviewId: "r1", text: "Tack!")

        XCTAssertFalse(success)
        XCTAssertNil(vm.reviews.first?.reply) // Unchanged
    }

    // MARK: - deleteReply

    func testDeleteReplyRemovesReplyOptimistically() async {
        let review = makeReview(id: "r1", reply: "Tack!", repliedAt: "2026-03-17T12:00:00.000Z")
        fetcher.fetchResult = .success(makeResponse(reviews: [review], totalCount: 1))
        await vm.loadReviews()

        await vm.deleteReply(reviewId: "r1")

        XCTAssertNil(vm.reviews.first?.reply)
        XCTAssertNil(vm.reviews.first?.repliedAt)
    }

    func testDeleteReplyRevertsOnError() async {
        let review = makeReview(id: "r1", reply: "Tack!", repliedAt: "2026-03-17T12:00:00.000Z")
        fetcher.fetchResult = .success(makeResponse(reviews: [review], totalCount: 1))
        await vm.loadReviews()

        fetcher.deleteReplyResult = .failure(NSError(domain: "test", code: 500))

        await vm.deleteReply(reviewId: "r1")

        // Should be reverted
        XCTAssertEqual(vm.reviews.first?.reply, "Tack!")
        XCTAssertEqual(vm.reviews.first?.repliedAt, "2026-03-17T12:00:00.000Z")
    }

    func testDeleteReplyNoOpWhenReviewNotFound() async {
        fetcher.fetchResult = .success(makeResponse(reviews: [makeReview(id: "r1")], totalCount: 1))
        await vm.loadReviews()

        await vm.deleteReply(reviewId: "nonexistent")

        XCTAssertTrue(fetcher.deleteReplyCalls.isEmpty) // Should not call API
        XCTAssertEqual(vm.reviews.count, 1) // Unchanged
    }

    // MARK: - hasMorePages

    func testHasMorePagesComputed() async {
        fetcher.fetchResult = .success(makeResponse(reviews: [makeReview()], totalCount: 15, averageRating: 4.0))
        await vm.loadReviews()

        XCTAssertTrue(vm.hasMorePages) // 1 loaded, 15 total, limit 10 -> page 1 has more

        fetcher.fetchResult = .success(makeResponse(reviews: Array(repeating: makeReview(), count: 5), totalCount: 15, averageRating: 4.0, page: 2))
        await vm.loadMore()

        // After loadMore: 6 loaded, page 2, limit 10 -> 2*10 >= 15 -> no more
        XCTAssertFalse(vm.hasMorePages)
    }

    // MARK: - reset

    func testResetClearsAllState() async {
        fetcher.fetchResult = .success(makeResponse(reviews: [makeReview()], totalCount: 5, averageRating: 4.5))
        await vm.loadReviews()
        XCTAssertFalse(vm.reviews.isEmpty)

        vm.reset()

        XCTAssertTrue(vm.reviews.isEmpty)
        XCTAssertEqual(vm.totalCount, 0)
        XCTAssertNil(vm.averageRating)
        XCTAssertEqual(vm.currentPage, 1)
        XCTAssertFalse(vm.isLoading)
        XCTAssertFalse(vm.isLoadingMore)
        XCTAssertNil(vm.error)
        XCTAssertNil(vm.actionInProgress)
    }
}
