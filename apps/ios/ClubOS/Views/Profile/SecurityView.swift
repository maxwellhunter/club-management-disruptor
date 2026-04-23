import SwiftUI
import LocalAuthentication

// MARK: - Security & Privacy

struct SecurityView: View {
    @Environment(AuthViewModel.self) private var auth

    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var isChangingPassword = false
    @State private var showPasswordSuccess = false
    @State private var passwordError: String?

    @State private var biometricsAvailable = false
    @State private var biometricsEnabled = false
    @State private var biometricType: LABiometryType = .none

    @State private var showDeleteAlert = false
    @State private var showSignOutAllAlert = false

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 24) {
                headerSection
                changePasswordSection
                biometricsSection
                sessionsSection
                dangerZone
                Spacer(minLength: 32)
            }
            .padding(.top, 16)
        }
        .background(Color.club.background)
        .navigationTitle("Security")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { checkBiometrics() }
        .alert("Password Updated", isPresented: $showPasswordSuccess) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Your password has been changed successfully.")
        }
        .alert("Sign Out All Devices", isPresented: $showSignOutAllAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Sign Out All", role: .destructive) {
                Task { await auth.signOut() }
            }
        } message: {
            Text("This will sign you out of all devices including this one. You'll need to log in again.")
        }
        .alert("Delete Account", isPresented: $showDeleteAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                // Account deletion would need admin/backend support
            }
        } message: {
            Text("Account deletion requires admin approval. Contact your club administrator to proceed.")
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: 6) {
            Image(systemName: "checkmark.shield.fill")
                .font(.system(size: 36))
                .foregroundStyle(Color.club.primary)
                .frame(width: 64, height: 64)
                .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 18))

            Text("Security & Privacy")
                .font(.custom("Georgia", size: 20).weight(.bold))
                .foregroundStyle(Color.club.foreground)
                .padding(.top, 4)

            Text("Manage your password, biometrics, and account security.")
                .font(.system(size: 13))
                .foregroundStyle(Color.club.onSurfaceVariant)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .padding(.bottom, 8)
    }

    // MARK: - Change Password

    private var changePasswordSection: some View {
        VStack(spacing: 0) {
            sectionHeader("CHANGE PASSWORD", icon: "key.fill")

            VStack(spacing: 0) {
                secureFieldRow(label: "Current Password", icon: "lock", text: $currentPassword)
                fieldDivider
                secureFieldRow(label: "New Password", icon: "lock.rotation", text: $newPassword)
                fieldDivider
                secureFieldRow(label: "Confirm Password", icon: "lock.rotation", text: $confirmPassword)

                if let passwordError {
                    Text(passwordError)
                        .font(.system(size: 12))
                        .foregroundStyle(.red)
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    Task { await changePassword() }
                } label: {
                    Group {
                        if isChangingPassword {
                            ProgressView().tint(.white)
                        } else {
                            Text("Update Password")
                                .font(.system(size: 14, weight: .semibold))
                        }
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        canSubmitPassword ? Color.club.primary : Color.club.outlineVariant,
                        in: RoundedRectangle(cornerRadius: 12)
                    )
                }
                .disabled(!canSubmitPassword || isChangingPassword)
                .padding(16)
            }
            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
            .shadow(color: Color.club.foreground.opacity(0.03), radius: 12, y: 4)
            .padding(.horizontal, 20)

            passwordRequirements
        }
    }

    private var passwordValidation: ValidationService.PasswordValidation {
        ValidationService.validatePassword(newPassword)
    }

    private var passwordsMatch: Bool {
        ValidationService.validatePasswordMatch(newPassword, confirmPassword)
    }

    private var passwordRequirements: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(passwordValidation.requirements) { req in
                requirementRow(req.label, met: req.met)
            }
            requirementRow("Passwords match", met: passwordsMatch)
        }
        .padding(.horizontal, 24)
        .padding(.top, 8)
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

    private var canSubmitPassword: Bool {
        !currentPassword.isEmpty && passwordValidation.isValid && passwordsMatch
    }

    // MARK: - Biometrics

    private var biometricsSection: some View {
        VStack(spacing: 0) {
            sectionHeader("BIOMETRIC LOGIN", icon: biometricIcon)

            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    Image(systemName: biometricIcon)
                        .font(.system(size: 20))
                        .foregroundStyle(Color.club.primary)
                        .frame(width: 28)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(biometricLabel)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.club.foreground)
                        Text(biometricsAvailable
                            ? "Require \(biometricLabel) to unlock the app"
                            : "\(biometricLabel) is not available on this device")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }

                    Spacer()

                    Toggle("", isOn: Binding(
                        get: { biometricsEnabled },
                        set: { newValue in
                            if newValue {
                                Task { await enableBiometrics() }
                            } else {
                                biometricsEnabled = false
                                UserDefaults.standard.set(false, forKey: "biometrics_enabled")
                            }
                        }
                    ))
                        .labelsHidden()
                        .tint(Color.club.primary)
                        .disabled(!biometricsAvailable)
                }
                .padding(16)
            }
            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
            .shadow(color: Color.club.foreground.opacity(0.03), radius: 12, y: 4)
            .padding(.horizontal, 20)
        }
    }

    // MARK: - Sessions

    private var sessionsSection: some View {
        VStack(spacing: 0) {
            sectionHeader("ACTIVE SESSIONS", icon: "desktopcomputer")

            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    Image(systemName: "iphone")
                        .font(.system(size: 20))
                        .foregroundStyle(Color.club.primary)
                        .frame(width: 28)

                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text("This Device")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.club.foreground)
                            Text("CURRENT")
                                .font(.system(size: 9, weight: .bold))
                                .tracking(0.5)
                                .foregroundStyle(Color.club.primary)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.club.accent, in: Capsule())
                        }
                        Text("ClubOS for iOS")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }

                    Spacer()
                }
                .padding(16)

                fieldDivider

                Button {
                    showSignOutAllAlert = true
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                            .font(.system(size: 14))
                        Text("Sign Out All Devices")
                            .font(.system(size: 14, weight: .medium))
                    }
                    .foregroundStyle(Color(hex: "dc2626"))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                }
            }
            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
            .shadow(color: Color.club.foreground.opacity(0.03), radius: 12, y: 4)
            .padding(.horizontal, 20)
        }
    }

    // MARK: - Danger Zone

    private var dangerZone: some View {
        VStack(spacing: 0) {
            sectionHeader("DANGER ZONE", icon: "exclamationmark.triangle.fill")

            Button {
                showDeleteAlert = true
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "trash.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(Color(hex: "dc2626"))
                        .frame(width: 28)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Delete Account")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color(hex: "dc2626"))
                        Text("Permanently remove your account and all data")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.club.outlineVariant)
                }
                .padding(16)
            }
            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color(hex: "dc2626").opacity(0.2), lineWidth: 1)
            )
            .padding(.horizontal, 20)
        }
    }

    // MARK: - Reusable Components

    private func sectionHeader(_ title: String, icon: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundStyle(Color.club.outline)
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .tracking(1)
                .foregroundStyle(Color.club.outline)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 24)
        .padding(.bottom, 8)
    }

    private func secureFieldRow(label: String, icon: String, text: Binding<String>) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15))
                .foregroundStyle(Color.club.onSurfaceVariant)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 11))
                    .foregroundStyle(Color.club.outline)
                SecureField(label, text: text)
                    .font(.system(size: 15))
                    .foregroundStyle(Color.club.foreground)
                    .textContentType(.password)
            }

            Spacer()
        }
        .padding(16)
    }

    private var fieldDivider: some View {
        Rectangle()
            .fill(Color.club.surfaceContainerLow)
            .frame(height: 1)
            .padding(.horizontal, 16)
    }

    // MARK: - Biometric Helpers

    private var biometricIcon: String {
        biometricType == .faceID ? "faceid" : "touchid"
    }

    private var biometricLabel: String {
        biometricType == .faceID ? "Face ID" : "Touch ID"
    }

    private func checkBiometrics() {
        let context = LAContext()
        var error: NSError?
        biometricsAvailable = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        biometricType = context.biometryType

        // Load saved preference
        biometricsEnabled = UserDefaults.standard.bool(forKey: "biometrics_enabled")
    }

    // MARK: - Actions

    private func enableBiometrics() async {
        let context = LAContext()
        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Enable \(biometricLabel) to unlock ClubOS"
            )
            if success {
                biometricsEnabled = true
                UserDefaults.standard.set(true, forKey: "biometrics_enabled")
            }
        } catch {
            biometricsEnabled = false
        }
    }

    private func changePassword() async {
        isChangingPassword = true
        passwordError = nil
        defer { isChangingPassword = false }

        do {
            try await auth.updatePassword(newPassword)
            currentPassword = ""
            newPassword = ""
            confirmPassword = ""
            showPasswordSuccess = true
        } catch {
            passwordError = error.localizedDescription
        }
    }
}
