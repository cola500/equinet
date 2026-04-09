//
//  AnnouncementDetailView.swift
//  Equinet
//
//  Announcement detail with bookings list and confirm/cancel actions.
//

#if os(iOS)
import SwiftUI

struct AnnouncementDetailView: View {
    let announcementId: String
    @Bindable var viewModel: AnnouncementsViewModel

    var body: some View {
        Group {
            if viewModel.isLoadingDetail {
                ProgressView("Laddar...")
            } else if let detail = viewModel.detail {
                detailContent(detail)
            } else {
                ContentUnavailableView(
                    "Kunde inte ladda",
                    systemImage: "exclamationmark.triangle",
                    description: Text("Försök igen senare.")
                )
            }
        }
        .navigationTitle("Annonsdetalj")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadDetail(id: announcementId)
        }
        .refreshable {
            await viewModel.loadDetail(id: announcementId)
        }
    }

    @ViewBuilder
    private func detailContent(_ detail: AnnouncementDetailResponse) -> some View {
        List {
            // Announcement info
            Section("Annons") {
                LabeledContent("Tjänster", value: detail.announcement.serviceType)
                if let municipality = detail.announcement.municipality {
                    LabeledContent("Kommun", value: municipality)
                }
                LabeledContent("Status", value: statusLabel(detail.announcement.status))
                if let instructions = detail.announcement.specialInstructions, !instructions.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Instruktioner")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(instructions)
                            .font(.body)
                    }
                }
            }

            // Summary
            Section("Sammanfattning") {
                HStack {
                    summaryCard("Totalt", count: detail.summary.total, color: .primary)
                    summaryCard("Väntar", count: detail.summary.pending, color: .orange)
                    summaryCard("Bekräftade", count: detail.summary.confirmed, color: .green)
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }

            // Bookings
            if detail.bookings.isEmpty {
                Section("Bokningar") {
                    Text("Inga bokningar ännu")
                        .foregroundStyle(.secondary)
                }
            } else {
                Section("Bokningar (\(detail.bookings.count))") {
                    ForEach(detail.bookings) { booking in
                        bookingRow(booking)
                    }
                }
            }
        }
    }

    private func summaryCard(_ label: String, count: Int, color: Color) -> some View {
        VStack(spacing: 4) {
            Text("\(count)")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundStyle(color)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
    }

    @ViewBuilder
    private func bookingRow(_ booking: AnnouncementBooking) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(booking.customerName)
                    .font(.headline)
                Spacer()
                bookingStatusBadge(booking.status, label: booking.statusLabel)
            }

            HStack(spacing: 12) {
                if !booking.formattedDate.isEmpty {
                    Label(booking.formattedDate, systemImage: "calendar")
                }
                if !booking.timeRange.isEmpty {
                    Label(booking.timeRange, systemImage: "clock")
                }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)

            if let service = booking.serviceName {
                HStack {
                    Text(service)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let price = booking.servicePrice {
                        Text("\(Int(price)) kr")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if let horse = booking.horseName, !horse.isEmpty {
                Label(horse, systemImage: "pawprint")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let notes = booking.customerNotes, !notes.isEmpty {
                Text(notes)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .italic()
            }

            // Action buttons for pending bookings
            if booking.isPending {
                HStack(spacing: 12) {
                    Button {
                        Task {
                            _ = await viewModel.updateBookingStatus(
                                announcementId: announcementId,
                                bookingId: booking.id,
                                newStatus: "confirmed"
                            )
                        }
                    } label: {
                        Label("Bekräfta", systemImage: "checkmark")
                            .font(.caption)
                            .fontWeight(.medium)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                    .disabled(viewModel.actionInProgress)

                    Button(role: .destructive) {
                        Task {
                            _ = await viewModel.updateBookingStatus(
                                announcementId: announcementId,
                                bookingId: booking.id,
                                newStatus: "cancelled"
                            )
                        }
                    } label: {
                        Label("Avboka", systemImage: "xmark")
                            .font(.caption)
                            .fontWeight(.medium)
                    }
                    .buttonStyle(.bordered)
                    .disabled(viewModel.actionInProgress)
                }
                .padding(.top, 4)
            }
        }
        .padding(.vertical, 4)
    }

    private func bookingStatusBadge(_ status: String, label: String) -> some View {
        let color: Color = switch status {
        case "pending": .orange
        case "confirmed": .green
        case "cancelled": .red
        case "completed": .gray
        default: .gray
        }
        return Text(label)
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }

    private func statusLabel(_ status: String) -> String {
        switch status {
        case "open": "Öppen"
        case "in_route": "På rutt"
        case "completed": "Avslutad"
        case "cancelled": "Avbruten"
        default: status
        }
    }
}
#endif
