//
//  NativeServicesView.swift
//  Equinet
//
//  Native SwiftUI service list with CRUD, swipe actions, and optimistic UI.
//  Does NOT own a NavigationStack -- uses NativeMoreView's stack.
//

#if os(iOS)
import SwiftUI
import OSLog

struct NativeServicesView: View {
    @Bindable var viewModel: ServicesViewModel

    @State private var hapticRefreshed = false

    var body: some View {
        content
            .navigationTitle("Mina tjänster")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.activeSheet = .add
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("Lägg till tjänst")
                }
            }
            .task {
                await viewModel.loadServices()
            }
            .refreshable {
                await viewModel.refresh()
                hapticRefreshed.toggle()
            }
            .sensoryFeedback(.success, trigger: hapticRefreshed)
            .sheet(item: $viewModel.activeSheet) { sheet in
                sheetContent(for: sheet)
            }
            .confirmationDialog(
                "Ta bort tjänst?",
                isPresented: Binding(
                    get: { viewModel.serviceToDelete != nil },
                    set: { if !$0 { viewModel.serviceToDelete = nil } }
                ),
                titleVisibility: .visible
            ) {
                if let service = viewModel.serviceToDelete {
                    Button("Ta bort \(service.name)", role: .destructive) {
                        Task {
                            _ = await viewModel.deleteService(id: service.id)
                        }
                    }
                    Button("Avbryt", role: .cancel) {
                        viewModel.serviceToDelete = nil
                    }
                }
            } message: {
                Text("Tjänsten tas bort permanent.")
            }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading {
            VStack {
                Spacer()
                ProgressView("Laddar tjänster...")
                Spacer()
            }
        } else if let error = viewModel.error {
            errorView(error)
        } else if viewModel.services.isEmpty {
            emptyState
        } else {
            serviceList
        }
    }

    // MARK: - Service List

    private var serviceList: some View {
        List {
            ForEach(viewModel.services) { service in
                ServiceRowView(service: service)
                    .swipeActions(edge: .leading, allowsFullSwipe: true) {
                        Button {
                            performToggleActive(service)
                        } label: {
                            Label(
                                service.isActive ? "Inaktivera" : "Aktivera",
                                systemImage: service.isActive ? "pause.circle" : "play.circle"
                            )
                        }
                        .tint(service.isActive ? .gray : .green)

                        Button {
                            viewModel.activeSheet = .edit(service)
                        } label: {
                            Label("Redigera", systemImage: "pencil")
                        }
                        .tint(.blue)
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            viewModel.serviceToDelete = service
                        } label: {
                            Label("Ta bort", systemImage: "trash")
                        }
                    }
                    .contextMenu {
                        Button {
                            viewModel.activeSheet = .edit(service)
                        } label: {
                            Label("Redigera", systemImage: "pencil")
                        }

                        Button {
                            performToggleActive(service)
                        } label: {
                            Label(
                                service.isActive ? "Inaktivera" : "Aktivera",
                                systemImage: service.isActive ? "pause.circle" : "play.circle"
                            )
                        }

                        Divider()

                        Button(role: .destructive) {
                            viewModel.serviceToDelete = service
                        } label: {
                            Label("Ta bort", systemImage: "trash")
                        }
                    }
            }
        }
    }

    // MARK: - Service Row (delegates to ServiceRowView struct)

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "stethoscope")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)

            Text("Inga tjänster ännu")
                .font(.title3)
                .fontWeight(.semibold)

            Text("Lägg till din första tjänst för att komma igång.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button {
                viewModel.activeSheet = .add
            } label: {
                Text("Lägg till tjänst")
                    .fontWeight(.medium)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .frame(minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.equinetGreen)

            Spacer()
        }
    }

    // MARK: - Error View

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)

            Text(message)
                .font(.title3)
                .fontWeight(.semibold)

            Button {
                Task { await viewModel.loadServices() }
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

    // MARK: - Actions

    private func performToggleActive(_ service: ServiceItem) {
        Task { await viewModel.toggleActive(service: service) }
    }

    private func performCreateService(name: String, description: String?, price: Double, duration: Int, isActive: Bool, interval: Int?) {
        Task {
            let ok = await viewModel.createService(
                name: name, description: description, price: price,
                durationMinutes: duration, isActive: isActive,
                recommendedIntervalWeeks: interval
            )
            if ok { viewModel.activeSheet = nil }
        }
    }

    private func performUpdateService(id: String, name: String, description: String?, price: Double, duration: Int, isActive: Bool, interval: Int?) {
        Task {
            let ok = await viewModel.updateService(
                id: id, name: name, description: description, price: price,
                durationMinutes: duration, isActive: isActive,
                recommendedIntervalWeeks: interval
            )
            if ok { viewModel.activeSheet = nil }
        }
    }

    // MARK: - Sheet Content

    @ViewBuilder
    private func sheetContent(for sheet: ServiceSheetType) -> some View {
        switch sheet {
        case .add:
            ServiceFormSheet(service: nil) { name, description, price, duration, isActive, interval in
                performCreateService(name: name, description: description, price: price, duration: duration, isActive: isActive, interval: interval)
            }
        case .edit(let service):
            ServiceFormSheet(service: service) { name, description, price, duration, isActive, interval in
                performUpdateService(id: service.id, name: name, description: description, price: price, duration: duration, isActive: isActive, interval: interval)
            }
        }
    }
}

// MARK: - Service Row

private struct ServiceRowView: View {
    let service: ServiceItem

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(service.name)
                    .font(.body)
                    .fontWeight(.medium)
                    .foregroundStyle(service.isActive ? .primary : .secondary)

                Spacer()

                Text(service.isActive ? "Aktiv" : "Inaktiv")
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(
                        Capsule()
                            .fill(service.isActive ? Color.green.opacity(0.15) : Color.gray.opacity(0.15))
                    )
                    .foregroundStyle(service.isActive ? .green : .secondary)
            }

            HStack(spacing: 6) {
                Text(service.formattedPrice)
                Text("\u{00B7}")
                Text(service.formattedDuration)
                if let interval = service.intervalLabel {
                    Text("\u{00B7}")
                    Text(interval)
                }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}
#endif
