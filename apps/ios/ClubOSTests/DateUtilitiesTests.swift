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

    // MARK: - eventMonthLabel

    func test_eventMonthLabel_returnsUppercasedMonth() {
        XCTAssertEqual(DateUtilities.eventMonthLabel("2025-06-15T12:00:00Z"), "JUN")
        XCTAssertEqual(DateUtilities.eventMonthLabel("2025-12-25T08:00:00Z"), "DEC")
    }

    func test_eventMonthLabel_withFractionalSeconds() {
        XCTAssertEqual(DateUtilities.eventMonthLabel("2025-01-01T00:00:00.000Z"), "JAN")
    }

    func test_eventMonthLabel_invalidReturnsEmpty() {
        XCTAssertEqual(DateUtilities.eventMonthLabel("garbage"), "")
    }

    // MARK: - eventDayLabel

    func test_eventDayLabel_returnsDayOfMonth() {
        XCTAssertEqual(DateUtilities.eventDayLabel("2025-06-15T12:00:00Z"), "15")
        XCTAssertEqual(DateUtilities.eventDayLabel("2025-06-03T12:00:00Z"), "3")
    }

    func test_eventDayLabel_invalidReturnsEmpty() {
        XCTAssertEqual(DateUtilities.eventDayLabel(""), "")
    }

    // MARK: - eventDateLabel

    func test_eventDateLabel_returnsFullDate() {
        let result = DateUtilities.eventDateLabel("2025-06-15T12:00:00Z")
        XCTAssertEqual(result, "Sunday, June 15")
    }

    func test_eventDateLabel_invalidReturnsEmpty() {
        XCTAssertEqual(DateUtilities.eventDateLabel("nope"), "")
    }

    // MARK: - eventTimeLabel

    func test_eventTimeLabel_formats12HourTime() {
        XCTAssertEqual(DateUtilities.eventTimeLabel("2025-06-15T15:30:00Z"), "3:30 PM")
        XCTAssertEqual(DateUtilities.eventTimeLabel("2025-06-15T09:00:00Z"), "9:00 AM")
    }

    func test_eventTimeLabel_midnight() {
        XCTAssertEqual(DateUtilities.eventTimeLabel("2025-06-15T00:00:00Z"), "12:00 AM")
    }

    func test_eventTimeLabel_invalidReturnsEmpty() {
        XCTAssertEqual(DateUtilities.eventTimeLabel(""), "")
    }

    // MARK: - eventTimeRange

    func test_eventTimeRange_withEnd() {
        let result = DateUtilities.eventTimeRange(
            start: "2025-06-15T15:00:00Z",
            end: "2025-06-15T17:00:00Z"
        )
        XCTAssertEqual(result, "3:00 PM – 5:00 PM")
    }

    func test_eventTimeRange_withoutEnd() {
        let result = DateUtilities.eventTimeRange(
            start: "2025-06-15T15:00:00Z",
            end: nil
        )
        XCTAssertEqual(result, "3:00 PM")
    }

    func test_eventTimeRange_emptyEndString() {
        let result = DateUtilities.eventTimeRange(
            start: "2025-06-15T15:00:00Z",
            end: ""
        )
        XCTAssertEqual(result, "3:00 PM")
    }

    // MARK: - formatPrice

    func test_formatPrice_wholeNumber() {
        XCTAssertEqual(DateUtilities.formatPrice(25), "$25")
    }

    func test_formatPrice_roundsDown() {
        XCTAssertEqual(DateUtilities.formatPrice(25.49), "$25")
    }

    func test_formatPrice_roundsUp() {
        XCTAssertEqual(DateUtilities.formatPrice(25.50), "$26")
    }

    func test_formatPrice_zero() {
        XCTAssertEqual(DateUtilities.formatPrice(0), "$0")
    }

    func test_formatPrice_largeAmount() {
        XCTAssertEqual(DateUtilities.formatPrice(1500), "$1500")
    }
}
