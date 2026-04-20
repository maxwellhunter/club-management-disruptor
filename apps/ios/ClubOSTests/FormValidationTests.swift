import XCTest
@testable import ClubOS

final class FormValidationTests: XCTestCase {

    // MARK: - Email Validation

    func test_email_valid_returnsNoErrors() {
        XCTAssertEqual(FormValidation.validateEmail("user@example.com"), [])
        XCTAssertEqual(FormValidation.validateEmail("first.last@domain.co.uk"), [])
        XCTAssertEqual(FormValidation.validateEmail("user+tag@example.org"), [])
        XCTAssertEqual(FormValidation.validateEmail("admin@greenfieldcc.com"), [])
    }

    func test_email_empty_returnsEmptyError() {
        let errors = FormValidation.validateEmail("")
        XCTAssertEqual(errors, [.empty(field: "Email")])
    }

    func test_email_whitespaceOnly_returnsEmptyError() {
        let errors = FormValidation.validateEmail("   ")
        XCTAssertEqual(errors, [.empty(field: "Email")])
    }

    func test_email_noAtSign_returnsInvalidEmail() {
        let errors = FormValidation.validateEmail("notanemail")
        XCTAssertEqual(errors, [.invalidEmail])
    }

    func test_email_noDomain_returnsInvalidEmail() {
        let errors = FormValidation.validateEmail("user@")
        XCTAssertEqual(errors, [.invalidEmail])
    }

    func test_email_noTLD_returnsInvalidEmail() {
        let errors = FormValidation.validateEmail("user@domain")
        XCTAssertEqual(errors, [.invalidEmail])
    }

    func test_email_doubleDot_returnsInvalidEmail() {
        let errors = FormValidation.validateEmail("user@domain..com")
        XCTAssertEqual(errors, [.invalidEmail])
    }

    func test_email_spaceInMiddle_returnsInvalidEmail() {
        let errors = FormValidation.validateEmail("user @example.com")
        XCTAssertEqual(errors, [.invalidEmail])
    }

    func test_email_leadingTrailingSpaces_trimmed_valid() {
        let errors = FormValidation.validateEmail("  user@example.com  ")
        XCTAssertEqual(errors, [])
    }

    func test_email_singleCharTLD_returnsInvalidEmail() {
        let errors = FormValidation.validateEmail("user@domain.c")
        XCTAssertEqual(errors, [.invalidEmail])
    }

    // MARK: - Password Validation

    func test_password_valid_returnsNoErrors() {
        XCTAssertEqual(FormValidation.validatePassword("Abcdef1!"), [])
        XCTAssertEqual(FormValidation.validatePassword("MyP4ssword"), [])
        XCTAssertEqual(FormValidation.validatePassword("Str0ngPa$$"), [])
    }

    func test_password_empty_returnsEmptyError() {
        let errors = FormValidation.validatePassword("")
        XCTAssertEqual(errors, [.empty(field: "Password")])
    }

    func test_password_tooShort_returnsError() {
        let errors = FormValidation.validatePassword("Ab1")
        XCTAssert(errors.contains(.passwordTooShort(minimum: 8)))
    }

    func test_password_customMinimumLength() {
        let errors = FormValidation.validatePassword("Ab1", minimumLength: 4)
        XCTAssert(errors.contains(.passwordTooShort(minimum: 4)))

        let valid = FormValidation.validatePassword("Ab1x", minimumLength: 4)
        XCTAssertFalse(valid.contains(where: {
            if case .passwordTooShort = $0 { return true }
            return false
        }))
    }

    func test_password_noUppercase_returnsError() {
        let errors = FormValidation.validatePassword("abcdefg1")
        XCTAssert(errors.contains(.passwordMissingUppercase))
        XCTAssertFalse(errors.contains(.passwordMissingLowercase))
        XCTAssertFalse(errors.contains(.passwordMissingDigit))
    }

    func test_password_noLowercase_returnsError() {
        let errors = FormValidation.validatePassword("ABCDEFG1")
        XCTAssert(errors.contains(.passwordMissingLowercase))
        XCTAssertFalse(errors.contains(.passwordMissingUppercase))
    }

    func test_password_noDigit_returnsError() {
        let errors = FormValidation.validatePassword("Abcdefgh")
        XCTAssert(errors.contains(.passwordMissingDigit))
        XCTAssertFalse(errors.contains(.passwordMissingUppercase))
        XCTAssertFalse(errors.contains(.passwordMissingLowercase))
    }

    func test_password_multipleFailures_returnsAll() {
        let errors = FormValidation.validatePassword("abc")
        XCTAssert(errors.contains(.passwordTooShort(minimum: 8)))
        XCTAssert(errors.contains(.passwordMissingUppercase))
        XCTAssert(errors.contains(.passwordMissingDigit))
        XCTAssertEqual(errors.count, 3)
    }

    func test_password_allUpperAndDigits_missingLowercase() {
        let errors = FormValidation.validatePassword("ABCDEFG1")
        XCTAssert(errors.contains(.passwordMissingLowercase))
        XCTAssertEqual(errors.count, 1)
    }

    // MARK: - Name Validation

    func test_name_valid_returnsNoErrors() {
        XCTAssertEqual(FormValidation.validateName("John", field: "First name"), [])
        XCTAssertEqual(FormValidation.validateName("O'Brien", field: "Last name"), [])
        XCTAssertEqual(FormValidation.validateName("Mary-Jane", field: "First name"), [])
        XCTAssertEqual(FormValidation.validateName("Dr. Smith", field: "Name"), [])
        XCTAssertEqual(FormValidation.validateName("Van der Berg", field: "Last name"), [])
    }

    func test_name_empty_returnsEmptyError() {
        let errors = FormValidation.validateName("", field: "First name")
        XCTAssertEqual(errors, [.empty(field: "First name")])
    }

    func test_name_whitespaceOnly_returnsEmptyError() {
        let errors = FormValidation.validateName("   ", field: "First name")
        XCTAssertEqual(errors, [.empty(field: "First name")])
    }

    func test_name_withNumbers_returnsInvalidName() {
        let errors = FormValidation.validateName("John123", field: "First name")
        XCTAssertEqual(errors, [.invalidName(field: "First name")])
    }

    func test_name_withSpecialChars_returnsInvalidName() {
        let errors = FormValidation.validateName("John@Doe", field: "Name")
        XCTAssertEqual(errors, [.invalidName(field: "Name")])
    }

    func test_name_withEmoji_returnsInvalidName() {
        let errors = FormValidation.validateName("John 🎉", field: "Name")
        XCTAssertEqual(errors, [.invalidName(field: "Name")])
    }

    func test_name_unicodeLetters_valid() {
        XCTAssertEqual(FormValidation.validateName("José", field: "First name"), [])
        XCTAssertEqual(FormValidation.validateName("Müller", field: "Last name"), [])
        XCTAssertEqual(FormValidation.validateName("Björk", field: "Name"), [])
    }

    func test_name_fieldLabel_propagates() {
        let errors = FormValidation.validateName("", field: "Last name")
        if case .empty(let field) = errors.first {
            XCTAssertEqual(field, "Last name")
        } else {
            XCTFail("Expected empty error")
        }
    }

    // MARK: - Phone Validation

    func test_phone_valid_returnsNoErrors() {
        XCTAssertEqual(FormValidation.validatePhone("555-1234"), [])
        XCTAssertEqual(FormValidation.validatePhone("(555) 123-4567"), [])
        XCTAssertEqual(FormValidation.validatePhone("+1 555 123 4567"), [])
        XCTAssertEqual(FormValidation.validatePhone("5551234567"), [])
        XCTAssertEqual(FormValidation.validatePhone("+44 20 7946 0958"), [])
    }

    func test_phone_empty_returnsNoErrors() {
        XCTAssertEqual(FormValidation.validatePhone(""), [])
    }

    func test_phone_whitespaceOnly_returnsNoErrors() {
        XCTAssertEqual(FormValidation.validatePhone("   "), [])
    }

    func test_phone_tooFewDigits_returnsInvalidPhone() {
        let errors = FormValidation.validatePhone("123")
        XCTAssertEqual(errors, [.invalidPhone])
    }

    func test_phone_tooManyDigits_returnsInvalidPhone() {
        let errors = FormValidation.validatePhone("1234567890123456")
        XCTAssertEqual(errors, [.invalidPhone])
    }

    func test_phone_withLetters_returnsInvalidPhone() {
        let errors = FormValidation.validatePhone("555-CALL")
        XCTAssertEqual(errors, [.invalidPhone])
    }

    func test_phone_withBadChars_returnsInvalidPhone() {
        let errors = FormValidation.validatePhone("555#1234")
        XCTAssertEqual(errors, [.invalidPhone])
    }

    func test_phone_internationalFormat_valid() {
        XCTAssertEqual(FormValidation.validatePhone("+1-555-123-4567"), [])
        XCTAssertEqual(FormValidation.validatePhone("+44.20.7946.0958"), [])
    }

    // MARK: - trimmedOrNil

    func test_trimmedOrNil_nonEmpty_returnsTrimmed() {
        XCTAssertEqual(FormValidation.trimmedOrNil("  hello  "), "hello")
    }

    func test_trimmedOrNil_empty_returnsNil() {
        XCTAssertNil(FormValidation.trimmedOrNil(""))
    }

    func test_trimmedOrNil_whitespaceOnly_returnsNil() {
        XCTAssertNil(FormValidation.trimmedOrNil("   "))
    }

    func test_trimmedOrNil_newlines_returnsNil() {
        XCTAssertNil(FormValidation.trimmedOrNil("\n\t  \n"))
    }

    func test_trimmedOrNil_preservesInnerSpaces() {
        XCTAssertEqual(FormValidation.trimmedOrNil("  hello world  "), "hello world")
    }

    // MARK: - ValidationError messages

    func test_errorMessages_areUserFriendly() {
        XCTAssertEqual(ValidationError.empty(field: "Email").message, "Email is required.")
        XCTAssertEqual(ValidationError.invalidEmail.message, "Please enter a valid email address.")
        XCTAssertEqual(ValidationError.passwordTooShort(minimum: 8).message, "Password must be at least 8 characters.")
        XCTAssertEqual(ValidationError.passwordMissingUppercase.message, "Password must contain an uppercase letter.")
        XCTAssertEqual(ValidationError.passwordMissingLowercase.message, "Password must contain a lowercase letter.")
        XCTAssertEqual(ValidationError.passwordMissingDigit.message, "Password must contain a number.")
        XCTAssertEqual(ValidationError.invalidPhone.message, "Please enter a valid phone number.")
        XCTAssertEqual(ValidationError.invalidName(field: "First name").message, "First name contains invalid characters.")
    }

    // MARK: - ValidationError Equatable

    func test_validationError_equatable() {
        XCTAssertEqual(ValidationError.invalidEmail, ValidationError.invalidEmail)
        XCTAssertNotEqual(ValidationError.invalidEmail, ValidationError.invalidPhone)
        XCTAssertEqual(ValidationError.empty(field: "X"), ValidationError.empty(field: "X"))
        XCTAssertNotEqual(ValidationError.empty(field: "X"), ValidationError.empty(field: "Y"))
        XCTAssertEqual(ValidationError.passwordTooShort(minimum: 8), ValidationError.passwordTooShort(minimum: 8))
        XCTAssertNotEqual(ValidationError.passwordTooShort(minimum: 8), ValidationError.passwordTooShort(minimum: 6))
    }
}
