//
//  NativeAnnouncementsView.swift
//  Equinet
//
//  Native SwiftUI view for provider's route announcements.
//  Shows list with status badges, booking counts, and cancel action.
//  Create/detail offloaded to WebView via onNavigateToWebPath callback.
//  Does NOT own a NavigationStack -- uses NativeMoreView's stack.
//

#if os(iOS)
import SwiftUI

struct NativeAnnouncementsView: View {
    @Bindable var viewModel: AnnouncementsViewModel
    var onNavigateToWebPath: ((String) -> Void)?

    var body: some View {
        content
            .navigationTitle("Rutt-annonser")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Skapa ny annons", systemImage: "plus") {
                        onNavigateToWebPath?("/provider/announcements/new")
                    }
                }
            }
            .task {
                await viewModel.loadAnnouncements()
            }
            .refreshable {
                await viewModel.refresh()
            }
            .confirmationDialog(
                "Avbryt annons?",
                isPresented: Binding(
                    get: { viewModel.announcementToCancel != nil },
                    set: { if !$0 { viewModel.announcementToCancel = nil } }
                ),
                titleVisibility: .visible
            ) {
                if let announcement = viewModel.announcementToCancel {
                    Button("Avbryt annons", role: .destructive) {
                        Task {
                            _ = await viewModel.cancelAnnouncement(id: announcement.id)
                        }
                    }
                    Button("Behåll", role: .cancel) {
                        viewModel.announcementToCancel = nil
                    }
                }
            } message: {
                Text("Annonsen avbryts och kan inte återställas.")
            }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading {
            VStack {
                Spacer()
                ProgressView("Laddar annonser...")
                Spacer()
            }
        } else if let error = viewModel.error {
            errorView(error)
        } else if viewModel.announcements.isEmpty {
            emptyState
        } else {
            announcementList
        }
    }

    // MARK: - List

    private var announcementList: some View {
        List {
            if !viewModel.openAnnouncements.isEmpty {
                Section("Öppna") {
                    ForEach(viewModel.openAnnouncements) { announcement in
                        AnnouncementRowView(announcement: announcement)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                onNavigateToWebPath?("/provider/announcements/\(announcement.id)")
                            }
                            .accessibilityAddTraits(.isButton)
                            .contextMenu {
                                Button {
                                    onNavigateToWebPath?("/provider/announcements/\(announcement.id)")
                                } label: {
                                    Label("Visa detaljer", systemImage: "eye")
                                }
                                Button(role: .destructive) {
                                    viewModel.announcementToCancel = announcement
                                } label: {
                                    Label("Avbryt annons", systemImage: "xmark.circle")
                                }
                            }
                    }
                }
            }

            if !viewModel.closedAnnouncements.isEmpty {
                Section("Avslutade") {
                    ForEach(viewModel.closedAnnouncements) { announcement in
                        AnnouncementRowView(announcement: announcement)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                onNavigateToWebPath?("/provider/announcements/\(announcement.id)")
                            }
                            .accessibilityAddTraits(.isButton)
                    }
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        ContentUnavailableView {
            Label("Inga annonser", systemImage: "megaphone")
        } description: {
            Text("Du har inga rutt-annonser ännu. Skapa en för att nå kunder i ditt område.")
        } actions: {
            Button("Skapa annons") {
                onNavigateToWebPath?("/provider/announcements/new")
            }
            .buttonStyle(.borderedProminent)
        }
    }

    // MARK: - Error

    private func errorView(_ message: String) -> some View {
        ContentUnavailableView {
            Label("Något gick fel", systemImage: "exclamationmark.triangle")
        } description: {
            Text(message)
        } actions: {
            Button("Försök igen") {
                Task {
                    await viewModel.loadAnnouncements()
                }
            }
            .buttonStyle(.borderedProminent)
        }
    }
}

// MARK: - Row View

private struct AnnouncementRowView: View {
    let announcement: AnnouncementItem

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(announcement.serviceNames)
                    .font(.headline)
                Spacer()
                StatusBadge(status: announcement.status, label: announcement.statusLabel)
            }

            HStack(spacing: 12) {
                Label(announcement.locationSummary, systemImage: "mappin")
                Label(announcement.dateRangeLabel, systemImage: "calendar")
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                Label("\(announcement.bookingCount) bokningar", systemImage: "person.2")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if let instructions = announcement.specialInstructions, !instructions.isEmpty {
                    Label("Instruktioner", systemImage: "info.circle")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(announcement.serviceNames), \(announcement.locationSummary), \(announcement.dateRangeLabel), \(announcement.bookingCount) bokningar, \(announcement.statusLabel)")
    }
}

// MARK: - Status Badge

private struct StatusBadge: View {
    let status: String
    let label: String

    private var color: Color {
        switch status {
        case "open": .green
        case "in_route": .blue
        case "completed": .gray
        case "cancelled": .red
        default: .gray
        }
    }

    var body: some View {
        Text(label)
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
}

#endif
