//
//  ProfileFormSheet.swift
//  Equinet
//
//  Form sheet for editing provider profile.
//  Two sections: Personlig information + Företagsinformation.
//

#if os(iOS)
import SwiftUI

struct ProfileFormSheet: View {
    let profile: ProviderProfile
    let isSaving: Bool
    let onSavePersonal: (_ firstName: String, _ lastName: String, _ phone: String?) -> Void
    let onSaveBusiness: (
        _ businessName: String,
        _ description: String?,
        _ address: String?,
        _ city: String?,
        _ postalCode: String?,
        _ serviceArea: String?,
        _ latitude: Double?,
        _ longitude: Double?,
        _ serviceAreaKm: Double?
    ) -> Void

    @Environment(\.dismiss) private var dismiss

    // Personal
    @State private var firstName: String = ""
    @State private var lastName: String = ""
    @State private var phone: String = ""

    // Business
    @State private var businessName: String = ""
    @State private var descriptionText: String = ""
    @State private var address: String = ""
    @State private var city: String = ""
    @State private var postalCode: String = ""
    @State private var serviceArea: String = ""
    @State private var serviceAreaKmText: String = ""

    @State private var selectedSection = 0

    init(
        profile: ProviderProfile,
        isSaving: Bool,
        onSavePersonal: @escaping (String, String, String?) -> Void,
        onSaveBusiness: @escaping (String, String?, String?, String?, String?, String?, Double?, Double?, Double?) -> Void
    ) {
        self.profile = profile
        self.isSaving = isSaving
        self.onSavePersonal = onSavePersonal
        self.onSaveBusiness = onSaveBusiness

        _firstName = State(initialValue: profile.user.firstName)
        _lastName = State(initialValue: profile.user.lastName)
        _phone = State(initialValue: profile.user.phone ?? "")
        _businessName = State(initialValue: profile.businessName)
        _descriptionText = State(initialValue: profile.description ?? "")
        _address = State(initialValue: profile.address ?? "")
        _city = State(initialValue: profile.city ?? "")
        _postalCode = State(initialValue: profile.postalCode ?? "")
        _serviceArea = State(initialValue: profile.serviceArea ?? "")
        _serviceAreaKmText = State(initialValue: profile.serviceAreaKm.map { String(Int($0)) } ?? "")
    }

    private var canSavePersonal: Bool {
        !firstName.trimmingCharacters(in: .whitespaces).isEmpty &&
        !lastName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var canSaveBusiness: Bool {
        !businessName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Sektion", selection: $selectedSection) {
                    Text("Personligt").tag(0)
                    Text("Företag").tag(1)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.vertical, 8)

                Form {
                    if selectedSection == 0 {
                        personalSection
                    } else {
                        businessSection
                    }
                }
            }
            .navigationTitle("Redigera profil")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Spara") {
                        save()
                    }
                    .disabled(selectedSection == 0 ? !canSavePersonal : !canSaveBusiness)
                    .disabled(isSaving)
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Klar") {
                        UIApplication.shared.sendAction(
                            #selector(UIResponder.resignFirstResponder),
                            to: nil, from: nil, for: nil
                        )
                    }
                }
            }
            .overlay {
                if isSaving {
                    Color.black.opacity(0.1)
                        .ignoresSafeArea()
                        .overlay(ProgressView())
                }
            }
        }
        .presentationDetents([.medium, .large])
        .interactiveDismissDisabled(isSaving)
    }

    // MARK: - Personal Section

    private var personalSection: some View {
        Section("Personlig information") {
            TextField("Förnamn", text: $firstName)
                .textContentType(.givenName)

            TextField("Efternamn", text: $lastName)
                .textContentType(.familyName)

            TextField("Telefon", text: $phone)
                .textContentType(.telephoneNumber)
                .keyboardType(.phonePad)
        }
    }

    // MARK: - Business Section

    private var businessSection: some View {
        Group {
            Section("Företagsinformation") {
                TextField("Företagsnamn", text: $businessName)
                    .textContentType(.organizationName)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Beskrivning")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    TextEditor(text: $descriptionText)
                        .frame(minHeight: 60)
                }
            }

            Section("Adress") {
                TextField("Gatuadress", text: $address)
                    .textContentType(.streetAddressLine1)

                TextField("Stad", text: $city)
                    .textContentType(.addressCity)

                TextField("Postnummer", text: $postalCode)
                    .textContentType(.postalCode)
                    .keyboardType(.numberPad)
            }

            Section("Serviceområde") {
                TextField("Område", text: $serviceArea)

                HStack {
                    Text("Max avstånd (km)")
                    Spacer()
                    TextField("50", text: $serviceAreaKmText)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 80)
                }
            }
        }
    }

    // MARK: - Save

    private func save() {
        if selectedSection == 0 {
            let trimmedPhone = phone.trimmingCharacters(in: .whitespaces)
            onSavePersonal(
                firstName.trimmingCharacters(in: .whitespaces),
                lastName.trimmingCharacters(in: .whitespaces),
                trimmedPhone.isEmpty ? nil : trimmedPhone
            )
        } else {
            let desc = descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
            let addr = address.trimmingCharacters(in: .whitespaces)
            let c = city.trimmingCharacters(in: .whitespaces)
            let pc = postalCode.trimmingCharacters(in: .whitespaces)
            let area = serviceArea.trimmingCharacters(in: .whitespaces)
            let km = Double(serviceAreaKmText)

            onSaveBusiness(
                businessName.trimmingCharacters(in: .whitespaces),
                desc.isEmpty ? nil : desc,
                addr.isEmpty ? nil : addr,
                c.isEmpty ? nil : c,
                pc.isEmpty ? nil : pc,
                area.isEmpty ? nil : area,
                profile.latitude,
                profile.longitude,
                km
            )
        }
    }
}
#endif
