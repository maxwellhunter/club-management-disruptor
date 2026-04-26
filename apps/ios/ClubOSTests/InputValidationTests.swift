import XCTest
@testable import ClubOS

final class InputValidationTests: XCTestCase {

    // MARK: - Email Validation

    func test_email_valid_standard() {
        XCTAssertTrue(InputValidation.isValidEmail("user@example.com"))
    }

    func test_email_valid_withSubdomain() {
        XCTAssertTrue(InputValidation.isValidEmail("user@mail.example.com"))
    }

    func test_email_valid_withPlus() {
        XCTAssertTrue(InputValidation.isValidEmail("user+tag@example.com"))
    }

    func test_email_valid_withDots() {
        XCTAssertTrue(InputValidation.isValidEmail("first.last@example.com"))
    }

    func test_email_valid_trimmedWhitespace() {
        XCTAssertTrue(InputValidation.isValidEmail("  user@example.com  "))
    }

    func test_email_invalid_empty() {
        XCTAssertFalse(InputValidation.isValidEmail(""))
    }

    func test_email_invalid_whitespaceOnly() {
        XCTAssertFalse(InputValidation.isValidEmail("   "))
    }

    func test_email_invalid_noAt() {
        XCTAssertFalse(InputValidation.isValidEmail("userexample.com"))
    }

    func test_email_invalid_noDomain() {
        XCTAssertFalse(InputValidation.isValidEmail("user@"))
    }

    func test_email_invalid_noTLD() {
        XCTAssertFalse(InputValidation.isValidEmail("user@example"))
    }

    func test_email_invalid_doubleDot() {
        XCTAssertFalse(InputValidation.isValidEmail("user@example..com"))
    }

    func test_email_invalid_spacesInside() {
        XCTAssertFalse(InputValidation.isValidEmail("user @example.com"))
    }

    func test_email_invalid_noLocal() {
        XCTAssertFalse(InputValidation.isValidEmail("@example.com"))
    }

    // MARK: - Email Error Messages

    func test_emailError_nil_whenEmpty() {
        XCTAssertNil(InputValidation.emailError(""))
    }

    func test_emailError_missingAt() {
        XCTAssertEqual(InputValidation.emailError("userexample.com"), "Missing @ symbol")
    }

    func test_emailError_missingDomain() {
        XCTAssertEqual(InputValidation.emailError("user@"), "Missing domain")
    }

    func test_emailError_invalidDomain() {
        XCTAssertEqual(InputValidation.emailError("user@example"), "Invalid domain")
    }

    func test_emailError_nil_whenValid() {
        XCTAssertNil(InputValidation.emailError("user@example.com"))
    }

    // MARK: - Password Checks

    func test_hasMinLength_true() {
        XCTAssertTrue(InputValidation.hasMinLength("12345678"))
    }

    func test_hasMinLength_false() {
        XCTAssertFalse(InputValidation.hasMinLength("1234567"))
    }

    func test_hasMinLength_empty() {
        XCTAssertFalse(InputValidation.hasMinLength(""))
    }

    func test_hasNumber_true() {
        XCTAssertTrue(InputValidation.hasNumber("abc1def"))
    }

    func test_hasNumber_false() {
        XCTAssertFalse(InputValidation.hasNumber("abcdef"))
    }

    func test_hasUppercase_true() {
        XCTAssertTrue(InputValidation.hasUppercase("aBc"))
    }

    func test_hasUppercase_false() {
        XCTAssertFalse(InputValidation.hasUppercase("abc"))
    }

    func test_hasLowercase_true() {
        XCTAssertTrue(InputValidation.hasLowercase("ABc"))
    }

    func test_hasLowercase_false() {
        XCTAssertFalse(InputValidation.hasLowercase("ABC"))
    }

    func test_hasSpecialCharacter_true() {
        XCTAssertTrue(InputValidation.hasSpecialCharacter("abc!"))
    }

    func test_hasSpecialCharacter_false() {
        XCTAssertFalse(InputValidation.hasSpecialCharacter("abc123"))
    }

    // MARK: - Password Strength

    func test_passwordStrength_empty() {
        let result = InputValidation.passwordStrength("")
        XCTAssertEqual(result, InputValidation.PasswordStrength.empty)
        XCTAssertEqual(result.score, 0)
        XCTAssertEqual(result.label, "Weak")
        XCTAssertFalse(result.meetsMinimum)
    }

    func test_passwordStrength_weak_shortNoNumber() {
        let result = InputValidation.passwordStrength("abc")
        XCTAssertEqual(result.score, 0)
        XCTAssertEqual(result.label, "Weak")
        XCTAssertFalse(result.meetsMinimum)
    }

    func test_passwordStrength_weak_lengthOnly() {
        let result = InputValidation.passwordStrength("abcdefgh")
        XCTAssertEqual(result.score, 1)
        XCTAssertEqual(result.label, "Weak")
        XCTAssertFalse(result.meetsMinimum)
    }

    func test_passwordStrength_fair_lengthAndNumber() {
        let result = InputValidation.passwordStrength("abcdefg1")
        XCTAssertEqual(result.score, 2)
        XCTAssertEqual(result.label, "Fair")
        XCTAssertTrue(result.meetsMinimum)
    }

    func test_passwordStrength_good_lengthNumberMixedCase() {
        let result = InputValidation.passwordStrength("Abcdefg1")
        XCTAssertEqual(result.score, 3)
        XCTAssertEqual(result.label, "Good")
        XCTAssertTrue(result.meetsMinimum)
    }

    func test_passwordStrength_strong_all() {
        let result = InputValidation.passwordStrength("Abcdef1!")
        XCTAssertEqual(result.score, 4)
        XCTAssertEqual(result.label, "Strong")
        XCTAssertTrue(result.meetsMinimum)
    }

    // MARK: - Password Meets Requirements

    func test_passwordMeetsRequirements_true() {
        XCTAssertTrue(InputValidation.passwordMeetsRequirements("abcdefg1"))
    }

    func test_passwordMeetsRequirements_false_tooShort() {
        XCTAssertFalse(InputValidation.passwordMeetsRequirements("abc1"))
    }

    func test_passwordMeetsRequirements_false_noNumber() {
        XCTAssertFalse(InputValidation.passwordMeetsRequirements("abcdefgh"))
    }

    func test_passwordMeetsRequirements_false_empty() {
        XCTAssertFalse(InputValidation.passwordMeetsRequirements(""))
    }

    // MARK: - Phone Validation

    func test_phone_valid_10digits() {
        XCTAssertTrue(InputValidation.isValidPhone("5551234567"))
    }

    func test_phone_valid_withFormatting() {
        XCTAssertTrue(InputValidation.isValidPhone("(555) 123-4567"))
    }

    func test_phone_valid_international() {
        XCTAssertTrue(InputValidation.isValidPhone("+1-555-123-4567"))
    }

    func test_phone_valid_sevenDigits() {
        XCTAssertTrue(InputValidation.isValidPhone("1234567"))
    }

    func test_phone_invalid_tooShort() {
        XCTAssertFalse(InputValidation.isValidPhone("123456"))
    }

    func test_phone_invalid_tooLong() {
        XCTAssertFalse(InputValidation.isValidPhone("1234567890123456"))
    }

    func test_phone_invalid_empty() {
        XCTAssertFalse(InputValidation.isValidPhone(""))
    }

    func test_phone_invalid_noDigits() {
        XCTAssertFalse(InputValidation.isValidPhone("abcdefg"))
    }

    // MARK: - Phone Error Messages

    func test_phoneError_nil_whenEmpty() {
        XCTAssertNil(InputValidation.phoneError(""))
    }

    func test_phoneError_noDigits() {
        XCTAssertEqual(InputValidation.phoneError("abc"), "Enter a valid phone number")
    }

    func test_phoneError_tooShort() {
        XCTAssertEqual(InputValidation.phoneError("12345"), "Phone number too short")
    }

    func test_phoneError_tooLong() {
        XCTAssertEqual(InputValidation.phoneError("1234567890123456"), "Phone number too long")
    }

    func test_phoneError_nil_whenValid() {
        XCTAssertNil(InputValidation.phoneError("(555) 123-4567"))
    }

    // MARK: - Name Validation

    func test_name_valid() {
        XCTAssertTrue(InputValidation.isValidName("John Smith"))
    }

    func test_name_valid_twoChars() {
        XCTAssertTrue(InputValidation.isValidName("Jo"))
    }

    func test_name_invalid_empty() {
        XCTAssertFalse(InputValidation.isValidName(""))
    }

    func test_name_invalid_whitespaceOnly() {
        XCTAssertFalse(InputValidation.isValidName("   "))
    }

    func test_name_invalid_singleChar() {
        XCTAssertFalse(InputValidation.isValidName("J"))
    }

    func test_name_valid_trims_whitespace() {
        XCTAssertTrue(InputValidation.isValidName("  John  "))
    }

    // MARK: - Name Error Messages

    func test_nameError_nil_whenEmpty() {
        XCTAssertNil(InputValidation.nameError(""))
    }

    func test_nameError_tooShort() {
        XCTAssertEqual(InputValidation.nameError("J"), "Name is too short")
    }

    func test_nameError_nil_whenValid() {
        XCTAssertNil(InputValidation.nameError("John"))
    }

    // MARK: - formatPrice

    func test_formatPrice_nil() {
        XCTAssertEqual(InputValidation.formatPrice(nil), "Free")
    }

    func test_formatPrice_zero() {
        XCTAssertEqual(InputValidation.formatPrice(0), "Free")
    }

    func test_formatPrice_negative() {
        XCTAssertEqual(InputValidation.formatPrice(-5), "Free")
    }

    func test_formatPrice_positive() {
        XCTAssertEqual(InputValidation.formatPrice(25), "$25")
    }

    func test_formatPrice_decimal_roundsDown() {
        XCTAssertEqual(InputValidation.formatPrice(49.99), "$50")
    }
}
