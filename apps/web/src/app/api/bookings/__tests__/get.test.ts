/**
 * Tests for GET /api/bookings (admin bookings list).
 *
 * Validates authentication, admin-only access, type filtering,
 * and cross-tenant isolation.
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
  const url = new URL("http://localhost:3000/api/bookings");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

function createChainMock(result: {
  data?: unknown;
  error?: unknown;
}) {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
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

const mockAdmin: MemberWithTier = {
  ...mockMember,
  id: "admin-1",
  role: "admin",
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

describe("GET /api/bookings", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(createRequest());
    expect(res.status).toBe(401);
  });

  it("returns 404 when member is not found", async () => {
    mockGetMemberWithTier.mockResolvedValue(null);
    const res = await GET(createRequest());
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not admin", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockMember,
      isGolfEligible: false,
    });

    const res = await GET(createRequest());
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Admin only");
  });

  it("returns bookings with details", async () => {
    const bookingsChain = createChainMock({
      data: [
        {
          id: "booking-1",
          club_id: "club-1",
          facility_id: "fac-1",
          member_id: "member-1",
          date: "2026-04-01",
          start_time: "17:00:00",
          end_time: "17:30:00",
          status: "confirmed",
          party_size: 4,
          notes: null,
          created_at: "2026-03-01",
          updated_at: "2026-03-01",
          facilities: { name: "Grill Room", type: "dining" },
          members: { first_name: "John", last_name: "Doe" },
        },
      ],
    });
    mockFrom.mockReturnValue(bookingsChain);

    const res = await GET(createRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.bookings).toHaveLength(1);
    expect(data.bookings[0].facility_name).toBe("Grill Room");
    expect(data.bookings[0].facility_type).toBe("dining");
    expect(data.bookings[0].member_first_name).toBe("John");
    expect(data.bookings[0].start_time).toBe("17:00");
    expectClubIdFilter(bookingsChain, "club-1");
  });

  it("filters by type when query param provided", async () => {
    const bookingsChain = createChainMock({
      data: [
        {
          id: "booking-1",
          club_id: "club-1",
          facility_id: "fac-1",
          member_id: "member-1",
          date: "2026-04-01",
          start_time: "17:00:00",
          end_time: "17:30:00",
          status: "confirmed",
          party_size: 4,
          notes: null,
          created_at: "2026-03-01",
          updated_at: "2026-03-01",
          facilities: { name: "Grill Room", type: "dining" },
          members: { first_name: "John", last_name: "Doe" },
        },
        {
          id: "booking-2",
          club_id: "club-1",
          facility_id: "fac-2",
          member_id: "member-1",
          date: "2026-04-01",
          start_time: "08:00:00",
          end_time: "08:10:00",
          status: "confirmed",
          party_size: 4,
          notes: null,
          created_at: "2026-03-01",
          updated_at: "2026-03-01",
          facilities: { name: "Main Course", type: "golf" },
          members: { first_name: "John", last_name: "Doe" },
        },
      ],
    });
    mockFrom.mockReturnValue(bookingsChain);

    const res = await GET(createRequest({ type: "dining" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    // Client-side filter should only return dining bookings
    expect(data.bookings).toHaveLength(1);
    expect(data.bookings[0].facility_type).toBe("dining");
  });
});
