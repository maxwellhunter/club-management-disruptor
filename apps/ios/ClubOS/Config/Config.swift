import Foundation

enum AppConfig {

    // Missing-config values trip a DEBUG assertion (so dev catches it
    // immediately) but fall back to a sentinel URL/string in RELEASE so
    // the app boots. The first API or Supabase call will then fail and
    // surface through the shared ErrorBanner — better UX than a startup
    // crash for a misconfigured TestFlight/App Store build.

    private static let missingConfigURL = URL(string: "https://missing-config.invalid")!

    private static func readURL(_ key: String) -> URL {
        guard let urlString = Bundle.main.infoDictionary?[key] as? String,
              let url = URL(string: urlString) else {
            assertionFailure("\(key) not set in Info.plist / xcconfig")
            return missingConfigURL
        }
        return url
    }

    private static func readString(_ key: String) -> String {
        guard let value = Bundle.main.infoDictionary?[key] as? String, !value.isEmpty else {
            assertionFailure("\(key) not set in Info.plist / xcconfig")
            return ""
        }
        return value
    }

    // MARK: - Supabase

    static let supabaseURL: URL = readURL("SUPABASE_URL")
    static let supabaseAnonKey: String = readString("SUPABASE_ANON_KEY")

    // MARK: - Web API

    static let apiBaseURL: URL = readURL("API_BASE_URL")

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
