import Foundation

enum ValidationError: Equatable, Sendable {
    case empty(field: String)
    case invalidEmail
    case passwordTooShort(minimum: Int)
    case passwordMissingUppercase
    case passwordMissingLowercase
    case passwordMissingDigit
    case invalidPhone
    case invalidName(field: String)

    var message: String {
        switch self {
        case .empty(let field):
            return "\(field) is required."
        case .invalidEmail:
            return "Please enter a valid email address."
        case .passwordTooShort(let minimum):
            return "Password must be at least \(minimum) characters."
        case .passwordMissingUppercase:
            return "Password must contain an uppercase letter."
        case .passwordMissingLowercase:
            return "Password must contain a lowercase letter."
        case .passwordMissingDigit:
            return "Password must contain a number."
        case .invalidPhone:
            return "Please enter a valid phone number."
        case .invalidName(let field):
            return "\(field) contains invalid characters."
        }
    }
}

struct FormValidation: Sendable {

    static func validateEmail(_ email: String) -> [ValidationError] {
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return [.empty(field: "Email")] }

        let pattern = #"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"#
        guard trimmed.range(of: pattern, options: .regularExpression) != nil else {
            return [.invalidEmail]
        }
        return []
    }

    static func validatePassword(_ password: String, minimumLength: Int = 8) -> [ValidationError] {
        if password.isEmpty { return [.empty(field: "Password")] }

        var errors: [ValidationError] = []
        if password.count < minimumLength {
            errors.append(.passwordTooShort(minimum: minimumLength))
        }
        if password.range(of: "[A-Z]", options: .regularExpression) == nil {
            errors.append(.passwordMissingUppercase)
        }
        if password.range(of: "[a-z]", options: .regularExpression) == nil {
            errors.append(.passwordMissingLowercase)
        }
        if password.range(of: "[0-9]", options: .regularExpression) == nil {
            errors.append(.passwordMissingDigit)
        }
        return errors
    }

    static func validateName(_ name: String, field: String) -> [ValidationError] {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return [.empty(field: field)] }

        let allowed = CharacterSet.letters
            .union(.whitespaces)
            .union(CharacterSet(charactersIn: "'-.,"))
        let nameChars = CharacterSet(charactersIn: trimmed)
        guard allowed.isSuperset(of: nameChars) else {
            return [.invalidName(field: field)]
        }
        return []
    }

    static func validatePhone(_ phone: String) -> [ValidationError] {
        let trimmed = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return [] }

        let digits = trimmed.filter(\.isNumber)
        guard digits.count >= 7 && digits.count <= 15 else {
            return [.invalidPhone]
        }

        let allowed = CharacterSet.decimalDigits
            .union(CharacterSet(charactersIn: "+()-. "))
        let phoneChars = CharacterSet(charactersIn: trimmed)
        guard allowed.isSuperset(of: phoneChars) else {
            return [.invalidPhone]
        }
        return []
    }

    static func trimmedOrNil(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
