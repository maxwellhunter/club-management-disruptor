/**
 * Tests for GET and DELETE /api/events/admin/[id]/attendees.
 *
 * Validates authentication, admin role enforcement,
 * club-scoped event verification, attendee data shape,
 * and attendee removal.
 */

import type { MemberWithTier } from "@/lib/golf-eligibility";

// ─── Module Mocks ────────────────────────────────────────────────────

const mockGetUser = jest.fn();
const mockFrom = jest.fn();
const mockAdminFrom = jest.fn();

jest.mock("@/lib/supabase/api", () => ({
  createApiClient: jest.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

jest.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: jest.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  })),
}));

const mockGetMemberWithTier = jest.fn();
jest.mock("@/lib/golf-eligibility", () => ({
  getMemberWithTier: (...args: unknown[]) => mockGetMemberWithTier(...args),
}));

// Import handlers after mocks
import { GET, DELETE } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createRequest(): Request {
  return new Request(
    "http://localhost:3000/api/events/admin/event-1/attendees",
    { method: "GET" }
  );
}

const mockParams = Promise.resolve({ id: "event-1" });

/**
 * Creates a chainable Supabase mock that resolves to the given result.
 * The `single` method resolves (for .single() calls);
 * the chain itself is thenable (for await without .single()).
 */
function createChainMock(result: {
  data?: unknown;
  error?: unknown;
}) {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
    count: null,
  };

  const chain: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "insert", "update", "delete", "order"]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain["single"] = jest.fn().mockResolvedValue(resolved);

  // Make thenable (for `await supabase.from(...).select(...).eq(...)`)
  (chain as unknown as PromiseLike<typeof resolved>).then = ((
    onFulfilled: (v: typeof resolved) => unknown,
  ) => Promise.resolve(resolved).then(onFulfilled)) as never;

  return chain;
}

/** Assert that a chain mock's .eq() was called with ("club_id", expectedClubId). */
function expectClubIdFilter(
  chain: Record<string, jest.Mock>,
  expectedClubId: string,
) {
  const eqCalls = chain["eq"].mock.calls;
  const hasClubIdFilter = eqCalls.some(
    ([col, val]: [string, string]) =>
      col === "club_id" && val === expectedClubId,
  );
  expect(hasClubIdFilter).toBe(true);
}

const mockAdmin: MemberWithTier = {
  id: "member-1",
  club_id: "club-1",
  user_id: "user-1",
  first_name: "Admin",
  last_name: "User",
  email: "admin@example.com",
  role: "admin",
  status: "active",
  membership_tier_id: "tier-1",
  tier_level: "premium",
  tier_name: "Premium",
};

const mockNonAdmin: MemberWithTier = {
  ...mockAdmin,
  id: "member-2",
  role: "member",
};

// ─── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
  });
  mockGetMemberWithTier.mockResolvedValue({
    member: mockAdmin,
    isGolfEligible: true,
  });
});

// ─── Tests ───────────────────────────────────────────────────────────

describe("GET /api/events/admin/[id]/attendees", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(createRequest(), { params: mockParams });
    expect(res.status).toBe(401);
  });

  it("returns 404 when member is not found", async () => {
    mockGetMemberWithTier.mockResolvedValue(null);

    const res = await GET(createRequest(), { params: mockParams });
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not admin", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockNonAdmin,
      isGolfEligible: true,
    });

    const res = await GET(createRequest(), { params: mockParams });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Admin access required");
  });

  it("returns 404 when event not in admin's club (cross-tenant)", async () => {
    const eventChain = createChainMock({
      data: null,
      error: { message: "Not found" },
    });
    mockAdminFrom.mockReturnValue(eventChain);

    const res = await GET(createRequest(), { params: mockParams });
    expect(res.status).toBe(404);
    expect(mockAdminFrom).toHaveBeenCalledWith("events");
    expectClubIdFilter(eventChain, "club-1");
  });

  it("returns 200 with attendees and total_guests", async () => {
    // First call: event verification
    const eventChain = createChainMock({ data: { id: "event-1" } });

    // Second call: RSVPs query
    const rsvpData = [
      {
        id: "rsvp-1",
        member_id: "member-10",
        status: "attending",
        guest_count: 2,
        created_at: "2026-03-01T00:00:00Z",
        members: {
          first_name: "Jane",
          last_name: "Doe",
          email: "jane@example.com",
        },
      },
      {
        id: "rsvp-2",
        member_id: "member-11",
        status: "declined",
        guest_count: 0,
        created_at: "2026-03-02T00:00:00Z",
        members: {
          first_name: "John",
          last_name: "Smith",
          email: "john@example.com",
        },
      },
    ];
    const rsvpChain = createChainMock({ data: rsvpData });

    // mockAdminFrom returns eventChain on first call, rsvpChain on second
    mockAdminFrom
      .mockReturnValueOnce(eventChain)
      .mockReturnValueOnce(rsvpChain);

    const res = await GET(createRequest(), { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.event_id).toBe("event-1");
    expect(data.attendees).toHaveLength(2);
    expect(data.attendees[0].first_name).toBe("Jane");
    expect(data.attendees[0].status).toBe("attending");
    expect(data.attendees[0].guest_count).toBe(2);
    expect(data.attendees[1].first_name).toBe("John");
    expect(data.attendees[1].status).toBe("declined");

    // total_guests = 1 attending member + 2 guests = 3
    // (declined members don't count)
    expect(data.total_guests).toBe(3);
  });

  it("returns 200 with empty attendees when no RSVPs", async () => {
    const eventChain = createChainMock({ data: { id: "event-1" } });
    const rsvpChain = createChainMock({ data: [] });

    mockAdminFrom
      .mockReturnValueOnce(eventChain)
      .mockReturnValueOnce(rsvpChain);

    const res = await GET(createRequest(), { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.attendees).toHaveLength(0);
    expect(data.total_guests).toBe(0);
  });

  it("returns 500 when RSVP query fails", async () => {
    const eventChain = createChainMock({ data: { id: "event-1" } });
    const rsvpChain = createChainMock({
      data: null,
      error: { message: "DB error" },
    });

    mockAdminFrom
      .mockReturnValueOnce(eventChain)
      .mockReturnValueOnce(rsvpChain);

    const res = await GET(createRequest(), { params: mockParams });
    expect(res.status).toBe(500);
  });
});

// ─── DELETE Tests ──────────────────────────────────────────────────

function createDeleteRequest(body: Record<string, unknown>): Request {
  return new Request(
    "http://localhost:3000/api/events/admin/event-1/attendees",
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

describe("DELETE /api/events/admin/[id]/attendees", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await DELETE(createDeleteRequest({ rsvp_id: "rsvp-1" }), {
      params: mockParams,
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockNonAdmin,
      isGolfEligible: true,
    });

    const res = await DELETE(createDeleteRequest({ rsvp_id: "rsvp-1" }), {
      params: mockParams,
    });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Admin access required");
  });

  it("returns 400 when rsvp_id is missing", async () => {
    const res = await DELETE(createDeleteRequest({}), {
      params: mockParams,
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("rsvp_id is required");
  });

  it("returns 404 when event not in admin's club (cross-tenant)", async () => {
    const eventChain = createChainMock({
      data: null,
      error: { message: "Not found" },
    });
    mockAdminFrom.mockReturnValue(eventChain);

    const res = await DELETE(createDeleteRequest({ rsvp_id: "rsvp-1" }), {
      params: mockParams,
    });
    expect(res.status).toBe(404);
    expect(mockAdminFrom).toHaveBeenCalledWith("events");
    expectClubIdFilter(eventChain, "club-1");
  });

  it("returns 200 on successful RSVP deletion", async () => {
    // First call: event verification
    const eventChain = createChainMock({ data: { id: "event-1" } });
    // Second call: RSVP delete
    const deleteChain = createChainMock({ data: null });

    mockAdminFrom
      .mockReturnValueOnce(eventChain)
      .mockReturnValueOnce(deleteChain);

    const res = await DELETE(createDeleteRequest({ rsvp_id: "rsvp-1" }), {
      params: mockParams,
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockAdminFrom).toHaveBeenCalledWith("events");
    expect(mockAdminFrom).toHaveBeenCalledWith("event_rsvps");

    // Verify delete was scoped to both rsvp ID and event ID
    const eqCalls = deleteChain["eq"].mock.calls;
    expect(eqCalls).toContainEqual(["id", "rsvp-1"]);
    expect(eqCalls).toContainEqual(["event_id", "event-1"]);
  });

  it("returns 500 when RSVP delete fails", async () => {
    const eventChain = createChainMock({ data: { id: "event-1" } });
    const deleteChain = createChainMock({
      data: null,
      error: { message: "DB error" },
    });

    mockAdminFrom
      .mockReturnValueOnce(eventChain)
      .mockReturnValueOnce(deleteChain);

    const res = await DELETE(createDeleteRequest({ rsvp_id: "rsvp-1" }), {
      params: mockParams,
    });
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Failed to remove attendee");
  });
});
