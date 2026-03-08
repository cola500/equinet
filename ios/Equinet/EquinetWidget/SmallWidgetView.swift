//
//  SmallWidgetView.swift
//  EquinetWidget
//
//  Small (2x2) widget showing next booking summary.
//

import SwiftUI
import WidgetKit

struct SmallWidgetView: View {
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
        VStack(alignment: .leading, spacing: 4) {
            Text("Nästa bokning")
                .font(.caption2)
                .foregroundStyle(.secondary)

            Text("\(booking.startTime) – \(booking.endTime)")
                .font(.headline)
                .fontWeight(.bold)
                .minimumScaleFactor(0.8)

            Text(booking.serviceName)
                .font(.caption)
                .foregroundStyle(.primary)
                .lineLimit(1)

            Spacer()

            HStack(spacing: 4) {
                Text(formatCustomerName(
                    firstName: booking.customerFirstName,
                    lastName: booking.customerLastName
                ))
                if let horse = booking.horseName {
                    Text("– \(horse)")
                }
            }
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
    }

    // MARK: - Empty

    private var emptyView: some View {
        VStack(spacing: 6) {
            Image(systemName: "calendar")
                .font(.title2)
                .foregroundStyle(.secondary)
            Text("Inga kommande bokningar")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }

    // MARK: - Auth needed

    private var authView: some View {
        VStack(spacing: 6) {
            Image(systemName: "person.crop.circle.badge.questionmark")
                .font(.title2)
                .foregroundStyle(.secondary)
            Text("Logga in i Equinet")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }

    // MARK: - Loading

    private var loadingView: some View {
        VStack(spacing: 6) {
            ProgressView()
            Text("Laddar...")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
    }

    // MARK: - Helpers

    private func formatCustomerName(firstName: String, lastName: String) -> String {
        let lastInitial = lastName.prefix(1)
        return "\(firstName) \(lastInitial)."
    }
}
