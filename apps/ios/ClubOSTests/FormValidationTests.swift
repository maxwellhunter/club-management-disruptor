import XCTest
@testable import ClubOS

final class FormValidationTests: XCTestCase {

    // MARK: - Email validation

    func test_email_valid_standard() {
        XCTAssertTrue(FormValidation.validateEmail("user@example.com").isValid)
    }

    func test_email_valid_withSubdomain() {
        XCTAssertTrue(FormValidation.validateEmail("user@mail.example.com").isValid)
    }

    func test_email_valid_withPlus() {
        XCTAssertTrue(FormValidation.validateEmail("user+tag@example.com").isValid)
    }

    func test_email_valid_withDots() {
        XCTAssertTrue(FormValidation.validateEmail("first.last@example.com").isValid)
    }

    func test_email_valid_trimsWhitespace() {
        XCTAssertTrue(FormValidation.validateEmail("  user@example.com  ").isValid)
    }

    func test_email_invalid_empty() {
        let result = FormValidation.validateEmail("")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.message, "Email is required")
    }

    func test_email_invalid_noAtSign() {
        let result = FormValidation.validateEmail("userexample.com")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.message, "Enter a valid email address")
    }

    func test_email_invalid_noDomain() {
        XCTAssertFalse(FormValidation.validateEmail("user@").isValid)
    }

    func test_email_invalid_noLocalPart() {
        XCTAssertFalse(FormValidation.validateEmail("@example.com").isValid)
    }

    func test_email_invalid_noTLD() {
        XCTAssertFalse(FormValidation.validateEmail("user@example").isValid)
    }

    func test_email_invalid_shortTLD() {
        XCTAssertFalse(FormValidation.validateEmail("user@example.c").isValid)
    }

    func test_email_invalid_onlyAt() {
        XCTAssertFalse(FormValidation.validateEmail("@").isValid)
    }

    func test_email_invalid_spaces() {
        XCTAssertFalse(FormValidation.validateEmail("user @example.com").isValid)
    }

    func test_email_invalid_whitespaceOnly() {
        let result = FormValidation.validateEmail("   ")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.message, "Email is required")
    }

    // MARK: - Password validation

    func test_password_valid_meetsAllRequirements() {
        XCTAssertTrue(FormValidation.validatePassword("MyPass1234").isValid)
    }

    func test_password_valid_exactMinLength() {
        XCTAssertTrue(FormValidation.validatePassword("Abcdef1x").isValid)
    }

    func test_password_invalid_empty() {
        let result = FormValidation.validatePassword("")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.message, "Password is required")
    }

    func test_password_invalid_tooShort() {
        let result = FormValidation.validatePassword("Ab1cdef")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.message, "Password must be at least 8 characters")
    }

    func test_password_invalid_noUppercase() {
        let result = FormValidation.validatePassword("abcdefg1")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.message, "Password must include an uppercase letter")
    }

    func test_password_invalid_noLowercase() {
        let result = FormValidation.validatePassword("ABCDEFG1")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.message, "Password must include a lowercase letter")
    }

    func test_password_invalid_noDigit() {
        let result = FormValidation.validatePassword("Abcdefgh")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.message, "Password must include a number")
    }

    // MARK: - Password strength

    func test_strength_weak_tooShort() {
        XCTAssertEqual(FormValidation.passwordStrength("Ab1"), .weak)
    }

    func test_strength_weak_minLengthButLowComplexity() {
        XCTAssertEqual(FormValidation.passwordStrength("abcdefgh"), .weak)
    }

    func test_strength_medium_mixedCase() {
        XCTAssertEqual(FormValidation.passwordStrength("Abcdefg1"), .medium)
    }

    func test_strength_strong_allCategories() {
        XCTAssertEqual(FormValidation.passwordStrength("Abcdefg1!"), .strong)
    }

    func test_strength_strong_longPassword() {
        XCTAssertEqual(FormValidation.passwordStrength("Abcdefghij1!"), .strong)
    }

    // MARK: - Name validation

    func test_name_valid() {
        XCTAssertTrue(FormValidation.validateName("John").isValid)
    }

    func test_name_valid_withSpaces() {
        XCTAssertTrue(FormValidation.validateName("John Smith").isValid)
    }

    func test_name_invalid_empty() {
        let result = FormValidation.validateName("", field: "First name")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.message, "First name is required")
    }

    func test_name_invalid_whitespaceOnly() {
        let result = FormValidation.validateName("   ", field: "Last name")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.message, "Last name is required")
    }

    func test_name_invalid_tooShort() {
        let result = FormValidation.validateName("J", field: "Name")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.message, "Name must be at least 2 characters")
    }

    func test_name_invalid_tooLong() {
        let longName = String(repeating: "a", count: 51)
        let result = FormValidation.validateName(longName)
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.message, "Name must be under 50 characters")
    }

    func test_name_valid_exactMinLength() {
        XCTAssertTrue(FormValidation.validateName("Jo").isValid)
    }

    func test_name_valid_exactly50() {
        let name = String(repeating: "a", count: 50)
        XCTAssertTrue(FormValidation.validateName(name).isValid)
    }

    // MARK: - Phone validation

    func test_phone_valid_empty() {
        XCTAssertTrue(FormValidation.validatePhone("").isValid)
    }

    func test_phone_valid_whitespaceOnly() {
        XCTAssertTrue(FormValidation.validatePhone("   ").isValid)
    }

    func test_phone_valid_usFormat() {
        XCTAssertTrue(FormValidation.validatePhone("(555) 123-4567").isValid)
    }

    func test_phone_valid_international() {
        XCTAssertTrue(FormValidation.validatePhone("+1 555 123 4567").isValid)
    }

    func test_phone_valid_digitsOnly() {
        XCTAssertTrue(FormValidation.validatePhone("5551234567").isValid)
    }

    func test_phone_invalid_tooShort() {
        let result = FormValidation.validatePhone("12345")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.message, "Phone number is too short")
    }

    func test_phone_invalid_tooLong() {
        let result = FormValidation.validatePhone("1234567890123456")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.message, "Phone number is too long")
    }

    func test_phone_invalid_letters() {
        let result = FormValidation.validatePhone("555-abc-1234")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.message, "Phone number contains invalid characters")
    }

    func test_phone_valid_withDots() {
        XCTAssertTrue(FormValidation.validatePhone("555.123.4567").isValid)
    }

    // MARK: - Member number validation

    func test_memberNumber_valid_empty() {
        XCTAssertTrue(FormValidation.validateMemberNumber("").isValid)
    }

    func test_memberNumber_valid_alphanumeric() {
        XCTAssertTrue(FormValidation.validateMemberNumber("MEM-001").isValid)
    }

    func test_memberNumber_valid_digitsOnly() {
        XCTAssertTrue(FormValidation.validateMemberNumber("12345").isValid)
    }

    func test_memberNumber_invalid_tooLong() {
        let result = FormValidation.validateMemberNumber("A-very-long-member-number-that-exceeds-the-max")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.message, "Member number must be under 20 characters")
    }

    func test_memberNumber_invalid_specialChars() {
        let result = FormValidation.validateMemberNumber("MEM@001")
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.message, "Member number can only contain letters, numbers, and hyphens")
    }

    func test_memberNumber_valid_whitespaceOnly() {
        XCTAssertTrue(FormValidation.validateMemberNumber("   ").isValid)
    }

    // MARK: - Result type

    func test_result_valid_hasNilMessage() {
        XCTAssertNil(FormValidation.Result.valid.message)
    }

    func test_result_invalid_hasMessage() {
        let result = FormValidation.Result.invalid("error")
        XCTAssertEqual(result.message, "error")
        XCTAssertFalse(result.isValid)
    }

    func test_result_equatable() {
        XCTAssertEqual(FormValidation.Result.valid, FormValidation.Result.valid)
        XCTAssertEqual(
            FormValidation.Result.invalid("msg"),
            FormValidation.Result.invalid("msg")
        )
        XCTAssertNotEqual(
            FormValidation.Result.valid,
            FormValidation.Result.invalid("msg")
        )
    }
}
