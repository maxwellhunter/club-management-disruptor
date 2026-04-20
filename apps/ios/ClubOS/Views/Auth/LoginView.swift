import SwiftUI

struct LoginView: View {
    @Environment(AuthViewModel.self) private var auth
    @State private var email = ""
    @State private var password = ""
    @State private var rememberMe = false
    @State private var isLoading = false
    @State private var emailError: String?
    @State private var showValidation = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // MARK: - Branding
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

                // MARK: - Heading
                Text("Sign In")
                    .font(.clubHeadline)
                    .foregroundStyle(Color.club.foreground)
                    .padding(.bottom, 8)

                Text("Enter your credentials to access the club.")
                    .font(.clubCaption)
                    .foregroundStyle(Color.club.onSurfaceVariant)
                    .padding(.bottom, 32)

                // MARK: - Dev Account Switcher
                #if DEBUG
                devPanel
                    .padding(.bottom, 28)
                #endif

                // MARK: - Form Fields
                VStack(spacing: 20) {
                    // Email
                    VStack(alignment: .leading, spacing: 6) {
                        Text("EMAIL ADDRESS")
                            .font(.clubLabel)
                            .tracking(1)
                            .foregroundStyle(Color.club.onSurfaceVariant)
                            .padding(.leading, 4)

                        HStack(spacing: 10) {
                            Image(systemName: "envelope")
                                .font(.system(size: 16))
                                .foregroundStyle(Color.club.onSurfaceVariant)

                            TextField("name@example.com", text: $email)
                                .foregroundStyle(Color.club.foreground)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 14)
                        .background(Color.club.surfaceContainerLowest)
                        .overlay(alignment: .bottom) {
                            Rectangle()
                                .fill(showValidation && emailError != nil ? .red.opacity(0.5) : Color.club.outlineVariant)
                                .frame(height: 1)
                        }

                        if showValidation, let emailError {
                            Text(emailError)
                                .font(.system(size: 12))
                                .foregroundStyle(.red)
                                .padding(.leading, 4)
                        }
                    }

                    // Password
                    VStack(alignment: .leading, spacing: 6) {
                        Text("PASSWORD")
                            .font(.clubLabel)
                            .tracking(1)
                            .foregroundStyle(Color.club.onSurfaceVariant)
                            .padding(.leading, 4)

                        HStack(spacing: 10) {
                            Image(systemName: "lock")
                                .font(.system(size: 16))
                                .foregroundStyle(Color.club.onSurfaceVariant)

                            SecureField("••••••••", text: $password)
                                .foregroundStyle(Color.club.foreground)
                                .textContentType(.password)
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

                    // Remember Me / Forgot
                    HStack {
                        Button {
                            rememberMe.toggle()
                        } label: {
                            HStack(spacing: 8) {
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(rememberMe ? Color.club.primary : .clear)
                                    .stroke(rememberMe ? Color.club.primary : Color.club.outline, lineWidth: 1.5)
                                    .frame(width: 18, height: 18)
                                    .overlay {
                                        if rememberMe {
                                            Image(systemName: "checkmark")
                                                .font(.system(size: 10, weight: .bold))
                                                .foregroundStyle(.white)
                                        }
                                    }

                                Text("Remember Me")
                                    .font(.clubCaption)
                                    .foregroundStyle(Color.club.onSurfaceVariant)
                            }
                        }

                        Spacer()

                        Button("Forgot Password?") {}
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color.club.primary)
                    }

                    // Sign In Button
                    Button {
                        Task { await handleLogin() }
                    } label: {
                        HStack(spacing: 8) {
                            if isLoading {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Sign In")
                                Image(systemName: "arrow.right")
                            }
                        }
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.club.primaryForeground)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.club.primaryContainer, in: RoundedRectangle(cornerRadius: 16))
                    }
                    .disabled(isLoading || email.isEmpty || password.isEmpty)
                    .opacity(email.isEmpty || password.isEmpty ? 0.5 : 1)
                }

                // MARK: - Footer
                HStack(spacing: 24) {
                    Label("Need help?", systemImage: "questionmark.circle")
                    Label("Security", systemImage: "checkmark.shield")
                }
                .font(.clubCaption)
                .foregroundStyle(Color.club.onSurfaceVariant)
                .padding(.top, 28)

                // Sign Up Link
                HStack(spacing: 4) {
                    Text("Don't have an account?")
                        .foregroundStyle(Color.club.onSurfaceVariant)
                    NavigationLink("Sign up") {
                        SignupView()
                    }
                    .foregroundStyle(Color.club.primary)
                    .fontWeight(.semibold)
                }
                .font(.system(size: 14))
                .padding(.top, 20)

                // Legal
                Text("Reserved access for registered members of ClubOS.\nUnauthorized access is strictly prohibited.")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.club.outline)
                    .multilineTextAlignment(.center)
                    .padding(.top, 24)
            }
            .padding(.horizontal, 32)
            .padding(.vertical, 48)
        }
        .background(Color.club.background)
        .alert("Error", isPresented: .constant(auth.errorMessage != nil)) {
            Button("OK") { auth.errorMessage = nil }
        } message: {
            Text(auth.errorMessage ?? "")
        }
    }

    // MARK: - Dev Panel

    #if DEBUG
    private var devPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "wrench")
                    .font(.system(size: 11))
                Text("Dev Mode — The Lakes")
                    .font(.system(size: 12, weight: .bold))
            }
            .foregroundStyle(Color(hex: "92400e"))

            ForEach(AppConfig.demoAccounts, id: \.email) { account in
                Button {
                    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                    email = account.email
                    password = AppConfig.demoPassword
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(account.label)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color(hex: "111827"))
                        }
                        Spacer()
                        Text(account.role)
                            .font(.system(size: 9, weight: .bold))
                            .textCase(.uppercase)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(
                                account.role == "Admin"
                                    ? Color(hex: "fee2e2")
                                    : account.role == "Staff"
                                        ? Color(hex: "dbeafe")
                                        : Color(hex: "dcfce7"),
                                in: RoundedRectangle(cornerRadius: 4)
                            )
                            .foregroundStyle(
                                account.role == "Admin"
                                    ? Color(hex: "b91c1c")
                                    : account.role == "Staff"
                                        ? Color(hex: "1d4ed8")
                                        : Color(hex: "15803d")
                            )
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(.white, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(
                                email == account.email ? Color.club.primary : Color(hex: "fde68a"),
                                lineWidth: email == account.email ? 2 : 1
                            )
                    )
                }
            }
        }
        .padding(14)
        .background(Color(hex: "fffbeb"), in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color(hex: "fde68a"), lineWidth: 1)
        )
    }
    #endif

    // MARK: - Actions

    private func handleLogin() async {
        showValidation = true
        let errors = FormValidation.validateEmail(email)
        emailError = errors.first?.message

        guard emailError == nil, !password.isEmpty else { return }
        isLoading = true
        await auth.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
        isLoading = false
    }
}
