//
//  NativeBookingDetailView.swift
//  Equinet
//
//  Full detail view for a single booking. Takes a bookingId and reads
//  live from BookingsViewModel so optimistic UI updates are reflected.
//

#if os(iOS)
import OSLog
import SwiftUI

struct NativeBookingDetailView: View {
    let bookingId: String
    @Bindable var viewModel: BookingsViewModel
    var onNavigateToWeb: ((_ path: String) -> Void)?
    var featureFlags: [String: Bool] = [:]

    @Environment(\.dismiss) private var dismiss

    // Sheet state (owned by detail view, independent of list)
    @State private var showCancelSheet = false
    @State private var cancelMessage = ""
    @State private var showReviewSheet = false
    @State private var reviewRating = 0
    @State private var reviewComment = ""
    @State private var isSubmittingReview = false
    @State private var showQuickNoteSheet = false

    // Haptic triggers
    @State private var hapticSuccess = false
    @State private var hapticError = false

    private var booking: BookingsListItem? {
        viewModel.bookings.first { $0.id == bookingId }
    }

    var body: some View {
        Group {
            if let booking {
                detailContent(booking)
            } else {
                ContentUnavailableView(
                    "Bokning hittades inte",
                    systemImage: "calendar.badge.exclamationmark",
                    description: Text("Gå tillbaka och försök igen")
                )
            }
        }
        .navigationTitle("Bokning")
        .navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.success, trigger: hapticSuccess)
        .sensoryFeedback(.error, trigger: hapticError)
        .sheet(isPresented: $showCancelSheet) {
            if let booking {
                CancelBookingSheet(
                    bookingId: booking.id,
                    message: $cancelMessage,
                    isLoading: viewModel.actionInProgress != nil,
                    onCancel: { showCancelSheet = false; cancelMessage = "" },
                    onConfirm: { id, message in
                        Task {
                            await viewModel.cancelBooking(id: id, message: message)
                            showCancelSheet = false
                            cancelMessage = ""
                            hapticSuccess.toggle()
                        }
                    }
                )
                .presentationDetents([.medium])
            }
        }
        .sheet(isPresented: $showReviewSheet) {
            if let booking {
                ReviewBookingSheet(
                    booking: booking,
                    rating: $reviewRating,
                    comment: $reviewComment,
                    isLoading: isSubmittingReview,
                    onCancel: { showReviewSheet = false; reviewRating = 0; reviewComment = "" },
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
                                showReviewSheet = false
                                reviewRating = 0
                                reviewComment = ""
                                hapticSuccess.toggle()
                            } else {
                                hapticError.toggle()
                            }
                        }
                    }
                )
                .presentationDetents([.medium])
            }
        }
        .sheet(isPresented: $showQuickNoteSheet) {
            if let booking {
                QuickNoteSheet(
                    existingNotes: booking.providerNotes,
                    onSave: { text in
                        let saved = await viewModel.saveQuickNote(bookingId: booking.id, text: text)
                        if saved { hapticSuccess.toggle() }
                        return saved
                    }
                )
                .presentationDetents([.medium, .large])
            }
        }
    }

    // MARK: - Detail Content

    @ViewBuilder
    private func detailContent(_ booking: BookingsListItem) -> some View {
        let isLoading = viewModel.actionInProgress == booking.id

        ScrollView {
            VStack(alignment: .leading, spacing: 20) {

                // Status badge
                statusBadge(booking.status)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Divider()

                // Kund-sektion
                sectionHeader("Kund")
                customerSection(booking)

                Divider()

                // Tjänst & tid
                sectionHeader("Tjänst och tid")
                serviceTimeSection(booking)

                // Häst (om finns)
                if booking.horseName != nil {
                    Divider()
                    sectionHeader("Häst")
                    horseSection(booking)
                }

                // Anteckningar
                let hasNotes = (booking.customerNotes != nil) || (booking.providerNotes != nil)
                if hasNotes {
                    Divider()
                    sectionHeader("Anteckningar")
                    notesSection(booking)
                }

                // Betalning
                Divider()
                sectionHeader("Betalning")
                paymentSection(booking)

                // Badges (återkommande, manuell)
                let badges = buildBadges(booking)
                if !badges.isEmpty {
                    Divider()
                    badgesSection(badges)
                }

                // Befintlig recension
                if let review = booking.customerReview {
                    Divider()
                    sectionHeader("Kundrecension")
                    reviewSection(review)
                }

                // Avbokningsmeddelande
                if booking.status == "cancelled",
                   let msg = booking.cancellationMessage,
                   !msg.isEmpty {
                    Divider()
                    cancellationSection(msg)
                }

                Divider()

                // Åtgärder
                sectionHeader("Åtgärder")
                actionsSection(booking, isLoading: isLoading)
            }
            .padding(16)
        }
        .opacity(isLoading ? 0.7 : 1.0)
        .overlay {
            if isLoading {
                ProgressView()
                    .scaleEffect(1.5)
            }
        }
        .accessibilityLabel(accessibilityDescription(booking))
    }

    // MARK: - Section Header

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.caption)
            .fontWeight(.semibold)
            .foregroundStyle(.secondary)
            .textCase(.uppercase)
            .tracking(0.5)
    }

    // MARK: - Status Badge

    private func statusBadge(_ status: String) -> some View {
        Text(statusText(status))
            .font(.subheadline)
            .fontWeight(.semibold)
            .foregroundStyle(statusTextColor(status))
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(statusTextColor(status).opacity(0.12))
            .clipShape(Capsule())
            .accessibilityLabel("Status: \(statusText(status))")
    }

    private func statusText(_ status: String) -> String {
        switch status {
        case "pending": return "Väntande"
        case "confirmed": return "Bekräftad"
        case "completed": return "Genomförd"
        case "cancelled": return "Avbokad"
        case "no_show": return "Uteblev"
        default: return status
        }
    }

    private func statusTextColor(_ status: String) -> Color {
        switch status {
        case "pending": return .orange
        case "confirmed": return .green
        case "completed": return .blue
        case "cancelled": return .red
        case "no_show": return .gray
        default: return .gray
        }
    }

    // MARK: - Kund-sektion

    private func customerSection(_ booking: BookingsListItem) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(booking.customerFullName)
                .font(.title3)
                .bold()
                .accessibilityLabel("Kund: \(booking.customerFullName)")

            if let phone = booking.customerPhone, !phone.isEmpty {
                phoneLink(phone)
            }

            emailLink(booking.customerEmail)
        }
    }

    private func phoneLink(_ phone: String) -> some View {
        let digits = phone.filter { $0.isNumber || $0 == "+" }
        if let telURL = URL(string: "tel:\(digits)") {
            return AnyView(
                Link(destination: telURL) {
                    HStack(spacing: 4) {
                        Image(systemName: "phone.fill")
                            .font(.caption)
                        Text(phone)
                            .font(.subheadline)
                    }
                    .frame(minHeight: 44)
                }
                .accessibilityLabel("Telefon: \(phone)")
            )
        }
        return AnyView(
            HStack(spacing: 4) {
                Image(systemName: "phone")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(phone)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(minHeight: 44)
        )
    }

    private func emailLink(_ email: String) -> some View {
        if let mailURL = URL(string: "mailto:\(email)") {
            return AnyView(
                Link(destination: mailURL) {
                    HStack(spacing: 4) {
                        Image(systemName: "envelope.fill")
                            .font(.caption)
                        Text(email)
                            .font(.subheadline)
                    }
                    .frame(minHeight: 44)
                }
                .accessibilityLabel("E-post: \(email)")
            )
        }
        return AnyView(
            HStack(spacing: 4) {
                Image(systemName: "envelope")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(email)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(minHeight: 44)
        )
    }

    // MARK: - Tjänst & tid

    private func serviceTimeSection(_ booking: BookingsListItem) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(booking.serviceName)
                    .font(.headline)
                Spacer()
                Text("\(Int(booking.servicePrice)) kr")
                    .font(.headline)
                    .fontWeight(.semibold)
            }

            HStack(spacing: 4) {
                Image(systemName: "calendar")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(formattedDate(booking.bookingDate))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .accessibilityLabel("Datum: \(formattedDate(booking.bookingDate))")

            HStack(spacing: 4) {
                Image(systemName: "clock")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("\(booking.startTime)–\(booking.endTime)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .accessibilityLabel("Tid: \(booking.startTime) till \(booking.endTime)")
        }
    }

    // MARK: - Häst

    private func horseSection(_ booking: BookingsListItem) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if let horseName = booking.horseName {
                if let horseId = booking.horseId, onNavigateToWeb != nil {
                    Button {
                        onNavigateToWeb?("/provider/horse-timeline/\(horseId)")
                    } label: {
                        HStack(spacing: 4) {
                            Label(horseName, systemImage: "pawprint.fill")
                                .font(.subheadline)
                            if let breed = booking.horseBreed {
                                Text("(\(breed))")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .frame(minHeight: 44)
                    }
                    .accessibilityLabel("Häst: \(horseName)\(booking.horseBreed.map { ", \($0)" } ?? "")")
                    .accessibilityHint("Visa hästens tidslinje")
                } else {
                    HStack(spacing: 4) {
                        Image(systemName: "pawprint.fill")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(horseName)
                            .font(.subheadline)
                        if let breed = booking.horseBreed {
                            Text("(\(breed))")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .accessibilityLabel("Häst: \(horseName)\(booking.horseBreed.map { ", \($0)" } ?? "")")
                }
            }
        }
    }

    // MARK: - Anteckningar

    private func notesSection(_ booking: BookingsListItem) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if let notes = booking.customerNotes, !notes.isEmpty {
                noteBox(label: "Kundmeddelande", text: notes, icon: "text.bubble")
            }
            if let notes = booking.providerNotes, !notes.isEmpty {
                noteBox(label: "Mina anteckningar", text: notes, icon: "note.text")
            }
        }
    }

    private func noteBox(label: String, text: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(label, systemImage: icon)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundStyle(.secondary)
            Text(text)
                .font(.body)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .accessibilityLabel("\(label): \(text)")
    }

    // MARK: - Betalning

    private func paymentSection(_ booking: BookingsListItem) -> some View {
        HStack {
            Label(
                booking.isPaid ? "Betald" : "Obetald",
                systemImage: booking.isPaid ? "checkmark.circle.fill" : "clock.fill"
            )
            .font(.subheadline)
            .foregroundStyle(booking.isPaid ? .green : .secondary)

            if let inv = booking.invoiceNumber, !inv.isEmpty {
                Spacer()
                Text("Faktura #\(inv)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityLabel(booking.isPaid ? "Betald" : "Obetald")
    }

    // MARK: - Badges

    private func buildBadges(_ booking: BookingsListItem) -> [String] {
        var badges: [String] = []
        if booking.bookingSeriesId != nil { badges.append("Återkommande") }
        if booking.isManualBooking { badges.append("Manuell") }
        return badges
    }

    private func badgesSection(_ badges: [String]) -> some View {
        HStack(spacing: 8) {
            ForEach(badges, id: \.self) { badge in
                Text(badge)
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color(.systemGray5))
                    .clipShape(Capsule())
                    .accessibilityLabel("Bokningstyp: \(badge)")
            }
        }
    }

    // MARK: - Recension

    private func reviewSection(_ review: BookingReview) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            StarRatingView(rating: review.rating, font: .body)
            if let comment = review.comment, !comment.isEmpty {
                Text(comment)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityLabel("Kundrecension: \(review.rating) stjärnor")
    }

    // MARK: - Avbokning

    private func cancellationSection(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            sectionHeader("Avbokningsanledning")
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.red)
        }
    }

    // MARK: - Åtgärder

    @ViewBuilder
    private func actionsSection(_ booking: BookingsListItem, isLoading: Bool) -> some View {
        switch booking.status {
        case "pending":
            pendingActions(booking, isLoading: isLoading)
        case "confirmed":
            confirmedActions(booking, isLoading: isLoading)
        case "completed":
            completedActions(booking, isLoading: isLoading)
        default:
            generalActions(isLoading: isLoading)
        }
    }

    private func pendingActions(_ booking: BookingsListItem, isLoading: Bool) -> some View {
        VStack(spacing: 12) {
            Button {
                Task {
                    await viewModel.confirmBooking(id: booking.id)
                    hapticSuccess.toggle()
                }
            } label: {
                Label("Bekräfta bokning", systemImage: "checkmark.circle.fill")
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .controlSize(.large)
            .disabled(isLoading)
            .accessibilityLabel("Bekräfta bokning")

            Button(role: .destructive) {
                Task {
                    await viewModel.declineBooking(id: booking.id)
                    hapticError.toggle()
                }
            } label: {
                Label("Avvisa förfrågan", systemImage: "xmark.circle")
                    .fontWeight(.medium)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(.red)
            .controlSize(.large)
            .disabled(isLoading)
            .accessibilityLabel("Avvisa bokning")

            noteButton(isLoading: isLoading)
            messagingButton(bookingId: booking.id)
        }
    }

    private func confirmedActions(_ booking: BookingsListItem, isLoading: Bool) -> some View {
        VStack(spacing: 12) {
            Button {
                Task {
                    await viewModel.completeBooking(id: booking.id)
                    hapticSuccess.toggle()
                }
            } label: {
                Label("Markera genomförd", systemImage: "checkmark.circle.fill")
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .controlSize(.large)
            .disabled(isLoading)

            HStack(spacing: 12) {
                Button {
                    Task {
                        await viewModel.markNoShow(id: booking.id)
                        hapticError.toggle()
                    }
                } label: {
                    Label("Uteblev", systemImage: "person.slash")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(.orange)
                .controlSize(.large)
                .disabled(isLoading)

                Button(role: .destructive) {
                    showCancelSheet = true
                } label: {
                    Label("Avboka", systemImage: "xmark.circle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .disabled(isLoading)
            }

            noteButton(isLoading: isLoading)
            messagingButton(bookingId: booking.id)
        }
    }

    private func completedActions(_ booking: BookingsListItem, isLoading: Bool) -> some View {
        VStack(spacing: 12) {
            if booking.customerReview == nil {
                Button {
                    reviewRating = 0
                    reviewComment = ""
                    showReviewSheet = true
                } label: {
                    Label("Recensera kund", systemImage: "star.fill")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.orange)
                .controlSize(.large)
                .disabled(isLoading)
            }

            noteButton(isLoading: isLoading)
            messagingButton(bookingId: booking.id)
        }
    }

    private func generalActions(isLoading: Bool) -> some View {
        noteButton(isLoading: isLoading)
    }

    private func noteButton(isLoading: Bool) -> some View {
        Button {
            showQuickNoteSheet = true
        } label: {
            Label("Lägg till anteckning", systemImage: "note.text")
                .font(.subheadline)
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
        .tint(Color.equinetGreen)
        .controlSize(.large)
        .disabled(isLoading)
        .accessibilityLabel("Lägg till anteckning")
    }

    @ViewBuilder
    private func messagingButton(bookingId: String) -> some View {
        if featureFlags["messaging"] == true, onNavigateToWeb != nil {
            Button {
                onNavigateToWeb?("/provider/messages/\(bookingId)")
            } label: {
                Label("Meddelanden", systemImage: "message")
                    .font(.subheadline)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(.blue)
            .controlSize(.large)
            .accessibilityLabel("Öppna meddelandetråd")
            .accessibilityHint("Navigerar till konversationen för denna bokning")
        }
    }

    // MARK: - Date Formatting

    private static let isoDateFormatter = EquinetDateFormatters.isoDate

    private static let displayDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "EEEE d MMMM yyyy"
        f.locale = Locale(identifier: "sv_SE")
        return f
    }()

    private func formattedDate(_ dateString: String) -> String {
        let short = String(dateString.prefix(10))
        if let date = Self.isoDateFormatter.date(from: short) {
            return Self.displayDateFormatter.string(from: date).capitalized
        }
        return short
    }

    // MARK: - Accessibility

    private func accessibilityDescription(_ booking: BookingsListItem) -> String {
        [
            "Bokning för \(booking.customerFullName)",
            booking.serviceName,
            formattedDate(booking.bookingDate),
            "\(booking.startTime) till \(booking.endTime)",
            statusText(booking.status),
        ].joined(separator: ", ")
    }
}
#endif
