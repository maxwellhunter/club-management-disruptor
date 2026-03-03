/**
 * Tests for GET /api/dining/availability.
 *
 * Validates authentication, required parameters, club-scoped facility lookup,
 * slot availability calculation, and cross-tenant isolation.
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

import { GET } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost:3000/api/dining/availability");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
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
    "select", "eq", "neq", "in", "gte", "order", "limit",
    "insert", "update",
  ]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain["single"] = jest.fn().mockResolvedValue(resolved);
  chain["maybeSingle"] = jest.fn().mockResolvedValue(resolved);

  (chain as unknown as PromiseLike<typeof resolved>).then = ((
    onFulfilled: (v: typeof resolved) => unknown,
  ) => Promise.resolve(resolved).then(onFulfilled)) as never;

  return chain;
}

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
    isGolfEligible: false,
  });
});

// ─── Tests ───────────────────────────────────────────────────────────

describe("GET /api/dining/availability", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(createRequest({ facility_id: "fac-1", date: "2026-04-01" }));
    expect(res.status).toBe(401);
  });

  it("returns 404 when member is not found", async () => {
    mockGetMemberWithTier.mockResolvedValue(null);
    const res = await GET(createRequest({ facility_id: "fac-1", date: "2026-04-01" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when facility_id is missing", async () => {
    const res = await GET(createRequest({ date: "2026-04-01" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("facility_id");
  });

  it("returns 400 when date is missing", async () => {
    const res = await GET(createRequest({ facility_id: "fac-1" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("date");
  });

  it("returns 404 when dining facility not found (cross-tenant isolation)", async () => {
    const facilityChain = createChainMock({ data: null, error: { message: "Not found" } });
    mockFrom.mockReturnValue(facilityChain);

    const res = await GET(createRequest({ facility_id: "fac-1", date: "2026-04-01" }));
    expect(res.status).toBe(404);
    expect(mockFrom).toHaveBeenCalledWith("facilities");
    expectClubIdFilter(facilityChain, "club-1");
  });

  it("returns empty slots when no booking_slots exist", async () => {
    const facilityChain = createChainMock({
      data: { id: "fac-1", type: "dining", name: "Grill Room" },
    });
    const slotsChain = createChainMock({ data: [] });

    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      return callNum === 1 ? facilityChain : slotsChain;
    });

    const res = await GET(createRequest({ facility_id: "fac-1", date: "2026-04-01" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.slots).toEqual([]);
  });

  it("returns availability with booking counts", async () => {
    const facilityChain = createChainMock({
      data: { id: "fac-1", type: "dining", name: "Grill Room" },
    });
    const slotsChain = createChainMock({
      data: [
        { start_time: "17:00:00", end_time: "17:30:00", max_bookings: 10 },
        { start_time: "17:30:00", end_time: "18:00:00", max_bookings: 10 },
      ],
    });
    const bookingsChain = createChainMock({
      data: [
        { start_time: "17:00:00" },
        { start_time: "17:00:00" },
        { start_time: "17:00:00" },
      ],
    });

    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      if (callNum === 1) return facilityChain;
      if (callNum === 2) return slotsChain;
      return bookingsChain;
    });

    const res = await GET(createRequest({ facility_id: "fac-1", date: "2026-04-01" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.slots).toHaveLength(2);
    expect(data.slots[0].start_time).toBe("17:00");
    expect(data.slots[0].is_available).toBe(true);
    expect(data.slots[0].bookings_remaining).toBe(7);
    expect(data.slots[1].bookings_remaining).toBe(10);
  });
});
