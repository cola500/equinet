//
//  MediumWidgetView.swift
//  EquinetWidget
//
//  Medium (4x2) widget showing next booking with more detail.
//

import SwiftUI
import WidgetKit

struct MediumWidgetView: View {
    let entry: NextBookingEntry

    var body: some View {
        switch entry.state {
        case .hasBooking(let booking):
            bookingView(booking)
        case .noBooking:
            emptyView
        case .authNeeded:
            authView
        case .loading:
            loadingView
        }
    }

    // MARK: - Booking

    private func bookingView(_ booking: WidgetBooking) -> some View {
        HStack(spacing: 12) {
            // Left: time block
            VStack(alignment: .center, spacing: 2) {
                Text(booking.startTime)
                    .font(.title2)
                    .fontWeight(.bold)
                Text(booking.endTime)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(width: 70)

            // Divider
            Rectangle()
                .fill(.tertiary)
                .frame(width: 1)

            // Right: booking details
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Image(systemName: "calendar")
                        .font(.caption2)
                    Text("Nästa bokning")
                        .font(.caption2)
                    Spacer()
                    Text(formatDate(booking.bookingDate))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Text(booking.serviceName)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .lineLimit(1)

                HStack(spacing: 4) {
                    Image(systemName: "person")
                        .font(.caption2)
                    Text("\(booking.customerFirstName) \(booking.customerLastName)")
                        .font(.caption)
                }

                if let horse = booking.horseName {
                    HStack(spacing: 4) {
                        Image(systemName: "pawprint")
                            .font(.caption2)
                        Text(horse)
                            .font(.caption)
                    }
                }

                Spacer()

                Text(statusText(booking.status))
                    .font(.caption2)
                    .foregroundStyle(statusColor(booking.status))
            }
        }
        .padding()
    }

    // MARK: - Empty

    private var emptyView: some View {
        HStack(spacing: 12) {
            Image(systemName: "calendar")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 4) {
                Text("Inga kommande bokningar")
                    .font(.subheadline)
                    .fontWeight(.medium)
                Text("Nya bokningar visas här")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
    }

    // MARK: - Auth needed

    private var authView: some View {
        HStack(spacing: 12) {
            Image(systemName: "person.crop.circle.badge.questionmark")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 4) {
                Text("Logga in i Equinet")
                    .font(.subheadline)
                    .fontWeight(.medium)
                Text("Öppna appen för att se bokningar")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
    }

    // MARK: - Loading

    private var loadingView: some View {
        HStack(spacing: 12) {
            ProgressView()
            Text("Laddar bokningar...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
    }

    // MARK: - Helpers

    private func formatDate(_ dateStr: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate, .withDashSeparatorInDate]
        guard let date = formatter.date(from: dateStr.prefix(10).description) else {
            return dateStr.prefix(10).description
        }
        let displayFormatter = DateFormatter()
        displayFormatter.locale = Locale(identifier: "sv_SE")
        displayFormatter.dateFormat = "d MMM"
        return displayFormatter.string(from: date)
    }

    private func statusText(_ status: String) -> String {
        switch status {
        case "confirmed": return "Bekräftad"
        case "pending": return "Inväntar bekräftelse"
        default: return status.capitalized
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "confirmed": return .green
        case "pending": return .orange
        default: return .secondary
        }
    }
}
