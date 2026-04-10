import SwiftUI
import LocalAuthentication

@main
struct ClubOSApp: App {
    @State private var auth = AuthViewModel()
    @State private var isUnlocked = false
    @State private var needsBiometricUnlock = false

    var body: some Scene {
        WindowGroup {
            Group {
                if auth.isLoading {
                    splashScreen
                } else if auth.isAuthenticated && needsBiometricUnlock && !isUnlocked {
                    biometricGate
                } else if auth.isAuthenticated {
                    ContentView()
                } else {
                    NavigationStack {
                        LoginView()
                    }
                }
            }
            .environment(auth)
            .task {
                await auth.initialize()
                // After auth loads, check if we need biometric unlock
                if auth.isAuthenticated && UserDefaults.standard.bool(forKey: "biometrics_enabled") {
                    needsBiometricUnlock = true
                    await attemptBiometricUnlock()
                }
            }
        }
    }

    // MARK: - Splash

    private var splashScreen: some View {
        ZStack {
            Color.club.background.ignoresSafeArea()
            VStack(spacing: 16) {
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.club.primary)
                    .frame(width: 64, height: 64)
                    .overlay {
                        Image(systemName: "diamond.fill")
                            .font(.system(size: 24))
                            .foregroundStyle(.white)
                    }
                Text("CLUB OS")
                    .font(.system(size: 15, weight: .semibold))
                    .tracking(4)
                    .foregroundStyle(Color.club.onSurfaceVariant)
                ProgressView()
                    .tint(Color.club.primary)
            }
        }
    }

    // MARK: - Biometric Gate

    private var biometricGate: some View {
        ZStack {
            Color.club.background.ignoresSafeArea()
            VStack(spacing: 20) {
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.club.primary)
                    .frame(width: 64, height: 64)
                    .overlay {
                        Image(systemName: "diamond.fill")
                            .font(.system(size: 24))
                            .foregroundStyle(.white)
                    }

                Text("CLUB OS")
                    .font(.system(size: 15, weight: .semibold))
                    .tracking(4)
                    .foregroundStyle(Color.club.onSurfaceVariant)

                if let email = auth.user?.email {
                    Text(email)
                        .font(.system(size: 14))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }

                Button {
                    Task { await attemptBiometricUnlock() }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: biometricIcon)
                            .font(.system(size: 22))
                        Text("Tap to Unlock")
                            .font(.system(size: 16, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 32)
                    .padding(.vertical, 14)
                    .background(Color.club.primary, in: RoundedRectangle(cornerRadius: 16))
                }
                .padding(.top, 8)

                Button("Use Password Instead") {
                    Task {
                        await auth.signOut()
                        needsBiometricUnlock = false
                    }
                }
                .font(.system(size: 14))
                .foregroundStyle(Color.club.onSurfaceVariant)
            }
        }
    }

    // MARK: - Biometric Logic

    private var biometricIcon: String {
        LAContext().biometryType == .faceID ? "faceid" : "touchid"
    }

    private func attemptBiometricUnlock() async {
        let context = LAContext()
        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Unlock ClubOS"
            )
            if success {
                isUnlocked = true
            }
        } catch {
            // User cancelled — stay on gate screen
        }
    }
}
