import Foundation

// MARK: - Date Utilities
//
// Shared date parsing / formatting helpers.
//
// Supabase `timestamptz` columns are serialized as ISO-8601 strings, but
// sometimes with fractional seconds ("2025-01-02T03:04:05.123Z") and sometimes
// without ("2025-01-02T03:04:05Z"). We try both formats.
//
// Previously this logic was duplicated (and slightly inconsistent) across
// AnnouncementsView, HomeView, EventsView, ChatView, MembershipCardView, and
// ProfileView. Consolidating here lets us cache the formatters and unit-test
// the relative-time formatting.

enum DateUtilities {
    // Formatters are expensive to create; cache them as static properties.
    // ISO8601DateFormatter is thread-safe for reading once configured.
    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoBasic: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    /// Parse an ISO-8601 string, tolerating both with- and without-fractional-seconds.
    /// Returns `nil` if the string is nil, empty, or unparseable.
    static func parseISODate(_ string: String?) -> Date? {
        guard let string, !string.isEmpty else { return nil }
        if let d = isoFractional.date(from: string) { return d }
        return isoBasic.date(from: string)
    }

    /// Human-friendly relative time string (e.g. "5m ago", "Yesterday", "3w ago").
    ///
    /// - Parameters:
    ///   - dateStr: An ISO-8601 date string (may be nil).
    ///   - now: The reference date to compute relative to. Exposed for testability.
    ///   - calendar: Calendar to use for "Yesterday" detection. Defaults to `.current`.
    /// - Returns: A short relative string, or an empty string if the input is nil/empty,
    ///   or the raw input string if it can't be parsed.
    static func relativeTimeString(
        from dateStr: String?,
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> String {
        guard let dateStr, !dateStr.isEmpty else { return "" }
        guard let date = parseISODate(dateStr) else { return dateStr }
        return relativeTimeString(from: date, now: now, calendar: calendar)
    }

    /// Overload that takes a parsed `Date` directly.
    static func relativeTimeString(
        from date: Date,
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> String {
        let diff = now.timeIntervalSince(date)

        // Handle future dates — clamp to "Just now" for small skew, otherwise
        // fall through to absolute formatting.
        if diff < 0 {
            // Up to 60s of clock skew is "Just now"; anything further in the
            // future gets an absolute "MMM d" (or "MMM d, yyyy" if different year).
            if diff > -60 { return "Just now" }
            return absoluteDateString(date, now: now, calendar: calendar)
        }

        let mins = Int(diff / 60)
        let hours = Int(diff / 3_600)

        // "Yesterday" / "Nd ago" are *calendar* concepts, not raw-second
        // concepts: 23h ago at 1am today is still "today"; 18h ago at 6pm
        // yesterday is "Yesterday". Compute the day delta using the
        // provided `calendar` (so tests with a fixed `now` stay deterministic
        // — we can't use `isDateInYesterday` here because it compares to the
        // real system clock, not our `now` parameter).
        let startOfNow = calendar.startOfDay(for: now)
        let startOfDate = calendar.startOfDay(for: date)
        let calDays = calendar.dateComponents([.day], from: startOfDate, to: startOfNow).day ?? 0
        let calWeeks = calDays / 7

        if mins < 1 { return "Just now" }
        if mins < 60 { return "\(mins)m ago" }
        if calDays == 0 { return "\(hours)h ago" }
        if calDays == 1 { return "Yesterday" }
        if calDays < 7 { return "\(calDays)d ago" }
        if calWeeks < 4 { return "\(calWeeks)w ago" }

        return absoluteDateString(date, now: now, calendar: calendar)
    }

    /// Absolute short date: "MMM d" when same year, "MMM d, yyyy" otherwise.
    static func absoluteDateString(
        _ date: Date,
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> String {
        let sameYear = calendar.component(.year, from: date) == calendar.component(.year, from: now)
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = sameYear ? "MMM d" : "MMM d, yyyy"
        return formatter.string(from: date)
    }

    /// "MMM d, yyyy" full date — used by invoice / billing rows.
    static func longDateString(_ dateStr: String?) -> String {
        guard let date = parseISODate(dateStr) else { return "—" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d, yyyy"
        return formatter.string(from: date)
    }

    // MARK: - Event Date Formatting
    //
    // Cached formatters for event-specific formatting. Previously duplicated
    // (and uncached) inside EventsView.

    private static let monthFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "MMM"
        return f
    }()

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "d"
        return f
    }()

    private static let fullDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "EEEE, MMMM d"
        return f
    }()

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "h:mm a"
        return f
    }()

    /// Abbreviated uppercase month: "JUN", "DEC".
    static func eventMonthLabel(_ iso: String) -> String {
        guard let date = parseISODate(iso) else { return "" }
        return monthFormatter.string(from: date).uppercased()
    }

    /// Day of month: "15", "3".
    static func eventDayLabel(_ iso: String) -> String {
        guard let date = parseISODate(iso) else { return "" }
        return dayFormatter.string(from: date)
    }

    /// Full human date: "Sunday, June 15".
    static func eventDateLabel(_ iso: String) -> String {
        guard let date = parseISODate(iso) else { return "" }
        return fullDateFormatter.string(from: date)
    }

    /// 12-hour time: "3:00 PM".
    static func eventTimeLabel(_ iso: String) -> String {
        guard let date = parseISODate(iso) else { return "" }
        return timeFormatter.string(from: date)
    }

    /// Time range: "3:00 PM – 5:00 PM" or just "3:00 PM" if no end.
    static func eventTimeRange(start: String, end: String?) -> String {
        let startStr = eventTimeLabel(start)
        if let end, !end.isEmpty {
            let endStr = eventTimeLabel(end)
            if !endStr.isEmpty {
                return "\(startStr) – \(endStr)"
            }
        }
        return startStr
    }

    /// Dollar-formatted price with no cents: "$25".
    static func formatPrice(_ price: Double) -> String {
        String(format: "$%.0f", price)
    }
}
