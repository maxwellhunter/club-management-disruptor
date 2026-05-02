import XCTest
@testable import ClubOS

final class InputValidatorTests: XCTestCase {

    // MARK: - Email Validation

    func test_email_valid_simple() {
        let result = InputValidator.validateEmail("user@example.com")
        XCTAssertTrue(result.isValid)
        XCTAssertNil(result.error)
    }

    func test_email_valid_withSubdomain() {
        let result = InputValidator.validateEmail("admin@mail.example.co.uk")
        XCTAssertTrue(result.isValid)
    }

    func test_email_valid_withPlus() {
        let result = InputValidator.validateEmail("user+tag@example.com")
        XCTAssertTrue(result.isValid)
    }

    func test_email_valid_withDots() {
        let result = InputValidator.validateEmail("first.last@example.com")
        XCTAssertTrue(result.isValid)
    }

    func test_email_valid_trimmedWhitespace() {
        let result = InputValidator.validateEmail("  user@example.com  ")
        XCTAssertTrue(result.isValid)
    }

    func test_email_invalid_empty() {
        let result = InputValidator.validateEmail("")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Email is required.")
    }

    func test_email_invalid_whitespaceOnly() {
        let result = InputValidator.validateEmail("   ")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Email is required.")
    }

    func test_email_invalid_noAtSign() {
        let result = InputValidator.validateEmail("userexample.com")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Enter a valid email address.")
    }

    func test_email_invalid_noLocal() {
        let result = InputValidator.validateEmail("@example.com")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Enter a valid email address.")
    }

    func test_email_invalid_noDomain() {
        let result = InputValidator.validateEmail("user@")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Enter a valid email address.")
    }

    func test_email_invalid_noTLD() {
        let result = InputValidator.validateEmail("user@example")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Enter a valid email address.")
    }

    func test_email_invalid_shortTLD() {
        let result = InputValidator.validateEmail("user@example.c")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Enter a valid email address.")
    }

    func test_email_invalid_doubleDotInDomain() {
        let result = InputValidator.validateEmail("user@example..com")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Enter a valid email address.")
    }

    func test_email_invalid_multipleAtSigns() {
        let result = InputValidator.validateEmail("user@@example.com")
        XCTAssertFalse(result.isValid)
    }

    // MARK: - Password Validation

    func test_password_valid() {
        let result = InputValidator.validatePassword("Secure1pass")
        XCTAssertTrue(result.isValid)
        XCTAssertTrue(result.errors.isEmpty)
    }

    func test_password_valid_exact_minimum_length() {
        let result = InputValidator.validatePassword("Abcdef1x")
        XCTAssertTrue(result.isValid)
    }

    func test_password_invalid_tooShort() {
        let result = InputValidator.validatePassword("Ab1")
        XCTAssertFalse(result.isValid)
        XCTAssertTrue(result.errors.contains("At least 8 characters."))
    }

    func test_password_invalid_noUppercase() {
        let result = InputValidator.validatePassword("lowercase1pass")
        XCTAssertFalse(result.isValid)
        XCTAssertTrue(result.errors.contains("At least one uppercase letter."))
    }

    func test_password_invalid_noLowercase() {
        let result = InputValidator.validatePassword("UPPERCASE1PASS")
        XCTAssertFalse(result.isValid)
        XCTAssertTrue(result.errors.contains("At least one lowercase letter."))
    }

    func test_password_invalid_noNumber() {
        let result = InputValidator.validatePassword("SecurePass")
        XCTAssertFalse(result.isValid)
        XCTAssertTrue(result.errors.contains("At least one number."))
    }

    func test_password_invalid_empty() {
        let result = InputValidator.validatePassword("")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.errors.count, 4)
    }

    func test_password_invalid_allLowercaseNoNumber() {
        let result = InputValidator.validatePassword("allowercase")
        XCTAssertFalse(result.isValid)
        XCTAssertTrue(result.errors.contains("At least one uppercase letter."))
        XCTAssertTrue(result.errors.contains("At least one number."))
        XCTAssertFalse(result.errors.contains("At least one lowercase letter."))
    }

    func test_password_multiple_errors_reported() {
        let result = InputValidator.validatePassword("abc")
        XCTAssertFalse(result.isValid)
        XCTAssertTrue(result.errors.count >= 2)
        XCTAssertTrue(result.errors.contains("At least 8 characters."))
        XCTAssertTrue(result.errors.contains("At least one uppercase letter."))
        XCTAssertTrue(result.errors.contains("At least one number."))
    }

    // MARK: - Name Validation

    func test_name_valid() {
        XCTAssertNil(InputValidator.validateName("John Smith"))
    }

    func test_name_valid_twoChars() {
        XCTAssertNil(InputValidator.validateName("Jo"))
    }

    func test_name_invalid_empty() {
        XCTAssertEqual(InputValidator.validateName(""), "Name is required.")
    }

    func test_name_invalid_whitespaceOnly() {
        XCTAssertEqual(InputValidator.validateName("   "), "Name is required.")
    }

    func test_name_invalid_singleChar() {
        XCTAssertEqual(InputValidator.validateName("J"), "Name must be at least 2 characters.")
    }

    func test_name_trims_whitespace() {
        XCTAssertNil(InputValidator.validateName("  Jo  "))
    }

    // MARK: - Equatable Conformance

    func test_emailValidation_equatable() {
        XCTAssertEqual(InputValidator.EmailValidation.valid, InputValidator.EmailValidation.valid)
        XCTAssertNotEqual(
            InputValidator.EmailValidation.valid,
            InputValidator.EmailValidation(isValid: false, error: "bad")
        )
    }

    func test_passwordValidation_equatable() {
        XCTAssertEqual(InputValidator.PasswordValidation.valid, InputValidator.PasswordValidation.valid)
        XCTAssertNotEqual(
            InputValidator.PasswordValidation.valid,
            InputValidator.PasswordValidation(isValid: false, errors: ["nope"])
        )
    }
}
