import XCTest
@testable import ClubOS

final class ModelTests: XCTestCase {

    // MARK: - BookingStatus

    func test_bookingStatus_decodesFromSnakeCase() throws {
        let json = Data(#"{"id":"00000000-0000-0000-0000-000000000001","member_id":"00000000-0000-0000-0000-000000000002","facility_id":"00000000-0000-0000-0000-000000000003","date":"2025-07-01","start_time":"08:00","party_size":4,"status":"no_show","facility_name":"Golf Course"}"#.utf8)
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let booking = try decoder.decode(Booking.self, from: json)
        XCTAssertEqual(booking.status, .noShow)
    }

    func test_bookingStatus_decodesAllCases() throws {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        for status in ["confirmed", "pending", "cancelled", "completed", "no_show"] {
            let json = Data(#"{"id":"00000000-0000-0000-0000-000000000001","member_id":"00000000-0000-0000-0000-000000000002","facility_id":"00000000-0000-0000-0000-000000000003","date":"2025-07-01","start_time":"08:00","party_size":2,"status":"\#(status)"}"#.utf8)
            let booking = try decoder.decode(Booking.self, from: json)
            XCTAssertEqual(booking.status.rawValue, status, "Failed to decode status: \(status)")
        }
    }

    func test_bookingStatus_label() {
        XCTAssertEqual(BookingStatus.confirmed.label, "Confirmed")
        XCTAssertEqual(BookingStatus.noShow.label, "No Show")
        XCTAssertEqual(BookingStatus.pending.label, "Pending")
    }

    func test_bookingStatus_encodesToRawValue() throws {
        let encoder = JSONEncoder()
        let data = try encoder.encode(BookingStatus.noShow)
        let str = String(data: data, encoding: .utf8)
        XCTAssertEqual(str, #""no_show""#)
    }

    // MARK: - Booking computed properties

    func test_booking_isCancellable_confirmedOrPending() {
        let confirmed = makeBooking(status: .confirmed)
        let pending = makeBooking(status: .pending)
        let cancelled = makeBooking(status: .cancelled)
        let completed = makeBooking(status: .completed)
        let noShow = makeBooking(status: .noShow)

        XCTAssertTrue(confirmed.isCancellable)
        XCTAssertTrue(pending.isCancellable)
        XCTAssertFalse(cancelled.isCancellable)
        XCTAssertFalse(completed.isCancellable)
        XCTAssertFalse(noShow.isCancellable)
    }

    func test_booking_isUpcoming_futureConfirmed() {
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date())!
        let iso = ISO8601DateFormatter().string(from: tomorrow)
        let booking = makeBooking(status: .confirmed, date: iso)
        XCTAssertTrue(booking.isUpcoming)
    }

    func test_booking_isUpcoming_cancelledNotUpcoming() {
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date())!
        let iso = ISO8601DateFormatter().string(from: tomorrow)
        let booking = makeBooking(status: .cancelled, date: iso)
        XCTAssertFalse(booking.isUpcoming)
    }

    func test_booking_isUpcoming_pastNotUpcoming() {
        let booking = makeBooking(status: .confirmed, date: "2020-01-01T08:00:00Z")
        XCTAssertFalse(booking.isUpcoming)
    }

    // MARK: - EventStatus

    func test_eventStatus_decodesAllCases() throws {
        for status in ["draft", "published", "cancelled", "completed"] {
            let json = Data(#""\#(status)""#.utf8)
            let decoded = try JSONDecoder().decode(EventStatus.self, from: json)
            XCTAssertEqual(decoded.rawValue, status)
        }
    }

    func test_eventStatus_label() {
        XCTAssertEqual(EventStatus.draft.label, "Draft")
        XCTAssertEqual(EventStatus.published.label, "Published")
    }

    // MARK: - RsvpStatus

    func test_rsvpStatus_decodesAllCases() throws {
        for status in ["attending", "declined", "waitlisted"] {
            let json = Data(#""\#(status)""#.utf8)
            let decoded = try JSONDecoder().decode(RsvpStatus.self, from: json)
            XCTAssertEqual(decoded.rawValue, status)
        }
    }

    func test_rsvpStatus_label() {
        XCTAssertEqual(RsvpStatus.attending.label, "Attending")
        XCTAssertEqual(RsvpStatus.declined.label, "Declined")
        XCTAssertEqual(RsvpStatus.waitlisted.label, "Waitlisted")
    }

    func test_rsvpStatus_encodesToRawValue() throws {
        let encoder = JSONEncoder()
        let data = try encoder.encode(RsvpStatus.attending)
        let str = String(data: data, encoding: .utf8)
        XCTAssertEqual(str, #""attending""#)
    }

    // MARK: - InvoiceStatus

    func test_invoiceStatus_decodesAllCases() throws {
        for status in ["draft", "sent", "paid", "overdue", "cancelled", "void"] {
            let json = Data(#""\#(status)""#.utf8)
            let decoded = try JSONDecoder().decode(InvoiceStatus.self, from: json)
            XCTAssertEqual(decoded.rawValue, status)
        }
    }

    func test_invoiceStatus_isPaid() {
        XCTAssertTrue(InvoiceStatus.paid.isPaid)
        XCTAssertFalse(InvoiceStatus.sent.isPaid)
        XCTAssertFalse(InvoiceStatus.overdue.isPaid)
    }

    func test_invoiceStatus_isOutstanding() {
        XCTAssertTrue(InvoiceStatus.sent.isOutstanding)
        XCTAssertTrue(InvoiceStatus.overdue.isOutstanding)
        XCTAssertFalse(InvoiceStatus.paid.isOutstanding)
        XCTAssertFalse(InvoiceStatus.draft.isOutstanding)
        XCTAssertFalse(InvoiceStatus.cancelled.isOutstanding)
        XCTAssertFalse(InvoiceStatus.void.isOutstanding)
    }

    func test_invoice_computedProperties_delegateToStatus() throws {
        let json = Data(#"{"id":"00000000-0000-0000-0000-000000000001","member_id":"00000000-0000-0000-0000-000000000002","amount":150.00,"status":"overdue","description":"Monthly Dues","due_date":"2025-06-01"}"#.utf8)
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let invoice = try decoder.decode(Invoice.self, from: json)
        XCTAssertTrue(invoice.isOutstanding)
        XCTAssertFalse(invoice.isPaid)
    }

    // MARK: - AnnouncementPriority

    func test_announcementPriority_decodesAllCases() throws {
        for priority in ["low", "normal", "high", "urgent"] {
            let json = Data(#""\#(priority)""#.utf8)
            let decoded = try JSONDecoder().decode(AnnouncementPriority.self, from: json)
            XCTAssertEqual(decoded.rawValue, priority)
        }
    }

    func test_announcementPriority_label() {
        XCTAssertEqual(AnnouncementPriority.low.label, "Low")
        XCTAssertEqual(AnnouncementPriority.normal.label, "Normal")
        XCTAssertEqual(AnnouncementPriority.high.label, "High")
        XCTAssertEqual(AnnouncementPriority.urgent.label, "Urgent")
    }

    func test_announcementPriority_allCases() {
        XCTAssertEqual(AnnouncementPriority.allCases.count, 4)
    }

    // MARK: - ClubEvent computed properties

    func test_clubEvent_isFull_withCapacity() {
        let event = makeEvent(capacity: 50, rsvpCount: 50)
        XCTAssertTrue(event.isFull)
    }

    func test_clubEvent_isFull_underCapacity() {
        let event = makeEvent(capacity: 50, rsvpCount: 30)
        XCTAssertFalse(event.isFull)
    }

    func test_clubEvent_isFull_noCapacity() {
        let event = makeEvent(capacity: nil, rsvpCount: 100)
        XCTAssertFalse(event.isFull)
    }

    func test_clubEvent_spotsRemaining() {
        let event = makeEvent(capacity: 50, rsvpCount: 45)
        XCTAssertEqual(event.spotsRemaining, 5)
    }

    func test_clubEvent_spotsRemaining_overCapacity() {
        let event = makeEvent(capacity: 50, rsvpCount: 55)
        XCTAssertEqual(event.spotsRemaining, 0)
    }

    func test_clubEvent_spotsRemaining_noCapacity() {
        let event = makeEvent(capacity: nil, rsvpCount: 10)
        XCTAssertNil(event.spotsRemaining)
    }

    func test_clubEvent_isPublished() {
        XCTAssertTrue(makeEvent(status: .published).isPublished)
        XCTAssertFalse(makeEvent(status: .draft).isPublished)
        XCTAssertFalse(makeEvent(status: .cancelled).isPublished)
    }

    func test_clubEvent_isCancelled() {
        XCTAssertTrue(makeEvent(status: .cancelled).isCancelled)
        XCTAssertFalse(makeEvent(status: .published).isCancelled)
    }

    // MARK: - ClubEvent full JSON decode

    func test_clubEvent_decodesWithEnumFields() throws {
        let json = Data(#"{"id":"evt-1","title":"Summer Gala","start_date":"2025-07-04T18:00:00Z","rsvp_count":25,"status":"published","user_rsvp_status":"attending","capacity":100}"#.utf8)
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let event = try decoder.decode(ClubEvent.self, from: json)
        XCTAssertEqual(event.status, .published)
        XCTAssertEqual(event.userRsvpStatus, .attending)
        XCTAssertTrue(event.isPublished)
        XCTAssertEqual(event.spotsRemaining, 75)
    }

    func test_clubEvent_decodesWithNullOptionalEnums() throws {
        let json = Data(#"{"id":"evt-2","title":"Pool Party","start_date":"2025-08-01T14:00:00Z","rsvp_count":0}"#.utf8)
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let event = try decoder.decode(ClubEvent.self, from: json)
        XCTAssertNil(event.status)
        XCTAssertNil(event.userRsvpStatus)
    }

    // MARK: - Member computed properties

    func test_member_isActive() {
        let active = makeMember(status: .active)
        let suspended = makeMember(status: .suspended)
        XCTAssertTrue(active.isActive)
        XCTAssertFalse(suspended.isActive)
    }

    func test_member_isAdmin() {
        let admin = makeMember(role: .admin)
        let member = makeMember(role: .member)
        XCTAssertTrue(admin.isAdmin)
        XCTAssertFalse(member.isAdmin)
    }

    func test_member_fullName() {
        let m = makeMember()
        XCTAssertEqual(m.fullName, "John Doe")
    }

    func test_member_initials() {
        let m = makeMember()
        XCTAssertEqual(m.initials, "JD")
    }

    // MARK: - FlexibleDouble

    func test_flexibleDouble_decodesNumber() throws {
        let json = Data("42.5".utf8)
        let decoded = try JSONDecoder().decode(FlexibleDouble.self, from: json)
        XCTAssertEqual(decoded.value, 42.5)
    }

    func test_flexibleDouble_decodesString() throws {
        let json = Data(#""99.99""#.utf8)
        let decoded = try JSONDecoder().decode(FlexibleDouble.self, from: json)
        XCTAssertEqual(decoded.value, 99.99)
    }

    func test_flexibleDouble_fallsBackToZero() throws {
        let json = Data(#""not-a-number""#.utf8)
        let decoded = try JSONDecoder().decode(FlexibleDouble.self, from: json)
        XCTAssertEqual(decoded.value, 0)
    }

    // MARK: - Helpers

    private let testUUID = UUID(uuidString: "00000000-0000-0000-0000-000000000001")!
    private let testUUID2 = UUID(uuidString: "00000000-0000-0000-0000-000000000002")!
    private let testUUID3 = UUID(uuidString: "00000000-0000-0000-0000-000000000003")!

    private func makeBooking(status: BookingStatus, date: String = "2025-07-01T08:00:00Z") -> Booking {
        Booking(
            id: testUUID,
            memberId: testUUID2,
            facilityId: testUUID3,
            slotId: nil,
            date: date,
            startTime: "08:00",
            endTime: "09:00",
            partySize: 4,
            status: status,
            notes: nil,
            facilityName: "Golf Course"
        )
    }

    private func makeEvent(
        status: EventStatus? = nil,
        capacity: Int? = nil,
        rsvpCount: Int = 0,
        userRsvpStatus: RsvpStatus? = nil
    ) -> ClubEvent {
        ClubEvent(
            id: "evt-test",
            clubId: nil,
            title: "Test Event",
            description: nil,
            location: nil,
            startDate: "2025-07-04T18:00:00Z",
            endDate: nil,
            capacity: capacity,
            price: nil,
            imageUrl: nil,
            status: status,
            createdAt: nil,
            rsvpCount: rsvpCount,
            userRsvpStatus: userRsvpStatus
        )
    }

    private func makeMember(
        role: MemberRole = .member,
        status: MemberStatus = .active
    ) -> Member {
        Member(
            id: testUUID,
            clubId: testUUID2,
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            phone: nil,
            role: role,
            status: status,
            memberNumber: "M001",
            membershipTierId: nil,
            familyId: nil,
            familyRole: nil,
            joinDate: nil,
            avatarUrl: nil,
            pushToken: nil,
            createdAt: nil,
            updatedAt: nil,
            tierName: nil,
            tierLevel: nil
        )
    }
}
