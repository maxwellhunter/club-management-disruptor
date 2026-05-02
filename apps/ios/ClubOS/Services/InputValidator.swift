import Foundation

enum InputValidator {

    // MARK: - Email

    struct EmailValidation: Equatable {
        let isValid: Bool
        let error: String?

        static let valid = EmailValidation(isValid: true, error: nil)
    }

    static func validateEmail(_ email: String) -> EmailValidation {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)

        if trimmed.isEmpty {
            return EmailValidation(isValid: false, error: "Email is required.")
        }

        let parts = trimmed.split(separator: "@", maxSplits: 2, omittingEmptySubsequences: false)
        guard parts.count == 2 else {
            return EmailValidation(isValid: false, error: "Enter a valid email address.")
        }

        let local = parts[0]
        let domain = parts[1]

        if local.isEmpty || domain.isEmpty {
            return EmailValidation(isValid: false, error: "Enter a valid email address.")
        }

        let domainParts = domain.split(separator: ".", omittingEmptySubsequences: false)
        if domainParts.count < 2 || domainParts.contains(where: { $0.isEmpty }) {
            return EmailValidation(isValid: false, error: "Enter a valid email address.")
        }

        let tld = domainParts.last!
        if tld.count < 2 {
            return EmailValidation(isValid: false, error: "Enter a valid email address.")
        }

        return .valid
    }

    // MARK: - Password

    struct PasswordValidation: Equatable {
        let isValid: Bool
        let errors: [String]

        static let valid = PasswordValidation(isValid: true, errors: [])
    }

    static let minimumPasswordLength = 8

    static func validatePassword(_ password: String) -> PasswordValidation {
        var errors: [String] = []

        if password.count < minimumPasswordLength {
            errors.append("At least \(minimumPasswordLength) characters.")
        }

        if !password.contains(where: \.isUppercase) {
            errors.append("At least one uppercase letter.")
        }

        if !password.contains(where: \.isLowercase) {
            errors.append("At least one lowercase letter.")
        }

        if !password.contains(where: \.isNumber) {
            errors.append("At least one number.")
        }

        return PasswordValidation(isValid: errors.isEmpty, errors: errors)
    }

    // MARK: - Name

    static func validateName(_ name: String) -> String? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "Name is required." }
        if trimmed.count < 2 { return "Name must be at least 2 characters." }
        return nil
    }
}
