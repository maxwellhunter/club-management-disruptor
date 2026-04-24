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

    // MARK: - formatTime24to12

    func test_formatTime_midnight() {
        XCTAssertEqual(DateUtilities.formatTime24to12("00:00"), "12:00 AM")
    }

    func test_formatTime_earlyMorning() {
        XCTAssertEqual(DateUtilities.formatTime24to12("06:30"), "6:30 AM")
    }

    func test_formatTime_noon() {
        XCTAssertEqual(DateUtilities.formatTime24to12("12:00"), "12:00 PM")
    }

    func test_formatTime_afternoon() {
        XCTAssertEqual(DateUtilities.formatTime24to12("14:45"), "2:45 PM")
    }

    func test_formatTime_endOfDay() {
        XCTAssertEqual(DateUtilities.formatTime24to12("23:59"), "11:59 PM")
    }

    func test_formatTime_withSeconds_ignoresSeconds() {
        XCTAssertEqual(DateUtilities.formatTime24to12("09:15:30"), "9:15 AM")
    }

    func test_formatTime_singleDigitMinute() {
        XCTAssertEqual(DateUtilities.formatTime24to12("8:05"), "8:05 AM")
    }

    func test_formatTime_invalidHour_returnsOriginal() {
        XCTAssertEqual(DateUtilities.formatTime24to12("25:00"), "25:00")
    }

    func test_formatTime_invalidMinute_returnsOriginal() {
        XCTAssertEqual(DateUtilities.formatTime24to12("12:61"), "12:61")
    }

    func test_formatTime_garbage_returnsOriginal() {
        XCTAssertEqual(DateUtilities.formatTime24to12("not-a-time"), "not-a-time")
    }

    func test_formatTime_emptyString_returnsOriginal() {
        XCTAssertEqual(DateUtilities.formatTime24to12(""), "")
    }

    func test_formatTime_onlyHour_returnsOriginal() {
        XCTAssertEqual(DateUtilities.formatTime24to12("14"), "14")
    }

    func test_formatTime_negativeHour_returnsOriginal() {
        XCTAssertEqual(DateUtilities.formatTime24to12("-1:00"), "-1:00")
    }

    func test_formatTime_1am() {
        XCTAssertEqual(DateUtilities.formatTime24to12("01:00"), "1:00 AM")
    }

    func test_formatTime_11am() {
        XCTAssertEqual(DateUtilities.formatTime24to12("11:59"), "11:59 AM")
    }

    func test_formatTime_1pm() {
        XCTAssertEqual(DateUtilities.formatTime24to12("13:00"), "1:00 PM")
    }

    // MARK: - formatShortWeekdayDate

    func test_formatShortWeekdayDate_validInput() {
        // 2025-06-15 is a Sunday
        XCTAssertEqual(DateUtilities.formatShortWeekdayDate("2025-06-15"), "Sun, Jun 15")
    }

    func test_formatShortWeekdayDate_monday() {
        // 2025-06-16 is a Monday
        XCTAssertEqual(DateUtilities.formatShortWeekdayDate("2025-06-16"), "Mon, Jun 16")
    }

    func test_formatShortWeekdayDate_invalidInput_returnsOriginal() {
        XCTAssertEqual(DateUtilities.formatShortWeekdayDate("bad-date"), "bad-date")
    }

    func test_formatShortWeekdayDate_differentMonth() {
        // 2025-12-25 is a Thursday
        XCTAssertEqual(DateUtilities.formatShortWeekdayDate("2025-12-25"), "Thu, Dec 25")
    }

    // MARK: - formatLongWeekdayDate

    func test_formatLongWeekdayDate_validInput() {
        // 2025-06-15 is a Sunday
        XCTAssertEqual(DateUtilities.formatLongWeekdayDate("2025-06-15"), "Sunday, Jun 15")
    }

    func test_formatLongWeekdayDate_monday() {
        XCTAssertEqual(DateUtilities.formatLongWeekdayDate("2025-06-16"), "Monday, Jun 16")
    }

    func test_formatLongWeekdayDate_invalidInput_returnsOriginal() {
        XCTAssertEqual(DateUtilities.formatLongWeekdayDate("nope"), "nope")
    }

    func test_formatLongWeekdayDate_wednesday() {
        // 2025-06-18 is a Wednesday
        XCTAssertEqual(DateUtilities.formatLongWeekdayDate("2025-06-18"), "Wednesday, Jun 18")
    }

    // MARK: - generateBookableDates

    func test_generateBookableDates_defaultsTo14Days() {
        let dates = DateUtilities.generateBookableDates(referenceDate: now)
        XCTAssertEqual(dates.count, 14)
    }

    func test_generateBookableDates_defaultStartsAtTomorrow() {
        let cal = Calendar.current
        let tomorrow = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: now))!
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"

        let dates = DateUtilities.generateBookableDates(referenceDate: now)
        XCTAssertEqual(dates.first?.dateString, formatter.string(from: tomorrow))
    }

    func test_generateBookableDates_customCount() {
        let dates = DateUtilities.generateBookableDates(count: 7, referenceDate: now)
        XCTAssertEqual(dates.count, 7)
    }

    func test_generateBookableDates_startOffsetZero_includesReferenceDay() {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        let todayStr = formatter.string(from: Calendar.current.startOfDay(for: now))

        let dates = DateUtilities.generateBookableDates(startOffset: 0, count: 3, referenceDate: now)
        XCTAssertEqual(dates.first?.dateString, todayStr)
    }

    func test_generateBookableDates_includeRelative_todayAndTomorrow() {
        let dates = DateUtilities.generateBookableDates(
            startOffset: 0, count: 3, includeRelative: true, referenceDate: now
        )
        XCTAssertEqual(dates[0].dayName, "Today")
        XCTAssertEqual(dates[1].dayName, "Tomorrow")
        // Third day should be a weekday name, not "Today"/"Tomorrow"
        XCTAssertFalse(dates[2].dayName == "Today" || dates[2].dayName == "Tomorrow")
    }

    func test_generateBookableDates_withoutRelative_usesWeekdayNames() {
        let dates = DateUtilities.generateBookableDates(
            startOffset: 0, count: 2, includeRelative: false, referenceDate: now
        )
        XCTAssertNotEqual(dates[0].dayName, "Today")
        XCTAssertNotEqual(dates[1].dayName, "Tomorrow")
    }

    func test_generateBookableDates_dateStringsAreSequential() {
        let dates = DateUtilities.generateBookableDates(startOffset: 1, count: 5, referenceDate: now)
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        let cal = Calendar.current
        let base = cal.startOfDay(for: now)

        for (i, bd) in dates.enumerated() {
            let expected = cal.date(byAdding: .day, value: i + 1, to: base)!
            XCTAssertEqual(bd.dateString, formatter.string(from: expected), "Date at index \(i) should be offset \(i + 1)")
        }
    }

    func test_generateBookableDates_dayNumAndMonthNameAreConsistent() {
        let dates = DateUtilities.generateBookableDates(referenceDate: now)
        for bd in dates {
            XCTAssertFalse(bd.dayNum.isEmpty, "dayNum should not be empty")
            XCTAssertFalse(bd.monthName.isEmpty, "monthName should not be empty")
            XCTAssertFalse(bd.dayName.isEmpty, "dayName should not be empty")
        }
    }

    func test_generateBookableDates_idsAreUnique() {
        let dates = DateUtilities.generateBookableDates(referenceDate: now)
        let ids = Set(dates.map(\.id))
        XCTAssertEqual(ids.count, dates.count, "All date IDs should be unique")
    }

    func test_generateBookableDates_zeroCount_returnsEmpty() {
        let dates = DateUtilities.generateBookableDates(count: 0, referenceDate: now)
        XCTAssertTrue(dates.isEmpty)
    }
}
