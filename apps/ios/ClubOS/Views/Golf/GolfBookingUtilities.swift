import Foundation
import SwiftUI

// MARK: - Golf Booking Utilities
//
// Pure helpers extracted from GolfBookingView so they can be unit-tested
// without standing up a SwiftUI view hierarchy.
//
// Previously these lived as file-private functions at the bottom of
// GolfBookingView.swift (formatTime, formatDate, timeCategory,
// generateBookableDates) and as a private instance method
// (isStartRoundEligible). Two problems:
//
//   1. `private` at file scope kept them out of reach of XCTest.
//   2. `isStartRoundEligible` read `Date()` directly, so even if it were
//      accessible it couldn't be tested deterministically — a round that
//      qualifies today won't qualify tomorrow.
//
// The `isStartRoundEligible` signature now accepts injected `now:` and
// `calendar:` parameters (defaulting to `Date()` / `.current`) so tests
// can pin the clock. Same pattern already used by DateUtilities.

enum GolfBookingUtilities {

    // MARK: - Time Category (slot pricing label)

    /// Categorize a tee-time-of-day into the display label the wizard
    /// shows beside each slot ("Early Bird" / "Prime Time" / "Afternoon" /
    /// "Twilight"). Input is a 24-hour "HH:mm" or "HH:mm:ss" string.
    ///
    /// If the hour can't be parsed (malformed input) we default to
    /// "Prime Time" rather than "Early Bird" — "Early Bird" implies an
    /// 8am-or-earlier discount, and silently applying that discount to
    /// garbage input would be a pricing bug. "Prime Time" is the neutral
    /// default.
    static func timeCategory(for time: String) -> TimeCategory {
        guard let hour = parseHour(time) else {
            return TimeCategory(label: "Prime Time", color: Color(hex: "ea580c"))
        }
        switch hour {
        case ..<8:
            return TimeCategory(label: "Early Bird", color: Color(hex: "7c3aed"))
        case ..<12:
            return TimeCategory(label: "Prime Time", color: Color(hex: "ea580c"))
        case ..<16:
            return TimeCategory(label: "Afternoon", color: Color(hex: "0369a1"))
        default:
            return TimeCategory(label: "Twilight", color: Color(hex: "0284c7"))
        }
    }

    // MARK: - Time / Date formatting

    /// Convert a 24-hour "HH:mm" (or "HH:mm:ss") string into a 12-hour
    /// display string like "7:30 AM" / "12:00 PM" / "11:45 PM".
    ///
    /// Returns the raw input if it can't be parsed — callers treat this
    /// as "show the server's value as-is rather than crash".
    static func formatTime(_ time: String) -> String {
        let parts = time.split(separator: ":")
        guard parts.count >= 2,
              let hour = Int(parts[0]),
              (0...23).contains(hour)
        else { return time }
        // Accept only the minute digits; ignore anything past ":mm".
        let minute = String(parts[1])
        let ampm = hour >= 12 ? "PM" : "AM"
        let display: Int
        if hour == 0 {
            display = 12              // midnight
        } else if hour > 12 {
            display = hour - 12
        } else {
            display = hour            // 1..12 pass through (noon is "12 PM")
        }
        return "\(display):\(minute) \(ampm)"
    }

    /// Convert an ISO "yyyy-MM-dd" date string into a user-facing
    /// "EEE, MMM d" string like "Wed, Jun 18". Returns the raw input if
    /// it can't be parsed.
    static func formatDate(_ dateStr: String, calendar: Calendar = .current) -> String {
        let parse = DateFormatter()
        parse.calendar = calendar
        parse.timeZone = calendar.timeZone
        parse.locale = Locale(identifier: "en_US_POSIX")
        parse.dateFormat = "yyyy-MM-dd"
        guard let date = parse.date(from: dateStr) else { return dateStr }

        let format = DateFormatter()
        format.calendar = calendar
        format.timeZone = calendar.timeZone
        format.locale = Locale(identifier: "en_US_POSIX")
        format.dateFormat = "EEE, MMM d"
        return format.string(from: date)
    }

    // MARK: - Bookable Date Strip

    /// Build the horizontal "date strip" the wizard shows above the slot
    /// list — `count` days starting from `startOffset` days after `now`.
    /// Defaults reproduce the old behavior (14 days starting tomorrow).
    static func generateBookableDates(
        from now: Date = Date(),
        startOffset: Int = 1,
        count: Int = 14,
        calendar: Calendar = .current
    ) -> [BookableDate] {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: "en_US_POSIX")
        var dates: [BookableDate] = []

        for offset in 0..<count {
            let dayOffset = startOffset + offset
            guard let date = calendar.date(byAdding: .day, value: dayOffset, to: now) else { continue }

            formatter.dateFormat = "yyyy-MM-dd"
            let dateString = formatter.string(from: date)

            formatter.dateFormat = "EEE"
            let dayName = formatter.string(from: date)

            formatter.dateFormat = "d"
            let dayNum = formatter.string(from: date)

            formatter.dateFormat = "MMM"
            let monthName = formatter.string(from: date)

            dates.append(BookableDate(
                dateString: dateString,
                dayName: dayName,
                dayNum: dayNum,
                monthName: monthName
            ))
        }
        return dates
    }

    // MARK: - Start Round Eligibility

    /// A round is eligible to "start" (score-entry mode) if it's a golf
    /// booking happening today and `now` falls within 30 min before →
    /// 4 hours after tee time. Outside this window the card falls back
    /// to the secondary "Track Round" label.
    ///
    /// `now` and `calendar` are injectable so tests can pin the clock.
    /// This was previously hard-coded to `Date()` / `.current`, which
    /// is why it shipped without tests.
    static func isStartRoundEligible(
        facilityType: String,
        date: String,
        startTime: String,
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> Bool {
        guard facilityType == "golf" else { return false }

        let df = DateFormatter()
        df.calendar = calendar
        df.timeZone = calendar.timeZone
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM-dd"
        let today = df.string(from: now)
        guard date == today else { return false }

        guard let (hour, minute) = parseHourMinute(startTime) else { return false }

        var components = calendar.dateComponents([.year, .month, .day], from: now)
        components.hour = hour
        components.minute = minute
        guard let teeTime = calendar.date(from: components) else { return false }

        let earliest = teeTime.addingTimeInterval(-30 * 60)       // 30 min before
        let latest   = teeTime.addingTimeInterval(4 * 60 * 60)    // 4 hours after
        return now >= earliest && now <= latest
    }

    // MARK: - Private helpers

    /// Parse the leading hour from "HH", "HH:mm", or "HH:mm:ss".
    private static func parseHour(_ time: String) -> Int? {
        let parts = time.split(separator: ":")
        guard let first = parts.first, let hour = Int(first), (0...23).contains(hour) else {
            return nil
        }
        return hour
    }

    /// Parse the "HH:mm" prefix. Returns nil if either component is
    /// missing or out of range.
    private static func parseHourMinute(_ time: String) -> (hour: Int, minute: Int)? {
        let parts = time.split(separator: ":")
        guard parts.count >= 2,
              let hour = Int(parts[0]),
              let minute = Int(parts[1]),
              (0...23).contains(hour),
              (0...59).contains(minute)
        else { return nil }
        return (hour, minute)
    }
}
