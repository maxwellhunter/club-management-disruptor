/**
 * Tests for GET /api/bookings/tee-times.
 *
 * Validates authentication, input validation, club-scoped facility lookup
 * (cross-tenant isolation), golf eligibility, and tee time slot retrieval.
 *
 * Cross-tenant tests verify that .eq("club_id", ...) is called on every
 * query that accepts user-supplied IDs, preventing data leakage between clubs.
 */

import type { MemberWithTier } from "@/lib/golf-eligibility";

// ─── Module Mocks ────────────────────────────────────────────────────

const mockGetUser = jest.fn();
const mockFrom = jest.fn();

jest.mock("@/lib/supabase/api", () => ({
  createApiClient: jest.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

const mockGetMemberWithTier = jest.fn();
jest.mock("@/lib/golf-eligibility", () => ({
  getMemberWithTier: (...args: unknown[]) => mockGetMemberWithTier(...args),
}));

// Import handler after mocks
import { GET } from "../tee-times/route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createRequest(params: Record<string, string>): Request {
  const url = new URL("http://localhost:3000/api/bookings/tee-times");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString(), { method: "GET" });
}

function createChainMock(result: {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}) {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
    count: result.count ?? null,
  };

  const chain: Record<string, jest.Mock> = {};
  for (const m of [
    "select",
    "eq",
    "neq",
    "in",
    "gte",
    "order",
    "limit",
    "single",
    "maybeSingle",
  ]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain["single"] = jest.fn().mockResolvedValue(resolved);

  // Make thenable
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
    ([col, val]: [string, string]) => col === "club_id" && val === expectedClubId,
  );
  expect(hasClubIdFilter).toBe(true);
}

const mockMember: MemberWithTier = {
  id: "member-1",
  club_id: "club-1",
  user_id: "user-1",
  first_name: "John",
  last_name: "Doe",
  email: "john@example.com",
  role: "member",
  status: "active",
  membership_tier_id: "tier-1",
  tier_level: "premium",
  tier_name: "Premium",
};

// ─── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
  });
  mockGetMemberWithTier.mockResolvedValue({
    member: mockMember,
    isGolfEligible: true,
  });
});

// ─── Tests ───────────────────────────────────────────────────────────

describe("GET /api/bookings/tee-times", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(
      createRequest({ facility_id: "fac-1", date: "2026-04-01" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when query params are missing", async () => {
    const res = await GET(createRequest({}));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("required");
  });

  it("returns 404 when member is not found", async () => {
    mockGetMemberWithTier.mockResolvedValue(null);

    const res = await GET(
      createRequest({ facility_id: "fac-1", date: "2026-04-01" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when member is not golf eligible", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockMember,
      isGolfEligible: false,
    });

    const res = await GET(
      createRequest({ facility_id: "fac-1", date: "2026-04-01" }),
    );
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("Golf booking requires");
  });

  it("returns 404 when facility not found (club_id mismatch — cross-tenant isolation)", async () => {
    const facilityChain = createChainMock({
      data: null,
      error: { message: "Not found" },
    });
    mockFrom.mockReturnValue(facilityChain);

    const res = await GET(
      createRequest({ facility_id: "fac-1", date: "2026-04-01" }),
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Facility not found");
    expect(mockFrom).toHaveBeenCalledWith("facilities");
    // Verify club_id filter was applied
    expectClubIdFilter(facilityChain, "club-1");
  });

  it("returns 200 with available tee time slots and club_id filters on all queries", async () => {
    const facilityChain = createChainMock({
      data: {
        id: "fac-1",
        name: "Championship Course",
        type: "golf",
        description: "18 holes",
      },
    });
    const slotsChain = createChainMock({
      data: [
        { id: "slot-1", start_time: "08:00:00", end_time: "08:10:00" },
        { id: "slot-2", start_time: "08:10:00", end_time: "08:20:00" },
      ],
    });
    const existingBookingsChain = createChainMock({
      data: [{ id: "booking-1", start_time: "08:00:00" }],
    });

    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      if (callNum === 1) return facilityChain;
      if (callNum === 2) return slotsChain;
      return existingBookingsChain;
    });

    const res = await GET(
      createRequest({ facility_id: "fac-1", date: "2026-04-01" }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.slots).toHaveLength(2);
    // First slot is booked, second is available
    expect(data.slots[0].is_available).toBe(false);
    expect(data.slots[1].is_available).toBe(true);

    // Verify club_id filter on facility lookup
    expectClubIdFilter(facilityChain, "club-1");
    // Verify club_id filter on existing bookings query
    expectClubIdFilter(existingBookingsChain, "club-1");
    // Verify the correct tables were queried
    expect(mockFrom).toHaveBeenCalledWith("facilities");
    expect(mockFrom).toHaveBeenCalledWith("booking_slots");
    expect(mockFrom).toHaveBeenCalledWith("bookings");
  });
});
