import Foundation
import Supabase
import Observation

// MARK: - Auth State Manager

@Observable
@MainActor
final class AuthViewModel {
    var user: User?
    var session: Session?
    var isLoading = true
    var errorMessage: String?

    var isAuthenticated: Bool { session != nil }

    private let supabase = SupabaseManager.shared.client

    // MARK: - Initialization

    func initialize() async {
        do {
            let session = try await supabase.auth.session
            self.session = session
            self.user = session.user
            await APIClient.shared.setToken(session.accessToken)
        } catch {
            // No existing session — user needs to log in
            self.session = nil
            self.user = nil
        }
        isLoading = false

        // Listen for auth state changes
        Task {
            for await (event, session) in supabase.auth.authStateChanges {
                self.session = session
                self.user = session?.user
                await APIClient.shared.setToken(session?.accessToken)

                if event == .signedOut {
                    self.session = nil
                    self.user = nil
                }
            }
        }
    }

    // MARK: - Sign In

    func signIn(email: String, password: String) async {
        errorMessage = nil

        if let validationError = Validation.validateSignIn(email: email, password: password) {
            errorMessage = validationError.localizedDescription
            return
        }

        isLoading = true
        defer { isLoading = false }

        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        do {
            let session = try await supabase.auth.signIn(
                email: trimmedEmail,
                password: password
            )
            self.session = session
            self.user = session.user
            await APIClient.shared.setToken(session.accessToken)
        } catch {
            errorMessage = friendlyAuthError(error)
        }
    }

    // MARK: - Sign Up

    func signUp(email: String, password: String, fullName: String) async {
        errorMessage = nil

        if let validationError = Validation.validateSignUp(email: email, password: password, fullName: fullName) {
            errorMessage = validationError.localizedDescription
            return
        }

        isLoading = true
        defer { isLoading = false }

        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let trimmedName = fullName.trimmingCharacters(in: .whitespacesAndNewlines)

        do {
            let response = try await supabase.auth.signUp(
                email: trimmedEmail,
                password: password,
                data: ["full_name": .string(trimmedName)]
            )
            self.session = response.session
            self.user = response.user
            if let token = response.session?.accessToken {
                await APIClient.shared.setToken(token)
            }
        } catch {
            errorMessage = friendlyAuthError(error)
        }
    }

    // MARK: - Sign Out

    func signOut() async {
        do {
            try await supabase.auth.signOut()
            session = nil
            user = nil
            await APIClient.shared.setToken(nil)
            await AppCacheService.shared.clearAll()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Update Password

    func updatePassword(_ newPassword: String) async throws {
        if let validationError = Validation.validatePassword(newPassword) {
            throw validationError
        }
        try await supabase.auth.update(user: UserAttributes(password: newPassword))
    }

    // MARK: - Helpers

    private func friendlyAuthError(_ error: Error) -> String {
        let message = error.localizedDescription.lowercased()
        if message.contains("invalid login credentials") || message.contains("invalid_credentials") {
            return "Incorrect email or password."
        }
        if message.contains("email not confirmed") {
            return "Please verify your email before signing in."
        }
        if message.contains("user already registered") || message.contains("already been registered") {
            return "An account with this email already exists."
        }
        if message.contains("network") || message.contains("offline") || message.contains("internet") {
            return "No internet connection. Please check your network."
        }
        if message.contains("rate") || message.contains("too many") {
            return "Too many attempts. Please wait a moment and try again."
        }
        return error.localizedDescription
    }
}
