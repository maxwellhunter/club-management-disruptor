import XCTest
@testable import ClubOS

final class ValidationTests: XCTestCase {

    // MARK: - Email Validation

    func test_email_valid() {
        XCTAssertNil(Validation.validateEmail("user@example.com"))
        XCTAssertNil(Validation.validateEmail("admin@greenfieldcc.com"))
        XCTAssertNil(Validation.validateEmail("user+tag@sub.domain.co"))
        XCTAssertNil(Validation.validateEmail("a@b.cd"))
    }

    func test_email_empty() {
        XCTAssertEqual(Validation.validateEmail(""), .emptyField("Email"))
        XCTAssertEqual(Validation.validateEmail("   "), .emptyField("Email"))
    }

    func test_email_missingAt() {
        XCTAssertEqual(Validation.validateEmail("userexample.com"), .invalidEmail)
    }

    func test_email_multipleAt() {
        XCTAssertEqual(Validation.validateEmail("user@@example.com"), .invalidEmail)
    }

    func test_email_missingDomain() {
        XCTAssertEqual(Validation.validateEmail("user@"), .invalidEmail)
    }

    func test_email_missingLocal() {
        XCTAssertEqual(Validation.validateEmail("@example.com"), .invalidEmail)
    }

    func test_email_noDotInDomain() {
        XCTAssertEqual(Validation.validateEmail("user@localhost"), .invalidEmail)
    }

    func test_email_shortTLD() {
        XCTAssertEqual(Validation.validateEmail("user@example.c"), .invalidEmail)
    }

    func test_email_consecutiveDots() {
        XCTAssertEqual(Validation.validateEmail("user@example..com"), .invalidEmail)
    }

    func test_email_trailingDot() {
        XCTAssertEqual(Validation.validateEmail("user@example.com."), .invalidEmail)
    }

    func test_email_tooLong() {
        let longLocal = String(repeating: "a", count: 250)
        let email = "\(longLocal)@example.com"
        XCTAssertEqual(Validation.validateEmail(email), .tooLong(field: "Email", maximum: 254))
    }

    func test_email_trims_whitespace() {
        XCTAssertNil(Validation.validateEmail("  user@example.com  "))
    }

    // MARK: - Password Validation

    func test_password_valid() {
        XCTAssertNil(Validation.validatePassword("Abcdef1!"))
        XCTAssertNil(Validation.validatePassword("MyStr0ngPass"))
        XCTAssertNil(Validation.validatePassword("Test1234"))
    }

    func test_password_empty() {
        XCTAssertEqual(Validation.validatePassword(""), .emptyField("Password"))
    }

    func test_password_tooShort() {
        XCTAssertEqual(Validation.validatePassword("Ab1"), .passwordTooShort(minimum: 8))
        XCTAssertEqual(Validation.validatePassword("Abcdef1"), .passwordTooShort(minimum: 8))
    }

    func test_password_missingUppercase() {
        XCTAssertEqual(Validation.validatePassword("abcdefg1"), .passwordMissingUppercase)
    }

    func test_password_missingLowercase() {
        XCTAssertEqual(Validation.validatePassword("ABCDEFG1"), .passwordMissingLowercase)
    }

    func test_password_missingNumber() {
        XCTAssertEqual(Validation.validatePassword("Abcdefgh"), .passwordMissingNumber)
    }

    func test_password_exactMinLength() {
        XCTAssertNil(Validation.validatePassword("Abcdef12"))
    }

    // MARK: - Name Validation

    func test_name_valid() {
        XCTAssertNil(Validation.validateName("Max Hunter"))
        XCTAssertNil(Validation.validateName("A"))
    }

    func test_name_empty() {
        XCTAssertEqual(Validation.validateName(""), .emptyField("Name"))
        XCTAssertEqual(Validation.validateName("   "), .emptyField("Name"))
    }

    func test_name_customFieldName() {
        XCTAssertEqual(Validation.validateName("", fieldName: "Full name"), .emptyField("Full name"))
    }

    func test_name_tooLong() {
        let longName = String(repeating: "a", count: 101)
        XCTAssertEqual(Validation.validateName(longName), .tooLong(field: "Name", maximum: 100))
    }

    func test_name_exactMaxLength() {
        let name = String(repeating: "a", count: 100)
        XCTAssertNil(Validation.validateName(name))
    }

    // MARK: - Phone Validation

    func test_phone_valid() {
        XCTAssertNil(Validation.validatePhone("555-123-4567"))
        XCTAssertNil(Validation.validatePhone("+1 (555) 123-4567"))
        XCTAssertNil(Validation.validatePhone("5551234567"))
    }

    func test_phone_empty() {
        XCTAssertEqual(Validation.validatePhone(""), .emptyField("Phone"))
    }

    func test_phone_tooFewDigits() {
        XCTAssertEqual(Validation.validatePhone("12345"), .invalidPhone)
        XCTAssertEqual(Validation.validatePhone("123-45"), .invalidPhone)
    }

    func test_phone_tooManyDigits() {
        let longPhone = String(repeating: "1", count: 16)
        XCTAssertEqual(Validation.validatePhone(longPhone), .invalidPhone)
    }

    func test_phone_noDigits() {
        XCTAssertEqual(Validation.validatePhone("abc-def"), .emptyField("Phone"))
    }

    func test_phone_exactBoundaries() {
        let sevenDigits = String(repeating: "1", count: 7)
        XCTAssertNil(Validation.validatePhone(sevenDigits))
        let fifteenDigits = String(repeating: "1", count: 15)
        XCTAssertNil(Validation.validatePhone(fifteenDigits))
    }

    // MARK: - Composite: Sign In Validation

    func test_signIn_valid() {
        XCTAssertNil(Validation.validateSignIn(email: "user@example.com", password: "secret"))
    }

    func test_signIn_emptyEmail() {
        XCTAssertEqual(
            Validation.validateSignIn(email: "", password: "secret"),
            .emptyField("Email")
        )
    }

    func test_signIn_emptyPassword() {
        XCTAssertEqual(
            Validation.validateSignIn(email: "user@example.com", password: ""),
            .emptyField("Password")
        )
    }

    func test_signIn_invalidEmail() {
        XCTAssertEqual(
            Validation.validateSignIn(email: "not-an-email", password: "secret"),
            .invalidEmail
        )
    }

    // MARK: - Composite: Sign Up Validation

    func test_signUp_valid() {
        XCTAssertNil(Validation.validateSignUp(
            email: "user@example.com",
            password: "MyStr0ng!",
            fullName: "John Doe"
        ))
    }

    func test_signUp_emptyName() {
        XCTAssertEqual(
            Validation.validateSignUp(email: "user@example.com", password: "MyStr0ng!", fullName: ""),
            .emptyField("Full name")
        )
    }

    func test_signUp_weakPassword() {
        XCTAssertEqual(
            Validation.validateSignUp(email: "user@example.com", password: "short", fullName: "John"),
            .passwordTooShort(minimum: 8)
        )
    }

    func test_signUp_invalidEmail() {
        XCTAssertEqual(
            Validation.validateSignUp(email: "bad", password: "MyStr0ng!", fullName: "John"),
            .invalidEmail
        )
    }

    func test_signUp_checksNameBeforeEmail() {
        let result = Validation.validateSignUp(email: "bad", password: "x", fullName: "")
        XCTAssertEqual(result, .emptyField("Full name"))
    }

    // MARK: - Error Messages

    func test_errorMessages_areHumanReadable() {
        XCTAssertEqual(
            ValidationError.emptyField("Email").localizedDescription,
            "Email is required."
        )
        XCTAssertEqual(
            ValidationError.invalidEmail.localizedDescription,
            "Please enter a valid email address."
        )
        XCTAssertEqual(
            ValidationError.passwordTooShort(minimum: 8).localizedDescription,
            "Password must be at least 8 characters."
        )
        XCTAssertEqual(
            ValidationError.passwordMissingUppercase.localizedDescription,
            "Password must contain an uppercase letter."
        )
        XCTAssertEqual(
            ValidationError.passwordMissingLowercase.localizedDescription,
            "Password must contain a lowercase letter."
        )
        XCTAssertEqual(
            ValidationError.passwordMissingNumber.localizedDescription,
            "Password must contain a number."
        )
        XCTAssertEqual(
            ValidationError.invalidPhone.localizedDescription,
            "Please enter a valid phone number."
        )
        XCTAssertEqual(
            ValidationError.tooLong(field: "Name", maximum: 100).localizedDescription,
            "Name must be 100 characters or fewer."
        )
    }
}
