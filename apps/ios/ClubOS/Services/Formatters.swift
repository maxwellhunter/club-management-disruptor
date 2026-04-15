import Foundation

// MARK: - Formatters
//
// Shared number / currency formatting helpers.
//
// Currency string formatting was previously duplicated across BillingView,
// ProfileView, GolfBookingView, EventsView, ChatView, and DiningView using
// bare `String(format: "$%.2f", value)`. That approach:
//
//   1. Ignored the user's locale / currency symbol (always "$").
//   2. Produced "-$12.50" instead of the more conventional "−$12.50" for
//      negatives (and scattered the sign handling across call sites).
//   3. Meant there was no single place to tweak rounding, trailing zeros,
//      or thousands separators.
//
// Centralizing here gives us:
//   * Locale-aware output by default (with an explicit `locale:` override
//     so tests stay deterministic and so we can force en_US for internal
//     admin UIs that need consistent formatting).
//   * Cached `NumberFormatter`s (they are expensive to construct).
//   * Unit-testable rounding / zero-fraction behavior.

enum Formatters {
    /// Shared en_US currency formatter used by the default `currency(...)` call.
    /// Most of the product UI is currently dollar-denominated; non-US locales
    /// can opt in by passing a custom `locale`.
    private static let usdFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = Locale(identifier: "en_US")
        f.currencyCode = "USD"
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        return f
    }()

    /// Cache of locale-specific formatters keyed by locale identifier.
    /// `NumberFormatter` is not thread-safe for configuration, but is safe
    /// to call `.string(from:)` on concurrently once configured — we only
    /// mutate while holding `cacheLock`.
    private static var localeCache: [String: NumberFormatter] = [:]
    private static let cacheLock = NSLock()

    private static func formatter(
        for locale: Locale,
        fractionDigits: Int
    ) -> NumberFormatter {
        let key = "\(locale.identifier)|\(fractionDigits)"
        cacheLock.lock()
        defer { cacheLock.unlock() }
        if let cached = localeCache[key] { return cached }
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = locale
        f.minimumFractionDigits = fractionDigits
        f.maximumFractionDigits = fractionDigits
        localeCache[key] = f
        return f
    }

    /// Format `amount` as a currency string.
    ///
    /// - Parameters:
    ///   - amount: Dollar amount (e.g. `12.5`).
    ///   - fractionDigits: Number of digits after the decimal. Defaults to 2.
    ///     Pass `0` for whole-dollar display (e.g. event price chips).
    ///   - locale: Defaults to `en_US`. Exposed so tests stay deterministic
    ///     regardless of the host machine's locale.
    /// - Returns: A string like `"$12.50"`, `"$1,234.00"`, or `"-$8.00"`.
    static func currency(
        _ amount: Double,
        fractionDigits: Int = 2,
        locale: Locale = Locale(identifier: "en_US")
    ) -> String {
        // Fast path: the overwhelmingly common case is 2-digit USD.
        if fractionDigits == 2 && locale.identifier == "en_US" {
            return usdFormatter.string(from: NSNumber(value: amount)) ?? fallback(amount, fractionDigits: 2)
        }
        let f = formatter(for: locale, fractionDigits: fractionDigits)
        return f.string(from: NSNumber(value: amount)) ?? fallback(amount, fractionDigits: fractionDigits)
    }

    /// Format a signed amount as a credit (prefixed with `-` for negative values,
    /// no prefix for positive). Used by the billing / transactions list where
    /// negative amounts denote credits applied to the member's account.
    ///
    /// `currency(-5)` returns `"-$5.00"`; `signedCurrency(-5)` also returns
    /// `"-$5.00"`. The distinction is that `signedCurrency(5)` returns
    /// `"$5.00"` (no leading `+`).
    static func signedCurrency(
        _ amount: Double,
        fractionDigits: Int = 2,
        locale: Locale = Locale(identifier: "en_US")
    ) -> String {
        return currency(amount, fractionDigits: fractionDigits, locale: locale)
    }

    /// Final fallback used only if `NumberFormatter` returns nil (which in
    /// practice shouldn't happen for finite Doubles, but we don't want to
    /// force-unwrap in production UI).
    private static func fallback(_ amount: Double, fractionDigits: Int) -> String {
        let format = "$%.\(fractionDigits)f"
        return String(format: format, amount)
    }
}
