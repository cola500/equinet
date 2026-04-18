//
//  NativeGroupBookingsView.swift
//  Equinet
//
//  Provider's group booking requests list.
//  Shows open requests with participant count.
//

#if os(iOS)
import SwiftUI

struct NativeGroupBookingsView: View {
    @State private var viewModel = GroupBookingsViewModel()
    @Bindable var servicesViewModel: ServicesViewModel

    @State private var hapticRefreshed = false

    var body: some View {
        content
            .navigationTitle("Gruppbokningar")
            .sensoryFeedback(.success, trigger: hapticRefreshed)
            .task {
                await viewModel.loadAvailable()
            }
            .refreshable {
                await viewModel.refresh()
                hapticRefreshed.toggle()
            }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading {
            VStack {
                Spacer()
                ProgressView("Laddar grupprequests...")
                Spacer()
            }
        } else if let error = viewModel.error {
            ContentUnavailableView {
                Label("Något gick fel", systemImage: "exclamationmark.triangle")
            } description: {
                Text(error)
            } actions: {
                Button("Försök igen") {
                    Task { await viewModel.loadAvailable() }
                }
                .buttonStyle(.borderedProminent)
            }
        } else if viewModel.requests.isEmpty {
            ContentUnavailableView {
                Label("Inga grupprequests", systemImage: "person.badge.plus")
            } description: {
                Text("Det finns inga öppna grupprequests i ditt område just nu.")
            }
        } else {
            List {
                ForEach(viewModel.requests) { request in
                    NavigationLink(value: request) {
                        groupRequestRow(request)
                    }
                }
            }
        }
    }

    private func groupRequestRow(_ request: GroupBookingRequest) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(request.serviceType)
                    .font(.headline)
                Spacer()
                Text(request.statusLabel)
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(request.isOpen ? Color.green.opacity(0.15) : Color.gray.opacity(0.15))
                    .foregroundStyle(request.isOpen ? .green : .gray)
                    .clipShape(Capsule())
            }

            HStack(spacing: 12) {
                Label(request.locationName, systemImage: "mappin")
                Label(request.dateRangeLabel, systemImage: "calendar")
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                Label("\(request.participantCount) deltagare", systemImage: "person.2")
                Label("\(request.totalHorses) hästar", systemImage: "pawprint")
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            if let notes = request.notes, !notes.isEmpty {
                Text(notes)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}
#endif
