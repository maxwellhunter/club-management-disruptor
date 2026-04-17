import Foundation

enum ValidationError: LocalizedError, Equatable {
    case emptyField(String)
    case invalidEmail
    case passwordTooShort(minimum: Int)
    case passwordMissingUppercase
    case passwordMissingLowercase
    case passwordMissingNumber
    case invalidPhone
    case tooLong(field: String, maximum: Int)

    var errorDescription: String? {
        switch self {
        case .emptyField(let field):
            return "\(field) is required."
        case .invalidEmail:
            return "Please enter a valid email address."
        case .passwordTooShort(let minimum):
            return "Password must be at least \(minimum) characters."
        case .passwordMissingUppercase:
            return "Password must contain an uppercase letter."
        case .passwordMissingLowercase:
            return "Password must contain a lowercase letter."
        case .passwordMissingNumber:
            return "Password must contain a number."
        case .invalidPhone:
            return "Please enter a valid phone number."
        case .tooLong(let field, let maximum):
            return "\(field) must be \(maximum) characters or fewer."
        }
    }
}

enum Validation {
    static func validateEmail(_ email: String) -> ValidationError? {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return .emptyField("Email") }

        let parts = trimmed.split(separator: "@", omittingEmptySubsequences: false)
        guard parts.count == 2 else { return .invalidEmail }

        let local = parts[0]
        let domain = parts[1]

        if local.isEmpty || domain.isEmpty { return .invalidEmail }
        guard domain.contains(".") else { return .invalidEmail }

        let domainParts = domain.split(separator: ".", omittingEmptySubsequences: false)
        guard domainParts.count >= 2 else { return .invalidEmail }
        for part in domainParts {
            if part.isEmpty { return .invalidEmail }
        }
        guard let tld = domainParts.last, tld.count >= 2 else { return .invalidEmail }

        if trimmed.count > 254 { return .tooLong(field: "Email", maximum: 254) }

        return nil
    }

    static let minimumPasswordLength = 8

    static func validatePassword(_ password: String) -> ValidationError? {
        if password.isEmpty { return .emptyField("Password") }
        if password.count < minimumPasswordLength {
            return .passwordTooShort(minimum: minimumPasswordLength)
        }
        if password.rangeOfCharacter(from: .uppercaseLetters) == nil {
            return .passwordMissingUppercase
        }
        if password.rangeOfCharacter(from: .lowercaseLetters) == nil {
            return .passwordMissingLowercase
        }
        if password.rangeOfCharacter(from: .decimalDigits) == nil {
            return .passwordMissingNumber
        }
        return nil
    }

    static func validateName(_ name: String, fieldName: String = "Name") -> ValidationError? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return .emptyField(fieldName) }
        if trimmed.count > 100 { return .tooLong(field: fieldName, maximum: 100) }
        return nil
    }

    static func validatePhone(_ phone: String) -> ValidationError? {
        let digits = phone.filter(\.isNumber)
        if digits.isEmpty { return .emptyField("Phone") }
        if digits.count < 7 || digits.count > 15 { return .invalidPhone }
        return nil
    }

    static func validateSignIn(email: String, password: String) -> ValidationError? {
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedEmail.isEmpty { return .emptyField("Email") }
        if password.isEmpty { return .emptyField("Password") }
        if let emailErr = validateEmail(trimmedEmail) { return emailErr }
        return nil
    }

    static func validateSignUp(email: String, password: String, fullName: String) -> ValidationError? {
        if let nameErr = validateName(fullName, fieldName: "Full name") { return nameErr }
        if let emailErr = validateEmail(email) { return emailErr }
        if let passErr = validatePassword(password) { return passErr }
        return nil
    }
}
