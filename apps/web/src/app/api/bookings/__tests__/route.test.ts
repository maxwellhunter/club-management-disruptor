/**
 * Tests for POST /api/bookings.
 *
 * Validates authentication, input validation, club-scoped facility lookup
 * (cross-tenant isolation), golf eligibility, double-booking prevention,
 * and successful booking creation.
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
import { POST } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
    "insert",
    "update",
    "upsert",
  ]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain["single"] = jest.fn().mockResolvedValue(resolved);
  chain["maybeSingle"] = jest.fn().mockResolvedValue(resolved);

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

const validBody = {
  facility_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  date: "2026-04-01",
  start_time: "08:00",
  end_time: "08:10",
  party_size: 4,
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

describe("POST /api/bookings", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(createRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid input (missing facility_id)", async () => {
    const res = await POST(
      createRequest({
        date: "2026-04-01",
        start_time: "08:00",
        end_time: "08:10",
        party_size: 4,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when member is not found", async () => {
    mockGetMemberWithTier.mockResolvedValue(null);

    const res = await POST(createRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Member not found");
  });

  it("returns 404 when facility not found (club_id mismatch — cross-tenant isolation)", async () => {
    const facilityChain = createChainMock({
      data: null,
      error: { message: "Not found" },
    });
    mockFrom.mockReturnValue(facilityChain);

    const res = await POST(createRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Facility not found");
    expect(mockFrom).toHaveBeenCalledWith("facilities");
    // Verify club_id filter was applied to the facility query
    expectClubIdFilter(facilityChain, "club-1");
  });

  it("returns 403 when member is not golf eligible", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockMember,
      isGolfEligible: false,
    });

    mockFrom.mockReturnValue(
      createChainMock({ data: { id: "fac-1", type: "golf" } }),
    );

    const res = await POST(createRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("Golf booking requires");
  });

  it("returns 409 when tee time is already booked", async () => {
    const facilityChain = createChainMock({
      data: { id: "fac-1", type: "golf" },
    });
    const bookingCheckChain = createChainMock({
      data: { id: "existing-booking-1" },
    });

    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      return callNum === 1 ? facilityChain : bookingCheckChain;
    });

    const res = await POST(createRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain("already booked");
    // Verify club_id filter on both queries
    expectClubIdFilter(facilityChain, "club-1");
    expectClubIdFilter(bookingCheckChain, "club-1");
  });

  it("returns 201 on successful booking with club_id filters on all queries", async () => {
    const facilityChain = createChainMock({
      data: { id: "fac-1", type: "golf" },
    });
    const bookingCheckChain = createChainMock({ data: null });
    const insertChain = createChainMock({
      data: {
        id: "booking-1",
        club_id: "club-1",
        facility_id: validBody.facility_id,
        member_id: "member-1",
        date: validBody.date,
        start_time: validBody.start_time,
        end_time: validBody.end_time,
        party_size: validBody.party_size,
        status: "confirmed",
      },
    });

    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      if (callNum === 1) return facilityChain;
      if (callNum === 2) return bookingCheckChain;
      return insertChain;
    });

    const res = await POST(createRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.booking).toBeDefined();
    expect(data.booking.club_id).toBe("club-1");

    // Verify club_id was filtered on facility lookup
    expectClubIdFilter(facilityChain, "club-1");
    // Verify club_id was filtered on double-booking check
    expectClubIdFilter(bookingCheckChain, "club-1");
  });
});
