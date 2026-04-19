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

    /// "MMM d, yyyy" from a "yyyy-MM-dd" plain date string.
    static func longDateFromPlain(_ dateStr: String) -> String {
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM-dd"
        guard let date = df.date(from: dateStr) else { return dateStr }
        df.dateFormat = "MMM d, yyyy"
        return df.string(from: date)
    }

    // MARK: - Booking / Schedule Dates

    /// Parse a date string ("yyyy-MM-dd") combined with a time string ("HH:mm") into a Date.
    static func parseBookingDate(_ dateStr: String, time: String) -> Date? {
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM-dd HH:mm"
        return df.date(from: "\(dateStr) \(time)")
    }

    /// Parse a due date that may arrive as "yyyy-MM-dd" or full ISO-8601.
    static func parseDueDate(_ dateStr: String?) -> Date? {
        guard let dateStr else { return nil }
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM-dd"
        if let d = df.date(from: dateStr) { return d }
        return parseISODate(dateStr)
    }

    /// Format a Date as a contextual upcoming label: "Today", "Tomorrow", or "EEE, MMM d".
    static func formatUpcomingDate(_ date: Date, calendar: Calendar = .current) -> String {
        if calendar.isDateInToday(date) { return "Today" }
        if calendar.isDateInTomorrow(date) { return "Tomorrow" }
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "EEE, MMM d"
        return df.string(from: date)
    }

    /// Format an "HH:mm" (or "HH:mm:ss") time string into 12-hour format (e.g. "2:30 PM").
    static func formatTime(_ time: String) -> String {
        let parts = time.split(separator: ":")
        guard parts.count >= 2, let hour = Int(parts[0]), let min = Int(parts[1]) else { return time }
        let period = hour >= 12 ? "PM" : "AM"
        let h = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour)
        return min == 0 ? "\(h) \(period)" : "\(h):\(String(format: "%02d", min)) \(period)"
    }

    /// Format an ISO-8601 date string as a time-only label (e.g. "2:30 PM").
    static func formatEventTime(_ iso: String) -> String {
        guard let date = parseISODate(iso) else { return "" }
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "h:mm a"
        return df.string(from: date)
    }

    // MARK: - Event Date Components

    /// Uppercased month abbreviation from an ISO string (e.g. "JUN").
    static func eventMonthLabel(_ iso: String) -> String {
        guard let date = parseISODate(iso) else { return "" }
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "MMM"
        return df.string(from: date).uppercased()
    }

    /// Day-of-month number from an ISO string (e.g. "15").
    static func eventDayLabel(_ iso: String) -> String {
        guard let date = parseISODate(iso) else { return "" }
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "d"
        return df.string(from: date)
    }

    /// Full event date from an ISO string (e.g. "Sunday, June 15").
    static func eventDateLabel(_ iso: String) -> String {
        guard let date = parseISODate(iso) else { return "" }
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "EEEE, MMMM d"
        return df.string(from: date)
    }

    /// Short event date from an ISO string (e.g. "Jun 15").
    static func eventDateShortLabel(_ iso: String) -> String {
        guard let date = parseISODate(iso) else { return iso }
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "MMM d"
        return df.string(from: date)
    }

    /// Time range string for an event with start and optional end ISO dates (e.g. "2:00 PM – 5:00 PM").
    static func eventTimeRange(start: String, end: String?) -> String {
        let startStr = formatEventTime(start)
        if let end {
            let endStr = formatEventTime(end)
            return "\(startStr) – \(endStr)"
        }
        return startStr
    }

    /// Format a "yyyy-MM-dd" date string into "EEE, MMM d" (e.g. "Sun, Jun 15").
    static func formatShortDate(_ dateStr: String) -> String {
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM-dd"
        guard let date = df.date(from: dateStr) else { return dateStr }
        df.dateFormat = "EEE, MMM d"
        return df.string(from: date)
    }
}
