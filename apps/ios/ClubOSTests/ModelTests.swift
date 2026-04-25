import XCTest
@testable import ClubOS

final class ModelTests: XCTestCase {

    private let snakeCaseDecoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    private let snakeCaseEncoder: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        return e
    }()

    // MARK: - FlexibleDouble

    func test_flexibleDouble_decodesFromNumber() throws {
        let result = try JSONDecoder().decode(FlexibleDouble.self, from: Data("25.99".utf8))
        XCTAssertEqual(result.value, 25.99)
    }

    func test_flexibleDouble_decodesFromInteger() throws {
        let result = try JSONDecoder().decode(FlexibleDouble.self, from: Data("100".utf8))
        XCTAssertEqual(result.value, 100.0)
    }

    func test_flexibleDouble_decodesFromString() throws {
        let result = try JSONDecoder().decode(FlexibleDouble.self, from: Data(#""42.50""#.utf8))
        XCTAssertEqual(result.value, 42.50)
    }

    func test_flexibleDouble_decodesFromStringInteger() throws {
        let result = try JSONDecoder().decode(FlexibleDouble.self, from: Data(#""100""#.utf8))
        XCTAssertEqual(result.value, 100.0)
    }

    func test_flexibleDouble_decodesInvalidStringAsZero() throws {
        let result = try JSONDecoder().decode(FlexibleDouble.self, from: Data(#""not-a-number""#.utf8))
        XCTAssertEqual(result.value, 0)
    }

    func test_flexibleDouble_encodesToNumber() throws {
        let original = try JSONDecoder().decode(FlexibleDouble.self, from: Data("99.95".utf8))
        let encoded = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(Double.self, from: encoded)
        XCTAssertEqual(decoded, 99.95)
    }

    func test_flexibleDouble_roundTripFromStringPreservesValue() throws {
        let original = try JSONDecoder().decode(FlexibleDouble.self, from: Data(#""123.45""#.utf8))
        let encoded = try JSONEncoder().encode(original)
        let roundTripped = try JSONDecoder().decode(FlexibleDouble.self, from: encoded)
        XCTAssertEqual(roundTripped.value, 123.45)
    }

    // MARK: - Member

    func test_member_decodesFromSnakeCaseJSON() throws {
        let json = Data("""
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "club_id": "660e8400-e29b-41d4-a716-446655440000",
            "first_name": "James",
            "last_name": "Wilson",
            "email": "james@example.com",
            "phone": "555-0100",
            "role": "member",
            "status": "active",
            "member_number": "M001",
            "membership_tier_id": "770e8400-e29b-41d4-a716-446655440000",
            "family_id": null,
            "family_role": null,
            "join_date": "2025-01-15",
            "avatar_url": null,
            "push_token": null,
            "created_at": "2025-01-15T00:00:00Z",
            "updated_at": "2025-01-15T00:00:00Z",
            "tier_name": "Gold",
            "tier_level": "2"
        }
        """.utf8)

        let member = try snakeCaseDecoder.decode(Member.self, from: json)
        XCTAssertEqual(member.firstName, "James")
        XCTAssertEqual(member.lastName, "Wilson")
        XCTAssertEqual(member.email, "james@example.com")
        XCTAssertEqual(member.phone, "555-0100")
        XCTAssertEqual(member.role, .member)
        XCTAssertEqual(member.status, .active)
        XCTAssertEqual(member.memberNumber, "M001")
        XCTAssertEqual(member.tierName, "Gold")
    }

    func test_member_computedProperties() throws {
        let json = Data("""
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "club_id": "660e8400-e29b-41d4-a716-446655440000",
            "first_name": "Emily",
            "last_name": "Brooks",
            "email": "emily@example.com",
            "phone": null, "role": "admin", "status": "active",
            "member_number": null, "membership_tier_id": null, "family_id": null,
            "family_role": null, "join_date": null, "avatar_url": null,
            "push_token": null, "created_at": null, "updated_at": null,
            "tier_name": null, "tier_level": null
        }
        """.utf8)

        let member = try snakeCaseDecoder.decode(Member.self, from: json)
        XCTAssertEqual(member.fullName, "Emily Brooks")
        XCTAssertEqual(member.initials, "EB")
    }

    func test_member_roundTrip() throws {
        let json = Data("""
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "club_id": "660e8400-e29b-41d4-a716-446655440000",
            "first_name": "Sarah",
            "last_name": "Chen",
            "email": "sarah@example.com",
            "phone": null, "role": "staff", "status": "active",
            "member_number": "S001", "membership_tier_id": null, "family_id": null,
            "family_role": null, "join_date": null, "avatar_url": null,
            "push_token": null, "created_at": null, "updated_at": null,
            "tier_name": "Standard", "tier_level": null
        }
        """.utf8)

        let original = try snakeCaseDecoder.decode(Member.self, from: json)
        let encoded = try snakeCaseEncoder.encode(original)
        let decoded = try snakeCaseDecoder.decode(Member.self, from: encoded)
        XCTAssertEqual(decoded.id, original.id)
        XCTAssertEqual(decoded.firstName, original.firstName)
        XCTAssertEqual(decoded.lastName, original.lastName)
        XCTAssertEqual(decoded.role, original.role)
        XCTAssertEqual(decoded.tierName, original.tierName)
    }

    func test_memberRole_allCases() {
        XCTAssertEqual(MemberRole.allCases.count, 3)
        XCTAssertEqual(MemberRole.admin.rawValue, "admin")
        XCTAssertEqual(MemberRole.staff.rawValue, "staff")
        XCTAssertEqual(MemberRole.member.rawValue, "member")
        XCTAssertEqual(MemberRole.admin.label, "Admin")
    }

    func test_memberStatus_rawValues() {
        XCTAssertEqual(MemberStatus.active.rawValue, "active")
        XCTAssertEqual(MemberStatus.inactive.rawValue, "inactive")
        XCTAssertEqual(MemberStatus.suspended.rawValue, "suspended")
        XCTAssertEqual(MemberStatus.invited.rawValue, "invited")
    }

    // MARK: - Booking

    func test_booking_decodesFromSnakeCaseJSON() throws {
        let json = Data("""
        {
            "id": "550e8400-e29b-41d4-a716-446655440001",
            "member_id": "550e8400-e29b-41d4-a716-446655440000",
            "facility_id": "660e8400-e29b-41d4-a716-446655440001",
            "slot_id": "770e8400-e29b-41d4-a716-446655440001",
            "date": "2025-07-01",
            "start_time": "08:00",
            "end_time": "09:30",
            "party_size": 4,
            "status": "confirmed",
            "notes": "Bring golf cart",
            "facility_name": "Championship Course"
        }
        """.utf8)

        let booking = try snakeCaseDecoder.decode(Booking.self, from: json)
        XCTAssertEqual(booking.date, "2025-07-01")
        XCTAssertEqual(booking.startTime, "08:00")
        XCTAssertEqual(booking.endTime, "09:30")
        XCTAssertEqual(booking.partySize, 4)
        XCTAssertEqual(booking.status, "confirmed")
        XCTAssertEqual(booking.notes, "Bring golf cart")
        XCTAssertEqual(booking.facilityName, "Championship Course")
    }

    func test_booking_decodesWithNullOptionals() throws {
        let json = Data("""
        {
            "id": "550e8400-e29b-41d4-a716-446655440001",
            "member_id": "550e8400-e29b-41d4-a716-446655440000",
            "facility_id": "660e8400-e29b-41d4-a716-446655440001",
            "slot_id": null,
            "date": "2025-07-01",
            "start_time": "08:00",
            "end_time": null,
            "party_size": 2,
            "status": "pending",
            "notes": null,
            "facility_name": null
        }
        """.utf8)

        let booking = try snakeCaseDecoder.decode(Booking.self, from: json)
        XCTAssertNil(booking.slotId)
        XCTAssertNil(booking.endTime)
        XCTAssertNil(booking.notes)
        XCTAssertNil(booking.facilityName)
    }

    // MARK: - ClubEvent

    func test_clubEvent_decodesWithStringPrice() throws {
        let json = Data("""
        {
            "id": "evt-001",
            "club_id": "club-001",
            "title": "Summer Gala",
            "description": "Annual summer celebration",
            "location": "Main Ballroom",
            "start_date": "2025-08-01T18:00:00Z",
            "end_date": "2025-08-01T23:00:00Z",
            "capacity": 200,
            "price": "75.00",
            "image_url": null,
            "status": "published",
            "created_at": "2025-06-01T00:00:00Z",
            "rsvp_count": 42,
            "user_rsvp_status": "attending"
        }
        """.utf8)

        let event = try snakeCaseDecoder.decode(ClubEvent.self, from: json)
        XCTAssertEqual(event.title, "Summer Gala")
        XCTAssertEqual(event.priceValue, 75.0)
        XCTAssertEqual(event.capacity, 200)
        XCTAssertEqual(event.rsvpCount, 42)
        XCTAssertEqual(event.userRsvpStatus, "attending")
    }

    func test_clubEvent_decodesWithNumericPrice() throws {
        let json = Data("""
        {
            "id": "evt-002",
            "club_id": null, "title": "Wine Tasting",
            "description": null, "location": null,
            "start_date": "2025-09-15T17:00:00Z",
            "end_date": null, "capacity": null,
            "price": 45.50,
            "image_url": null, "status": null, "created_at": null,
            "rsvp_count": 0, "user_rsvp_status": null
        }
        """.utf8)

        let event = try snakeCaseDecoder.decode(ClubEvent.self, from: json)
        XCTAssertEqual(event.priceValue, 45.5)
    }

    func test_clubEvent_decodesWithNullPrice() throws {
        let json = Data("""
        {
            "id": "evt-003", "title": "Open House",
            "start_date": "2025-10-01T10:00:00Z",
            "rsvp_count": 15, "price": null,
            "club_id": null, "description": null, "location": null,
            "end_date": null, "capacity": null, "image_url": null,
            "status": null, "created_at": null, "user_rsvp_status": null
        }
        """.utf8)

        let event = try snakeCaseDecoder.decode(ClubEvent.self, from: json)
        XCTAssertNil(event.price)
        XCTAssertNil(event.priceValue)
    }

    // MARK: - Invoice

    func test_invoice_decodesFromSnakeCaseJSON() throws {
        let json = Data("""
        {
            "id": "550e8400-e29b-41d4-a716-446655440010",
            "member_id": "550e8400-e29b-41d4-a716-446655440000",
            "amount": 350.00,
            "status": "sent",
            "description": "Monthly Dues - July 2025",
            "due_date": "2025-07-31",
            "paid_at": null,
            "created_at": "2025-07-01T00:00:00Z"
        }
        """.utf8)

        let invoice = try snakeCaseDecoder.decode(Invoice.self, from: json)
        XCTAssertEqual(invoice.amount, 350.0)
        XCTAssertEqual(invoice.status, "sent")
        XCTAssertEqual(invoice.description, "Monthly Dues - July 2025")
        XCTAssertNil(invoice.paidAt)
    }

    func test_invoice_decodesWithPaidAt() throws {
        let json = Data("""
        {
            "id": "550e8400-e29b-41d4-a716-446655440011",
            "member_id": "550e8400-e29b-41d4-a716-446655440000",
            "amount": 500.00,
            "status": "paid",
            "description": "Annual Assessment",
            "due_date": "2025-06-30",
            "paid_at": "2025-06-25T14:30:00Z",
            "created_at": "2025-06-01T00:00:00Z"
        }
        """.utf8)

        let invoice = try snakeCaseDecoder.decode(Invoice.self, from: json)
        XCTAssertEqual(invoice.status, "paid")
        XCTAssertEqual(invoice.paidAt, "2025-06-25T14:30:00Z")
    }

    // MARK: - Announcement

    func test_announcement_decodesFromSnakeCaseJSON() throws {
        let json = Data("""
        {
            "id": "550e8400-e29b-41d4-a716-446655440020",
            "club_id": "660e8400-e29b-41d4-a716-446655440000",
            "title": "Pool Opening",
            "content": "The pool opens this Saturday!",
            "priority": "high",
            "status": "published",
            "created_at": "2025-06-10T09:00:00Z"
        }
        """.utf8)

        let announcement = try snakeCaseDecoder.decode(Announcement.self, from: json)
        XCTAssertEqual(announcement.title, "Pool Opening")
        XCTAssertEqual(announcement.content, "The pool opens this Saturday!")
        XCTAssertEqual(announcement.priority, "high")
        XCTAssertEqual(announcement.status, "published")
    }

    func test_announcement_decodesWithNullOptionals() throws {
        let json = Data("""
        {
            "id": "550e8400-e29b-41d4-a716-446655440021",
            "club_id": null,
            "title": "Draft Note",
            "content": "Work in progress",
            "priority": "low",
            "status": null,
            "created_at": null
        }
        """.utf8)

        let announcement = try snakeCaseDecoder.decode(Announcement.self, from: json)
        XCTAssertNil(announcement.clubId)
        XCTAssertNil(announcement.status)
        XCTAssertNil(announcement.createdAt)
    }

    // MARK: - Facility

    func test_facility_decodesFromSnakeCaseJSON() throws {
        let json = Data("""
        {
            "id": "550e8400-e29b-41d4-a716-446655440030",
            "club_id": "660e8400-e29b-41d4-a716-446655440000",
            "name": "Championship Course",
            "type": "golf_course",
            "description": "18-hole championship course",
            "image_url": "https://example.com/course.jpg"
        }
        """.utf8)

        let facility = try snakeCaseDecoder.decode(Facility.self, from: json)
        XCTAssertEqual(facility.name, "Championship Course")
        XCTAssertEqual(facility.type, "golf_course")
        XCTAssertEqual(facility.description, "18-hole championship course")
        XCTAssertNotNil(facility.imageUrl)
    }

    func test_facility_decodesWithNullOptionals() throws {
        let json = Data("""
        {
            "id": "550e8400-e29b-41d4-a716-446655440031",
            "club_id": null,
            "name": "Tennis Courts",
            "type": "tennis",
            "description": null,
            "image_url": null
        }
        """.utf8)

        let facility = try snakeCaseDecoder.decode(Facility.self, from: json)
        XCTAssertNil(facility.clubId)
        XCTAssertNil(facility.description)
        XCTAssertNil(facility.imageUrl)
    }
}
