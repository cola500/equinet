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

    var id: String { path }
}

private let menuSections: [(name: String, items: [MoreMenuItem])] = [
    ("Dagligt arbete", [
        MoreMenuItem(label: "Mina tjänster", icon: "stethoscope", path: "/provider/services", section: "Dagligt arbete"),
        MoreMenuItem(label: "Kunder", icon: "person.2", path: "/provider/customers", section: "Dagligt arbete"),
    ]),
    ("Mitt företag", [
        MoreMenuItem(label: "Recensioner", icon: "star", path: "/provider/reviews", section: "Mitt företag"),
        MoreMenuItem(label: "Min profil", icon: "person.circle", path: "/provider/profile", section: "Mitt företag"),
        MoreMenuItem(label: "Hjälp", icon: "questionmark.circle", path: "/provider/help", section: "Mitt företag"),
    ]),
]

// MARK: - NativeMoreView

struct NativeMoreView: View {
    let bridge: BridgeHandler
    let authManager: AuthManager
    @Bindable var customersViewModel: CustomersViewModel
    @Binding var pendingPath: String?
    @State private var navigationPath = NavigationPath()
    @State private var showLogoutConfirmation = false

    var body: some View {
        NavigationStack(path: $navigationPath) {
            List {
                ForEach(menuSections, id: \.name) { section in
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
                            bridge.clearMobileToken()
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
                if item.path == "/provider/customers" {
                    NativeCustomersView(viewModel: customersViewModel)
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
        let allItems = menuSections.flatMap(\.items)
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
