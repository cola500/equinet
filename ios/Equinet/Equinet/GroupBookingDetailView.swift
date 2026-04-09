//
//  GroupBookingDetailView.swift
//  Equinet
//
//  Group booking request detail with participants and match action.
//

#if os(iOS)
import SwiftUI

struct GroupBookingDetailView: View {
    let requestId: String
    @State private var viewModel = GroupBookingsViewModel()
    @Bindable var servicesViewModel: ServicesViewModel
    @State private var showMatchSheet = false

    var body: some View {
        Group {
            if viewModel.isLoadingDetail {
                ProgressView("Laddar...")
            } else if let detail = viewModel.detail {
                detailContent(detail)
            } else {
                ContentUnavailableView(
                    "Kunde inte ladda",
                    systemImage: "exclamationmark.triangle",
                    description: Text("Försök igen senare.")
                )
            }
        }
        .navigationTitle("Grupprequest")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadDetail(id: requestId)
        }
        .refreshable {
            await viewModel.loadDetail(id: requestId)
        }
        .sheet(isPresented: $showMatchSheet) {
            if let detail = viewModel.detail {
                GroupBookingMatchSheet(
                    request: detail,
                    viewModel: viewModel,
                    services: servicesViewModel.services
                )
            }
        }
    }

    @ViewBuilder
    private func detailContent(_ request: GroupBookingRequest) -> some View {
        List {
            // Request info
            Section("Förfrågan") {
                LabeledContent("Tjänst", value: request.serviceType)
                LabeledContent("Plats", value: request.locationName)
                LabeledContent("Adress", value: request.address)
                LabeledContent("Datum", value: request.dateRangeLabel)
                LabeledContent("Max deltagare", value: "\(request.maxParticipants)")
                LabeledContent("Status", value: request.statusLabel)
                if let notes = request.notes, !notes.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Anteckningar")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(notes)
                    }
                }
            }

            // Participants
            if let participants = request.participants, !participants.isEmpty {
                Section("Deltagare (\(participants.count))") {
                    ForEach(participants) { participant in
                        participantRow(participant)
                    }
                }
            }

            // Match action
            if request.isOpen {
                Section {
                    Button {
                        showMatchSheet = true
                    } label: {
                        Label("Matcha och skapa bokningar", systemImage: "checkmark.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.equinetGreen)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
            }

            // Match result
            if let result = viewModel.matchResult {
                Section("Resultat") {
                    Label(result.message, systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                    if !result.errors.isEmpty {
                        ForEach(result.errors, id: \.self) { error in
                            Label(error, systemImage: "exclamationmark.triangle")
                                .foregroundStyle(.orange)
                        }
                    }
                }
            }
        }
    }

    private func participantRow(_ participant: GroupBookingParticipant) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(participant.displayName)
                    .font(.body)
                    .fontWeight(.medium)
                Spacer()
                Text(participant.status == "joined" ? "Ansluten" : participant.status == "booked" ? "Bokad" : participant.status)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 12) {
                Label("\(participant.numberOfHorses) häst\(participant.numberOfHorses > 1 ? "ar" : "")", systemImage: "pawprint")
                if let horseName = participant.horseName, !horseName.isEmpty {
                    Text(horseName)
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            if let notes = participant.notes, !notes.isEmpty {
                Text(notes)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .italic()
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Match Sheet

struct GroupBookingMatchSheet: View {
    let request: GroupBookingRequest
    @Bindable var viewModel: GroupBookingsViewModel
    let services: [ServiceItem]
    @Environment(\.dismiss) private var dismiss

    @State private var selectedServiceId: String?
    @State private var bookingDate = Date()
    @State private var startTime = Date()

    private var selectedService: ServiceItem? {
        guard let id = selectedServiceId else { return nil }
        return services.first { $0.id == id }
    }

    private var dateFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }

    private var timeFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f
    }

    private var participantCount: Int {
        request.participants?.filter { $0.status == "joined" }.count ?? 0
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Tjänst") {
                    Picker("Välj tjänst", selection: $selectedServiceId) {
                        Text("Välj...").tag(nil as String?)
                        ForEach(services) { service in
                            Text("\(service.name) (\(Int(service.price)) kr, \(service.durationMinutes) min)")
                                .tag(service.id as String?)
                        }
                    }
                }

                Section("Datum och tid") {
                    DatePicker("Datum", selection: $bookingDate, displayedComponents: .date)
                    DatePicker("Starttid", selection: $startTime, displayedComponents: .hourAndMinute)
                }

                // Time slot preview
                if let service = selectedService {
                    Section("Tidsschema (\(participantCount) bokningar)") {
                        ForEach(0..<participantCount, id: \.self) { index in
                            let startMinutes = Calendar.current.component(.hour, from: startTime) * 60 +
                                Calendar.current.component(.minute, from: startTime) +
                                (index * service.durationMinutes)
                            let endMinutes = startMinutes + service.durationMinutes
                            let participant = request.participants?.filter({ $0.status == "joined" })[safe: index]

                            HStack {
                                Text(formatMinutes(startMinutes))
                                Text("–")
                                Text(formatMinutes(endMinutes))
                                Spacer()
                                Text(participant?.displayName ?? "Deltagare \(index + 1)")
                                    .foregroundStyle(.secondary)
                            }
                            .font(.subheadline)
                        }
                    }
                }
            }
            .navigationTitle("Matcha grupprequest")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Skapa bokningar") {
                        Task { await performMatch() }
                    }
                    .disabled(selectedServiceId == nil || viewModel.isMatching)
                }
            }
        }
    }

    private func performMatch() async {
        guard let serviceId = selectedServiceId else { return }

        let success = await viewModel.match(
            id: request.id,
            serviceId: serviceId,
            bookingDate: dateFormatter.string(from: bookingDate),
            startTime: timeFormatter.string(from: startTime)
        )

        if success {
            dismiss()
        }
    }

    private func formatMinutes(_ totalMinutes: Int) -> String {
        let h = totalMinutes / 60
        let m = totalMinutes % 60
        return String(format: "%02d:%02d", h, m)
    }
}

// MARK: - Safe Array Subscript

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
#endif
