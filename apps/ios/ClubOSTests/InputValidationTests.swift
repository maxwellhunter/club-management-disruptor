import XCTest
@testable import ClubOS

final class InputValidationTests: XCTestCase {

    // MARK: - Email Validation

    func test_email_empty_isInvalid_noMessage() {
        let r = InputValidation.validateEmail("")
        XCTAssertFalse(r.isValid)
        XCTAssertNil(r.message)
    }

    func test_email_whitespaceOnly_isInvalid_noMessage() {
        let r = InputValidation.validateEmail("   ")
        XCTAssertFalse(r.isValid)
        XCTAssertNil(r.message)
    }

    func test_email_valid_simple() {
        let r = InputValidation.validateEmail("user@example.com")
        XCTAssertTrue(r.isValid)
        XCTAssertNil(r.message)
    }

    func test_email_valid_subdomains() {
        let r = InputValidation.validateEmail("admin@mail.greenfield.cc")
        XCTAssertTrue(r.isValid)
    }

    func test_email_valid_plusAddressing() {
        let r = InputValidation.validateEmail("user+tag@example.com")
        XCTAssertTrue(r.isValid)
    }

    func test_email_valid_withLeadingTrailingWhitespace() {
        let r = InputValidation.validateEmail("  user@example.com  ")
        XCTAssertTrue(r.isValid)
    }

    func test_email_invalid_missingAt() {
        let r = InputValidation.validateEmail("userexample.com")
        XCTAssertFalse(r.isValid)
        XCTAssertEqual(r.message, "Enter a valid email address")
    }

    func test_email_invalid_missingDomain() {
        let r = InputValidation.validateEmail("user@")
        XCTAssertFalse(r.isValid)
        XCTAssertNotNil(r.message)
    }

    func test_email_invalid_missingTLD() {
        let r = InputValidation.validateEmail("user@example")
        XCTAssertFalse(r.isValid)
        XCTAssertNotNil(r.message)
    }

    func test_email_invalid_singleCharTLD() {
        let r = InputValidation.validateEmail("user@example.c")
        XCTAssertFalse(r.isValid)
    }

    func test_email_invalid_doubleAt() {
        let r = InputValidation.validateEmail("user@@example.com")
        XCTAssertFalse(r.isValid)
    }

    func test_email_invalid_spacesInMiddle() {
        let r = InputValidation.validateEmail("user @example.com")
        XCTAssertFalse(r.isValid)
    }

    // MARK: - Password Validation

    func test_password_empty_isInvalid_noMessage() {
        let r = InputValidation.validatePassword("")
        XCTAssertFalse(r.isValid)
        XCTAssertNil(r.message)
        XCTAssertEqual(r.strength, .none)
    }

    func test_password_tooShort() {
        let r = InputValidation.validatePassword("abc")
        XCTAssertFalse(r.isValid)
        XCTAssertEqual(r.message, "Must be at least 8 characters")
        XCTAssertEqual(r.strength, .weak)
    }

    func test_password_sevenChars_tooShort() {
        let r = InputValidation.validatePassword("abcdefg")
        XCTAssertFalse(r.isValid)
        XCTAssertEqual(r.strength, .weak)
    }

    func test_password_eightLowercase_validButWeak() {
        let r = InputValidation.validatePassword("abcdefgh")
        XCTAssertTrue(r.isValid)
        XCTAssertEqual(r.strength, .weak)
    }

    func test_password_eightLowercase_requireStrength_fails() {
        let r = InputValidation.validatePassword("abcdefgh", requireStrength: true)
        XCTAssertFalse(r.isValid)
        XCTAssertNotNil(r.message)
        XCTAssertEqual(r.strength, .weak)
    }

    func test_password_withUppercase_fair() {
        let r = InputValidation.validatePassword("Abcdefgh")
        XCTAssertTrue(r.isValid)
        XCTAssertEqual(r.strength, .fair)
    }

    func test_password_withUppercaseAndDigit_fair() {
        let r = InputValidation.validatePassword("Abcdefg1")
        XCTAssertTrue(r.isValid)
        XCTAssertEqual(r.strength, .fair)
    }

    func test_password_mixedWithSymbol_strong() {
        let r = InputValidation.validatePassword("Abcdef1!")
        XCTAssertTrue(r.isValid)
        XCTAssertEqual(r.strength, .strong)
    }

    func test_password_strong_requireStrength_passes() {
        let r = InputValidation.validatePassword("Abcdef1!", requireStrength: true)
        XCTAssertTrue(r.isValid)
        XCTAssertNil(r.message)
    }

    func test_password_fair_requireStrength_passes() {
        let r = InputValidation.validatePassword("Abcdefgh", requireStrength: true)
        XCTAssertTrue(r.isValid)
    }

    // MARK: - Password Strength Ordering

    func test_strengthComparable() {
        XCTAssertTrue(InputValidation.PasswordStrength.none < .weak)
        XCTAssertTrue(InputValidation.PasswordStrength.weak < .fair)
        XCTAssertTrue(InputValidation.PasswordStrength.fair < .strong)
        XCTAssertFalse(InputValidation.PasswordStrength.strong < .fair)
    }

    func test_strengthLabels() {
        XCTAssertEqual(InputValidation.PasswordStrength.none.label, "")
        XCTAssertEqual(InputValidation.PasswordStrength.weak.label, "Weak")
        XCTAssertEqual(InputValidation.PasswordStrength.fair.label, "Fair")
        XCTAssertEqual(InputValidation.PasswordStrength.strong.label, "Strong")
    }

    // MARK: - Name Validation

    func test_name_empty_isInvalid_noMessage() {
        let r = InputValidation.validateName("")
        XCTAssertFalse(r.isValid)
        XCTAssertNil(r.message)
    }

    func test_name_whitespaceOnly_isInvalid_noMessage() {
        let r = InputValidation.validateName("   ")
        XCTAssertFalse(r.isValid)
        XCTAssertNil(r.message)
    }

    func test_name_singleChar_tooShort() {
        let r = InputValidation.validateName("A")
        XCTAssertFalse(r.isValid)
        XCTAssertEqual(r.message, "Name is too short")
    }

    func test_name_firstNameOnly_needsFullName() {
        let r = InputValidation.validateName("Maxwell")
        XCTAssertFalse(r.isValid)
        XCTAssertEqual(r.message, "Enter your full name")
    }

    func test_name_fullName_valid() {
        let r = InputValidation.validateName("Maxwell Hunter")
        XCTAssertTrue(r.isValid)
        XCTAssertNil(r.message)
    }

    func test_name_withExtraSpaces_valid() {
        let r = InputValidation.validateName("  Maxwell Hunter  ")
        XCTAssertTrue(r.isValid)
    }

    func test_name_threeWords_valid() {
        let r = InputValidation.validateName("Mary Jane Watson")
        XCTAssertTrue(r.isValid)
    }

    // MARK: - Email Trimming

    func test_trimmedEmail_lowercases() {
        XCTAssertEqual(InputValidation.trimmedEmail("USER@Example.COM"), "user@example.com")
    }

    func test_trimmedEmail_trims() {
        XCTAssertEqual(InputValidation.trimmedEmail("  user@example.com  "), "user@example.com")
    }

    func test_trimmedEmail_emptyString() {
        XCTAssertEqual(InputValidation.trimmedEmail(""), "")
    }
}
