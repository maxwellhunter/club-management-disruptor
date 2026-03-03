/**
 * Tests for GET /api/dining/orders/my.
 *
 * Validates authentication, member-scoped queries (own orders only,
 * excludes delivered/cancelled), and cross-tenant isolation.
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

function createRequest(): Request {
  return new Request("http://localhost:3000/api/dining/orders/my");
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
    "select", "eq", "neq", "in", "gte", "not", "order", "limit",
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

describe("GET /api/dining/orders/my", () => {
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

  it("returns member's active orders only", async () => {
    const ordersChain = createChainMock({
      data: [
        {
          id: "order-1",
          club_id: "club-1",
          member_id: "member-1",
          facility_id: "fac-1",
          booking_id: null,
          invoice_id: null,
          status: "pending",
          table_number: "A5",
          subtotal: 29.0,
          tax: 2.32,
          total: 31.32,
          notes: null,
          created_at: "2026-03-01",
          updated_at: "2026-03-01",
          facilities: { name: "Grill Room" },
          dining_order_items: [],
        },
      ],
    });

    mockFrom.mockReturnValue(ordersChain);

    const res = await GET(createRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.orders).toHaveLength(1);
    expect(data.orders[0].facility_name).toBe("Grill Room");
    expect(data.orders[0].member_first_name).toBe("John");
  });

  it("filters by club_id and member_id", async () => {
    const ordersChain = createChainMock({ data: [] });
    mockFrom.mockReturnValue(ordersChain);

    await GET(createRequest());

    expectClubIdFilter(ordersChain, "club-1");

    const eqCalls = ordersChain["eq"].mock.calls;
    const hasMemberFilter = eqCalls.some(
      ([col, val]: [string, string]) => col === "member_id" && val === "member-1",
    );
    expect(hasMemberFilter).toBe(true);
  });

  it("excludes delivered and cancelled orders", async () => {
    const ordersChain = createChainMock({ data: [] });
    mockFrom.mockReturnValue(ordersChain);

    await GET(createRequest());

    // Verify .not() was called to exclude delivered/cancelled
    expect(ordersChain["not"]).toHaveBeenCalled();
  });
});
