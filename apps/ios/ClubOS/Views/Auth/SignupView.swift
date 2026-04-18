import SwiftUI

struct SignupView: View {
    @Environment(AuthViewModel.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var fullName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var hasEditedName = false
    @State private var hasEditedEmail = false
    @State private var hasEditedPassword = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Branding
                VStack(spacing: 12) {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.club.primary)
                        .frame(width: 44, height: 44)
                        .overlay {
                            Image(systemName: "diamond.fill")
                                .font(.system(size: 16))
                                .foregroundStyle(.white)
                        }

                    Text("CLUB OS")
                        .font(.system(size: 13, weight: .semibold))
                        .tracking(4)
                        .foregroundStyle(Color.club.onSurfaceVariant)

                    Rectangle()
                        .fill(Color.club.outlineVariant)
                        .frame(width: 40, height: 1)
                }
                .padding(.bottom, 40)

                Text("Create Account")
                    .font(.clubHeadline)
                    .foregroundStyle(Color.club.foreground)
                    .padding(.bottom, 8)

                Text("Sign up to get started with ClubOS.")
                    .font(.clubCaption)
                    .foregroundStyle(Color.club.onSurfaceVariant)
                    .padding(.bottom, 32)

                // Form
                VStack(spacing: 20) {
                    VStack(alignment: .leading, spacing: 0) {
                        fieldGroup(label: "FULL NAME", icon: "person", placeholder: "John Smith") {
                            TextField("John Smith", text: $fullName)
                                .textContentType(.name)
                                .onChange(of: fullName) { _, _ in hasEditedName = true }
                        }
                        if hasEditedName, let msg = nameValidation.message {
                            Text(msg)
                                .font(.system(size: 12))
                                .foregroundStyle(.red.opacity(0.8))
                                .padding(.leading, 4)
                                .padding(.top, 4)
                        }
                    }

                    VStack(alignment: .leading, spacing: 0) {
                        fieldGroup(label: "EMAIL ADDRESS", icon: "envelope", placeholder: "name@example.com") {
                            TextField("name@example.com", text: $email)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .onChange(of: email) { _, _ in hasEditedEmail = true }
                        }
                        if hasEditedEmail, let msg = emailValidation.message {
                            Text(msg)
                                .font(.system(size: 12))
                                .foregroundStyle(.red.opacity(0.8))
                                .padding(.leading, 4)
                                .padding(.top, 4)
                        }
                    }

                    VStack(alignment: .leading, spacing: 0) {
                        fieldGroup(label: "PASSWORD", icon: "lock", placeholder: "••••••••") {
                            SecureField("••••••••", text: $password)
                                .textContentType(.newPassword)
                                .onChange(of: password) { _, _ in hasEditedPassword = true }
                        }
                        if hasEditedPassword {
                            if let msg = passwordValidation.message {
                                Text(msg)
                                    .font(.system(size: 12))
                                    .foregroundStyle(.red.opacity(0.8))
                                    .padding(.leading, 4)
                                    .padding(.top, 4)
                            }
                            if passwordValidation.strength > .none {
                                HStack(spacing: 4) {
                                    ForEach(1...3, id: \.self) { level in
                                        RoundedRectangle(cornerRadius: 2)
                                            .fill(level <= passwordValidation.strength.rawValue
                                                  ? strengthColor : Color.club.outlineVariant)
                                            .frame(height: 3)
                                    }
                                    Text(passwordValidation.strength.label)
                                        .font(.system(size: 11, weight: .medium))
                                        .foregroundStyle(strengthColor)
                                }
                                .padding(.top, 6)
                            }
                        }
                    }

                    // Sign Up Button
                    Button {
                        Task { await handleSignUp() }
                    } label: {
                        HStack(spacing: 8) {
                            if isLoading {
                                ProgressView().tint(.white)
                            } else {
                                Text("Create Account")
                                Image(systemName: "arrow.right")
                            }
                        }
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.club.primaryForeground)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.club.primaryContainer, in: RoundedRectangle(cornerRadius: 16))
                    }
                    .disabled(isLoading || !isFormValid)
                    .opacity(isFormValid ? 1 : 0.5)
                }

                // Back to Login
                HStack(spacing: 4) {
                    Text("Already have an account?")
                        .foregroundStyle(Color.club.onSurfaceVariant)
                    Button("Sign in") { dismiss() }
                        .foregroundStyle(Color.club.primary)
                        .fontWeight(.semibold)
                }
                .font(.system(size: 14))
                .padding(.top, 28)
            }
            .padding(.horizontal, 32)
            .padding(.vertical, 48)
        }
        .background(Color.club.background)
        .navigationBarBackButtonHidden()
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button { dismiss() } label: {
                    Image(systemName: "arrow.left")
                        .foregroundStyle(Color.club.foreground)
                }
                .accessibilityLabel("Back")
            }
        }
    }

    @ViewBuilder
    private func fieldGroup<Content: View>(
        label: String,
        icon: String,
        placeholder: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.clubLabel)
                .tracking(1)
                .foregroundStyle(Color.club.onSurfaceVariant)
                .padding(.leading, 4)

            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundStyle(Color.club.onSurfaceVariant)
                content()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 14)
            .background(Color.club.surfaceContainerLowest)
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(Color.club.outlineVariant)
                    .frame(height: 1)
            }
        }
    }

    private var nameValidation: InputValidation.NameResult {
        InputValidation.validateName(fullName)
    }

    private var emailValidation: InputValidation.EmailResult {
        InputValidation.validateEmail(email)
    }

    private var passwordValidation: InputValidation.PasswordResult {
        InputValidation.validatePassword(password, requireStrength: true)
    }

    private var isFormValid: Bool {
        nameValidation.isValid && emailValidation.isValid && passwordValidation.isValid
    }

    private var strengthColor: Color {
        switch passwordValidation.strength {
        case .none: return .clear
        case .weak: return .red
        case .fair: return .orange
        case .strong: return Color.club.primary
        }
    }

    private func handleSignUp() async {
        guard isFormValid else { return }
        isLoading = true
        let trimmed = InputValidation.trimmedEmail(email)
        let trimmedName = fullName.trimmingCharacters(in: .whitespacesAndNewlines)
        await auth.signUp(email: trimmed, password: password, fullName: trimmedName)
        isLoading = false
    }
}
