import SwiftUI

struct SignupView: View {
    @Environment(AuthViewModel.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var fullName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var hasAttemptedSubmit = false

    private var nameResult: FormValidation.Result {
        FormValidation.validateName(fullName, field: "Full name")
    }
    private var emailResult: FormValidation.Result {
        FormValidation.validateEmail(email)
    }
    private var passwordResult: FormValidation.Result {
        FormValidation.validatePassword(password)
    }
    private var canSubmit: Bool {
        nameResult.isValid && emailResult.isValid && passwordResult.isValid && !isLoading
    }

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
                    fieldGroup(label: "FULL NAME", icon: "person", placeholder: "John Smith",
                               error: hasAttemptedSubmit ? nameResult.message : nil) {
                        TextField("John Smith", text: $fullName)
                            .textContentType(.name)
                    }

                    fieldGroup(label: "EMAIL ADDRESS", icon: "envelope", placeholder: "name@example.com",
                               error: hasAttemptedSubmit ? emailResult.message : nil) {
                        TextField("name@example.com", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }

                    fieldGroup(label: "PASSWORD", icon: "lock", placeholder: "••••••••",
                               error: hasAttemptedSubmit ? passwordResult.message : nil) {
                        SecureField("••••••••", text: $password)
                            .textContentType(.newPassword)
                    }

                    if !password.isEmpty {
                        let strength = FormValidation.passwordStrength(password)
                        HStack(spacing: 8) {
                            ForEach(0..<3, id: \.self) { i in
                                Capsule()
                                    .fill(i < strengthIndex(strength) ? strengthColor(strength) : Color.club.outlineVariant)
                                    .frame(height: 4)
                            }
                            Text(strength.rawValue)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(strengthColor(strength))
                        }
                        .padding(.top, -8)
                    }

                    Button {
                        hasAttemptedSubmit = true
                        guard canSubmit else { return }
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
                    .disabled(isLoading)
                    .opacity(hasAttemptedSubmit && !canSubmit ? 0.5 : 1)
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
        error: String? = nil,
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
                    .foregroundStyle(error != nil ? Color.club.destructive : Color.club.onSurfaceVariant)
                content()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 14)
            .background(Color.club.surfaceContainerLowest)
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(error != nil ? Color.club.destructive : Color.club.outlineVariant)
                    .frame(height: 1)
            }

            if let error {
                Text(error)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.club.destructive)
                    .padding(.leading, 4)
            }
        }
    }

    private func strengthIndex(_ s: FormValidation.PasswordStrength) -> Int {
        switch s { case .weak: 1; case .medium: 2; case .strong: 3 }
    }

    private func strengthColor(_ s: FormValidation.PasswordStrength) -> Color {
        switch s { case .weak: Color.club.destructive; case .medium: .orange; case .strong: Color.club.primary }
    }

    private func handleSignUp() async {
        isLoading = true
        await auth.signUp(email: email, password: password, fullName: fullName)
        isLoading = false
    }
}
