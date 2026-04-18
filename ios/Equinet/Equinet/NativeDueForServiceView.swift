//
//  NativeDueForServiceView.swift
//  Equinet
//
//  Native view for due-for-service (besöksplanering).
//

#if os(iOS)
import SwiftUI
import OSLog

struct NativeDueForServiceView: View {
    @Bindable var viewModel: DueForServiceViewModel

    @State private var hapticRefreshed = false

    var body: some View {
        content
            .navigationTitle("Besöksplanering")
            .sensoryFeedback(.success, trigger: hapticRefreshed)
            .task {
                await viewModel.loadItems()
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
                ProgressView("Laddar besöksplanering...")
                Spacer()
            }
        } else if let error = viewModel.error {
            errorView(error)
        } else if viewModel.items.isEmpty {
            emptyState
        } else {
            itemList
        }
    }

    // MARK: - Summary Cards

    private var summaryCards: some View {
        HStack(spacing: 12) {
            SummaryCard(
                count: viewModel.overdueCount,
                label: "Försenade",
                systemImage: "exclamationmark.triangle.fill",
                color: .red
            )
            SummaryCard(
                count: viewModel.upcomingCount,
                label: "Inom 2 veckor",
                systemImage: "clock.fill",
                color: .orange
            )
        }
        .padding(.horizontal)
        .padding(.top, 8)
    }

    // MARK: - Filter

    private var filterPicker: some View {
        Picker("Filter", selection: $viewModel.selectedFilter) {
            ForEach(DueForServiceFilter.allCases, id: \.self) { filter in
                Text(filter.label).tag(filter)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    // MARK: - List

    private var itemList: some View {
        ScrollView {
            VStack(spacing: 0) {
                summaryCards
                filterPicker

                if viewModel.filteredItems.isEmpty {
                    Text("Inga hästar matchar filtret.")
                        .foregroundStyle(.secondary)
                        .padding(.top, 40)
                } else {
                    LazyVStack(spacing: 0) {
                        ForEach(viewModel.filteredItems) { item in
                            DueForServiceRow(item: item)
                            Divider()
                                .padding(.leading, 16)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "clock.badge.checkmark")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("Inga hästar behöver besök just nu")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text("Hästar dyker upp här efter avslutade bokningar med tjänster som har återbesöksintervall.")
                .font(.subheadline)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
    }

    // MARK: - Actions

    private func retry() {
        Task { await viewModel.loadItems() }
    }

    // MARK: - Error

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text(message)
                .foregroundStyle(.secondary)
            Button("Försök igen", action: retry)
                .buttonStyle(.bordered)
            Spacer()
        }
    }
}

// MARK: - Row

private struct DueForServiceRow: View {
    let item: DueForServiceItem

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Horse name + status badge
            HStack {
                Text(item.horseName)
                    .font(.headline)
                Spacer()
                statusBadge
            }

            // Owner
            Text(item.ownerName)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            // Service + interval
            HStack {
                Label(item.serviceName, systemImage: "stethoscope")
                    .font(.subheadline)
                Spacer()
                Text("var \(item.intervalWeeks):e vecka")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            // Dates
            HStack {
                Label("Senast: \(item.formattedLastServiceDate)", systemImage: "calendar")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(item.urgencyText)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(urgencyColor)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(item.horseName), \(item.serviceName), \(item.urgencyText)")
    }

    private var statusBadge: some View {
        HStack(spacing: 4) {
            Image(systemName: statusIcon)
                .font(.caption2)
            Text(item.status.label)
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(badgeBackground)
        .clipShape(.capsule)
    }

    private var statusIcon: String {
        switch item.status {
        case .overdue: "exclamationmark.triangle.fill"
        case .upcoming: "clock.fill"
        case .ok: "checkmark.circle.fill"
        }
    }

    private var badgeBackground: Color {
        switch item.status {
        case .overdue: .red.opacity(0.15)
        case .upcoming: .orange.opacity(0.15)
        case .ok: .green.opacity(0.15)
        }
    }

    private var urgencyColor: Color {
        switch item.status {
        case .overdue: .red
        case .upcoming: .orange
        case .ok: .green
        }
    }
}

// MARK: - Summary Card

private struct SummaryCard: View {
    let count: Int
    let label: String
    let systemImage: String
    let color: Color

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: systemImage)
                .foregroundStyle(color)
                .font(.title3)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(count)")
                    .font(.title2)
                    .fontWeight(.bold)
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(12)
        .background(Color(.systemBackground))
        .clipShape(.rect(cornerRadius: 12))
        .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(count) \(label)")
    }
}
#endif
