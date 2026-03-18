//
//  ServiceFormSheet.swift
//  Equinet
//
//  Form sheet for creating/editing a service.
//  Two sections: Grundinformation + Inställningar.
//

#if os(iOS)
import SwiftUI

struct ServiceFormSheet: View {
    let service: ServiceItem?
    let onSave: (
        _ name: String,
        _ description: String?,
        _ price: Double,
        _ durationMinutes: Int,
        _ isActive: Bool,
        _ recommendedIntervalWeeks: Int?
    ) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var name: String = ""
    @State private var descriptionText: String = ""
    @State private var priceText: String = ""
    @State private var selectedDuration: Int = 60
    @State private var isActive: Bool = true
    @State private var selectedInterval: Int = 0  // 0 = ingen
    @FocusState private var isTextFieldFocused: Bool

    private var isEditing: Bool { service != nil }

    private static let durationOptions = [15, 30, 45, 60, 75, 90, 120]

    private static let intervalOptions: [(label: String, value: Int)] = [
        ("Ingen påminnelse", 0),
        ("Var 4:e vecka", 4),
        ("Var 6:e vecka", 6),
        ("Var 8:e vecka", 8),
        ("Var 12:e vecka", 12),
        ("Var 26:e vecka", 26),
        ("Varje år", 52),
    ]

    init(service: ServiceItem?, onSave: @escaping (String, String?, Double, Int, Bool, Int?) -> Void) {
        self.service = service
        self.onSave = onSave
        if let s = service {
            _name = State(initialValue: s.name)
            _descriptionText = State(initialValue: s.description ?? "")
            _priceText = State(initialValue: s.price.truncatingRemainder(dividingBy: 1) == 0
                ? String(Int(s.price))
                : String(s.price))
            _selectedDuration = State(initialValue: s.durationMinutes)
            _isActive = State(initialValue: s.isActive)
            _selectedInterval = State(initialValue: s.recommendedIntervalWeeks ?? 0)
        }
    }

    private var parsedPrice: Double? {
        let normalized = priceText.replacingOccurrences(of: ",", with: ".")
        return Double(normalized)
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && parsedPrice != nil && parsedPrice! > 0
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Grundinformation") {
                    TextField("Namn", text: $name)
                        .textContentType(.name)
                        .focused($isTextFieldFocused)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Beskrivning")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        TextEditor(text: $descriptionText)
                            .frame(minHeight: 60)
                    }

                    HStack {
                        Text("Pris (kr)")
                        Spacer()
                        TextField("0", text: $priceText)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 120)
                            .focused($isTextFieldFocused)
                    }

                    Picker("Varaktighet", selection: $selectedDuration) {
                        ForEach(Self.durationOptions, id: \.self) { mins in
                            Text(durationLabel(mins)).tag(mins)
                        }
                    }
                }

                Section("Inställningar") {
                    Picker("Rekommenderat intervall", selection: $selectedInterval) {
                        ForEach(Self.intervalOptions, id: \.value) { option in
                            Text(option.label).tag(option.value)
                        }
                    }

                    Toggle("Aktiv", isOn: $isActive)
                }
            }
            .navigationTitle(isEditing ? "Redigera tjänst" : "Ny tjänst")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Spara") {
                        guard let price = parsedPrice else { return }
                        let desc = descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
                        onSave(
                            name.trimmingCharacters(in: .whitespaces),
                            desc.isEmpty ? nil : desc,
                            price,
                            selectedDuration,
                            isActive,
                            selectedInterval > 0 ? selectedInterval : nil
                        )
                    }
                    .disabled(!canSave)
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Klar") {
                        isTextFieldFocused = false
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func durationLabel(_ minutes: Int) -> String {
        let h = minutes / 60
        let m = minutes % 60
        if h > 0 && m > 0 { return "\(h) h \(m) min" }
        if h > 0 { return "\(h) h" }
        return "\(m) min"
    }
}
#endif
