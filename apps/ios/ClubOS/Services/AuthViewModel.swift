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
        isLoading = true
        defer { isLoading = false }

        do {
            let session = try await supabase.auth.signIn(
                email: email,
                password: password
            )
            self.session = session
            self.user = session.user
            await APIClient.shared.setToken(session.accessToken)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Sign Up

    func signUp(email: String, password: String, fullName: String) async {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await supabase.auth.signUp(
                email: email,
                password: password,
                data: ["full_name": .string(fullName)]
            )
            self.session = response.session
            self.user = response.user
            if let token = response.session?.accessToken {
                await APIClient.shared.setToken(token)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Sign Out

    func signOut() async {
        do {
            try await supabase.auth.signOut()
            session = nil
            user = nil
            await APIClient.shared.setToken(nil)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Update Password

    func updatePassword(_ newPassword: String) async throws {
        try await supabase.auth.update(user: UserAttributes(password: newPassword))
    }
}
