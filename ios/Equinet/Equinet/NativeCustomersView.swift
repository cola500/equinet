//
//  NativeCustomersView.swift
//  Equinet
//
//  Native SwiftUI customer list with search, filter bar, and CRUD.
//  Does NOT own a NavigationStack -- uses NativeMoreView's stack.
//

#if os(iOS)
import SwiftUI
import OSLog

struct NativeCustomersView: View {
    @Bindable var viewModel: CustomersViewModel
    var onNavigateToWeb: ((_ path: String) -> Void)?

    var body: some View {
        VStack(spacing: 0) {
            filterBar
            content
        }
        .searchable(text: $viewModel.searchQuery, prompt: "Sök kund...")
        .navigationTitle("Kunder")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    viewModel.activeSheet = .addCustomer
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Lägg till kund")
            }
        }
        .task {
            await viewModel.loadCustomers()
        }
        .refreshable {
            await viewModel.refresh()
        }
        .sheet(item: $viewModel.activeSheet) { sheet in
            sheetContent(for: sheet)
        }
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(CustomerFilter.allCases, id: \.self) { filter in
                    let isSelected = viewModel.selectedFilter == filter

                    Button {
                        viewModel.selectedFilter = filter
                    } label: {
                        Text(filter.label)
                            .font(.subheadline)
                            .fontWeight(isSelected ? .semibold : .regular)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 7)
                            .background(
                                Capsule()
                                    .fill(isSelected ? Color.equinetGreen : Color(.systemGray5))
                            )
                            .foregroundStyle(isSelected ? .white : .primary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .scrollIndicators(.hidden)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading {
            VStack {
                Spacer()
                ProgressView("Laddar kunder...")
                Spacer()
            }
        } else if let error = viewModel.error {
            errorView(message: error)
        } else if viewModel.filteredCustomers.isEmpty {
            emptyState
        } else {
            customerList
        }
    }

    // MARK: - Customer List

    private var customerList: some View {
        List {
            ForEach(viewModel.filteredCustomers) { customer in
                NavigationLink(value: customer) {
                    CustomerCard(customer: customer)
                }
            }
        }
        .listStyle(.plain)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "person.2.slash")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)

            if !viewModel.searchQuery.isEmpty {
                Text("Inga kunder matchar sökningen")
                    .font(.title3)
                    .fontWeight(.semibold)

                Text("Prova att söka på ett annat namn eller e-postadress.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            } else if viewModel.selectedFilter != .all {
                Text("Inga \(viewModel.selectedFilter.label.lowercased()) kunder")
                    .font(.title3)
                    .fontWeight(.semibold)
            } else {
                Text("Inga kunder ännu")
                    .font(.title3)
                    .fontWeight(.semibold)

                Text("Kunder läggs till automatiskt när de bokar, eller lägg till dem manuellt.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)

                Button {
                    viewModel.activeSheet = .addCustomer
                } label: {
                    Text("Lägg till kund")
                        .fontWeight(.medium)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 10)
                        .frame(minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .tint(.equinetGreen)
            }

            Spacer()
        }
    }

    // MARK: - Error View

    private func errorView(message: String) -> some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)

            Text(message)
                .font(.title3)
                .fontWeight(.semibold)

            Button {
                Task { await viewModel.loadCustomers() }
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

    // MARK: - Sheet Content

    @ViewBuilder
    private func sheetContent(for sheet: CustomerSheetType) -> some View {
        switch sheet {
        case .addCustomer:
            AddCustomerSheet(viewModel: viewModel)
                .presentationDetents([.medium])
        case .editCustomer:
            // Handled in detail view
            EmptyView()
        case .addHorse, .editHorse, .addNote, .editNote:
            // Handled in detail view
            EmptyView()
        }
    }
}

// MARK: - Customer Card

private struct CustomerCard: View {
    let customer: CustomerSummary

    private static let dateFormatter = EquinetDateFormatters.swedishMediumDate
    private static let isoFormatter = EquinetDateFormatters.isoWithFractionalSeconds

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Name + no-show warning
            HStack {
                Text(customer.fullName)
                    .font(.headline)

                if customer.hasNoShowWarning {
                    HStack(spacing: 2) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.caption2)
                        Text("\(customer.noShowCount) uteblivna")
                            .font(.caption2)
                    }
                    .foregroundStyle(.red)
                }

                Spacer()

                if customer.isManuallyAdded == true {
                    Text("Manuell")
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color(.systemGray5))
                        .clipShape(Capsule())
                }
            }

            // Last booking + count
            HStack(spacing: 4) {
                if let lastDate = customer.lastBookingDate,
                   let date = Self.isoFormatter.date(from: lastDate) {
                    Text("Senast: \(Self.dateFormatter.string(from: date))")
                } else {
                    Text("Ingen bokning")
                }

                Text("·")

                Text("\(customer.bookingCount) bokningar")
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            // Phone (if available)
            if let phone = customer.phone, !phone.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "phone")
                        .font(.caption2)
                    Text(phone)
                        .font(.caption)
                }
                .foregroundStyle(.secondary)
            }

            // Horse badges
            if !customer.horses.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "pawprint")
                        .font(.caption2)
                    Text("\(customer.horses.count) häst\(customer.horses.count == 1 ? "" : "ar")")
                        .font(.caption2)
                }
                .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(customer.fullName), \(customer.bookingCount) bokningar\(customer.hasNoShowWarning ? ", \(customer.noShowCount) uteblivna" : "")")
    }
}

// MARK: - Add Customer Sheet

private struct AddCustomerSheet: View {
    @Bindable var viewModel: CustomersViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var firstName = ""
    @State private var lastName = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Kundinformation") {
                    TextField("Förnamn *", text: $firstName)
                        .textContentType(.givenName)
                    TextField("Efternamn", text: $lastName)
                        .textContentType(.familyName)
                    TextField("Telefon", text: $phone)
                        .textContentType(.telephoneNumber)
                        .keyboardType(.phonePad)
                    TextField("E-post", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                }
            }
            .navigationTitle("Ny kund")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Spara") {
                        isSaving = true
                        Task {
                            let success = await viewModel.createCustomer(
                                firstName: firstName.trimmingCharacters(in: .whitespaces),
                                lastName: lastName.trimmingCharacters(in: .whitespaces),
                                phone: phone.isEmpty ? nil : phone.trimmingCharacters(in: .whitespaces),
                                email: email.isEmpty ? nil : email.trimmingCharacters(in: .whitespaces)
                            )
                            isSaving = false
                            if success { dismiss() }
                        }
                    }
                    .disabled(firstName.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
        }
    }
}
#endif
