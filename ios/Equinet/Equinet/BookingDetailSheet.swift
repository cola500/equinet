//
//  BookingDetailSheet.swift
//  Equinet
//
//  Read-only booking detail presented as a sheet from the native calendar.
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
            List {
                // Service info
                Section {
                    LabeledContent("Tjänst", value: booking.serviceName)
                    LabeledContent("Pris", value: "\(Int(booking.servicePrice)) kr")
                }

                // Time
                Section {
                    LabeledContent("Tid", value: "\(booking.startTime) - \(booking.endTime)")
                    if let date = booking.date {
                        LabeledContent("Datum", value: formattedDate(date))
                    }
                }

                // Customer
                Section("Kund") {
                    LabeledContent("Namn", value: booking.customerFullName)
                    if let horse = booking.horseName {
                        LabeledContent("Häst", value: horse)
                    }
                }

                // Status
                Section {
                    HStack {
                        Text("Status")
                        Spacer()
                        statusBadge
                    }
                    if booking.isPaid {
                        HStack {
                            Text("Betalning")
                            Spacer()
                            Label("Betald", systemImage: "creditcard.fill")
                                .font(.subheadline)
                                .foregroundStyle(.green)
                        }
                    }
                    if booking.isManualBooking {
                        HStack {
                            Text("Typ")
                            Spacer()
                            Text("Manuell bokning")
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                // Notes
                if booking.customerNotes != nil || booking.providerNotes != nil {
                    Section("Anteckningar") {
                        if let notes = booking.customerNotes {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Kundens meddelande")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text(notes)
                                    .font(.body)
                            }
                        }
                        if let notes = booking.providerNotes {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Dina anteckningar")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text(notes)
                                    .font(.body)
                            }
                        }
                    }
                }

                // Recurring badge
                if booking.bookingSeriesId != nil {
                    Section {
                        Label("Återkommande bokning", systemImage: "arrow.triangle.2.circlepath")
                            .foregroundStyle(.secondary)
                    }
                }

                // Action buttons for pending bookings
                if booking.status == "pending", let onAction {
                    Section {
                        Button {
                            onAction(booking.id, "confirmed")
                            dismiss()
                        } label: {
                            HStack {
                                Spacer()
                                Label("Bekräfta bokning", systemImage: "checkmark.circle.fill")
                                    .fontWeight(.semibold)
                                Spacer()
                            }
                        }
                        .tint(.green)

                        Button(role: .destructive) {
                            onAction(booking.id, "cancelled")
                            dismiss()
                        } label: {
                            HStack {
                                Spacer()
                                Label("Avvisa bokning", systemImage: "xmark.circle.fill")
                                    .fontWeight(.semibold)
                                Spacer()
                            }
                        }
                    }
                }

                // Open in web app
                if let onOpenInApp, booking.status != "cancelled", booking.status != "no_show" {
                    Section {
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
            }
            .navigationTitle("Bokningsdetaljer")
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

    private func formattedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "sv_SE")
        formatter.dateFormat = "d MMMM yyyy"
        return formatter.string(from: date)
    }
}
#endif
