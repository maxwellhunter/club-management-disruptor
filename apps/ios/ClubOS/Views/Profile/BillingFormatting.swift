import Foundation

// MARK: - Billing Invoice (display model)
//
// Decoded from `/api/billing/invoices`. Lifted out of `BillingView` so the
// formatting/filtering helpers below — and their unit tests — can reference it
// directly without going through the view layer.

struct BillingInvoice: Decodable, Identifiable, Equatable, Sendable {
    let id: UUID
    let amount: Double
    let status: String
    let description: String
    let dueDate: String?
    let createdAt: String?
}

// MARK: - Filter

enum BillingInvoiceFilter: String, CaseIterable, Sendable {
    case all = "All"
    case paid = "Paid"
    case outstanding = "Outstanding"
}

// MARK: - Pure Formatting Helpers
//
// These are deliberately free functions in an enum namespace: no UI imports,
// no async work, no shared state. That keeps them trivially unit-testable on
// any platform that has Foundation.

enum BillingFormatting {

    // MARK: Filtering

    /// Apply the user-selected filter to a list of invoices.
    /// `outstanding` includes both `sent` (not yet due) and `overdue` invoices,
    /// which matches what members expect to see under "what do I owe".
    static func filter(_ invoices: [BillingInvoice], by filter: BillingInvoiceFilter) -> [BillingInvoice] {
        switch filter {
        case .all:
            return invoices
        case .paid:
            return invoices.filter { $0.status.lowercased() == "paid" }
        case .outstanding:
            let pending: Set<String> = ["sent", "overdue"]
            return invoices.filter { pending.contains($0.status.lowercased()) }
        }
    }

    // MARK: Icons

    /// Pick an SF Symbol based on keywords in the invoice description.
    /// Order matters: more specific keywords are checked first so that, e.g.,
    /// "Pro Shop Golf Balls" maps to the golf icon rather than the generic one.
    static func icon(for description: String) -> String {
        let lower = description.lowercased()
        if lower.contains("dining") || lower.contains("restaurant") || lower.contains("grill") || lower.contains("bar") {
            return "fork.knife"
        }
        if lower.contains("golf") || lower.contains("pro shop") || lower.contains("tee time") {
            return "figure.golf"
        }
        if lower.contains("membership") || lower.contains("dues") || lower.contains("assessment") {
            return "creditcard"
        }
        if lower.contains("event") {
            return "calendar"
        }
        if lower.contains("guest") {
            return "person.2"
        }
        return "doc.text"
    }

    // MARK: Status

    /// Hex color for an invoice status badge. Returns the hex string (no `#`)
    /// so this stays UI-framework-agnostic and trivially testable.
    static func statusHex(_ status: String) -> String {
        switch status.lowercased() {
        case "paid":     return "16a34a" // green
        case "overdue":  return "dc2626" // red
        case "sent":     return "d97706" // amber
        case "draft":    return "6b7280" // gray
        case "void", "cancelled", "canceled":
            return "9ca3af" // light gray
        default:         return "6b7280"
        }
    }

    /// Human-friendly label for an invoice status. Falls back to a capitalized
    /// version of the raw value so unknown statuses still display sensibly.
    static func statusLabel(_ status: String) -> String {
        switch status.lowercased() {
        case "paid":     return "Paid"
        case "overdue":  return "Overdue"
        case "sent":     return "Due"
        case "draft":    return "Draft"
        case "void":     return "Void"
        case "cancelled", "canceled": return "Cancelled"
        default:         return status.capitalized
        }
    }

    // MARK: Currency

    /// Format a USD amount as a localized currency string (e.g. "$1,234.50").
    /// Uses `NumberFormatter` so locale-aware grouping/separators are handled
    /// correctly — the previous `String(format: "%.2f")` approach printed
    /// "$1234.50" with no grouping separators.
    static func currency(_ amount: Double, locale: Locale = Locale(identifier: "en_US")) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.locale = locale
        return formatter.string(from: NSNumber(value: amount)) ?? "$\(String(format: "%.2f", amount))"
    }

    // MARK: Due Date

    /// Format a `YYYY-MM-DD` date string (as returned by the API) into a
    /// short, member-friendly form like "Apr 13, 2026". Returns an empty
    /// string for nil input and the raw value for unparseable input — never
    /// crashes the row render.
    static func formattedDueDate(_ raw: String?, now: Date = Date(), calendar: Calendar = Calendar(identifier: .gregorian)) -> String {
        guard let raw, !raw.isEmpty else { return "" }
        guard let date = parseAPIDate(raw) else { return raw }

        let display = DateFormatter()
        display.locale = Locale(identifier: "en_US_POSIX")
        display.dateFormat = "MMM d, yyyy"
        return display.string(from: date)
    }

    /// Compute days until due (negative if already past due). Returns nil if
    /// the date can't be parsed. Used to render "5 days overdue" / "due in
    /// 3 days" hints alongside invoices.
    static func daysUntilDue(_ raw: String?, now: Date = Date(), calendar: Calendar = Calendar(identifier: .gregorian)) -> Int? {
        guard let raw, let due = parseAPIDate(raw) else { return nil }
        let startOfNow = calendar.startOfDay(for: now)
        let startOfDue = calendar.startOfDay(for: due)
        return calendar.dateComponents([.day], from: startOfNow, to: startOfDue).day
    }

    /// True if the invoice is past its due date *and* not yet paid. The
    /// server status is authoritative when it already says "overdue".
    static func isOverdue(_ invoice: BillingInvoice, now: Date = Date()) -> Bool {
        if invoice.status.lowercased() == "paid" { return false }
        if invoice.status.lowercased() == "overdue" { return true }
        guard let days = daysUntilDue(invoice.dueDate, now: now) else { return false }
        return days < 0
    }

    // MARK: Aggregates

    /// Total outstanding (sent + overdue) balance. Useful for the "You owe"
    /// summary at the top of the billing screen.
    static func outstandingBalance(_ invoices: [BillingInvoice]) -> Double {
        filter(invoices, by: .outstanding).reduce(0) { $0 + $1.amount }
    }

    // MARK: Internal

    /// Parse the API's `YYYY-MM-DD` (and ISO-8601 with time) date strings.
    private static func parseAPIDate(_ raw: String) -> Date? {
        let dateOnly = DateFormatter()
        dateOnly.locale = Locale(identifier: "en_US_POSIX")
        dateOnly.dateFormat = "yyyy-MM-dd"
        dateOnly.timeZone = TimeZone(secondsFromGMT: 0)
        if let d = dateOnly.date(from: raw) { return d }

        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: raw) { return d }

        let isoFractional = ISO8601DateFormatter()
        isoFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return isoFractional.date(from: raw)
    }
}
