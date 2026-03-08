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
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
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
