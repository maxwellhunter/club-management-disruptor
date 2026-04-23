import XCTest
@testable import ClubOS

final class ValidationServiceTests: XCTestCase {

    // MARK: - Email Validation

    func test_email_valid_standard() {
        let result = ValidationService.validateEmail("user@example.com")
        XCTAssertTrue(result.isValid)
        XCTAssertNil(result.error)
    }

    func test_email_valid_withSubdomain() {
        let result = ValidationService.validateEmail("admin@mail.club.org")
        XCTAssertTrue(result.isValid)
    }

    func test_email_valid_withPlus() {
        let result = ValidationService.validateEmail("user+tag@example.com")
        XCTAssertTrue(result.isValid)
    }

    func test_email_valid_withDots() {
        let result = ValidationService.validateEmail("first.last@example.co.uk")
        XCTAssertTrue(result.isValid)
    }

    func test_email_valid_withHyphen() {
        let result = ValidationService.validateEmail("user@my-domain.com")
        XCTAssertTrue(result.isValid)
    }

    func test_email_valid_withNumbers() {
        let result = ValidationService.validateEmail("user123@example456.com")
        XCTAssertTrue(result.isValid)
    }

    func test_email_invalid_empty() {
        let result = ValidationService.validateEmail("")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Email is required")
    }

    func test_email_invalid_whitespaceOnly() {
        let result = ValidationService.validateEmail("   ")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Email is required")
    }

    func test_email_invalid_noAt() {
        let result = ValidationService.validateEmail("userexample.com")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Enter a valid email address")
    }

    func test_email_invalid_noDomain() {
        let result = ValidationService.validateEmail("user@")
        XCTAssertFalse(result.isValid)
    }

    func test_email_invalid_noTLD() {
        let result = ValidationService.validateEmail("user@example")
        XCTAssertFalse(result.isValid)
    }

    func test_email_invalid_singleCharTLD() {
        let result = ValidationService.validateEmail("user@example.c")
        XCTAssertFalse(result.isValid)
    }

    func test_email_invalid_doubleAt() {
        let result = ValidationService.validateEmail("user@@example.com")
        XCTAssertFalse(result.isValid)
    }

    func test_email_invalid_spacesInside() {
        let result = ValidationService.validateEmail("user @example.com")
        XCTAssertFalse(result.isValid)
    }

    func test_email_valid_trims_leadingTrailingWhitespace() {
        let result = ValidationService.validateEmail("  user@example.com  ")
        XCTAssertTrue(result.isValid)
    }

    func test_email_invalid_missingLocalPart() {
        let result = ValidationService.validateEmail("@example.com")
        XCTAssertFalse(result.isValid)
    }

    // MARK: - Password Validation

    func test_password_valid_meetsAll() {
        let result = ValidationService.validatePassword("Secret1x")
        XCTAssertTrue(result.isValid)
        XCTAssertTrue(result.requirements.allSatisfy(\.met))
    }

    func test_password_valid_complex() {
        let result = ValidationService.validatePassword("MyP@ssw0rd123!")
        XCTAssertTrue(result.isValid)
    }

    func test_password_invalid_empty() {
        let result = ValidationService.validatePassword("")
        XCTAssertFalse(result.isValid)
        XCTAssertFalse(requirement(result, id: "length").met)
    }

    func test_password_invalid_tooShort() {
        let result = ValidationService.validatePassword("Ab1")
        XCTAssertFalse(result.isValid)
        XCTAssertFalse(requirement(result, id: "length").met)
        XCTAssertTrue(requirement(result, id: "uppercase").met)
        XCTAssertTrue(requirement(result, id: "lowercase").met)
        XCTAssertTrue(requirement(result, id: "number").met)
    }

    func test_password_invalid_noUppercase() {
        let result = ValidationService.validatePassword("password1")
        XCTAssertFalse(result.isValid)
        XCTAssertTrue(requirement(result, id: "length").met)
        XCTAssertFalse(requirement(result, id: "uppercase").met)
    }

    func test_password_invalid_noLowercase() {
        let result = ValidationService.validatePassword("PASSWORD1")
        XCTAssertFalse(result.isValid)
        XCTAssertFalse(requirement(result, id: "lowercase").met)
    }

    func test_password_invalid_noNumber() {
        let result = ValidationService.validatePassword("Password")
        XCTAssertFalse(result.isValid)
        XCTAssertFalse(requirement(result, id: "number").met)
    }

    func test_password_invalid_allNumbers() {
        let result = ValidationService.validatePassword("12345678")
        XCTAssertFalse(result.isValid)
        XCTAssertTrue(requirement(result, id: "length").met)
        XCTAssertTrue(requirement(result, id: "number").met)
        XCTAssertFalse(requirement(result, id: "uppercase").met)
        XCTAssertFalse(requirement(result, id: "lowercase").met)
    }

    func test_password_exactlyMinLength_valid() {
        let result = ValidationService.validatePassword("Abcdefg1")
        XCTAssertTrue(result.isValid)
        XCTAssertEqual(result.requirements.count, 4)
    }

    func test_password_requirementCount() {
        let result = ValidationService.validatePassword("")
        XCTAssertEqual(result.requirements.count, 4)
    }

    // MARK: - Password Match

    func test_passwordMatch_identical() {
        XCTAssertTrue(ValidationService.validatePasswordMatch("Secret1x", "Secret1x"))
    }

    func test_passwordMatch_different() {
        XCTAssertFalse(ValidationService.validatePasswordMatch("Secret1x", "Secret2y"))
    }

    func test_passwordMatch_emptyPassword() {
        XCTAssertFalse(ValidationService.validatePasswordMatch("", "Secret1x"))
    }

    func test_passwordMatch_emptyConfirmation() {
        XCTAssertFalse(ValidationService.validatePasswordMatch("Secret1x", ""))
    }

    func test_passwordMatch_bothEmpty() {
        XCTAssertFalse(ValidationService.validatePasswordMatch("", ""))
    }

    func test_passwordMatch_caseSensitive() {
        XCTAssertFalse(ValidationService.validatePasswordMatch("Secret1x", "secret1x"))
    }

    // MARK: - Name Validation

    func test_name_valid_simple() {
        let result = ValidationService.validateName("John")
        XCTAssertTrue(result.isValid)
        XCTAssertNil(result.error)
    }

    func test_name_valid_withSpaces() {
        let result = ValidationService.validateName("John Smith")
        XCTAssertTrue(result.isValid)
    }

    func test_name_valid_singleCharacter() {
        let result = ValidationService.validateName("J")
        XCTAssertTrue(result.isValid)
    }

    func test_name_invalid_empty() {
        let result = ValidationService.validateName("")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Name is required")
    }

    func test_name_invalid_whitespaceOnly() {
        let result = ValidationService.validateName("   ")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Name is required")
    }

    func test_name_invalid_tooLong() {
        let longName = String(repeating: "A", count: 101)
        let result = ValidationService.validateName(longName)
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Name is too long")
    }

    func test_name_valid_atMaxLength() {
        let name = String(repeating: "A", count: 100)
        let result = ValidationService.validateName(name)
        XCTAssertTrue(result.isValid)
    }

    func test_name_customFieldName() {
        let result = ValidationService.validateName("", fieldName: "First name")
        XCTAssertEqual(result.error, "First name is required")
    }

    func test_name_customFieldName_tooLong() {
        let longName = String(repeating: "A", count: 101)
        let result = ValidationService.validateName(longName, fieldName: "Last name")
        XCTAssertEqual(result.error, "Last name is too long")
    }

    func test_name_valid_trimmed() {
        let result = ValidationService.validateName("  John  ")
        XCTAssertTrue(result.isValid)
    }

    // MARK: - Phone Validation

    func test_phone_valid_empty_isOptional() {
        let result = ValidationService.validatePhone("")
        XCTAssertTrue(result.isValid)
        XCTAssertNil(result.error)
    }

    func test_phone_valid_whitespaceOnly_isOptional() {
        let result = ValidationService.validatePhone("   ")
        XCTAssertTrue(result.isValid)
    }

    func test_phone_valid_usFormat() {
        let result = ValidationService.validatePhone("(555) 123-4567")
        XCTAssertTrue(result.isValid)
    }

    func test_phone_valid_international() {
        let result = ValidationService.validatePhone("+1 555 123 4567")
        XCTAssertTrue(result.isValid)
    }

    func test_phone_valid_plainDigits() {
        let result = ValidationService.validatePhone("5551234567")
        XCTAssertTrue(result.isValid)
    }

    func test_phone_valid_withDots() {
        let result = ValidationService.validatePhone("555.123.4567")
        XCTAssertTrue(result.isValid)
    }

    func test_phone_valid_sevenDigits() {
        let result = ValidationService.validatePhone("1234567")
        XCTAssertTrue(result.isValid)
    }

    func test_phone_invalid_tooShort() {
        let result = ValidationService.validatePhone("123456")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Phone number is too short")
    }

    func test_phone_invalid_tooLong() {
        let result = ValidationService.validatePhone("1234567890123456")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Phone number is too long")
    }

    func test_phone_invalid_letters() {
        let result = ValidationService.validatePhone("555-CALL-ME")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Phone contains invalid characters")
    }

    func test_phone_invalid_specialChars() {
        let result = ValidationService.validatePhone("555#123@4567")
        XCTAssertFalse(result.isValid)
    }

    func test_phone_valid_maxLength() {
        let result = ValidationService.validatePhone("123456789012345")
        XCTAssertTrue(result.isValid)
    }

    // MARK: - Helpers

    private func requirement(
        _ validation: ValidationService.PasswordValidation,
        id: String
    ) -> ValidationService.PasswordRequirement {
        validation.requirements.first(where: { $0.id == id })!
    }
}
