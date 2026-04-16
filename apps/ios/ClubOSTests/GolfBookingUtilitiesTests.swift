import XCTest
@testable import ClubOS

// Tests for GolfBookingUtilities — the pure-logic helpers extracted from
// GolfBookingView. Previously these lived as file-private functions and
// couldn't be reached from XCTest; `isStartRoundEligible` also read
// `Date()` directly, so even if it were accessible it couldn't be tested
// deterministically.

final class GolfBookingUtilitiesTests: XCTestCase {

    // Deterministic UTC calendar so formatters and day-rollover math are
    // stable regardless of the host's locale/timezone.
    private var utcCalendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        cal.locale = Locale(identifier: "en_US_POSIX")
        return cal
    }

    // A fixed reference moment for "now": 2025-06-15 12:00:00 UTC.
    // Chosen off a DST boundary; a Sunday (weekday 1).
    private func fixedNow(hour: Int = 12, minute: Int = 0) -> Date {
        var c = DateComponents()
        c.year = 2025; c.month = 6; c.day = 15
        c.hour = hour; c.minute = minute; c.second = 0
        c.timeZone = TimeZone(identifier: "UTC")
        return Calendar(identifier: .gregorian).date(from: c)!
    }

    // MARK: - timeCategory

    func test_timeCategory_earlyBird_before8am() {
        XCTAssertEqual(GolfBookingUtilities.timeCategory(for: "06:30").label, "Early Bird")
        XCTAssertEqual(GolfBookingUtilities.timeCategory(for: "07:59").label, "Early Bird")
        XCTAssertEqual(GolfBookingUtilities.timeCategory(for: "00:00").label, "Early Bird")
    }

    func test_timeCategory_primeTime_8amToNoon() {
        XCTAssertEqual(GolfBookingUtilities.timeCategory(for: "08:00").label, "Prime Time")
        XCTAssertEqual(GolfBookingUtilities.timeCategory(for: "11:59").label, "Prime Time")
    }

    func test_timeCategory_afternoon_noonTo4pm() {
        XCTAssertEqual(GolfBookingUtilities.timeCategory(for: "12:00").label, "Afternoon")
        XCTAssertEqual(GolfBookingUtilities.timeCategory(for: "15:59").label, "Afternoon")
    }

    func test_timeCategory_twilight_after4pm() {
        XCTAssertEqual(GolfBookingUtilities.timeCategory(for: "16:00").label, "Twilight")
        XCTAssertEqual(GolfBookingUtilities.timeCategory(for: "20:30").label, "Twilight")
    }

    func test_timeCategory_withSeconds_isParsedFromHour() {
        // Input from the server can include seconds ("14:30:00"); the
        // category should still fall out of the 14 hour.
        XCTAssertEqual(GolfBookingUtilities.timeCategory(for: "14:30:00").label, "Afternoon")
    }

    func test_timeCategory_garbageInput_defaultsToPrimeTime_notEarlyBird() {
        // Regression guard: the old implementation used
        // `Int(time.prefix(2)) ?? 0` which silently categorized garbage
        // as "Early Bird" — i.e. it would silently apply the pre-8am
        // discount price label to malformed input. We now default to
        // "Prime Time" instead.
        XCTAssertEqual(GolfBookingUtilities.timeCategory(for: "").label, "Prime Time")
        XCTAssertEqual(GolfBookingUtilities.timeCategory(for: "not-a-time").label, "Prime Time")
        XCTAssertEqual(GolfBookingUtilities.timeCategory(for: "99:00").label, "Prime Time")
    }

    // MARK: - formatTime

    func test_formatTime_morningHours() {
        XCTAssertEqual(GolfBookingUtilities.formatTime("07:30"), "7:30 AM")
        XCTAssertEqual(GolfBookingUtilities.formatTime("11:45"), "11:45 AM")
    }

    func test_formatTime_noon_isTwelvePm_notZero() {
        // Regression: `hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour)`
        // must render 12 as "12 PM", not "0 PM".
        XCTAssertEqual(GolfBookingUtilities.formatTime("12:00"), "12:00 PM")
    }

    func test_formatTime_midnight_isTwelveAm_notZero() {
        XCTAssertEqual(GolfBookingUtilities.formatTime("00:15"), "12:15 AM")
    }

    func test_formatTime_pmHours_subtractTwelve() {
        XCTAssertEqual(GolfBookingUtilities.formatTime("13:05"), "1:05 PM")
        XCTAssertEqual(GolfBookingUtilities.formatTime("23:59"), "11:59 PM")
    }

    func test_formatTime_acceptsServerSecondsSuffix() {
        // The bookings API returns "HH:mm:ss"; the display layer must
        // not choke on it.
        XCTAssertEqual(GolfBookingUtilities.formatTime("09:30:00"), "9:30 AM")
    }

    func test_formatTime_unparseable_returnsInputUnchanged() {
        XCTAssertEqual(GolfBookingUtilities.formatTime("not-a-time"), "not-a-time")
        XCTAssertEqual(GolfBookingUtilities.formatTime(""), "")
        XCTAssertEqual(GolfBookingUtilities.formatTime("25:00"), "25:00")
    }

    // MARK: - formatDate

    func test_formatDate_validIso_isWeekdayShortMonthDay() {
        // 2025-06-15 is a Sunday.
        XCTAssertEqual(
            GolfBookingUtilities.formatDate("2025-06-15", calendar: utcCalendar),
            "Sun, Jun 15"
        )
    }

    func test_formatDate_unparseable_returnsInputUnchanged() {
        XCTAssertEqual(
            GolfBookingUtilities.formatDate("garbage", calendar: utcCalendar),
            "garbage"
        )
    }

    // MARK: - generateBookableDates

    func test_generateBookableDates_defaultsTo14DaysStartingTomorrow() {
        let now = fixedNow()
        let dates = GolfBookingUtilities.generateBookableDates(
            from: now,
            calendar: utcCalendar
        )

        XCTAssertEqual(dates.count, 14)
        // First entry is tomorrow (2025-06-16), last is 14 days out (2025-06-29).
        XCTAssertEqual(dates.first?.dateString, "2025-06-16")
        XCTAssertEqual(dates.last?.dateString, "2025-06-29")

        XCTAssertEqual(dates.first?.dayName, "Mon")
        XCTAssertEqual(dates.first?.dayNum, "16")
        XCTAssertEqual(dates.first?.monthName, "Jun")
    }

    func test_generateBookableDates_customStartOffsetAndCount() {
        let now = fixedNow()
        let dates = GolfBookingUtilities.generateBookableDates(
            from: now,
            startOffset: 0,
            count: 3,
            calendar: utcCalendar
        )

        XCTAssertEqual(dates.count, 3)
        XCTAssertEqual(dates.map(\.dateString), ["2025-06-15", "2025-06-16", "2025-06-17"])
    }

    func test_generateBookableDates_zeroCount_returnsEmpty() {
        let dates = GolfBookingUtilities.generateBookableDates(
            from: fixedNow(),
            startOffset: 1,
            count: 0,
            calendar: utcCalendar
        )
        XCTAssertTrue(dates.isEmpty)
    }

    // MARK: - isStartRoundEligible

    func test_startRoundEligible_rightAtTeeTime() {
        // Tee time 12:00, now 12:00 → eligible.
        let now = fixedNow(hour: 12, minute: 0)
        XCTAssertTrue(GolfBookingUtilities.isStartRoundEligible(
            facilityType: "golf",
            date: "2025-06-15",
            startTime: "12:00",
            now: now,
            calendar: utcCalendar
        ))
    }

    func test_startRoundEligible_thirtyMinutesBefore_isStillEligible() {
        // Lower bound: exactly 30 min before → eligible.
        let now = fixedNow(hour: 11, minute: 30)
        XCTAssertTrue(GolfBookingUtilities.isStartRoundEligible(
            facilityType: "golf",
            date: "2025-06-15",
            startTime: "12:00",
            now: now,
            calendar: utcCalendar
        ))
    }

    func test_startRoundEligible_31MinutesBefore_isNotEligible() {
        // Outside the 30-min pre-tee-time window.
        let now = fixedNow(hour: 11, minute: 29)
        XCTAssertFalse(GolfBookingUtilities.isStartRoundEligible(
            facilityType: "golf",
            date: "2025-06-15",
            startTime: "12:00",
            now: now,
            calendar: utcCalendar
        ))
    }

    func test_startRoundEligible_fourHoursAfter_isStillEligible() {
        // Upper bound: exactly 4 hours after tee time → eligible.
        let now = fixedNow(hour: 16, minute: 0)
        XCTAssertTrue(GolfBookingUtilities.isStartRoundEligible(
            facilityType: "golf",
            date: "2025-06-15",
            startTime: "12:00",
            now: now,
            calendar: utcCalendar
        ))
    }

    func test_startRoundEligible_fourHoursOneMinuteAfter_isNotEligible() {
        let now = fixedNow(hour: 16, minute: 1)
        XCTAssertFalse(GolfBookingUtilities.isStartRoundEligible(
            facilityType: "golf",
            date: "2025-06-15",
            startTime: "12:00",
            now: now,
            calendar: utcCalendar
        ))
    }

    func test_startRoundEligible_differentDay_isNotEligible() {
        // Same time-of-day but booking is tomorrow — must not be eligible.
        let now = fixedNow(hour: 12, minute: 0)
        XCTAssertFalse(GolfBookingUtilities.isStartRoundEligible(
            facilityType: "golf",
            date: "2025-06-16",
            startTime: "12:00",
            now: now,
            calendar: utcCalendar
        ))
    }

    func test_startRoundEligible_nonGolfFacility_isNeverEligible() {
        // Tennis/pickleball/dining bookings should never flip the
        // "Start Round" CTA, even if the date/time are a match.
        let now = fixedNow(hour: 12, minute: 0)
        XCTAssertFalse(GolfBookingUtilities.isStartRoundEligible(
            facilityType: "tennis",
            date: "2025-06-15",
            startTime: "12:00",
            now: now,
            calendar: utcCalendar
        ))
    }

    func test_startRoundEligible_acceptsServerSecondsSuffix() {
        // API returns "HH:mm:ss" — eligibility should still parse correctly.
        let now = fixedNow(hour: 12, minute: 0)
        XCTAssertTrue(GolfBookingUtilities.isStartRoundEligible(
            facilityType: "golf",
            date: "2025-06-15",
            startTime: "12:00:00",
            now: now,
            calendar: utcCalendar
        ))
    }

    func test_startRoundEligible_malformedStartTime_isNotEligible() {
        let now = fixedNow(hour: 12, minute: 0)
        XCTAssertFalse(GolfBookingUtilities.isStartRoundEligible(
            facilityType: "golf",
            date: "2025-06-15",
            startTime: "not-a-time",
            now: now,
            calendar: utcCalendar
        ))
    }
}
