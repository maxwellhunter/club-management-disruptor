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

    var isActive: Bool { status == .active }
    var isAdmin: Bool { role == .admin }

    // No CodingKeys needed — APIClient uses .convertFromSnakeCase / .convertToSnakeCase
}

enum MemberRole: String, Codable, Sendable, CaseIterable, Identifiable {
    case admin, staff, member

    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

enum MemberStatus: String, Codable, Sendable {
    case active, inactive, suspended, invited
}

// MARK: - Booking

enum BookingStatus: String, Codable, Sendable {
    case confirmed
    case pending
    case cancelled
    case completed
    case noShow = "no_show"

    var label: String {
        switch self {
        case .noShow: return "No Show"
        default: return rawValue.capitalized
        }
    }
}

struct Booking: Codable, Identifiable, Sendable {
    let id: UUID
    let memberId: UUID
    let facilityId: UUID
    let slotId: UUID?
    let date: String
    let startTime: String
    let endTime: String?
    let partySize: Int
    let status: BookingStatus
    let notes: String?
    let facilityName: String?

    var isUpcoming: Bool {
        guard let d = DateUtilities.parseISODate(date) else { return false }
        return d >= Calendar.current.startOfDay(for: Date()) && status == .confirmed
    }

    var isCancellable: Bool {
        status == .confirmed || status == .pending
    }

    // No CodingKeys needed — APIClient uses .convertFromSnakeCase / .convertToSnakeCase
}

// MARK: - Event

enum EventStatus: String, Codable, Sendable {
    case draft, published, cancelled, completed

    var label: String { rawValue.capitalized }
}

enum RsvpStatus: String, Codable, Sendable {
    case attending, declined, waitlisted

    var label: String { rawValue.capitalized }
}

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
    let status: EventStatus?
    let createdAt: String?
    let rsvpCount: Int
    let userRsvpStatus: RsvpStatus?

    var priceValue: Double? { price?.value }

    var isFull: Bool {
        guard let capacity else { return false }
        return rsvpCount >= capacity
    }

    var spotsRemaining: Int? {
        guard let capacity else { return nil }
        return max(0, capacity - rsvpCount)
    }

    var isPublished: Bool { status == .published }
    var isCancelled: Bool { status == .cancelled }
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

enum InvoiceStatus: String, Codable, Sendable {
    case draft, sent, paid, overdue, cancelled, void

    var label: String { rawValue.capitalized }

    var isPaid: Bool { self == .paid }
    var isOutstanding: Bool { self == .sent || self == .overdue }
}

struct Invoice: Codable, Identifiable, Sendable {
    let id: UUID
    let memberId: UUID
    let amount: Double
    let status: InvoiceStatus
    let description: String
    let dueDate: String
    let paidAt: String?
    let createdAt: String?

    var isPaid: Bool { status.isPaid }
    var isOutstanding: Bool { status.isOutstanding }

    // No CodingKeys needed — APIClient uses .convertFromSnakeCase / .convertToSnakeCase
}

// MARK: - Announcement

enum AnnouncementPriority: String, Codable, Sendable, CaseIterable, Identifiable {
    case low, normal, high, urgent

    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

struct Announcement: Codable, Identifiable, Sendable {
    let id: UUID
    let clubId: UUID?
    let title: String
    let content: String
    let priority: AnnouncementPriority
    let status: String?
    let createdAt: String?

    // No CodingKeys needed — APIClient uses .convertFromSnakeCase / .convertToSnakeCase
}

// MARK: - Facility

struct Facility: Codable, Identifiable, Sendable {
    let id: UUID
    let clubId: UUID?
    let name: String
    let type: String
    let description: String?
    let imageUrl: String?

    // No CodingKeys needed — APIClient uses .convertFromSnakeCase / .convertToSnakeCase
}

// Chat models moved to Views/Chat/ChatView.swift
