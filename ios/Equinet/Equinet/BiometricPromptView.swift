//
//  BiometricPromptView.swift
//  Equinet
//
//  Prompts the user for Face ID / Touch ID to unlock the app.
//  Shown when a valid mobile token exists in Keychain.
//

import SwiftUI

struct BiometricPromptView: View {
    let authManager: AuthManager

    // Equinet brand green
    private let brandGreen = Color(red: 0.16, green: 0.65, blue: 0.47)

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            // Logo
            VStack(spacing: 12) {
                Image(systemName: "figure.equestrian.sports")
                    .font(.system(size: 48))
                    .foregroundStyle(brandGreen)

                Text("Equinet")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundStyle(brandGreen)
            }

            // Biometric button
            Button {
                Task { await authManager.authenticateWithBiometric() }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: authManager.biometryIconName)
                        .font(.title3)
                    Text("Logga in med \(authManager.biometryTypeName)")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(brandGreen)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, 32)
            .accessibilityLabel("Logga in med \(authManager.biometryTypeName)")

            // Fallback to password
            Button {
                authManager.logout()
            } label: {
                Text("Logga in med lösenord")
                    .font(.subheadline)
                    .foregroundStyle(brandGreen)
            }
            .accessibilityLabel("Logga in med lösenord istället")

            Spacer()
        }
        .task {
            // Auto-trigger biometric on appear (small delay for animation)
            try? await Task.sleep(for: .milliseconds(500))
            await authManager.authenticateWithBiometric()
        }
    }
}

#Preview {
    BiometricPromptView(authManager: AuthManager())
}
