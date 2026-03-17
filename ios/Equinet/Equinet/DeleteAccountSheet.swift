//
//  DeleteAccountSheet.swift
//  Equinet
//
//  Confirmation sheet for account deletion (GDPR Art. 17).
//  Requires password + typing "RADERA" to confirm.
//

#if os(iOS)
import SwiftUI

struct DeleteAccountSheet: View {
    let onConfirm: (_ password: String, _ confirmation: String) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var password: String = ""
    @State private var confirmationText: String = ""

    private var canDelete: Bool {
        !password.isEmpty && confirmationText == "RADERA"
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.title)
                            .foregroundStyle(.red)

                        Text("Radera konto permanent")
                            .font(.headline)

                        Text("Denna åtgärd kan inte ångras. All din data, bokningar och kundrelationer raderas permanent.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }

                Section("Bekräfta med lösenord") {
                    SecureField("Lösenord", text: $password)
                        .textContentType(.password)
                }

                Section {
                    TextField("Skriv RADERA", text: $confirmationText)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.characters)
                } header: {
                    Text("Skriv \"RADERA\" för att bekräfta")
                }

                Section {
                    Button(role: .destructive) {
                        onConfirm(password, confirmationText)
                    } label: {
                        HStack {
                            Spacer()
                            Text("Radera mitt konto")
                                .fontWeight(.semibold)
                            Spacer()
                        }
                    }
                    .disabled(!canDelete)
                }
            }
            .navigationTitle("Radera konto")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
#endif
