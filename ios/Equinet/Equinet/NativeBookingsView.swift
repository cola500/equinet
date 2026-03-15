//
//  NativeBookingsView.swift
//  Equinet
//
//  Native SwiftUI bookings list with filter bar, booking cards,
//  inline actions, cancellation dialog, and review dialog.
//

#if os(iOS)
import SwiftUI
import OSLog

struct NativeBookingsView: View {
    @Bindable var viewModel: BookingsViewModel
    var onNavigateToWeb: ((_ path: String) -> Void)?

    // Sheet state
    @State private var cancelBookingId: String?
    @State private var cancelMessage = ""
    @State private var reviewBookingId: String?
    @State private var reviewRating = 0
    @State private var reviewComment = ""
    @State private var isSubmittingReview = false
    @State private var quickNoteBooking: BookingsListItem?

    var body: some View {
        VStack(spacing: 0) {
            filterBar
            content
        }
        .task {
            await viewModel.loadBookings()
        }
        .sheet(item: cancelBinding) { item in
            CancelBookingSheet(
                bookingId: item.id,
                message: $cancelMessage,
                isLoading: viewModel.actionInProgress != nil,
                onCancel: { cancelBookingId = nil; cancelMessage = "" },
                onConfirm: { id, message in
                    Task {
                        await viewModel.cancelBooking(id: id, message: message)
                        cancelBookingId = nil
                        cancelMessage = ""
                    }
                }
            )
            .presentationDetents([.medium])
        }
        .sheet(item: reviewBinding) { item in
            ReviewBookingSheet(
                booking: item,
                rating: $reviewRating,
                comment: $reviewComment,
                isLoading: isSubmittingReview,
                onCancel: { reviewBookingId = nil; reviewRating = 0; reviewComment = "" },
                onSubmit: { bookingId, rating, comment in
                    isSubmittingReview = true
                    Task {
                        let success = await viewModel.submitReview(
                            bookingId: bookingId,
                            rating: rating,
                            comment: comment.isEmpty ? nil : comment
                        )
                        isSubmittingReview = false
                        if success {
                            reviewBookingId = nil
                            reviewRating = 0
                            reviewComment = ""
                        }
                    }
                }
            )
            .presentationDetents([.medium])
        }
        .sheet(item: $quickNoteBooking) { booking in
            QuickNoteSheet(
                existingNotes: booking.providerNotes,
                onSave: { text in
                    await viewModel.saveQuickNote(bookingId: booking.id, text: text)
                }
            )
            .presentationDetents([.medium])
        }
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(BookingFilter.allCases, id: \.self) { filter in
                    let count = viewModel.filterCounts[filter] ?? 0
                    let isSelected = viewModel.selectedFilter == filter

                    Button {
                        viewModel.selectedFilter = filter
                    } label: {
                        HStack(spacing: 4) {
                            Text(filter.label)
                                .font(.subheadline)
                                .fontWeight(isSelected ? .semibold : .regular)
                            if count > 0 {
                                Text("\(count)")
                                    .font(.caption2)
                                    .fontWeight(.bold)
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 1)
                                    .background(
                                        isSelected ? Color.white.opacity(0.3) : Color(.systemGray5)
                                    )
                                    .clipShape(Capsule())
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(isSelected ? Color.equinetGreen : Color(.systemGray6))
                        .foregroundStyle(isSelected ? .white : .primary)
                        .clipShape(Capsule())
                    }
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(Color(.systemBackground))
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.bookings.isEmpty {
            loadingView
        } else if let error = viewModel.error, viewModel.bookings.isEmpty {
            errorView(error)
        } else if viewModel.filteredBookings.isEmpty {
            emptyView
        } else {
            bookingsList
        }
    }

    private var loadingView: some View {
        VStack(spacing: 12) {
            Spacer()
            ProgressView()
            Text("Laddar bokningar...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Button("Försök igen") {
                Task { await viewModel.loadBookings() }
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.equinetGreen)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private var emptyView: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: emptyStateIcon)
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text(emptyStateMessage)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding()
    }

    private var bookingsList: some View {
        List {
            ForEach(viewModel.filteredBookings) { booking in
                BookingCard(
                    booking: booking,
                    isActionInProgress: viewModel.actionInProgress == booking.id,
                    onConfirm: { Task { await viewModel.confirmBooking(id: booking.id) } },
                    onDecline: { Task { await viewModel.declineBooking(id: booking.id) } },
                    onComplete: { Task { await viewModel.completeBooking(id: booking.id) } },
                    onNoShow: { Task { await viewModel.markNoShow(id: booking.id) } },
                    onCancel: { cancelBookingId = booking.id },
                    onReview: { reviewBookingId = booking.id; reviewRating = 0; reviewComment = "" },
                    onQuickNote: { quickNoteBooking = booking },
                    onNavigateToWeb: onNavigateToWeb
                )
                .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .refreshable {
            await viewModel.refresh()
        }
    }

    // MARK: - Empty State Helpers

    private var emptyStateIcon: String {
        switch viewModel.selectedFilter {
        case .all: return "calendar.badge.checkmark"
        case .pending: return "bell.slash"
        case .confirmed: return "checkmark.circle"
        case .completed: return "flag.checkered"
        case .noShow: return "person.slash"
        case .cancelled: return "xmark.circle"
        }
    }

    private var emptyStateMessage: String {
        switch viewModel.selectedFilter {
        case .all: return "Inga aktiva bokningar"
        case .pending: return "Inga väntande förfrågningar"
        case .confirmed: return "Inga bekräftade bokningar"
        case .completed: return "Inga genomförda bokningar"
        case .noShow: return "Inga uteblivna bokningar"
        case .cancelled: return "Inga avbokade bokningar"
        }
    }

    // MARK: - Sheet Bindings

    private var cancelBinding: Binding<IdentifiableString?> {
        Binding(
            get: { cancelBookingId.map { IdentifiableString(id: $0) } },
            set: { cancelBookingId = $0?.id }
        )
    }

    private var reviewBinding: Binding<BookingsListItem?> {
        Binding(
            get: { reviewBookingId.flatMap { id in viewModel.bookings.first { $0.id == id } } },
            set: { reviewBookingId = $0?.id }
        )
    }
}

// MARK: - Identifiable wrapper for sheet binding

private struct IdentifiableString: Identifiable {
    let id: String
}

// MARK: - Booking Card

private struct BookingCard: View {
    let booking: BookingsListItem
    let isActionInProgress: Bool
    let onConfirm: () -> Void
    let onDecline: () -> Void
    let onComplete: () -> Void
    let onNoShow: () -> Void
    let onCancel: () -> Void
    let onReview: () -> Void
    let onQuickNote: () -> Void
    var onNavigateToWeb: ((_ path: String) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header row: status + service + price
            HStack {
                statusIndicator
                Text(booking.serviceName)
                    .font(.headline)
                Spacer()
                Text("\(Int(booking.servicePrice)) kr")
                    .font(.subheadline)
                    .fontWeight(.semibold)
            }

            // Customer name
            Text(booking.customerFullName)
                .font(.subheadline)

            // Date & time
            HStack(spacing: 4) {
                Image(systemName: "calendar")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(formattedDate)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("\(booking.startTime)–\(booking.endTime)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            // Horse info
            if let horseName = booking.horseName {
                HStack(spacing: 4) {
                    Image(systemName: "pawprint")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let horseId = booking.horseId, onNavigateToWeb != nil {
                        Button {
                            onNavigateToWeb?("/provider/horse-timeline/\(horseId)")
                        } label: {
                            Text(horseName)
                                .font(.caption)
                                .foregroundStyle(.blue)
                        }
                    } else {
                        Text(horseName)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if let breed = booking.horseBreed {
                        Text("(\(breed))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            // Customer phone (tappable)
            if let phone = booking.customerPhone, !phone.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "phone")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Link(phone, destination: URL(string: "tel:\(phone)")!)
                        .font(.caption)
                }
            }

            // Provider notes
            if let notes = booking.providerNotes, !notes.isEmpty {
                Label(notes, systemImage: "note.text")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            // Customer notes
            if let customerNotes = booking.customerNotes, !customerNotes.isEmpty {
                Label(customerNotes, systemImage: "text.bubble")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            // Cancellation message
            if booking.status == "cancelled", let msg = booking.cancellationMessage, !msg.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.bubble")
                        .font(.caption)
                        .foregroundStyle(.red)
                    Text(msg)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .lineLimit(2)
                }
            }

            // Badges
            badgeRow

            // Action buttons
            actionButtons

            // Existing review
            if let review = booking.customerReview {
                HStack(spacing: 2) {
                    ForEach(1...5, id: \.self) { star in
                        Image(systemName: star <= review.rating ? "star.fill" : "star")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                    if let comment = review.comment {
                        Text(comment)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Kundrecension: \(review.rating) av 5 stjärnor")
            }
        }
        .padding(12)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .opacity(isActionInProgress ? 0.6 : 1.0)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(accessibilityDescription)
    }

    // MARK: - Status Indicator

    private var statusIndicator: some View {
        Circle()
            .fill(statusColor)
            .frame(width: 8, height: 8)
    }

    private var statusColor: Color {
        switch booking.status {
        case "pending": return .orange
        case "confirmed": return .blue
        case "completed": return .green
        case "cancelled": return .red
        case "no_show": return .gray
        default: return .gray
        }
    }

    // MARK: - Badges

    @ViewBuilder
    private var badgeRow: some View {
        let badges = buildBadges()
        if !badges.isEmpty {
            HStack(spacing: 6) {
                ForEach(badges, id: \.self) { badge in
                    Text(badge)
                        .font(.caption2)
                        .fontWeight(.medium)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color(.systemGray5))
                        .clipShape(Capsule())
                }
            }
        }
    }

    private func buildBadges() -> [String] {
        var badges: [String] = []
        if booking.isPaid {
            if let inv = booking.invoiceNumber, !inv.isEmpty {
                badges.append("Betald #\(inv)")
            } else {
                badges.append("Betald")
            }
        }
        if booking.bookingSeriesId != nil { badges.append("Återkommande") }
        if booking.isManualBooking { badges.append("Manuell") }
        return badges
    }

    // MARK: - Action Buttons

    @ViewBuilder
    private var actionButtons: some View {
        switch booking.status {
        case "pending":
            HStack(spacing: 8) {
                Button(action: onConfirm) {
                    Label("Bekräfta", systemImage: "checkmark")
                        .font(.caption)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.equinetGreen)
                .disabled(isActionInProgress)

                Button(action: onDecline) {
                    Label("Avvisa", systemImage: "xmark")
                        .font(.caption)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(.red)
                .disabled(isActionInProgress)
            }
        case "confirmed":
            VStack(spacing: 8) {
                HStack(spacing: 8) {
                    Button(action: onComplete) {
                        Label("Genomförd", systemImage: "checkmark.circle")
                            .font(.caption)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.equinetGreen)
                    .disabled(isActionInProgress)

                    Button(action: onNoShow) {
                        Label("Uteblev", systemImage: "person.slash")
                            .font(.caption)
                    }
                    .buttonStyle(.bordered)
                    .tint(.orange)
                    .disabled(isActionInProgress)

                    Button(action: onCancel) {
                        Label("Avboka", systemImage: "xmark.circle")
                            .font(.caption)
                    }
                    .buttonStyle(.bordered)
                    .tint(.red)
                    .disabled(isActionInProgress)
                }
                HStack(spacing: 8) {
                    Button(action: onQuickNote) {
                        Label("Anteckning", systemImage: "note.text")
                            .font(.caption)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .tint(Color.equinetGreen)
                    .disabled(isActionInProgress)
                }
            }
        case "completed":
            HStack(spacing: 8) {
                if booking.customerReview == nil {
                    Button(action: onReview) {
                        Label("Recensera kund", systemImage: "star")
                            .font(.caption)
                    }
                    .buttonStyle(.bordered)
                    .tint(.orange)
                    .disabled(isActionInProgress)
                }
                Button(action: onQuickNote) {
                    Label("Anteckning", systemImage: "note.text")
                        .font(.caption)
                }
                .buttonStyle(.bordered)
                .tint(Color.equinetGreen)
                .disabled(isActionInProgress)
            }
        default:
            EmptyView()
        }
    }

    // MARK: - Formatted Date

    private var formattedDate: String {
        // bookingDate comes as ISO string "2026-03-14T00:00:00.000Z"
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "sv_SE")
        if let date = formatter.date(from: String(booking.bookingDate.prefix(10))) {
            formatter.dateFormat = "d MMM yyyy"
            return formatter.string(from: date)
        }
        return String(booking.bookingDate.prefix(10))
    }

    // MARK: - Accessibility

    private var accessibilityDescription: String {
        var parts = [booking.serviceName, booking.customerFullName, formattedDate, "\(booking.startTime) till \(booking.endTime)"]
        if let horseName = booking.horseName { parts.append(horseName) }
        if let phone = booking.customerPhone, !phone.isEmpty { parts.append("Telefon: \(phone)") }
        if let customerNotes = booking.customerNotes, !customerNotes.isEmpty { parts.append("Kundkommentar: \(customerNotes)") }
        return parts.joined(separator: ", ")
    }
}

// MARK: - Cancel Booking Sheet

struct CancelBookingSheet: View {
    let bookingId: String
    @Binding var message: String
    let isLoading: Bool
    let onCancel: () -> Void
    let onConfirm: (String, String) -> Void

    private let maxLength = 500

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("Ange en anledning till avbokningen (valfritt):")
                    .font(.subheadline)

                TextEditor(text: $message)
                    .frame(minHeight: 100)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color(.systemGray4), lineWidth: 1)
                    )
                    .onChange(of: message) { _, newValue in
                        if newValue.count > maxLength {
                            message = String(newValue.prefix(maxLength))
                        }
                    }

                HStack {
                    Spacer()
                    Text("\(message.count)/\(maxLength)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }
            .padding()
            .navigationTitle("Avboka bokning")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { onCancel() }
                        .disabled(isLoading)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Avboka") {
                        onConfirm(bookingId, message)
                    }
                    .foregroundStyle(.red)
                    .disabled(isLoading)
                }
            }
        }
    }
}

// MARK: - Review Booking Sheet

struct ReviewBookingSheet: View {
    let booking: BookingsListItem
    @Binding var rating: Int
    @Binding var comment: String
    let isLoading: Bool
    let onCancel: () -> Void
    let onSubmit: (String, Int, String) -> Void

    private let maxLength = 500

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("Recensera \(booking.customerFullName)")
                    .font(.headline)

                // Star rating
                HStack(spacing: 8) {
                    ForEach(1...5, id: \.self) { star in
                        Image(systemName: star <= rating ? "star.fill" : "star")
                            .font(.title2)
                            .foregroundStyle(star <= rating ? .orange : .gray)
                            .onTapGesture {
                                rating = star
                            }
                            .accessibilityLabel("\(star) stjärna")
                            .accessibilityAddTraits(star <= rating ? .isSelected : [])
                    }
                }
                .accessibilityElement(children: .contain)
                .accessibilityValue("\(rating) av 5")
                .padding(.vertical, 4)

                // Comment
                Text("Kommentar (valfritt):")
                    .font(.subheadline)

                TextEditor(text: $comment)
                    .frame(minHeight: 80)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color(.systemGray4), lineWidth: 1)
                    )
                    .onChange(of: comment) { _, newValue in
                        if newValue.count > maxLength {
                            comment = String(newValue.prefix(maxLength))
                        }
                    }

                HStack {
                    Spacer()
                    Text("\(comment.count)/\(maxLength)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }
            .padding()
            .navigationTitle("Kundrecension")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { onCancel() }
                        .disabled(isLoading)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Skicka") {
                        onSubmit(booking.id, rating, comment)
                    }
                    .disabled(rating == 0 || isLoading)
                }
            }
        }
    }
}
#endif
