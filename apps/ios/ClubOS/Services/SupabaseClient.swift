import Foundation
import Supabase

// MARK: - Supabase Singleton

@MainActor
final class SupabaseManager {
    static let shared = SupabaseManager()

    let client: SupabaseClient

    private init() {
        client = SupabaseClient(
            supabaseURL: AppConfig.supabaseURL,
            supabaseKey: AppConfig.supabaseAnonKey,
            options: .init(
                auth: .init(
                    emitLocalSessionAsInitialSession: true
                )
            )
        )
    }
}
