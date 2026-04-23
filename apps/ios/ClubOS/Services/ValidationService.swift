import Foundation

enum ValidationService {

    // MARK: - Email

    struct EmailValidation {
        let isValid: Bool
        let error: String?
    }

    static func validateEmail(_ email: String) -> EmailValidation {
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty {
            return EmailValidation(isValid: false, error: "Email is required")
        }
        let pattern = #"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"#
        let isValid = trimmed.range(of: pattern, options: .regularExpression) != nil
        return EmailValidation(
            isValid: isValid,
            error: isValid ? nil : "Enter a valid email address"
        )
    }

    // MARK: - Password

    struct PasswordRequirement: Identifiable {
        let id: String
        let label: String
        let met: Bool
    }

    struct PasswordValidation {
        let isValid: Bool
        let requirements: [PasswordRequirement]
    }

    static let minimumPasswordLength = 8

    static func validatePassword(_ password: String) -> PasswordValidation {
        let requirements = [
            PasswordRequirement(
                id: "length",
                label: "At least \(minimumPasswordLength) characters",
                met: password.count >= minimumPasswordLength
            ),
            PasswordRequirement(
                id: "uppercase",
                label: "Contains an uppercase letter",
                met: password.contains(where: \.isUppercase)
            ),
            PasswordRequirement(
                id: "lowercase",
                label: "Contains a lowercase letter",
                met: password.contains(where: \.isLowercase)
            ),
            PasswordRequirement(
                id: "number",
                label: "Contains a number",
                met: password.contains(where: \.isNumber)
            ),
        ]
        return PasswordValidation(
            isValid: requirements.allSatisfy(\.met),
            requirements: requirements
        )
    }

    static func validatePasswordMatch(_ password: String, _ confirmation: String) -> Bool {
        !password.isEmpty && !confirmation.isEmpty && password == confirmation
    }

    // MARK: - Name

    struct NameValidation {
        let isValid: Bool
        let error: String?
    }

    static let maximumNameLength = 100

    static func validateName(_ name: String, fieldName: String = "Name") -> NameValidation {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty {
            return NameValidation(isValid: false, error: "\(fieldName) is required")
        }
        if trimmed.count > maximumNameLength {
            return NameValidation(isValid: false, error: "\(fieldName) is too long")
        }
        return NameValidation(isValid: true, error: nil)
    }

    // MARK: - Phone

    struct PhoneValidation {
        let isValid: Bool
        let error: String?
    }

    static func validatePhone(_ phone: String) -> PhoneValidation {
        let trimmed = phone.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty {
            return PhoneValidation(isValid: true, error: nil)
        }
        let digits = trimmed.filter(\.isNumber)
        if digits.count < 7 {
            return PhoneValidation(isValid: false, error: "Phone number is too short")
        }
        if digits.count > 15 {
            return PhoneValidation(isValid: false, error: "Phone number is too long")
        }
        let allowed = CharacterSet(charactersIn: "0123456789+()-. ")
        let input = CharacterSet(charactersIn: trimmed)
        if !input.isSubset(of: allowed) {
            return PhoneValidation(isValid: false, error: "Phone contains invalid characters")
        }
        return PhoneValidation(isValid: true, error: nil)
    }
}
