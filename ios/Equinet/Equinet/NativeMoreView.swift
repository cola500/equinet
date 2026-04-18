//
//  NativeMoreView.swift
//  Equinet
//
//  Native "More" tab with NavigationStack.
//  Each menu item pushes a WebView for the corresponding web page.
//

#if os(iOS)
import OSLog
import SwiftUI

// MARK: - Menu data

struct MoreMenuItem: Hashable, Identifiable {
    let label: String
    let icon: String  // SF Symbol
    let path: String
    let section: String
    let featureFlag: String?

    var id: String { path }

    init(label: String, icon: String, path: String, section: String, featureFlag: String? = nil) {
        self.label = label
        self.icon = icon
        self.path = path
        self.section = section
        self.featureFlag = featureFlag
    }
}

/// All menu sections matching the web ProviderNav order exactly.
/// Items with a featureFlag are hidden unless that flag is true.
let allMenuSections: [(name: String, items: [MoreMenuItem])] = [
    ("Dagligt arbete", [
        MoreMenuItem(label: "Mina tjänster", icon: "stethoscope", path: "/provider/services", section: "Dagligt arbete"),
        MoreMenuItem(label: "Meddelanden", icon: "message", path: "/provider/messages", section: "Dagligt arbete", featureFlag: "messaging"),
        MoreMenuItem(label: "Logga arbete", icon: "mic", path: "/provider/voice-log", section: "Dagligt arbete", featureFlag: "voice_logging"),
        MoreMenuItem(label: "Kunder", icon: "person.2", path: "/provider/customers", section: "Dagligt arbete"),
    ]),
    ("Planering", [
        MoreMenuItem(label: "Ruttplanering", icon: "map", path: "/provider/route-planning", section: "Planering", featureFlag: "route_planning"),
        MoreMenuItem(label: "Rutt-annonser", icon: "megaphone", path: "/provider/announcements", section: "Planering", featureFlag: "route_announcements"),
        MoreMenuItem(label: "Besöksplanering", icon: "clock.badge.checkmark", path: "/provider/due-for-service", section: "Planering", featureFlag: "due_for_service"),
        MoreMenuItem(label: "Gruppbokningar", icon: "person.badge.plus", path: "/provider/group-bookings", section: "Planering", featureFlag: "group_bookings"),
    ]),
    ("Mitt företag", [
        MoreMenuItem(label: "Insikter", icon: "chart.bar.xaxis", path: "/provider/insights", section: "Mitt företag", featureFlag: "business_insights"),
        MoreMenuItem(label: "Recensioner", icon: "star", path: "/provider/reviews", section: "Mitt företag"),
        MoreMenuItem(label: "Hjälp", icon: "questionmark.circle", path: "/provider/help", section: "Mitt företag", featureFlag: "help_center"),
        MoreMenuItem(label: "Min profil", icon: "person.circle", path: "/provider/profile", section: "Mitt företag"),
    ]),
]

// MARK: - NativeMoreView

struct NativeMoreView: View {
    let bridge: BridgeHandler
    let authManager: AuthManager
    @Bindable var customersViewModel: CustomersViewModel
    @Bindable var servicesViewModel: ServicesViewModel
    @Bindable var reviewsViewModel: ReviewsViewModel
    @Bindable var profileViewModel: ProfileViewModel
    @State private var dueForServiceViewModel = DueForServiceViewModel()
    @State private var announcementsViewModel = AnnouncementsViewModel()
    @State private var insightsViewModel = InsightsViewModel()
    let featureFlags: [String: Bool]
    @Binding var pendingPath: String?
    @State private var navigationPath = NavigationPath()
    @State private var showLogoutConfirmation = false

    /// Sections filtered by feature flags. Empty sections are hidden.
    private var visibleSections: [(name: String, items: [MoreMenuItem])] {
        allMenuSections.compactMap { section in
            let visible = section.items.filter { item in
                guard let flag = item.featureFlag else { return true }
                return featureFlags[flag] == true
            }
            return visible.isEmpty ? nil : (section.name, visible)
        }
    }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            List {
                ForEach(visibleSections, id: \.name) { section in
                    Section(section.name) {
                        ForEach(section.items) { item in
                            NavigationLink(value: item) {
                                Label(item.label, systemImage: item.icon)
                            }
                        }
                    }
                }

                Section {
                    Button(role: .destructive) {
                        showLogoutConfirmation = true
                    } label: {
                        Label("Logga ut", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                    .confirmationDialog("Vill du logga ut?", isPresented: $showLogoutConfirmation, titleVisibility: .visible) {
                        Button("Logga ut", role: .destructive) {
                            reviewsViewModel.reset()
                            profileViewModel.reset()
                            announcementsViewModel.reset()
                            insightsViewModel.reset()
                            bridge.clearCachedData()
                            authManager.logout()
                        }
                        Button("Avbryt", role: .cancel) {}
                    }
                } header: {
                    Text("Konto")
                }
            }
            .navigationTitle("Mer")
            .tint(Color.equinetGreen)
            .onAppear {
                handlePendingPath()
            }
            .onChange(of: pendingPath) { _, _ in
                handlePendingPath()
            }
            .navigationDestination(for: MoreMenuItem.self) { item in
                if item.path == "/provider/services" {
                    NativeServicesView(viewModel: servicesViewModel)
                } else if item.path == "/provider/customers" {
                    NativeCustomersView(viewModel: customersViewModel)
                } else if item.path == "/provider/reviews" {
                    NativeReviewsView(viewModel: reviewsViewModel)
                } else if item.path == "/provider/profile" {
                    NativeProfileView(
                        viewModel: profileViewModel,
                        featureFlags: featureFlags,
                        onNavigateToWebPath: { path in
                            navigationPath.removeLast()
                            let temp = MoreMenuItem(label: "Profil", icon: "person.circle", path: path, section: "")
                            navigationPath.append(temp)
                        }
                    )
                } else if item.path == "/provider/due-for-service" {
                    NativeDueForServiceView(viewModel: dueForServiceViewModel)
                } else if item.path == "/provider/announcements" {
                    NativeAnnouncementsView(
                        viewModel: announcementsViewModel,
                        servicesViewModel: servicesViewModel
                    )
                    .navigationDestination(for: AnnouncementItem.self) { announcement in
                        AnnouncementDetailView(
                            announcementId: announcement.id,
                            viewModel: announcementsViewModel
                        )
                    }
                } else if item.path == "/provider/group-bookings" {
                    NativeGroupBookingsView(servicesViewModel: servicesViewModel)
                        .navigationDestination(for: GroupBookingRequest.self) { request in
                            GroupBookingDetailView(
                                requestId: request.id,
                                servicesViewModel: servicesViewModel
                            )
                        }
                } else if item.path == "/provider/insights" {
                    NativeInsightsView(viewModel: insightsViewModel)
                } else if item.path == "/provider/help" {
                    NativeHelpView()
                        .navigationDestination(for: HelpArticle.self) { article in
                            HelpArticleDetailView(article: article)
                        }
                } else {
                    MoreWebView(
                        path: item.path,
                        title: item.label,
                        bridge: bridge,
                        authManager: authManager
                    )
                }
            }
            .navigationDestination(for: CustomerSummary.self) { customer in
                CustomerDetailView(
                    customer: customer,
                    viewModel: customersViewModel,
                    onNavigateToWeb: nil
                )
            }
        }
    }

    // MARK: - Pending Path Handling

    private func handlePendingPath() {
        guard let path = pendingPath else { return }
        let allItems = allMenuSections.flatMap(\.items)
        if let item = allItems.first(where: { $0.path == path }) {
            navigationPath.append(item)
        } else {
            let temp = MoreMenuItem(label: "", icon: "", path: path, section: "")
            navigationPath.append(temp)
        }
        pendingPath = nil
    }
}

// MARK: - MoreWebView

/// Thin wrapper that shows a WebView for a specific path inside the NavigationStack.
struct MoreWebView: View {
    let path: String
    let title: String
    let bridge: BridgeHandler
    let authManager: AuthManager

    @State private var canGoBack = false
    @State private var isLoading = false
    @State private var hasNavigationError = false

    private var url: URL {
        URL(string: path, relativeTo: AppConfig.baseURL) ?? AppConfig.baseURL
    }

    var body: some View {
        ZStack {
            if hasNavigationError {
                errorView
            } else {
                WebView(
                    url: url,
                    bridge: bridge,
                    authManager: authManager,
                    canGoBack: $canGoBack,
                    isLoading: $isLoading,
                    hasNavigationError: $hasNavigationError,
                    webViewReady: .constant(true),
                    showNativeCalendar: .constant(false),
                    navigateTo: .constant(nil)
                )
                .ignoresSafeArea()
            }

            if isLoading {
                VStack {
                    ProgressView()
                        .progressViewStyle(.linear)
                        .tint(.accentColor)
                    Spacer()
                }
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var errorView: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)

            Text("Kunde inte ladda sidan")
                .font(.title3)
                .fontWeight(.semibold)

            Text("Kontrollera din internetanslutning och försök igen.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button {
                hasNavigationError = false
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
