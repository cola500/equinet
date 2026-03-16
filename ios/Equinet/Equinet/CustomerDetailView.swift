//
//  CustomerDetailView.swift
//  Equinet
//
//  Customer detail with segmented tabs (Overview, Horses, Notes).
//  Supports CRUD for horses and notes via sheets.
//

#if os(iOS)
import SwiftUI
import OSLog

struct CustomerDetailView: View {
    let customer: CustomerSummary
    @Bindable var viewModel: CustomersViewModel
    var onNavigateToWeb: ((_ path: String) -> Void)?

    @State private var selectedTab: CustomerDetailTab = .overview
    @State private var showDeleteConfirmation = false

    @Environment(\.dismiss) private var dismiss

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.locale = Locale(identifier: "sv_SE")
        return f
    }()

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    var body: some View {
        VStack(spacing: 0) {
            // Segmented picker
            Picker("Flik", selection: $selectedTab) {
                ForEach(CustomerDetailTab.allCases, id: \.self) { tab in
                    Text(tab.label).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)

            // Tab content
            switch selectedTab {
            case .overview:
                overviewTab
            case .horses:
                horsesTab
            case .notes:
                notesTab
            }
        }
        .navigationTitle(customer.fullName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        viewModel.activeSheet = .editCustomer(customer)
                    } label: {
                        Label("Redigera", systemImage: "pencil")
                    }

                    if customer.isManuallyAdded == true {
                        Button(role: .destructive) {
                            showDeleteConfirmation = true
                        } label: {
                            Label("Ta bort kund", systemImage: "trash")
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .confirmationDialog(
            "Ta bort kund?",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Ta bort", role: .destructive) {
                Task {
                    let success = await viewModel.deleteCustomer(customerId: customer.id)
                    if success { dismiss() }
                }
            }
            Button("Avbryt", role: .cancel) {}
        } message: {
            Text("Kunden \(customer.fullName) tas bort från ditt kundregister. Denna åtgärd kan inte ångras.")
        }
        .task {
            await viewModel.loadDetail(customerId: customer.id)
        }
        .sheet(item: $viewModel.activeSheet) { sheet in
            sheetContent(for: sheet)
        }
    }

    // MARK: - Overview Tab

    private var overviewTab: some View {
        List {
            Section("Kontaktinformation") {
                if let phone = customer.phone, !phone.isEmpty {
                    HStack {
                        Label("Telefon", systemImage: "phone")
                        Spacer()
                        Link(phone, destination: URL(string: "tel:\(phone.replacingOccurrences(of: " ", with: "").replacingOccurrences(of: "-", with: ""))")!)
                            .foregroundStyle(.blue)
                    }
                }

                HStack {
                    Label("E-post", systemImage: "envelope")
                    Spacer()
                    Text(customer.email)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Statistik") {
                HStack {
                    Label("Bokningar", systemImage: "calendar")
                    Spacer()
                    Text("\(customer.bookingCount)")
                        .foregroundStyle(.secondary)
                }

                if customer.noShowCount > 0 {
                    HStack {
                        Label("Uteblivna", systemImage: "exclamationmark.triangle")
                        Spacer()
                        Text("\(customer.noShowCount)")
                            .foregroundStyle(customer.hasNoShowWarning ? .red : .secondary)
                    }
                }

                if let lastDate = customer.lastBookingDate,
                   let date = Self.isoFormatter.date(from: lastDate) {
                    HStack {
                        Label("Senaste bokning", systemImage: "clock")
                        Spacer()
                        Text(Self.dateFormatter.string(from: date))
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if customer.isManuallyAdded == true {
                Section {
                    HStack {
                        Image(systemName: "person.badge.plus")
                            .foregroundStyle(.secondary)
                        Text("Manuellt tillagd kund")
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    // MARK: - Horses Tab

    private var horsesTab: some View {
        Group {
            if viewModel.isLoadingDetail {
                VStack {
                    Spacer()
                    ProgressView("Laddar hästar...")
                    Spacer()
                }
            } else if viewModel.horses.isEmpty {
                VStack(spacing: 16) {
                    Spacer()
                    Image(systemName: "pawprint")
                        .font(.system(size: 48))
                        .foregroundStyle(.secondary)
                    Text("Inga hästar registrerade")
                        .font(.title3)
                        .fontWeight(.semibold)
                    Button {
                        viewModel.activeSheet = .addHorse(customer.id)
                    } label: {
                        Text("Lägg till häst")
                            .fontWeight(.medium)
                            .padding(.horizontal, 24)
                            .padding(.vertical, 10)
                            .frame(minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.equinetGreen)
                    Spacer()
                }
            } else {
                List {
                    ForEach(viewModel.horses) { horse in
                        HorseRow(horse: horse)
                            .contextMenu {
                                Button {
                                    viewModel.activeSheet = .editHorse(customer.id, horse)
                                } label: {
                                    Label("Redigera", systemImage: "pencil")
                                }
                                Button(role: .destructive) {
                                    Task {
                                        await viewModel.deleteHorse(customerId: customer.id, horseId: horse.id)
                                    }
                                } label: {
                                    Label("Ta bort", systemImage: "trash")
                                }
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    Task {
                                        await viewModel.deleteHorse(customerId: customer.id, horseId: horse.id)
                                    }
                                } label: {
                                    Label("Ta bort", systemImage: "trash")
                                }
                            }
                    }
                }
                .listStyle(.plain)
                .toolbar {
                    ToolbarItem(placement: .bottomBar) {
                        Button {
                            viewModel.activeSheet = .addHorse(customer.id)
                        } label: {
                            Label("Lägg till häst", systemImage: "plus")
                        }
                    }
                }
            }
        }
    }

    // MARK: - Notes Tab

    private var notesTab: some View {
        Group {
            if viewModel.isLoadingDetail {
                VStack {
                    Spacer()
                    ProgressView("Laddar anteckningar...")
                    Spacer()
                }
            } else if viewModel.notes.isEmpty {
                VStack(spacing: 16) {
                    Spacer()
                    Image(systemName: "note.text")
                        .font(.system(size: 48))
                        .foregroundStyle(.secondary)
                    Text("Inga anteckningar")
                        .font(.title3)
                        .fontWeight(.semibold)
                    Button {
                        viewModel.activeSheet = .addNote(customer.id)
                    } label: {
                        Text("Skriv anteckning")
                            .fontWeight(.medium)
                            .padding(.horizontal, 24)
                            .padding(.vertical, 10)
                            .frame(minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.equinetGreen)
                    Spacer()
                }
            } else {
                List {
                    ForEach(viewModel.notes) { note in
                        NoteRow(note: note)
                            .contextMenu {
                                Button {
                                    viewModel.activeSheet = .editNote(customer.id, note)
                                } label: {
                                    Label("Redigera", systemImage: "pencil")
                                }
                                Button(role: .destructive) {
                                    Task {
                                        await viewModel.deleteNote(customerId: customer.id, noteId: note.id)
                                    }
                                } label: {
                                    Label("Ta bort", systemImage: "trash")
                                }
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    Task {
                                        await viewModel.deleteNote(customerId: customer.id, noteId: note.id)
                                    }
                                } label: {
                                    Label("Ta bort", systemImage: "trash")
                                }
                            }
                    }
                }
                .listStyle(.plain)
                .toolbar {
                    ToolbarItem(placement: .bottomBar) {
                        Button {
                            viewModel.activeSheet = .addNote(customer.id)
                        } label: {
                            Label("Ny anteckning", systemImage: "plus")
                        }
                    }
                }
            }
        }
    }

    // MARK: - Sheet Content

    @ViewBuilder
    private func sheetContent(for sheet: CustomerSheetType) -> some View {
        switch sheet {
        case .addCustomer:
            EmptyView() // Handled in list view
        case .editCustomer(let c):
            EditCustomerSheet(customer: c, viewModel: viewModel)
                .presentationDetents([.medium])
        case .addHorse(let customerId):
            HorseFormSheet(customerId: customerId, horse: nil, viewModel: viewModel)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        case .editHorse(let customerId, let horse):
            HorseFormSheet(customerId: customerId, horse: horse, viewModel: viewModel)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        case .addNote(let customerId):
            NoteFormSheet(customerId: customerId, note: nil, viewModel: viewModel)
                .presentationDetents([.medium])
        case .editNote(let customerId, let note):
            NoteFormSheet(customerId: customerId, note: note, viewModel: viewModel)
                .presentationDetents([.medium])
        }
    }
}

// MARK: - Horse Row

private struct HorseRow: View {
    let horse: CustomerHorse

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(horse.name)
                .font(.headline)

            HStack(spacing: 8) {
                if let breed = horse.breed, !breed.isEmpty {
                    Text(breed)
                }
                Text(horse.genderLabel)
                if let year = horse.birthYear {
                    Text("f. \(String(year))")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            if let needs = horse.specialNeeds, !needs.isEmpty {
                Text(needs)
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Note Row

private struct NoteRow: View {
    let note: CustomerNote

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .short
        f.timeStyle = .short
        f.locale = Locale(identifier: "sv_SE")
        return f
    }()

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(note.content)
                .font(.body)

            if let date = Self.isoFormatter.date(from: note.createdAt) {
                Text(Self.dateFormatter.string(from: date))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Edit Customer Sheet

private struct EditCustomerSheet: View {
    let customer: CustomerSummary
    @Bindable var viewModel: CustomersViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var firstName: String
    @State private var lastName: String
    @State private var phone: String
    @State private var email: String
    @State private var isSaving = false

    init(customer: CustomerSummary, viewModel: CustomersViewModel) {
        self.customer = customer
        self.viewModel = viewModel
        _firstName = State(initialValue: customer.firstName)
        _lastName = State(initialValue: customer.lastName)
        _phone = State(initialValue: customer.phone ?? "")
        _email = State(initialValue: customer.email)
    }

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
            .navigationTitle("Redigera kund")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Spara") {
                        isSaving = true
                        Task {
                            let success = await viewModel.updateCustomer(
                                customerId: customer.id,
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

// MARK: - Horse Form Sheet

private struct HorseFormSheet: View {
    let customerId: String
    let horse: CustomerHorse?
    @Bindable var viewModel: CustomersViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var breed: String
    @State private var birthYearText: String
    @State private var color: String
    @State private var gender: String
    @State private var specialNeeds: String
    @State private var registrationNumber: String
    @State private var microchipNumber: String
    @State private var isSaving = false

    private let genderOptions = [
        ("", "Välj kön"),
        ("mare", "Sto"),
        ("gelding", "Valack"),
        ("stallion", "Hingst"),
    ]

    init(customerId: String, horse: CustomerHorse?, viewModel: CustomersViewModel) {
        self.customerId = customerId
        self.horse = horse
        self.viewModel = viewModel
        _name = State(initialValue: horse?.name ?? "")
        _breed = State(initialValue: horse?.breed ?? "")
        _birthYearText = State(initialValue: horse?.birthYear.map(String.init) ?? "")
        _color = State(initialValue: horse?.color ?? "")
        _gender = State(initialValue: horse?.gender ?? "")
        _specialNeeds = State(initialValue: horse?.specialNeeds ?? "")
        _registrationNumber = State(initialValue: horse?.registrationNumber ?? "")
        _microchipNumber = State(initialValue: horse?.microchipNumber ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Grundinformation") {
                    TextField("Namn *", text: $name)
                    TextField("Ras", text: $breed)

                    Picker("Kön", selection: $gender) {
                        ForEach(genderOptions, id: \.0) { value, label in
                            Text(label).tag(value)
                        }
                    }
                    .pickerStyle(.segmented)

                    TextField("Födelseår", text: $birthYearText)
                        .keyboardType(.numberPad)

                    TextField("Färg", text: $color)
                }

                Section("Övrigt") {
                    TextField("Specialbehov", text: $specialNeeds, axis: .vertical)
                        .lineLimit(3...6)
                    TextField("Registreringsnummer", text: $registrationNumber)
                    TextField("Chipnummer", text: $microchipNumber)
                }
            }
            .navigationTitle(horse == nil ? "Ny häst" : "Redigera häst")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Spara") {
                        isSaving = true
                        Task {
                            let success: Bool
                            let trimmedName = name.trimmingCharacters(in: .whitespaces)
                            let birthYear = Int(birthYearText)
                            let breedVal = breed.isEmpty ? nil : breed
                            let colorVal = color.isEmpty ? nil : color
                            let genderVal = gender.isEmpty ? nil : gender
                            let needsVal = specialNeeds.isEmpty ? nil : specialNeeds
                            let regVal = registrationNumber.isEmpty ? nil : registrationNumber
                            let chipVal = microchipNumber.isEmpty ? nil : microchipNumber

                            if let horse {
                                success = await viewModel.updateHorse(
                                    customerId: customerId, horseId: horse.id,
                                    name: trimmedName, breed: breedVal, birthYear: birthYear,
                                    color: colorVal, gender: genderVal, specialNeeds: needsVal,
                                    registrationNumber: regVal, microchipNumber: chipVal
                                )
                            } else {
                                success = await viewModel.createHorse(
                                    customerId: customerId, name: trimmedName,
                                    breed: breedVal, birthYear: birthYear,
                                    color: colorVal, gender: genderVal, specialNeeds: needsVal,
                                    registrationNumber: regVal, microchipNumber: chipVal
                                )
                            }
                            isSaving = false
                            if success { dismiss() }
                        }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
        }
    }
}

// MARK: - Note Form Sheet

private struct NoteFormSheet: View {
    let customerId: String
    let note: CustomerNote?
    @Bindable var viewModel: CustomersViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var content: String
    @State private var isSaving = false

    init(customerId: String, note: CustomerNote?, viewModel: CustomersViewModel) {
        self.customerId = customerId
        self.note = note
        self.viewModel = viewModel
        _content = State(initialValue: note?.content ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextEditor(text: $content)
                        .frame(minHeight: 120)
                } header: {
                    Text("Anteckning")
                }
            }
            .navigationTitle(note == nil ? "Ny anteckning" : "Redigera anteckning")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Spara") {
                        isSaving = true
                        Task {
                            let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
                            let success: Bool
                            if let note {
                                success = await viewModel.updateNote(
                                    customerId: customerId,
                                    noteId: note.id,
                                    content: trimmed
                                )
                            } else {
                                success = await viewModel.createNote(
                                    customerId: customerId,
                                    content: trimmed
                                )
                            }
                            isSaving = false
                            if success { dismiss() }
                        }
                    }
                    .disabled(content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
                }
            }
        }
    }
}
#endif
