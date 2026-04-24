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

    // MARK: - Time Formatting (24h → 12h)

    /// Convert a 24-hour time string ("HH:mm" or "HH:mm:ss") to 12-hour format ("h:mm AM/PM").
    /// Returns the original string unchanged if parsing fails.
    static func formatTime24to12(_ time: String) -> String {
        let parts = time.split(separator: ":")
        guard parts.count >= 2,
              let hour = Int(parts[0]),
              let minute = Int(parts[1]),
              (0...23).contains(hour),
              (0...59).contains(minute)
        else { return time }
        let hour12 = hour % 12 == 0 ? 12 : hour % 12
        let ampm = hour < 12 ? "AM" : "PM"
        return String(format: "%d:%02d %@", hour12, minute, ampm)
    }

    // MARK: - Date-only String Formatting

    /// Parse a "yyyy-MM-dd" date string and format it as "EEE, MMM d" (e.g. "Mon, Jun 15").
    /// Returns the original string if parsing fails.
    static func formatShortWeekdayDate(_ dateStr: String) -> String {
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.dateFormat = "yyyy-MM-dd"
        guard let date = parser.date(from: dateStr) else { return dateStr }
        let out = DateFormatter()
        out.locale = Locale(identifier: "en_US_POSIX")
        out.dateFormat = "EEE, MMM d"
        return out.string(from: date)
    }

    /// Parse a "yyyy-MM-dd" date string and format it as "EEEE, MMM d" (e.g. "Monday, Jun 15").
    /// Returns the original string if parsing fails.
    static func formatLongWeekdayDate(_ dateStr: String) -> String {
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.dateFormat = "yyyy-MM-dd"
        guard let date = parser.date(from: dateStr) else { return dateStr }
        let out = DateFormatter()
        out.locale = Locale(identifier: "en_US_POSIX")
        out.dateFormat = "EEEE, MMM d"
        return out.string(from: date)
    }

    // MARK: - Bookable Date Generation

    struct BookableDate: Sendable, Identifiable {
        var id: String { dateString }
        let dateString: String   // "yyyy-MM-dd"
        let dayName: String      // "Mon" (or "Today"/"Tomorrow" if includeRelative)
        let dayNum: String       // "15"
        let monthName: String    // "Jun"
    }

    /// Generate an array of upcoming bookable dates.
    ///
    /// - Parameters:
    ///   - startOffset: Days from `referenceDate` to begin (1 = tomorrow). Defaults to 1.
    ///   - count: Number of dates to generate. Defaults to 14.
    ///   - includeRelative: If true, uses "Today"/"Tomorrow" labels for offsets 0/1. Defaults to false.
    ///   - referenceDate: The base date. Defaults to today.
    static func generateBookableDates(
        startOffset: Int = 1,
        count: Int = 14,
        includeRelative: Bool = false,
        referenceDate: Date = Date()
    ) -> [BookableDate] {
        let calendar = Calendar.current
        let baseDate = calendar.startOfDay(for: referenceDate)
        let isoFormatter = DateFormatter()
        isoFormatter.locale = Locale(identifier: "en_US_POSIX")
        isoFormatter.dateFormat = "yyyy-MM-dd"
        let weekdayFormatter = DateFormatter()
        weekdayFormatter.locale = Locale(identifier: "en_US_POSIX")
        weekdayFormatter.dateFormat = "EEE"
        let dayFormatter = DateFormatter()
        dayFormatter.locale = Locale(identifier: "en_US_POSIX")
        dayFormatter.dateFormat = "d"
        let monthFormatter = DateFormatter()
        monthFormatter.locale = Locale(identifier: "en_US_POSIX")
        monthFormatter.dateFormat = "MMM"

        var dates: [BookableDate] = []
        for offset in startOffset..<(startOffset + count) {
            guard let date = calendar.date(byAdding: .day, value: offset, to: baseDate) else { continue }
            let dayName: String
            if includeRelative && offset == 0 {
                dayName = "Today"
            } else if includeRelative && offset == 1 {
                dayName = "Tomorrow"
            } else {
                dayName = weekdayFormatter.string(from: date)
            }
            dates.append(BookableDate(
                dateString: isoFormatter.string(from: date),
                dayName: dayName,
                dayNum: dayFormatter.string(from: date),
                monthName: monthFormatter.string(from: date)
            ))
        }
        return dates
    }
}
