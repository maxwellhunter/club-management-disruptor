import SwiftUI

struct SignupView: View {
    @Environment(AuthViewModel.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var fullName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false

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

                    fieldGroup(label: "EMAIL ADDRESS", icon: "envelope", placeholder: "name@example.com") {
                        TextField("name@example.com", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }

                    fieldGroup(label: "PASSWORD", icon: "lock", placeholder: "••••••••") {
                        SecureField("••••••••", text: $password)
                            .textContentType(.newPassword)
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
                    .disabled(isLoading || fullName.isEmpty || email.isEmpty || password.isEmpty)
                    .opacity(fullName.isEmpty || email.isEmpty || password.isEmpty ? 0.5 : 1)
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
        isLoading = true
        await auth.signUp(email: email, password: password, fullName: fullName)
        isLoading = false
    }
}
