import SwiftUI

struct SignupView: View {
    @Environment(AuthViewModel.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var fullName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var nameTouched = false
    @State private var emailTouched = false
    @State private var passwordTouched = false

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
                    fieldGroup(
                        label: "FULL NAME",
                        icon: "person",
                        placeholder: "John Smith",
                        error: nameTouched ? InputValidation.nameError(fullName) : nil
                    ) {
                        TextField("John Smith", text: $fullName)
                            .textContentType(.name)
                            .onChange(of: fullName) { _, _ in
                                if !nameTouched && !fullName.isEmpty { nameTouched = true }
                            }
                    }

                    fieldGroup(
                        label: "EMAIL ADDRESS",
                        icon: "envelope",
                        placeholder: "name@example.com",
                        error: emailTouched ? InputValidation.emailError(email) : nil
                    ) {
                        TextField("name@example.com", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .onChange(of: email) { _, _ in
                                if !emailTouched && !email.isEmpty { emailTouched = true }
                            }
                    }

                    fieldGroup(
                        label: "PASSWORD",
                        icon: "lock",
                        placeholder: "••••••••",
                        error: nil
                    ) {
                        SecureField("••••••••", text: $password)
                            .textContentType(.newPassword)
                            .onChange(of: password) { _, _ in
                                if !passwordTouched && !password.isEmpty { passwordTouched = true }
                            }
                    }

                    if passwordTouched {
                        passwordRequirements
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
                    .disabled(!canSubmitSignup)
                    .opacity(canSubmitSignup ? 1 : 0.5)
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
                    .foregroundStyle(Color.club.onSurfaceVariant)
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
                    .font(.system(size: 11))
                    .foregroundStyle(Color.club.destructive)
                    .padding(.leading, 4)
            }
        }
    }

    // MARK: - Password Requirements

    private var passwordRequirements: some View {
        VStack(alignment: .leading, spacing: 4) {
            requirementRow("At least 8 characters", met: InputValidation.hasMinLength(password))
            requirementRow("Contains a number", met: InputValidation.hasNumber(password))
        }
        .padding(.horizontal, 4)
    }

    private func requirementRow(_ text: String, met: Bool) -> some View {
        HStack(spacing: 6) {
            Image(systemName: met ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 12))
                .foregroundStyle(met ? Color.club.primary : Color.club.outlineVariant)
            Text(text)
                .font(.system(size: 12))
                .foregroundStyle(met ? Color.club.foreground : Color.club.onSurfaceVariant)
        }
    }

    // MARK: - Validation

    private var canSubmitSignup: Bool {
        !isLoading
        && InputValidation.isValidName(fullName)
        && InputValidation.isValidEmail(email)
        && InputValidation.passwordMeetsRequirements(password)
    }

    // MARK: - Actions

    private func handleSignUp() async {
        guard canSubmitSignup else { return }
        isLoading = true
        await auth.signUp(email: email, password: password, fullName: fullName.trimmingCharacters(in: .whitespacesAndNewlines))
        isLoading = false
    }
}
