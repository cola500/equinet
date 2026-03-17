//
//  NativeReviewsView.swift
//  Equinet
//
//  Native SwiftUI reviews list with reply/delete functionality.
//  Does NOT own a NavigationStack -- uses NativeMoreView's stack.
//

#if os(iOS)
import SwiftUI
import OSLog

struct NativeReviewsView: View {
    @Bindable var viewModel: ReviewsViewModel
    var networkMonitor: NetworkMonitor?

    @State private var activeSheet: ReviewSheetType?
    @State private var reviewToDeleteReply: ReviewItem?

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.averageRating != nil || viewModel.totalCount > 0 {
                statsHeader
            }
            content
        }
        .navigationTitle("Recensioner")
        .task {
            if viewModel.reviews.isEmpty {
                await viewModel.loadReviews()
            }
        }
        .refreshable {
            await viewModel.refresh()
        }
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .reply(let review):
                ReplySheet(
                    review: review,
                    isConnected: networkMonitor?.isConnected ?? true,
                    isLoading: viewModel.actionInProgress == review.id,
                    onSubmit: { text in
                        let success = await viewModel.submitReply(reviewId: review.id, text: text)
                        if success { activeSheet = nil }
                        return success
                    }
                )
            }
        }
        .confirmationDialog(
            "Ta bort ditt svar?",
            isPresented: Binding(
                get: { reviewToDeleteReply != nil },
                set: { if !$0 { reviewToDeleteReply = nil } }
            ),
            titleVisibility: .visible
        ) {
            if let review = reviewToDeleteReply {
                Button("Ta bort svar", role: .destructive) {
                    Task {
                        await viewModel.deleteReply(reviewId: review.id)
                    }
                }
                Button("Avbryt", role: .cancel) {}
            }
        } message: {
            Text("Svaret kommer att tas bort permanent.")
        }
    }

    // MARK: - Stats Header

    private var statsHeader: some View {
        HStack(spacing: 12) {
            if let avg = viewModel.averageRating {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Text(String(format: "%.1f", avg))
                            .font(.title2)
                            .fontWeight(.bold)
                        StarRatingView(rating: Int(avg.rounded()), font: .body)
                    }
                    Text("\(viewModel.totalCount) recensioner")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Genomsnitt \(String(format: "%.1f", avg)) av 5, baserat på \(viewModel.totalCount) recensioner")
            }
            Spacer()
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
        .background(Color(.systemGroupedBackground))
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading {
            loadingView
        } else if let error = viewModel.error {
            errorView(error)
        } else if viewModel.reviews.isEmpty {
            emptyView
        } else {
            reviewsList
        }
    }

    private var loadingView: some View {
        VStack {
            Spacer()
            ProgressView("Hämtar recensioner...")
            Spacer()
        }
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text(message)
                .font(.body)
                .foregroundStyle(.secondary)
            Button("Försök igen") {
                Task { await viewModel.loadReviews() }
            }
            .buttonStyle(.borderedProminent)
            .frame(minHeight: 44)
            Spacer()
        }
    }

    private var emptyView: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "star")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("Inga recensioner ännu")
                .font(.title3)
                .fontWeight(.medium)
            Text("Recensioner dyker upp här när kunder betygsätter dina tjänster.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }

    // MARK: - Reviews List

    private var reviewsList: some View {
        List {
            ForEach(viewModel.reviews) { review in
                reviewCard(review)
                    .swipeActions(edge: .trailing) {
                        if review.hasReply {
                            Button(role: .destructive) {
                                reviewToDeleteReply = review
                            } label: {
                                Label("Ta bort svar", systemImage: "trash")
                            }
                            .accessibilityHint("Tar bort ditt svar på recensionen")
                        }
                    }
            }

            if viewModel.hasMorePages {
                loadMoreButton
            }
        }
        .listStyle(.plain)
    }

    // MARK: - Review Card

    private func reviewCard(_ review: ReviewItem) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header: customer + service
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(review.customerName)
                        .font(.subheadline)
                        .fontWeight(.medium)
                    if let service = review.serviceName {
                        Text(service)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                statusBadge(for: review)
            }

            // Stars + date
            HStack {
                StarRatingView(rating: review.rating, font: .caption)
                Spacer()
                Text(formattedDate(review.createdAt))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            // Comment
            if let comment = review.comment, !comment.isEmpty {
                Text(comment)
                    .font(.body)
                    .foregroundStyle(.primary)
            }

            // Reply box
            if let reply = review.reply {
                replyBox(reply: reply, repliedAt: review.repliedAt)
            }

            // Reply button (only if not replied)
            if !review.hasReply {
                Button {
                    activeSheet = .reply(review)
                } label: {
                    Label("Svara", systemImage: "arrowshape.turn.up.left")
                        .font(.subheadline)
                }
                .buttonStyle(.borderless)
                .tint(Color.equinetGreen)
                .frame(minHeight: 44)
                .disabled(!(networkMonitor?.isConnected ?? true))
                .accessibilityHint(
                    (networkMonitor?.isConnected ?? true) ? "Öppnar svarsfönster" : "Inte tillgängligt offline"
                )
            }
        }
        .padding(.vertical, 4)
    }

    // MARK: - Status Badge

    @ViewBuilder
    private func statusBadge(for review: ReviewItem) -> some View {
        if review.hasReply {
            Text("Besvarad")
                .font(.caption2)
                .fontWeight(.medium)
                .foregroundStyle(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Color.green, in: Capsule())
        } else if review.rating <= 3 {
            Text("Obesvarad")
                .font(.caption2)
                .fontWeight(.medium)
                .foregroundStyle(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Color.orange, in: Capsule())
        }
    }

    // MARK: - Reply Box

    private func replyBox(reply: String, repliedAt: String?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Ditt svar")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(Color.equinetGreen)
                Spacer()
                if let repliedAt {
                    Text(formattedDate(repliedAt))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            Text(reply)
                .font(.subheadline)
                .foregroundStyle(.primary)
        }
        .padding(10)
        .background(Color.equinetGreen.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Ditt svar\(repliedAt.map { ", \(formattedDate($0))" } ?? ""): \(reply)")
    }

    // MARK: - Load More

    private var loadMoreButton: some View {
        HStack {
            Spacer()
            if viewModel.isLoadingMore {
                ProgressView()
            } else {
                Button("Visa fler recensioner") {
                    Task { await viewModel.loadMore() }
                }
                .frame(minHeight: 44)
            }
            Spacer()
        }
        .listRowSeparator(.hidden)
    }

    // MARK: - Date formatting

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let displayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "sv_SE")
        f.dateStyle = .medium
        return f
    }()

    private func formattedDate(_ iso: String) -> String {
        guard let date = Self.isoFormatter.date(from: iso) else { return iso }
        return Self.displayFormatter.string(from: date)
    }
}

// MARK: - Reply Sheet

private struct ReplySheet: View {
    let review: ReviewItem
    let isConnected: Bool
    let isLoading: Bool
    let onSubmit: (String) async -> Bool

    @State private var replyText = ""
    @Environment(\.dismiss) private var dismiss

    private var canSubmit: Bool {
        !replyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        && replyText.count <= 500
        && isConnected
        && !isLoading
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                // Context box
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(review.customerName)
                            .font(.subheadline)
                            .fontWeight(.medium)
                        Spacer()
                        StarRatingView(rating: review.rating, font: .caption)
                    }
                    if let comment = review.comment {
                        Text(comment)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(3)
                    }
                }
                .padding(12)
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 8))

                // Reply text field
                VStack(alignment: .trailing, spacing: 4) {
                    TextField("Skriv ditt svar...", text: $replyText, axis: .vertical)
                        .lineLimit(3...8)
                        .textFieldStyle(.roundedBorder)

                    Text("\(replyText.count)/500")
                        .font(.caption2)
                        .foregroundStyle(replyText.count > 500 ? .red : .secondary)
                }

                if !isConnected {
                    Label("Kräver internetanslutning", systemImage: "wifi.slash")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }

                Spacer()
            }
            .padding()
            .navigationTitle("Svara på recension")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isLoading {
                        ProgressView()
                    } else {
                        Button("Skicka") {
                            Task {
                                _ = await onSubmit(replyText.trimmingCharacters(in: .whitespacesAndNewlines))
                            }
                        }
                        .disabled(!canSubmit)
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

#endif
