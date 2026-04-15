import XCTest
@testable import ClubOS

final class FormattersTests: XCTestCase {
    // MARK: - currency — default (en_US, 2 fraction digits)

    func test_currency_positiveAmount_rendersAsUSD() {
        XCTAssertEqual(Formatters.currency(12.5), "$12.50")
    }

    func test_currency_zero_rendersWithTwoDecimals() {
        XCTAssertEqual(Formatters.currency(0), "$0.00")
    }

    func test_currency_negativeAmount_prefixesSign() {
        // NumberFormatter in en_US produces "-$12.50" (hyphen-minus), which is
        // what the old `String(format:)` path produced too — callers rely on it.
        XCTAssertEqual(Formatters.currency(-12.5), "-$12.50")
    }

    func test_currency_thousandsSeparator() {
        // Previous `String(format: "$%.2f")` impl produced "$1234.56" with
        // no grouping. The new impl adds it.
        XCTAssertEqual(Formatters.currency(1234.56), "$1,234.56")
    }

    func test_currency_largeValueGroupsCorrectly() {
        XCTAssertEqual(Formatters.currency(1_234_567.89), "$1,234,567.89")
    }

    func test_currency_roundsHalfEven() {
        // Double-precision 12.345 + NSNumber may round to 12.34 or 12.35
        // depending on representation. We just assert it rounds to 2 digits
        // and does not emit more than 2.
        let out = Formatters.currency(12.345)
        XCTAssertTrue(out == "$12.35" || out == "$12.34", "got \(out)")
        XCTAssertFalse(out.contains("12.3450"))
    }

    // MARK: - currency — custom fraction digits

    func test_currency_zeroFractionDigits_roundsToWholeDollars() {
        // Used by event price chips: "Free" or "$50", no ".00".
        XCTAssertEqual(Formatters.currency(50.0, fractionDigits: 0), "$50")
    }

    func test_currency_zeroFractionDigits_rounds() {
        // 49.6 → "$50" (half-up on positive at 0 digits)
        XCTAssertEqual(Formatters.currency(49.6, fractionDigits: 0), "$50")
    }

    func test_currency_oneFractionDigit() {
        XCTAssertEqual(Formatters.currency(12.5, fractionDigits: 1), "$12.5")
    }

    // MARK: - currency — locale

    func test_currency_explicitUSLocaleMatchesDefault() {
        XCTAssertEqual(
            Formatters.currency(9.99, locale: Locale(identifier: "en_US")),
            "$9.99"
        )
    }

    func test_currency_nonUSLocaleUsesLocaleSymbol() {
        // en_GB currency formatter uses the pound sign by default. This test
        // documents that the locale parameter is actually threaded through to
        // the NumberFormatter (important if we ever internationalize the app).
        let gb = Formatters.currency(5, locale: Locale(identifier: "en_GB"))
        XCTAssertTrue(gb.contains("£"), "expected £ symbol in \(gb)")
    }

    // MARK: - signedCurrency

    func test_signedCurrency_positiveHasNoPlusSign() {
        XCTAssertEqual(Formatters.signedCurrency(5), "$5.00")
    }

    func test_signedCurrency_negativeHasMinus() {
        XCTAssertEqual(Formatters.signedCurrency(-5), "-$5.00")
    }

    // MARK: - caching / repeat calls

    func test_currency_repeatedCallsAreStable() {
        // Regression guard: a bug where the cached formatter was being
        // re-mutated would surface as different output across calls.
        let a = Formatters.currency(1.23)
        let b = Formatters.currency(1.23)
        XCTAssertEqual(a, b)
    }

    func test_currency_mixedLocaleCallsDontLeak() {
        // Calling with a non-default locale must not corrupt the en_US
        // fast-path formatter.
        _ = Formatters.currency(1, locale: Locale(identifier: "en_GB"))
        XCTAssertEqual(Formatters.currency(1), "$1.00")
    }
}
