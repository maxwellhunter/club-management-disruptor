import Foundation

enum InputValidation {

    // MARK: - Email

    static func isValidEmail(_ email: String) -> Bool {
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return false }
        let pattern = #"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"#
        return trimmed.range(of: pattern, options: .regularExpression) != nil
    }

    static func emailError(_ email: String) -> String? {
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return nil }
        if !trimmed.contains("@") { return "Missing @ symbol" }
        let parts = trimmed.split(separator: "@", maxSplits: 1)
        if parts.count < 2 || parts[1].isEmpty { return "Missing domain" }
        let domain = String(parts[1])
        if !domain.contains(".") { return "Invalid domain" }
        if !isValidEmail(trimmed) { return "Invalid email format" }
        return nil
    }

    // MARK: - Password

    struct PasswordStrength: Equatable {
        let score: Int          // 0–4
        let label: String       // "Weak", "Fair", "Good", "Strong"
        let meetsMinimum: Bool  // true if score >= 2

        static let empty = PasswordStrength(score: 0, label: "Weak", meetsMinimum: false)
    }

    static let minimumPasswordLength = 8

    static func hasMinLength(_ password: String) -> Bool {
        password.count >= minimumPasswordLength
    }

    static func hasNumber(_ password: String) -> Bool {
        password.contains(where: \.isNumber)
    }

    static func hasUppercase(_ password: String) -> Bool {
        password.contains(where: \.isUppercase)
    }

    static func hasLowercase(_ password: String) -> Bool {
        password.contains(where: \.isLowercase)
    }

    static func hasSpecialCharacter(_ password: String) -> Bool {
        let specials = CharacterSet.alphanumerics.inverted
        return password.unicodeScalars.contains(where: { specials.contains($0) })
    }

    static func passwordStrength(_ password: String) -> PasswordStrength {
        guard !password.isEmpty else { return .empty }

        var score = 0
        if hasMinLength(password) { score += 1 }
        if hasNumber(password) { score += 1 }
        if hasUppercase(password) && hasLowercase(password) { score += 1 }
        if hasSpecialCharacter(password) { score += 1 }

        let label: String
        switch score {
        case 0...1: label = "Weak"
        case 2:     label = "Fair"
        case 3:     label = "Good"
        default:    label = "Strong"
        }

        return PasswordStrength(score: score, label: label, meetsMinimum: score >= 2)
    }

    static func passwordMeetsRequirements(_ password: String) -> Bool {
        hasMinLength(password) && hasNumber(password)
    }

    // MARK: - Phone

    static func isValidPhone(_ phone: String) -> Bool {
        let digits = phone.filter(\.isNumber)
        return digits.count >= 7 && digits.count <= 15
    }

    static func phoneError(_ phone: String) -> String? {
        let trimmed = phone.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return nil }
        let digits = trimmed.filter(\.isNumber)
        if digits.isEmpty { return "Enter a valid phone number" }
        if digits.count < 7 { return "Phone number too short" }
        if digits.count > 15 { return "Phone number too long" }
        return nil
    }

    // MARK: - Name

    static func isValidName(_ name: String) -> Bool {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.count >= 2
    }

    static func nameError(_ name: String) -> String? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return nil }
        if trimmed.count < 2 { return "Name is too short" }
        return nil
    }

    // MARK: - Currency formatting (safe)

    static func formatPrice(_ value: Double?) -> String {
        guard let value, value > 0 else { return "Free" }
        return String(format: "$%.0f", value)
    }
}
