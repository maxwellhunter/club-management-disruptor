import SwiftUI

struct SignupView: View {
    @Environment(AuthViewModel.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var fullName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var isLoading = false
    @State private var showValidation = false
    @State private var nameError: String?
    @State private var emailError: String?
    @State private var passwordErrors: [String] = []
    @State private var confirmError: String?

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
                    fieldGroup(label: "FULL NAME", icon: "person", placeholder: "John Smith") {
                        TextField("John Smith", text: $fullName)
                            .textContentType(.name)
                    }

                    if showValidation, let nameError {
                        Text(nameError)
                            .font(.system(size: 12))
                            .foregroundStyle(.red)
                            .padding(.horizontal, 4)
                            .padding(.top, -12)
                    }

                    fieldGroup(label: "EMAIL ADDRESS", icon: "envelope", placeholder: "name@example.com") {
                        TextField("name@example.com", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }

                    if showValidation, let emailError {
                        Text(emailError)
                            .font(.system(size: 12))
                            .foregroundStyle(.red)
                            .padding(.horizontal, 4)
                            .padding(.top, -12)
                    }

                    fieldGroup(label: "PASSWORD", icon: "lock", placeholder: "••••••••") {
                        SecureField("••••••••", text: $password)
                            .textContentType(.newPassword)
                    }

                    if showValidation && !passwordErrors.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(passwordErrors, id: \.self) { error in
                                HStack(spacing: 6) {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.system(size: 11))
                                    Text(error)
                                        .font(.system(size: 12))
                                }
                                .foregroundStyle(.red)
                            }
                        }
                        .padding(.horizontal, 4)
                        .padding(.top, -12)
                    }

                    fieldGroup(label: "CONFIRM PASSWORD", icon: "lock", placeholder: "••••••••") {
                        SecureField("••••••••", text: $confirmPassword)
                            .textContentType(.newPassword)
                    }

                    if showValidation, let confirmError {
                        Text(confirmError)
                            .font(.system(size: 12))
                            .foregroundStyle(.red)
                            .padding(.horizontal, 4)
                            .padding(.top, -12)
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
                    .disabled(isLoading || fullName.isEmpty || email.isEmpty || password.isEmpty || confirmPassword.isEmpty)
                    .opacity(fullName.isEmpty || email.isEmpty || password.isEmpty || confirmPassword.isEmpty ? 0.5 : 1)
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

    private func handleSignUp() async {
        showValidation = true

        let nameErrors = FormValidation.validateName(fullName, field: "Name")
        nameError = nameErrors.first?.message

        let emailErrors = FormValidation.validateEmail(email)
        emailError = emailErrors.first?.message

        let pwErrors = FormValidation.validatePassword(password)
        passwordErrors = pwErrors.map(\.message)

        if password != confirmPassword {
            confirmError = "Passwords do not match."
        } else {
            confirmError = nil
        }

        guard nameError == nil, emailError == nil, passwordErrors.isEmpty, confirmError == nil else { return }

        isLoading = true
        let trimmedName = fullName.trimmingCharacters(in: .whitespacesAndNewlines)
        await auth.signUp(email: email.trimmingCharacters(in: .whitespaces), password: password, fullName: trimmedName)
        isLoading = false
    }
}
