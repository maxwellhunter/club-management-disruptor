import Foundation

enum FormValidation {

    // MARK: - Result type

    enum Result: Equatable {
        case valid
        case invalid(String)

        var isValid: Bool {
            if case .valid = self { return true }
            return false
        }

        var message: String? {
            if case .invalid(let msg) = self { return msg }
            return nil
        }
    }

    // MARK: - Email

    private static let emailRegex: NSRegularExpression = {
        let pattern = "^[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}$"
        return try! NSRegularExpression(pattern: pattern)
    }()

    static func validateEmail(_ email: String) -> Result {
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return .invalid("Email is required") }
        let range = NSRange(trimmed.startIndex..., in: trimmed)
        if emailRegex.firstMatch(in: trimmed, range: range) == nil {
            return .invalid("Enter a valid email address")
        }
        return .valid
    }

    // MARK: - Password

    static let minimumPasswordLength = 8

    static func validatePassword(_ password: String) -> Result {
        if password.isEmpty { return .invalid("Password is required") }
        if password.count < minimumPasswordLength {
            return .invalid("Password must be at least \(minimumPasswordLength) characters")
        }
        if password.rangeOfCharacter(from: .uppercaseLetters) == nil {
            return .invalid("Password must include an uppercase letter")
        }
        if password.rangeOfCharacter(from: .lowercaseLetters) == nil {
            return .invalid("Password must include a lowercase letter")
        }
        if password.rangeOfCharacter(from: .decimalDigits) == nil {
            return .invalid("Password must include a number")
        }
        return .valid
    }

    static func passwordStrength(_ password: String) -> PasswordStrength {
        if password.count < minimumPasswordLength { return .weak }
        var score = 0
        if password.rangeOfCharacter(from: .uppercaseLetters) != nil { score += 1 }
        if password.rangeOfCharacter(from: .lowercaseLetters) != nil { score += 1 }
        if password.rangeOfCharacter(from: .decimalDigits) != nil { score += 1 }
        let specials = CharacterSet.alphanumerics.inverted
        if password.unicodeScalars.contains(where: { specials.contains($0) }) { score += 1 }
        if password.count >= 12 { score += 1 }
        if score <= 2 { return .weak }
        if score <= 3 { return .medium }
        return .strong
    }

    enum PasswordStrength: String, Equatable {
        case weak = "Weak"
        case medium = "Fair"
        case strong = "Strong"
    }

    // MARK: - Name

    static func validateName(_ name: String, field: String = "Name") -> Result {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return .invalid("\(field) is required") }
        if trimmed.count < 2 { return .invalid("\(field) must be at least 2 characters") }
        if trimmed.count > 50 { return .invalid("\(field) must be under 50 characters") }
        return .valid
    }

    // MARK: - Phone (optional field — empty is valid)

    private static let phoneMinDigits = 7
    private static let phoneMaxDigits = 15

    static func validatePhone(_ phone: String) -> Result {
        let trimmed = phone.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return .valid }
        let digits = trimmed.filter(\.isNumber)
        if digits.count < phoneMinDigits {
            return .invalid("Phone number is too short")
        }
        if digits.count > phoneMaxDigits {
            return .invalid("Phone number is too long")
        }
        let allowed = CharacterSet(charactersIn: "0123456789+()-. ")
        if trimmed.unicodeScalars.contains(where: { !allowed.contains($0) }) {
            return .invalid("Phone number contains invalid characters")
        }
        return .valid
    }

    // MARK: - Member number (optional — empty is valid)

    static func validateMemberNumber(_ number: String) -> Result {
        let trimmed = number.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return .valid }
        if trimmed.count > 20 {
            return .invalid("Member number must be under 20 characters")
        }
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-"))
        if trimmed.unicodeScalars.contains(where: { !allowed.contains($0) }) {
            return .invalid("Member number can only contain letters, numbers, and hyphens")
        }
        return .valid
    }
}
