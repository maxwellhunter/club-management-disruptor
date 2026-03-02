import {
  createMemberSchema,
  updateMemberSchema,
  createTierSchema,
  createBookingSchema,
  createEventSchema,
  rsvpSchema,
  createInvoiceSchema,
  createAnnouncementSchema,
  chatMessageSchema,
  createClubSchema,
} from "../schemas";

// ─── createMemberSchema ──────────────────────────────────────────────

describe("createMemberSchema", () => {
  const validMember = {
    first_name: "John",
    last_name: "Doe",
    email: "john@example.com",
  };

  it("accepts a valid member with required fields only", () => {
    const result = createMemberSchema.safeParse(validMember);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("member"); // default
    }
  });

  it("accepts a valid member with all optional fields", () => {
    const result = createMemberSchema.safeParse({
      ...validMember,
      phone: "555-1234",
      role: "admin",
      membership_tier_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      member_number: "M001",
      notes: "VIP member",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = createMemberSchema.safeParse({
      ...validMember,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty first_name", () => {
    const result = createMemberSchema.safeParse({
      ...validMember,
      first_name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty last_name", () => {
    const result = createMemberSchema.safeParse({
      ...validMember,
      last_name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = createMemberSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects an invalid role", () => {
    const result = createMemberSchema.safeParse({
      ...validMember,
      role: "superadmin",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid role values", () => {
    for (const role of ["admin", "staff", "member"]) {
      const result = createMemberSchema.safeParse({ ...validMember, role });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an invalid membership_tier_id (not UUID)", () => {
    const result = createMemberSchema.safeParse({
      ...validMember,
      membership_tier_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

// ─── updateMemberSchema ──────────────────────────────────────────────

describe("updateMemberSchema", () => {
  it("accepts partial updates", () => {
    const result = updateMemberSchema.safeParse({ first_name: "Jane" });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object (all fields optional)", () => {
    const result = updateMemberSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("still validates field values when provided", () => {
    const result = updateMemberSchema.safeParse({ email: "bad-email" });
    expect(result.success).toBe(false);
  });
});

// ─── createTierSchema ────────────────────────────────────────────────

describe("createTierSchema", () => {
  const validTier = {
    name: "Gold",
    level: "premium" as const,
    monthly_dues: 500,
  };

  it("accepts a valid tier", () => {
    const result = createTierSchema.safeParse(validTier);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.benefits).toEqual([]); // default
    }
  });

  it("rejects negative monthly dues", () => {
    const result = createTierSchema.safeParse({
      ...validTier,
      monthly_dues: -100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid tier level", () => {
    const result = createTierSchema.safeParse({
      ...validTier,
      level: "platinum",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid tier levels", () => {
    for (const level of ["standard", "premium", "vip", "honorary"]) {
      const result = createTierSchema.safeParse({ ...validTier, level });
      expect(result.success).toBe(true);
    }
  });

  it("accepts optional benefits array", () => {
    const result = createTierSchema.safeParse({
      ...validTier,
      benefits: ["Pool access", "Golf"],
    });
    expect(result.success).toBe(true);
  });
});

// ─── createBookingSchema ─────────────────────────────────────────────

describe("createBookingSchema", () => {
  const validBooking = {
    facility_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    date: "2026-03-15",
    start_time: "09:00",
    end_time: "10:00",
  };

  it("accepts a valid booking", () => {
    const result = createBookingSchema.safeParse(validBooking);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.party_size).toBe(1); // default
    }
  });

  it("rejects invalid date format", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      date: "March 15, 2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid time format", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      start_time: "9am",
    });
    expect(result.success).toBe(false);
  });

  it("rejects party size below 1", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      party_size: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects party size above 20", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      party_size: 21,
    });
    expect(result.success).toBe(false);
  });

  it("accepts party size within range", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      party_size: 4,
    });
    expect(result.success).toBe(true);
  });
});

// ─── createEventSchema ───────────────────────────────────────────────

describe("createEventSchema", () => {
  const validEvent = {
    title: "Wine Tasting Evening",
    start_date: "2026-04-01T18:00:00.000Z",
  };

  it("accepts a valid event with required fields", () => {
    const result = createEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });

  it("accepts a valid event with all optional fields", () => {
    const result = createEventSchema.safeParse({
      ...validEvent,
      description: "An evening of fine wines",
      location: "Main Clubhouse",
      end_date: "2026-04-01T21:00:00.000Z",
      capacity: 50,
      price: 25.0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createEventSchema.safeParse({
      ...validEvent,
      title: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid datetime format", () => {
    const result = createEventSchema.safeParse({
      ...validEvent,
      start_date: "2026-04-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative price", () => {
    const result = createEventSchema.safeParse({
      ...validEvent,
      price: -10,
    });
    expect(result.success).toBe(false);
  });

  it("rejects capacity below 1", () => {
    const result = createEventSchema.safeParse({
      ...validEvent,
      capacity: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ─── rsvpSchema ──────────────────────────────────────────────────────

describe("rsvpSchema", () => {
  const validRsvp = {
    event_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    status: "attending" as const,
  };

  it("accepts a valid RSVP", () => {
    const result = rsvpSchema.safeParse(validRsvp);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.guest_count).toBe(0); // default
    }
  });

  it("accepts all valid status values", () => {
    for (const status of ["attending", "declined", "maybe"]) {
      const result = rsvpSchema.safeParse({ ...validRsvp, status });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = rsvpSchema.safeParse({
      ...validRsvp,
      status: "interested",
    });
    expect(result.success).toBe(false);
  });

  it("rejects guest_count below 0", () => {
    const result = rsvpSchema.safeParse({
      ...validRsvp,
      guest_count: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects guest_count above 10", () => {
    const result = rsvpSchema.safeParse({
      ...validRsvp,
      guest_count: 11,
    });
    expect(result.success).toBe(false);
  });

  it("accepts guest_count at boundary values", () => {
    expect(rsvpSchema.safeParse({ ...validRsvp, guest_count: 0 }).success).toBe(true);
    expect(rsvpSchema.safeParse({ ...validRsvp, guest_count: 10 }).success).toBe(true);
  });

  it("rejects invalid event_id (not UUID)", () => {
    const result = rsvpSchema.safeParse({
      ...validRsvp,
      event_id: "abc",
    });
    expect(result.success).toBe(false);
  });
});

// ─── createInvoiceSchema ─────────────────────────────────────────────

describe("createInvoiceSchema", () => {
  const validInvoice = {
    member_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    amount: 150.0,
    description: "Monthly dues",
    due_date: "2026-04-01",
  };

  it("accepts a valid invoice", () => {
    const result = createInvoiceSchema.safeParse(validInvoice);
    expect(result.success).toBe(true);
  });

  it("rejects zero amount", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      amount: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid due_date format", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      due_date: "April 1 2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      description: "",
    });
    expect(result.success).toBe(false);
  });
});

// ─── createAnnouncementSchema ────────────────────────────────────────

describe("createAnnouncementSchema", () => {
  const validAnnouncement = {
    title: "Pool Closing",
    content: "The pool will be closed for maintenance next week.",
  };

  it("accepts a valid announcement", () => {
    const result = createAnnouncementSchema.safeParse(validAnnouncement);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe("normal"); // default
    }
  });

  it("accepts all valid priority values", () => {
    for (const priority of ["low", "normal", "high", "urgent"]) {
      const result = createAnnouncementSchema.safeParse({
        ...validAnnouncement,
        priority,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid priority", () => {
    const result = createAnnouncementSchema.safeParse({
      ...validAnnouncement,
      priority: "critical",
    });
    expect(result.success).toBe(false);
  });
});

// ─── chatMessageSchema ───────────────────────────────────────────────

describe("chatMessageSchema", () => {
  it("accepts a valid message", () => {
    const result = chatMessageSchema.safeParse({ message: "Hello!" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty message", () => {
    const result = chatMessageSchema.safeParse({ message: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a message over 4000 characters", () => {
    const result = chatMessageSchema.safeParse({
      message: "a".repeat(4001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a message at exactly 4000 characters", () => {
    const result = chatMessageSchema.safeParse({
      message: "a".repeat(4000),
    });
    expect(result.success).toBe(true);
  });
});

// ─── createClubSchema ────────────────────────────────────────────────

describe("createClubSchema", () => {
  const validClub = {
    name: "Pine Valley Country Club",
    slug: "pine-valley",
  };

  it("accepts a valid club with required fields", () => {
    const result = createClubSchema.safeParse(validClub);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timezone).toBe("America/New_York"); // default
    }
  });

  it("accepts a valid club with all optional fields", () => {
    const result = createClubSchema.safeParse({
      ...validClub,
      address: "123 Club Drive",
      phone: "555-0100",
      email: "info@pinevalley.com",
      website: "https://pinevalley.com",
      timezone: "America/Chicago",
    });
    expect(result.success).toBe(true);
  });

  it("rejects slug with uppercase letters", () => {
    const result = createClubSchema.safeParse({
      ...validClub,
      slug: "Pine-Valley",
    });
    expect(result.success).toBe(false);
  });

  it("rejects slug with spaces", () => {
    const result = createClubSchema.safeParse({
      ...validClub,
      slug: "pine valley",
    });
    expect(result.success).toBe(false);
  });

  it("rejects slug with special characters", () => {
    const result = createClubSchema.safeParse({
      ...validClub,
      slug: "pine_valley!",
    });
    expect(result.success).toBe(false);
  });

  it("accepts slug with numbers and hyphens", () => {
    const result = createClubSchema.safeParse({
      ...validClub,
      slug: "pine-valley-2",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = createClubSchema.safeParse({
      ...validClub,
      email: "not-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid website URL", () => {
    const result = createClubSchema.safeParse({
      ...validClub,
      website: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});
