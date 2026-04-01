//
//  NativeDashboardView.swift
//  Equinet
//
//  Native dashboard with KPI cards, today's bookings, onboarding checklist,
//  and priority actions. Replaces the WebView dashboard for faster load times.
//

#if os(iOS)
import OSLog
import SwiftUI

struct NativeDashboardView: View {
    @Bindable var viewModel: DashboardViewModel
    var onNavigateToTab: ((AppTab) -> Void)?
    var onNavigateToWebPath: ((String) -> Void)?

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "sv_SE")
        f.dateFormat = "EEEE d MMMM"
        return f
    }()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.dashboard == nil {
                    loadingView
                } else if let error = viewModel.error {
                    errorView(error)
                } else if let dashboard = viewModel.dashboard {
                    dashboardContent(dashboard)
                }
            }
            .navigationTitle(Self.dateFormatter.string(from: .now).localizedCapitalized)
            .navigationBarTitleDisplayMode(.large)
        }
        .task {
            await viewModel.loadDashboard()
        }
    }

    // MARK: - Dashboard Content

    @ViewBuilder
    private func dashboardContent(_ data: DashboardResponse) -> some View {
        ScrollView {
            VStack(spacing: 16) {
                // Priority action card
                if data.priorityAction.type != .none {
                    priorityActionCard(data.priorityAction)
                }

                // Onboarding checklist
                if data.onboarding.allComplete != true,
                   !viewModel.isOnboardingDismissed() {
                    onboardingChecklist(data.onboarding)
                }

                // Today's bookings
                if !data.todayBookings.isEmpty {
                    todaySection(data.todayBookings)
                }

                // KPI grid
                kpiGrid(data)

                // Empty states
                if data.onboarding.hasServices != true {
                    emptyStateNoServices
                } else if data.upcomingBookingCount == 0 {
                    emptyStateNoBookings
                }
            }
            .padding()
        }
        .refreshable {
            await viewModel.refresh()
        }
        .sensoryFeedback(.success, trigger: viewModel.dashboard?.todayBookings.count ?? 0)
    }

    // MARK: - Priority Action

    private func priorityActionCard(_ action: DashboardPriorityAction) -> some View {
        Button {
            switch action.type {
            case .pendingBookings:
                onNavigateToTab?(.bookings)
            case .incompleteOnboarding:
                onNavigateToWebPath?("/provider/profile")
            case .none, .unknown:
                break
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: action.type == .pendingBookings ? "bell.badge" : "checklist")
                    .font(.title3)
                    .foregroundStyle(action.type == .pendingBookings ? .orange : Color.equinetGreen)
                    .frame(width: 32)

                Text(action.label)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundStyle(.primary)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(action.type == .pendingBookings
                          ? Color.orange.opacity(0.1)
                          : Color.equinetGreen.opacity(0.1))
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(action.label)
        .accessibilityHint("Dubbeltryck för att öppna")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Onboarding Checklist

    private func onboardingChecklist(_ onboarding: DashboardOnboarding) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Kom igång")
                    .font(.headline)
                Spacer()
                Menu {
                    Button("Påminn mig imorgon") {
                        withAnimation {
                            viewModel.dismissOnboarding(permanent: false)
                        }
                    }
                    Button("Dölj tills vidare") {
                        withAnimation {
                            viewModel.dismissOnboarding(permanent: true)
                        }
                    }
                } label: {
                    Image(systemName: "xmark")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(width: 44, height: 44)
                }
            }

            onboardingStep(
                "Fyll i din profil",
                done: onboarding.profileComplete == true,
                action: { onNavigateToWebPath?("/provider/profile") }
            )
            onboardingStep(
                "Lägg till en tjänst",
                done: onboarding.hasServices == true,
                action: { onNavigateToWebPath?("/provider/services") }
            )
            onboardingStep(
                "Ange tillgänglighet",
                done: onboarding.hasAvailability == true,
                action: { onNavigateToWebPath?("/provider/profile") }
            )
            onboardingStep(
                "Aktivera din profil",
                done: onboarding.isActive == true,
                action: { onNavigateToWebPath?("/provider/profile") }
            )
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
        )
    }

    private func onboardingStep(_ title: String, done: Bool, action: @escaping () -> Void) -> some View {
        Button(action: done ? {} : action) {
            HStack(spacing: 10) {
                Image(systemName: done ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(done ? .green : .secondary)
                    .font(.body)

                Text(title)
                    .font(.subheadline)
                    .foregroundStyle(done ? .secondary : .primary)
                    .strikethrough(done)

                Spacer()

                if !done {
                    Image(systemName: "chevron.right")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(done)
        .accessibilityValue(done ? "Klar" : "Ej klar")
    }

    // MARK: - Today Section

    private func todaySection(_ bookings: [DashboardTodayBooking]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Idag")
                .font(.headline)

            ForEach(bookings.prefix(3)) { booking in
                todayBookingRow(booking)
            }

            if bookings.count > 3 {
                Button {
                    onNavigateToTab?(.calendar)
                } label: {
                    Text("Visa alla i kalendern")
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
                .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func todayBookingRow(_ booking: DashboardTodayBooking) -> some View {
        HStack(spacing: 12) {
            // Time
            Text(booking.startTime)
                .font(.subheadline)
                .fontWeight(.semibold)
                .monospacedDigit()
                .frame(width: 44, alignment: .leading)

            VStack(alignment: .leading, spacing: 2) {
                Text("\(booking.customerFirstName) \(booking.customerLastName)")
                    .font(.subheadline)
                    .fontWeight(.medium)
                Text(booking.serviceName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if booking.status == "pending" {
                Text("Väntar")
                    .font(.caption2)
                    .fontWeight(.medium)
                    .foregroundStyle(.orange)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(
                        Capsule()
                            .fill(Color.orange.opacity(0.12))
                    )
            }
        }
        .padding(.vertical, 6)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(booking.startTime), \(booking.customerFirstName) \(booking.customerLastName), \(booking.serviceName)\(booking.status == "pending" ? ", väntar på bekräftelse" : "")")
    }

    // MARK: - KPI Grid

    private func kpiGrid(_ data: DashboardResponse) -> some View {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: 12),
            GridItem(.flexible(), spacing: 12),
        ], spacing: 12) {
            kpiCard(
                title: "Idag",
                value: "\(data.todayBookingCount)",
                icon: "calendar.day.timeline.left",
                action: { onNavigateToTab?(.calendar) }
            )

            kpiCard(
                title: "Kommande",
                value: "\(data.upcomingBookingCount)",
                icon: "calendar",
                action: { onNavigateToTab?(.bookings) }
            )

            kpiCard(
                title: "Nya förfrågningar",
                value: "\(data.pendingBookingCount)",
                icon: "bell.badge",
                badge: data.pendingBookingCount > 0 ? data.pendingBookingCount : nil,
                action: { onNavigateToTab?(.bookings) }
            )

            if data.reviewStats.totalCount > 0 {
                kpiCard(
                    title: "Recensioner",
                    value: data.reviewStats.averageRating.map { $0.formatted(.number.precision(.fractionLength(1))) } ?? "-",
                    icon: "star.fill",
                    subtitle: "\(data.reviewStats.totalCount) st",
                    action: { onNavigateToWebPath?("/provider/reviews") }
                )
            }
        }
    }

    private func kpiCard(
        title: String,
        value: String,
        icon: String,
        badge: Int? = nil,
        subtitle: String? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: icon)
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Spacer()

                    if let badge, badge > 0 {
                        Text("\(badge)")
                            .font(.caption2)
                            .bold()
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(.orange))
                    }

                    Image(systemName: "chevron.right")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }

                Text(value)
                    .font(.title2)
                    .bold()
                    .foregroundStyle(.primary)

                if let subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Text(title)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(.systemBackground))
                    .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(title): \(value)\(subtitle.map { ", \($0)" } ?? "")")
        .accessibilityHint("Dubbeltryck för att öppna")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Empty States

    private var emptyStateNoServices: some View {
        VStack(spacing: 12) {
            Image(systemName: "stethoscope")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)

            Text("Lägg till din första tjänst")
                .font(.headline)

            Text("Skapa en tjänst så att kunder kan boka dig.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button {
                onNavigateToWebPath?("/provider/services")
            } label: {
                Text("Lägg till tjänst")
                    .fontWeight(.medium)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .frame(minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(.vertical, 24)
    }

    private var emptyStateNoBookings: some View {
        ContentUnavailableView {
            Label("Inga bokningar ännu", systemImage: "calendar.badge.plus")
        } description: {
            Text("Dela din profil för att få dina första bokningar.")
        } actions: {
            ShareLink(item: shareURL) {
                Text("Dela min profil")
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(.vertical, 24)
    }

    private var shareURL: URL {
        URL(string: "\(AppConfig.baseURL.absoluteString)/provider/profile") ?? AppConfig.baseURL
    }

    // MARK: - Loading & Error

    private var loadingView: some View {
        VStack {
            Spacer()
            ProgressView("Laddar översikt...")
                .font(.subheadline)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)

            Text("Kunde inte ladda översikten")
                .font(.title3)
                .fontWeight(.semibold)

            Text(message)
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button {
                Task { await viewModel.refresh() }
            } label: {
                Text("Försök igen")
                    .fontWeight(.medium)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .frame(minHeight: 44)
            }
            .buttonStyle(.borderedProminent)

            Spacer()
        }
    }
}
#endif
