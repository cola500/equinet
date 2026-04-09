//
//  AnnouncementFormSheet.swift
//  Equinet
//
//  Create announcement form: multi-select services, municipality, date range.
//

#if os(iOS)
import SwiftUI
import OSLog

struct AnnouncementFormSheet: View {
    @Bindable var viewModel: AnnouncementsViewModel
    let services: [ServiceItem]
    @Environment(\.dismiss) private var dismiss

    @State private var selectedServiceIds: Set<String> = []
    @State private var municipality = ""
    @State private var municipalitySearch = ""
    @State private var dateFrom = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
    @State private var dateTo = Calendar.current.date(byAdding: .day, value: 7, to: Date()) ?? Date()
    @State private var specialInstructions = ""
    @State private var showMunicipalityPicker = false
    @State private var validationError: String?

    private var filteredMunicipalities: [String] {
        searchMunicipalities(municipalitySearch)
    }

    private var isValid: Bool {
        !selectedServiceIds.isEmpty && !municipality.isEmpty && dateTo >= dateFrom
    }

    var body: some View {
        NavigationStack {
            Form {
                // Services multi-select
                Section("Tjänster") {
                    if services.isEmpty {
                        Text("Inga aktiva tjänster")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(services) { service in
                            Button {
                                if selectedServiceIds.contains(service.id) {
                                    selectedServiceIds.remove(service.id)
                                } else {
                                    selectedServiceIds.insert(service.id)
                                }
                            } label: {
                                HStack {
                                    Text(service.name)
                                        .foregroundStyle(.primary)
                                    Spacer()
                                    Text("\(Int(service.price)) kr")
                                        .foregroundStyle(.secondary)
                                        .font(.subheadline)
                                    if selectedServiceIds.contains(service.id) {
                                        Image(systemName: "checkmark")
                                            .foregroundStyle(Color.equinetGreen)
                                    }
                                }
                            }
                        }
                    }
                    if selectedServiceIds.isEmpty {
                        Text("Välj minst en tjänst")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }

                // Municipality
                Section("Kommun") {
                    if municipality.isEmpty {
                        TextField("Sök kommun...", text: $municipalitySearch)
                            .autocorrectionDisabled()
                        if !municipalitySearch.isEmpty {
                            ForEach(filteredMunicipalities.prefix(8), id: \.self) { name in
                                Button(name) {
                                    municipality = name
                                    municipalitySearch = ""
                                }
                            }
                        }
                    } else {
                        HStack {
                            Text(municipality)
                            Spacer()
                            Button("Ändra") {
                                municipality = ""
                            }
                            .font(.caption)
                        }
                    }
                }

                // Date range
                Section("Datumintervall") {
                    DatePicker("Från", selection: $dateFrom, in: Date()..., displayedComponents: .date)
                    DatePicker("Till", selection: $dateTo, in: dateFrom..., displayedComponents: .date)

                    let daysDiff = Calendar.current.dateComponents([.day], from: dateFrom, to: dateTo).day ?? 0
                    if daysDiff > 14 {
                        Text("Max 14 dagar")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }

                // Special instructions
                Section("Instruktioner (valfritt)") {
                    TextField("T.ex. parkering, portkod...", text: $specialInstructions, axis: .vertical)
                        .lineLimit(3...6)
                }

                if let error = validationError {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("Ny annons")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Publicera") {
                        Task { await createAnnouncement() }
                    }
                    .disabled(!isValid || viewModel.actionInProgress)
                }
            }
        }
    }

    private func createAnnouncement() async {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        let request = CreateAnnouncementRequest(
            serviceIds: Array(selectedServiceIds),
            dateFrom: formatter.string(from: dateFrom),
            dateTo: formatter.string(from: dateTo),
            municipality: municipality,
            specialInstructions: specialInstructions.isEmpty ? nil : specialInstructions
        )

        let success = await viewModel.createAnnouncement(request)
        if success {
            dismiss()
        } else {
            validationError = "Kunde inte skapa annons. Försök igen."
        }
    }
}
#endif
