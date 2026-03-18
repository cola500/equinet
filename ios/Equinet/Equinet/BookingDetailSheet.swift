//
//  BookingDetailSheet.swift
//  Equinet
//
//  Compact action card for calendar bookings.
//  Focus: "What do I do with this booking NOW?"
//

#if os(iOS)
import SwiftUI

struct BookingDetailSheet: View {
    let booking: NativeBooking
    var onAction: ((_ bookingId: String, _ newStatus: String) -> Void)?
    var onOpenInApp: ((_ bookingId: String) -> Void)?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Status pill
                    statusBadge

                    // Customer + horse
                    VStack(alignment: .leading, spacing: 2) {
                        Text(booking.customerFullName)
                            .font(.title3)
                            .bold()
                        if let horse = booking.horseName {
                            Text(horse)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }

                    // Service + time
                    VStack(alignment: .leading, spacing: 2) {
                        Text(booking.serviceName)
                            .font(.headline)
                        if let date = booking.date {
                            Text("\(formattedDate(date)), \(booking.startTime)–\(booking.endTime)")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        } else {
                            Text("\(booking.startTime)–\(booking.endTime)")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }

                    // Phone (tap-to-call)
                    if let phone = booking.customerPhone, !phone.isEmpty {
                        phoneLink(phone)
                    }

                    // Customer message (highlight box)
                    if let notes = booking.customerNotes, !notes.isEmpty {
                        customerMessageBox(notes)
                    }

                    Spacer(minLength: 8)

                    // Actions (status-dependent)
                    actionButtons

                    // Open in web app
                    if let onOpenInApp, booking.status != "cancelled", booking.status != "no_show" {
                        Button {
                            dismiss()
                            onOpenInApp(booking.id)
                        } label: {
                            HStack {
                                Spacer()
                                Label("Hantera bokning", systemImage: "list.bullet")
                                Spacer()
                            }
                        }
                    }
                }
                .padding(16)
            }
            .navigationTitle("Bokning")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Stäng") {
                        dismiss()
                    }
                }
            }
        }
    }

    // MARK: - Status Badge

    private var statusBadge: some View {
        Text(statusText)
            .font(.subheadline)
            .fontWeight(.medium)
            .foregroundStyle(statusTextColor)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(statusBackgroundColor)
            .clipShape(Capsule())
    }

    private var statusText: String {
        switch booking.status {
        case "pending": return "Väntande"
        case "confirmed": return "Bekräftad"
        case "completed": return "Slutförd"
        case "cancelled": return "Avbokad"
        case "no_show": return "Uteblev"
        default: return booking.status
        }
    }

    private var statusTextColor: Color {
        switch booking.status {
        case "pending": return .orange
        case "confirmed": return .green
        case "completed": return .blue
        case "cancelled": return .red
        case "no_show": return .orange
        default: return .gray
        }
    }

    private var statusBackgroundColor: Color {
        statusTextColor.opacity(0.12)
    }

    // MARK: - Phone Link

    private func phoneLink(_ phone: String) -> some View {
        let digits = phone.filter { $0.isNumber || $0 == "+" }
        return Link(destination: URL(string: "tel:\(digits)")!) {
            Label(phone, systemImage: "phone.fill")
                .font(.body)
        }
    }

    // MARK: - Customer Message

    private func customerMessageBox(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Kundens meddelande")
                .font(.caption)
                .fontWeight(.medium)
                .foregroundStyle(.secondary)
            Text(message)
                .font(.body)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    // MARK: - Action Buttons

    @ViewBuilder
    private var actionButtons: some View {
        switch booking.status {
        case "pending":
            pendingActions
        case "confirmed":
            confirmedActions
        default:
            // completed, cancelled, no_show
            detailLink("Alla detaljer")
        }
    }

    private var pendingActions: some View {
        VStack(spacing: 12) {
            if let onAction {
                Button {
                    onAction(booking.id, "confirmed")
                    dismiss()
                } label: {
                    Label("Bekräfta bokning", systemImage: "checkmark.circle.fill")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .controlSize(.large)

                Button(role: .destructive) {
                    onAction(booking.id, "cancelled")
                    dismiss()
                } label: {
                    Text("Avvisa")
                        .fontWeight(.medium)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.red)
            }
        }
    }

    private var confirmedActions: some View {
        VStack(spacing: 12) {
            if let onAction {
                Button {
                    onAction(booking.id, "completed")
                    dismiss()
                } label: {
                    Label("Markera genomförd", systemImage: "checkmark.circle.fill")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .controlSize(.large)
            }

            detailLink("Hantera bokning")
        }
    }

    private func detailLink(_ title: String) -> some View {
        Group {
            if let onOpenInApp {
                Button {
                    onOpenInApp(booking.id)
                    dismiss()
                } label: {
                    Text(title)
                        .fontWeight(.medium)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.blue)
            }
        }
    }

    // MARK: - Date Formatting

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "sv_SE")
        f.dateFormat = "EEE d MMM"
        return f
    }()

    private func formattedDate(_ date: Date) -> String {
        Self.dateFormatter.string(from: date)
    }
}
#endif
