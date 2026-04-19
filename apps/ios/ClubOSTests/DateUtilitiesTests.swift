import XCTest
@testable import ClubOS

final class DateUtilitiesTests: XCTestCase {
    // A fixed reference point so "now" is deterministic across test runs.
    // 2025-06-15 12:00:00 UTC — chosen arbitrarily; not near a DST boundary.
    private let now: Date = {
        var comps = DateComponents()
        comps.year = 2025
        comps.month = 6
        comps.day = 15
        comps.hour = 12
        comps.minute = 0
        comps.second = 0
        comps.timeZone = TimeZone(identifier: "UTC")
        return Calendar(identifier: .gregorian).date(from: comps)!
    }()

    private var utcCalendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        return cal
    }

    // MARK: - parseISODate

    func test_parseISODate_nilOrEmpty_returnsNil() {
        XCTAssertNil(DateUtilities.parseISODate(nil))
        XCTAssertNil(DateUtilities.parseISODate(""))
    }

    func test_parseISODate_acceptsFractionalSeconds() {
        let date = DateUtilities.parseISODate("2025-06-15T11:59:59.123Z")
        XCTAssertNotNil(date)
    }

    func test_parseISODate_acceptsBasicISO() {
        let date = DateUtilities.parseISODate("2025-06-15T11:59:59Z")
        XCTAssertNotNil(date)
    }

    func test_parseISODate_rejectsGarbage() {
        XCTAssertNil(DateUtilities.parseISODate("not-a-date"))
    }

    // MARK: - relativeTimeString — past

    func test_relative_justNow_underOneMinute() {
        // 30s ago
        let iso = "2025-06-15T11:59:30Z"
        XCTAssertEqual(
            DateUtilities.relativeTimeString(from: iso, now: now, calendar: utcCalendar),
            "Just now"
        )
    }

    func test_relative_minutesAgo() {
        // 5m ago
        let iso = "2025-06-15T11:55:00Z"
        XCTAssertEqual(
            DateUtilities.relativeTimeString(from: iso, now: now, calendar: utcCalendar),
            "5m ago"
        )
    }

    func test_relative_hoursAgo() {
        // 3h ago
        let iso = "2025-06-15T09:00:00Z"
        XCTAssertEqual(
            DateUtilities.relativeTimeString(from: iso, now: now, calendar: utcCalendar),
            "3h ago"
        )
    }

    func test_relative_yesterday_usesCalendarNotRawHours() {
        // 18h ago but on the previous calendar day in UTC.
        // now = 2025-06-15 12:00 UTC; event at 2025-06-14 18:00 UTC.
        let iso = "2025-06-14T18:00:00Z"
        XCTAssertEqual(
            DateUtilities.relativeTimeString(from: iso, now: now, calendar: utcCalendar),
            "Yesterday"
        )
    }

    func test_relative_daysAgo() {
        // 3 days ago → "3d ago"
        let iso = "2025-06-12T12:00:00Z"
        XCTAssertEqual(
            DateUtilities.relativeTimeString(from: iso, now: now, calendar: utcCalendar),
            "3d ago"
        )
    }

    func test_relative_weeksAgo() {
        // 2 weeks ago
        let iso = "2025-06-01T12:00:00Z"
        XCTAssertEqual(
            DateUtilities.relativeTimeString(from: iso, now: now, calendar: utcCalendar),
            "2w ago"
        )
    }

    func test_relative_fallsBackToAbsoluteAfterFourWeeks() {
        // 5 weeks ago → "May 11" (same year)
        let iso = "2025-05-11T12:00:00Z"
        XCTAssertEqual(
            DateUtilities.relativeTimeString(from: iso, now: now, calendar: utcCalendar),
            "May 11"
        )
    }

    func test_relative_priorYearIncludesYear() {
        // 2024 → must include year to avoid ambiguity
        let iso = "2024-12-01T12:00:00Z"
        XCTAssertEqual(
            DateUtilities.relativeTimeString(from: iso, now: now, calendar: utcCalendar),
            "Dec 1, 2024"
        )
    }

    // MARK: - relativeTimeString — future & edge cases

    func test_relative_smallFutureSkew_isJustNow() {
        // 30s in the future → clock skew, treat as "Just now"
        let iso = "2025-06-15T12:00:30Z"
        XCTAssertEqual(
            DateUtilities.relativeTimeString(from: iso, now: now, calendar: utcCalendar),
            "Just now"
        )
    }

    func test_relative_farFuture_showsAbsoluteDate() {
        // 2 hours in the future — previously would render as a large negative
        // integer like "-120m ago"; should now be an absolute string.
        let iso = "2025-06-15T14:00:00Z"
        XCTAssertEqual(
            DateUtilities.relativeTimeString(from: iso, now: now, calendar: utcCalendar),
            "Jun 15"
        )
    }

    func test_relative_nilReturnsEmpty() {
        XCTAssertEqual(DateUtilities.relativeTimeString(from: nil, now: now), "")
    }

    func test_relative_unparseableReturnsInput() {
        XCTAssertEqual(
            DateUtilities.relativeTimeString(from: "garbage", now: now),
            "garbage"
        )
    }

    // MARK: - longDateString

    func test_longDate_formatsIsoInput() {
        // Use noon UTC so the rendered day is stable across common host timezones.
        XCTAssertEqual(
            DateUtilities.longDateString("2025-01-02T12:00:00Z"),
            "Jan 2, 2025"
        )
    }

    func test_longDate_nilReturnsEmDash() {
        XCTAssertEqual(DateUtilities.longDateString(nil), "—")
        XCTAssertEqual(DateUtilities.longDateString("nope"), "—")
    }

    // MARK: - longDateFromPlain

    func test_longDateFromPlain_formatsYMD() {
        XCTAssertEqual(DateUtilities.longDateFromPlain("2025-01-02"), "Jan 2, 2025")
    }

    func test_longDateFromPlain_invalidReturnsSelf() {
        XCTAssertEqual(DateUtilities.longDateFromPlain("nope"), "nope")
    }

    // MARK: - parseBookingDate

    func test_parseBookingDate_validDateAndTime() {
        let date = DateUtilities.parseBookingDate("2025-06-15", time: "14:30")
        XCTAssertNotNil(date)
        let cal = utcCalendar
        let comps = cal.dateComponents([.year, .month, .day, .hour, .minute], from: date!)
        XCTAssertEqual(comps.year, 2025)
        XCTAssertEqual(comps.month, 6)
        XCTAssertEqual(comps.day, 15)
        XCTAssertEqual(comps.hour, 14)
        XCTAssertEqual(comps.minute, 30)
    }

    func test_parseBookingDate_invalidReturnsNil() {
        XCTAssertNil(DateUtilities.parseBookingDate("bad", time: "14:30"))
        XCTAssertNil(DateUtilities.parseBookingDate("2025-06-15", time: "bad"))
    }

    // MARK: - parseDueDate

    func test_parseDueDate_nil_returnsNil() {
        XCTAssertNil(DateUtilities.parseDueDate(nil))
    }

    func test_parseDueDate_plainYMD() {
        let date = DateUtilities.parseDueDate("2025-06-15")
        XCTAssertNotNil(date)
    }

    func test_parseDueDate_isoFormat() {
        let date = DateUtilities.parseDueDate("2025-06-15T12:00:00Z")
        XCTAssertNotNil(date)
    }

    func test_parseDueDate_garbage_returnsNil() {
        XCTAssertNil(DateUtilities.parseDueDate("garbage"))
    }

    // MARK: - formatUpcomingDate

    func test_formatUpcomingDate_today() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        XCTAssertEqual(DateUtilities.formatUpcomingDate(now, calendar: cal), "Today")
    }

    func test_formatUpcomingDate_tomorrow() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let tomorrow = cal.date(byAdding: .day, value: 1, to: now)!
        XCTAssertEqual(DateUtilities.formatUpcomingDate(tomorrow, calendar: cal), "Tomorrow")
    }

    func test_formatUpcomingDate_otherDay() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let future = cal.date(byAdding: .day, value: 3, to: now)!
        let result = DateUtilities.formatUpcomingDate(future, calendar: cal)
        XCTAssertTrue(result.contains("Jun"), "Expected month, got: \(result)")
        XCTAssertTrue(result.contains("18"), "Expected day, got: \(result)")
    }

    // MARK: - formatTime

    func test_formatTime_morning() {
        XCTAssertEqual(DateUtilities.formatTime("09:30"), "9:30 AM")
    }

    func test_formatTime_afternoon() {
        XCTAssertEqual(DateUtilities.formatTime("14:30"), "2:30 PM")
    }

    func test_formatTime_noon() {
        XCTAssertEqual(DateUtilities.formatTime("12:00"), "12 PM")
    }

    func test_formatTime_midnight() {
        XCTAssertEqual(DateUtilities.formatTime("00:00"), "12 AM")
    }

    func test_formatTime_onTheHour() {
        XCTAssertEqual(DateUtilities.formatTime("15:00"), "3 PM")
    }

    func test_formatTime_withSeconds() {
        XCTAssertEqual(DateUtilities.formatTime("08:45:00"), "8:45 AM")
    }

    func test_formatTime_invalid() {
        XCTAssertEqual(DateUtilities.formatTime("bad"), "bad")
    }

    // MARK: - formatEventTime

    func test_formatEventTime_validISO() {
        let result = DateUtilities.formatEventTime("2025-06-15T14:30:00Z")
        XCTAssertTrue(result.contains("30"), "Expected minutes, got: \(result)")
    }

    func test_formatEventTime_invalidReturnsEmpty() {
        XCTAssertEqual(DateUtilities.formatEventTime("bad"), "")
    }

    // MARK: - eventMonthLabel

    func test_eventMonthLabel_returnsUppercased() {
        XCTAssertEqual(DateUtilities.eventMonthLabel("2025-06-15T12:00:00Z"), "JUN")
    }

    func test_eventMonthLabel_invalidReturnsEmpty() {
        XCTAssertEqual(DateUtilities.eventMonthLabel("bad"), "")
    }

    // MARK: - eventDayLabel

    func test_eventDayLabel_returnsDay() {
        XCTAssertEqual(DateUtilities.eventDayLabel("2025-06-15T12:00:00Z"), "15")
    }

    func test_eventDayLabel_invalidReturnsEmpty() {
        XCTAssertEqual(DateUtilities.eventDayLabel("bad"), "")
    }

    // MARK: - eventDateLabel

    func test_eventDateLabel_fullFormat() {
        let result = DateUtilities.eventDateLabel("2025-06-15T12:00:00Z")
        XCTAssertTrue(result.contains("June"), "Expected full month, got: \(result)")
        XCTAssertTrue(result.contains("15"), "Expected day, got: \(result)")
    }

    func test_eventDateLabel_invalidReturnsEmpty() {
        XCTAssertEqual(DateUtilities.eventDateLabel("bad"), "")
    }

    // MARK: - eventDateShortLabel

    func test_eventDateShortLabel_shortFormat() {
        XCTAssertEqual(DateUtilities.eventDateShortLabel("2025-06-15T12:00:00Z"), "Jun 15")
    }

    func test_eventDateShortLabel_invalidReturnsSelf() {
        XCTAssertEqual(DateUtilities.eventDateShortLabel("bad"), "bad")
    }

    // MARK: - eventTimeRange

    func test_eventTimeRange_startOnly() {
        let result = DateUtilities.eventTimeRange(start: "2025-06-15T14:00:00Z", end: nil)
        XCTAssertFalse(result.contains("–"), "Should not have range separator")
        XCTAssertFalse(result.isEmpty)
    }

    func test_eventTimeRange_startAndEnd() {
        let result = DateUtilities.eventTimeRange(
            start: "2025-06-15T14:00:00Z",
            end: "2025-06-15T17:00:00Z"
        )
        XCTAssertTrue(result.contains("–"), "Expected range separator, got: \(result)")
    }

    // MARK: - formatShortDate

    func test_formatShortDate_validYMD() {
        let result = DateUtilities.formatShortDate("2025-06-15")
        XCTAssertTrue(result.contains("Jun"), "Expected month, got: \(result)")
        XCTAssertTrue(result.contains("15"), "Expected day, got: \(result)")
    }

    func test_formatShortDate_invalidReturnsSelf() {
        XCTAssertEqual(DateUtilities.formatShortDate("bad"), "bad")
    }
}
