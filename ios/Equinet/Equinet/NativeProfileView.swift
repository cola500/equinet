//
//  NativeProfileView.swift
//  Equinet
//
//  Native SwiftUI provider profile view with two tabs: Profil + Inställningar.
//  Uses Segmented Picker (not TabView) to avoid swipe conflicts.
//  Does NOT own a NavigationStack -- uses NativeMoreView's stack.
//

#if os(iOS)
import SwiftUI
import OSLog

struct NativeProfileView: View {
    @Bindable var viewModel: ProfileViewModel
    let featureFlags: [String: Bool]
    var onNavigateToWebPath: ((String) -> Void)?

    @State private var selectedTab = 0
    @State private var showEditSheet = false
    // Delete account offloaded to WebView (session auth required)

    var body: some View {
        VStack(spacing: 0) {
            Picker("Sektion", selection: $selectedTab) {
                Text("Profil").tag(0)
                Text("Inställningar").tag(1)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.vertical, 8)

            switch selectedTab {
            case 0:
                profileTab
            default:
                settingsTab
            }
        }
        .navigationTitle("Min profil")
        .task {
            await viewModel.loadProfile()
        }
        .refreshable {
            await viewModel.loadProfile()
        }
        .sheet(isPresented: $showEditSheet) {
            if let profile = viewModel.profile {
                ProfileFormSheet(
                    profile: profile,
                    isSaving: viewModel.isSaving,
                    onSavePersonal: { firstName, lastName, phone in
                        Task {
                            let ok = await viewModel.updatePersonalInfo(
                                firstName: firstName,
                                lastName: lastName,
                                phone: phone
                            )
                            if ok { showEditSheet = false }
                        }
                    },
                    onSaveBusiness: { name, desc, address, city, postalCode, area, lat, lng, areaKm in
                        Task {
                            let ok = await viewModel.updateBusinessInfo(
                                businessName: name,
                                description: desc,
                                address: address,
                                city: city,
                                postalCode: postalCode,
                                serviceArea: area,
                                latitude: lat,
                                longitude: lng,
                                serviceAreaKm: areaKm
                            )
                            if ok { showEditSheet = false }
                        }
                    }
                )
            }
        }
        // Delete account offloaded to WebView (session auth, not Bearer JWT)
    }

    // MARK: - Profile Tab

    @ViewBuilder
    private var profileTab: some View {
        if viewModel.isLoading {
            VStack { Spacer(); ProgressView("Laddar profil..."); Spacer() }
        } else if let error = viewModel.error {
            errorView(error)
        } else if let profile = viewModel.profile {
            ScrollView {
                VStack(spacing: 16) {
                    completionCard(profile)
                    profileImageSection(profile)
                    personalInfoSection(profile)
                    businessInfoSection(profile)
                    linksSection
                }
                .padding()
            }
        }
    }

    // MARK: - Completion Card

    @ViewBuilder
    private func completionCard(_ profile: ProviderProfile) -> some View {
        if profile.profileCompletion < 100 {
            HStack(spacing: 12) {
                Image(systemName: "exclamationmark.circle")
                    .font(.title3)
                    .foregroundStyle(.orange)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Profilen är \(profile.profileCompletion)% klar")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    Text("Fyll i fler uppgifter för att synas bättre.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Button("Redigera") {
                    showEditSheet = true
                }
                .font(.subheadline)
                .fontWeight(.medium)
            }
            .padding()
            .background(Color.orange.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    // MARK: - Profile Image

    private func profileImageSection(_ profile: ProviderProfile) -> some View {
        VStack(spacing: 8) {
            if let imageUrl = profile.profileImageUrl, let url = URL(string: imageUrl) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .scaledToFill()
                } placeholder: {
                    Circle()
                        .fill(Color.gray.opacity(0.2))
                        .overlay(
                            Image(systemName: "person.fill")
                                .font(.system(size: 32))
                                .foregroundStyle(.secondary)
                        )
                }
                .frame(width: 80, height: 80)
                .clipShape(Circle())
            } else {
                Circle()
                    .fill(Color.gray.opacity(0.2))
                    .frame(width: 80, height: 80)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.system(size: 32))
                            .foregroundStyle(.secondary)
                    )
            }

            if profile.isVerified {
                Label("Verifierad", systemImage: "checkmark.seal.fill")
                    .font(.caption)
                    .foregroundStyle(.green)
            }
        }
    }

    // MARK: - Personal Info

    private func personalInfoSection(_ profile: ProviderProfile) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Personlig information")
                    .font(.headline)
                Spacer()
                Button("Redigera") { showEditSheet = true }
                    .font(.subheadline)
            }

            infoRow(label: "Namn", value: "\(profile.user.firstName) \(profile.user.lastName)")
            infoRow(label: "E-post", value: profile.user.email)
            infoRow(label: "Telefon", value: profile.user.phone ?? "Ej angivet")
        }
        .padding()
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Business Info

    private func businessInfoSection(_ profile: ProviderProfile) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Företagsinformation")
                    .font(.headline)
                Spacer()
                Button("Redigera") { showEditSheet = true }
                    .font(.subheadline)
            }

            infoRow(label: "Företag", value: profile.businessName)
            infoRow(label: "Beskrivning", value: profile.description ?? "Ej angivet")
            infoRow(label: "Adress", value: profile.address ?? "Ej angivet")
            infoRow(label: "Stad", value: profile.city ?? "Ej angivet")
            infoRow(label: "Postnummer", value: profile.postalCode ?? "Ej angivet")
            if let km = profile.serviceAreaKm {
                infoRow(label: "Serviceområde", value: "\(Int(km)) km")
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Links Section

    private var linksSection: some View {
        VStack(spacing: 0) {
            linkRow(title: "Verifiering", icon: "checkmark.shield", path: "/provider/profile?tab=settings")
            Divider().padding(.leading, 44)
            linkRow(title: "Exportera data", icon: "square.and.arrow.up", path: "/provider/profile?tab=settings")
        }
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func linkRow(title: String, icon: String, path: String) -> some View {
        Button {
            onNavigateToWebPath?(path)
        } label: {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .frame(width: 24)
                    .foregroundStyle(.primary)
                Text(title)
                    .foregroundStyle(.primary)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal)
            .padding(.vertical, 12)
            .frame(minHeight: 44)
        }
    }

    // MARK: - Settings Tab

    @ViewBuilder
    private var settingsTab: some View {
        if let profile = viewModel.profile {
            List {
                bookingSettingsSection(profile)

                if featureFlags["self_reschedule"] ?? false {
                    rescheduleSection(profile)
                }

                if featureFlags["recurring_bookings"] ?? false {
                    recurringSection(profile)
                }

                availabilitySection

                dangerZoneSection
            }
        } else if viewModel.isLoading {
            VStack { Spacer(); ProgressView(); Spacer() }
        }
    }

    // MARK: - Booking Settings

    private func bookingSettingsSection(_ profile: ProviderProfile) -> some View {
        Section("Bokningsinställningar") {
            Toggle("Tar emot nya kunder", isOn: Binding(
                get: { profile.acceptingNewCustomers },
                set: { newValue in
                    Task { _ = await viewModel.updateSettings(["acceptingNewCustomers": newValue]) }
                }
            ))
        }
    }

    // MARK: - Reschedule Settings

    private func rescheduleSection(_ profile: ProviderProfile) -> some View {
        Section("Ombokning") {
            Toggle("Tillåt ombokning", isOn: Binding(
                get: { profile.rescheduleEnabled },
                set: { newValue in
                    Task { _ = await viewModel.updateSettings(["rescheduleEnabled": newValue]) }
                }
            ))

            if profile.rescheduleEnabled {
                Picker("Minsta framförhållning", selection: Binding(
                    get: { profile.rescheduleWindowHours },
                    set: { newValue in
                        Task { _ = await viewModel.updateSettings(["rescheduleWindowHours": newValue]) }
                    }
                )) {
                    Text("12 timmar").tag(12)
                    Text("24 timmar").tag(24)
                    Text("48 timmar").tag(48)
                    Text("72 timmar").tag(72)
                }

                Picker("Max ombokningsmöjligheter", selection: Binding(
                    get: { profile.maxReschedules },
                    set: { newValue in
                        Task { _ = await viewModel.updateSettings(["maxReschedules": newValue]) }
                    }
                )) {
                    ForEach(1...5, id: \.self) { n in
                        Text("\(n)").tag(n)
                    }
                }

                Toggle("Kräv godkännande", isOn: Binding(
                    get: { profile.rescheduleRequiresApproval },
                    set: { newValue in
                        Task { _ = await viewModel.updateSettings(["rescheduleRequiresApproval": newValue]) }
                    }
                ))
            }
        }
    }

    // MARK: - Recurring Settings

    private func recurringSection(_ profile: ProviderProfile) -> some View {
        Section("Återkommande bokningar") {
            Toggle("Tillåt återkommande bokningar", isOn: Binding(
                get: { profile.recurringEnabled },
                set: { newValue in
                    Task { _ = await viewModel.updateSettings(["recurringEnabled": newValue]) }
                }
            ))

            if profile.recurringEnabled {
                Picker("Max bokningar per serie", selection: Binding(
                    get: { profile.maxSeriesOccurrences },
                    set: { newValue in
                        Task { _ = await viewModel.updateSettings(["maxSeriesOccurrences": newValue]) }
                    }
                )) {
                    ForEach([4, 6, 8, 12, 24, 52], id: \.self) { n in
                        Text("\(n)").tag(n)
                    }
                }
            }
        }
    }

    // MARK: - Availability

    private var availabilitySection: some View {
        Section("Tillgänglighet") {
            Button {
                onNavigateToWebPath?("/provider/profile?tab=availability")
            } label: {
                HStack {
                    Label("Redigera tillgänglighetsschema", systemImage: "calendar.badge.clock")
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .foregroundStyle(.primary)
        }
    }

    // MARK: - Danger Zone

    private var dangerZoneSection: some View {
        Section {
            Button(role: .destructive) {
                // Offload to WebView -- /api/account uses session auth, not Bearer JWT
                onNavigateToWebPath?("/provider/profile?tab=settings")
            } label: {
                Label("Radera konto", systemImage: "trash")
            }
        } footer: {
            Text("Permanent borttagning av ditt konto och all data.")
        }
    }

    // MARK: - Helpers

    private func infoRow(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.body)
        }
    }

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
                Task { await viewModel.loadProfile() }
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
