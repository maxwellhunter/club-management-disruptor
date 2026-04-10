import Foundation

// MARK: - Core Models (ported from @club/shared types)

struct Member: Codable, Identifiable, Sendable {
    let id: UUID
    let clubId: UUID
    let firstName: String
    let lastName: String
    let email: String
    let phone: String?
    let role: MemberRole
    let status: MemberStatus
    let memberNumber: String?
    let membershipTierId: UUID?
    let familyId: UUID?
    let familyRole: String?
    let joinDate: String?
    let avatarUrl: String?
    let pushToken: String?
    let createdAt: String?
    let updatedAt: String?

    // Joined fields (from API)
    let tierName: String?
    let tierLevel: String?

    var fullName: String { "\(firstName) \(lastName)" }

    var initials: String {
        let f = firstName.prefix(1).uppercased()
        let l = lastName.prefix(1).uppercased()
        return "\(f)\(l)"
    }

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case firstName = "first_name"
        case lastName = "last_name"
        case email, phone, role, status
        case memberNumber = "member_number"
        case membershipTierId = "membership_tier_id"
        case familyId = "family_id"
        case familyRole = "family_role"
        case joinDate = "join_date"
        case avatarUrl = "avatar_url"
        case pushToken = "push_token"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case tierName = "tier_name"
        case tierLevel = "tier_level"
    }
}

enum MemberRole: String, Codable, Sendable {
    case admin, staff, member
}

enum MemberStatus: String, Codable, Sendable {
    case active, inactive, suspended, invited
}

// MARK: - Booking

struct Booking: Codable, Identifiable, Sendable {
    let id: UUID
    let memberId: UUID
    let facilityId: UUID
    let slotId: UUID?
    let date: String
    let startTime: String
    let endTime: String?
    let partySize: Int
    let status: String
    let notes: String?
    let facilityName: String?

    enum CodingKeys: String, CodingKey {
        case id
        case memberId = "member_id"
        case facilityId = "facility_id"
        case slotId = "slot_id"
        case date
        case startTime = "start_time"
        case endTime = "end_time"
        case partySize = "party_size"
        case status, notes
        case facilityName = "facility_name"
    }
}

// MARK: - Event

struct ClubEvent: Codable, Identifiable, Sendable {
    let id: String
    let clubId: String?
    let title: String
    let description: String?
    let location: String?
    let startDate: String
    let endDate: String?
    let capacity: Int?
    let price: FlexibleDouble?
    let imageUrl: String?
    let status: String?
    let createdAt: String?
    let rsvpCount: Int
    let userRsvpStatus: String?

    var priceValue: Double? { price?.value }
}

/// Decodes a value that may be a JSON number or a JSON string (e.g. Supabase `numeric` columns)
struct FlexibleDouble: Codable, Sendable {
    let value: Double

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let d = try? container.decode(Double.self) {
            value = d
        } else if let s = try? container.decode(String.self), let d = Double(s) {
            value = d
        } else {
            value = 0
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(value)
    }
}

// MARK: - Invoice

struct Invoice: Codable, Identifiable, Sendable {
    let id: UUID
    let memberId: UUID
    let amount: Double
    let status: String
    let description: String
    let dueDate: String
    let paidAt: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case memberId = "member_id"
        case amount, status, description
        case dueDate = "due_date"
        case paidAt = "paid_at"
        case createdAt = "created_at"
    }
}

// MARK: - Announcement

struct Announcement: Codable, Identifiable, Sendable {
    let id: UUID
    let clubId: UUID?
    let title: String
    let content: String
    let priority: String
    let status: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case title, content, priority, status
        case createdAt = "created_at"
    }
}

// MARK: - Facility

struct Facility: Codable, Identifiable, Sendable {
    let id: UUID
    let clubId: UUID?
    let name: String
    let type: String
    let description: String?
    let imageUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case name, type, description
        case imageUrl = "image_url"
    }
}

// Chat models moved to Views/Chat/ChatView.swift
