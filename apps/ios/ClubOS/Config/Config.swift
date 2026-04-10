import Foundation

enum AppConfig {

    // MARK: - Supabase

    static let supabaseURL: URL = {
        guard let urlString = Bundle.main.infoDictionary?["SUPABASE_URL"] as? String,
              let url = URL(string: urlString) else {
            fatalError("SUPABASE_URL not set in Info.plist / xcconfig")
        }
        return url
    }()

    static let supabaseAnonKey: String = {
        guard let key = Bundle.main.infoDictionary?["SUPABASE_ANON_KEY"] as? String, !key.isEmpty else {
            fatalError("SUPABASE_ANON_KEY not set in Info.plist / xcconfig")
        }
        return key
    }()

    // MARK: - Web API

    static let apiBaseURL: URL = {
        guard let urlString = Bundle.main.infoDictionary?["API_BASE_URL"] as? String,
              let url = URL(string: urlString) else {
            fatalError("API_BASE_URL not set in Info.plist / xcconfig")
        }
        return url
    }()

    // MARK: - App Info

    static let appVersion: String = {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1.0"
    }()

    static let buildNumber: String = {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }()

    // MARK: - Debug

    #if DEBUG
    static let isDebug = true
    #else
    static let isDebug = false
    #endif

    // MARK: - Demo Accounts (debug only)

    static let demoAccounts: [(label: String, role: String, email: String)] = [
        ("Max Hunter", "Admin", "admin@greenfieldcc.com"),
        ("Sarah Chen", "Staff", "staff@greenfieldcc.com"),
        ("James Wilson", "Member", "member@greenfieldcc.com"),
        ("Emily Brooks", "Member", "golf@greenfieldcc.com"),
    ]

    static let demoPassword = "clubos-demo-2026"
}
