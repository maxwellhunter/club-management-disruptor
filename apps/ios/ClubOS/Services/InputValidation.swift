import Foundation

enum InputValidation {

    // MARK: - Email

    struct EmailResult: Equatable, Sendable {
        let isValid: Bool
        let message: String?
    }

    static func validateEmail(_ email: String) -> EmailResult {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return EmailResult(isValid: false, message: nil)
        }
        let pattern = #"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"#
        let valid = trimmed.range(of: pattern, options: .regularExpression) != nil
        return EmailResult(
            isValid: valid,
            message: valid ? nil : "Enter a valid email address"
        )
    }

    // MARK: - Password

    struct PasswordResult: Equatable, Sendable {
        let isValid: Bool
        let message: String?
        let strength: PasswordStrength
    }

    enum PasswordStrength: Int, Comparable, Sendable {
        case none = 0
        case weak = 1
        case fair = 2
        case strong = 3

        static func < (lhs: Self, rhs: Self) -> Bool {
            lhs.rawValue < rhs.rawValue
        }

        var label: String {
            switch self {
            case .none: return ""
            case .weak: return "Weak"
            case .fair: return "Fair"
            case .strong: return "Strong"
            }
        }
    }

    static func validatePassword(_ password: String, requireStrength: Bool = false) -> PasswordResult {
        if password.isEmpty {
            return PasswordResult(isValid: false, message: nil, strength: .none)
        }

        if password.count < 8 {
            return PasswordResult(
                isValid: false,
                message: "Must be at least 8 characters",
                strength: .weak
            )
        }

        let strength = computeStrength(password)

        if requireStrength && strength < .fair {
            return PasswordResult(
                isValid: false,
                message: "Add uppercase, numbers, or symbols",
                strength: strength
            )
        }

        return PasswordResult(isValid: true, message: nil, strength: strength)
    }

    private static func computeStrength(_ password: String) -> PasswordStrength {
        var score = 0
        if password.count >= 8 { score += 1 }
        if password.range(of: "[A-Z]", options: .regularExpression) != nil { score += 1 }
        if password.range(of: "[0-9]", options: .regularExpression) != nil { score += 1 }
        if password.range(of: "[^A-Za-z0-9]", options: .regularExpression) != nil { score += 1 }

        switch score {
        case 0...1: return .weak
        case 2...3: return .fair
        default: return .strong
        }
    }

    // MARK: - Name

    struct NameResult: Equatable, Sendable {
        let isValid: Bool
        let message: String?
    }

    static func validateName(_ name: String) -> NameResult {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return NameResult(isValid: false, message: nil)
        }
        if trimmed.count < 2 {
            return NameResult(isValid: false, message: "Name is too short")
        }
        if !trimmed.contains(" ") {
            return NameResult(isValid: false, message: "Enter your full name")
        }
        return NameResult(isValid: true, message: nil)
    }

    // MARK: - Trimming helper

    static func trimmedEmail(_ email: String) -> String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
