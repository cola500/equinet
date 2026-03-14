//
//  NativeLoginView.swift
//  Equinet
//
//  Native SwiftUI login screen. Replaces WebView login for faster startup.
//

import SwiftUI

struct NativeLoginView: View {
    let authManager: AuthManager

    @State private var email = ""
    @State private var password = ""
    @FocusState private var focusedField: Field?

    private enum Field {
        case email, password
    }

    // Equinet brand green
    private let brandGreen = Color(red: 0.16, green: 0.65, blue: 0.47)

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Spacer()
                    .frame(height: 40)

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
                .padding(.bottom, 24)

                // Form
                VStack(spacing: 16) {
                    // Email
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Email")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundStyle(.secondary)

                        TextField("din@email.se", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focusedField, equals: .email)
                            .padding(12)
                            .background(Color(.systemGray6))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .accessibilityLabel("Email")
                            .accessibilityIdentifier("emailField")
                    }

                    // Password
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Lösenord")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundStyle(.secondary)

                        SecureField("Ange lösenord", text: $password)
                            .textContentType(.password)
                            .focused($focusedField, equals: .password)
                            .padding(12)
                            .background(Color(.systemGray6))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .accessibilityLabel("Lösenord")
                            .accessibilityIdentifier("passwordField")
                    }
                }

                // Error message
                if let error = authManager.loginError {
                    Text(error)
                        .font(.subheadline)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                        .accessibilityLabel("Felmeddelande: \(error)")
                }

                // Login button
                Button {
                    focusedField = nil
                    Task { await authManager.login(email: email, password: password) }
                } label: {
                    if authManager.isLoggingIn {
                        ProgressView()
                            .tint(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                    } else {
                        Text("Logga in")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(brandGreen)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .disabled(email.isEmpty || password.isEmpty || authManager.isLoggingIn)
                .accessibilityLabel("Logga in")

                // Forgot password link
                Button {
                    openForgotPassword()
                } label: {
                    Text("Glömt lösenord?")
                        .font(.subheadline)
                        .foregroundStyle(brandGreen)
                }
                .accessibilityLabel("Glömt lösenord")

                Spacer()
            }
            .padding(.horizontal, 32)
        }
        .onSubmit {
            switch focusedField {
            case .email:
                focusedField = .password
            case .password:
                if !email.isEmpty && !password.isEmpty {
                    Task { await authManager.login(email: email, password: password) }
                }
            case .none:
                break
            }
        }
    }

    private func openForgotPassword() {
        let url = AppConfig.baseURL.appendingPathComponent("forgot-password")
        UIApplication.shared.open(url)
    }
}

#Preview {
    NativeLoginView(authManager: .createDefault())
}
