/**
 * Tests for GET /api/members (member directory).
 *
 * Validates authentication, club-scoped queries, search, tier filter,
 * default active status, and cross-tenant isolation.
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
  const url = new URL("http://localhost:3000/api/members");
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
    "select", "eq", "neq", "in", "gte", "or", "order", "limit",
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

describe("GET /api/members", () => {
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

  it("returns members with tier info and club_id filter", async () => {
    const membersChain = createChainMock({
      data: [
        {
          id: "m-1",
          member_number: "001",
          first_name: "Jane",
          last_name: "Smith",
          email: "jane@example.com",
          phone: "+1-555-0100",
          avatar_url: null,
          role: "member",
          status: "active",
          join_date: "2025-01-15",
          membership_tiers: { name: "Premium", level: "premium" },
        },
      ],
    });
    const tiersChain = createChainMock({
      data: [
        { id: "tier-1", name: "Premium", level: "premium" },
        { id: "tier-2", name: "Standard", level: "standard" },
      ],
    });

    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      return callNum === 1 ? membersChain : tiersChain;
    });

    const res = await GET(createRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.members).toHaveLength(1);
    expect(data.members[0].first_name).toBe("Jane");
    expect(data.members[0].tier_name).toBe("Premium");
    expect(data.members[0].tier_level).toBe("premium");
    expect(data.tiers).toHaveLength(2);
    expect(data.role).toBe("member");
    expectClubIdFilter(membersChain, "club-1");
  });

  it("defaults to active status filter", async () => {
    const membersChain = createChainMock({ data: [] });
    const tiersChain = createChainMock({ data: [] });

    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      return callNum === 1 ? membersChain : tiersChain;
    });

    await GET(createRequest());

    const eqCalls = membersChain["eq"].mock.calls;
    const hasActiveFilter = eqCalls.some(
      ([col, val]: [string, string]) => col === "status" && val === "active",
    );
    expect(hasActiveFilter).toBe(true);
  });

  it("filters by tier when param provided", async () => {
    const membersChain = createChainMock({ data: [] });
    const tiersChain = createChainMock({ data: [] });

    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      return callNum === 1 ? membersChain : tiersChain;
    });

    await GET(createRequest({ tier: "tier-2" }));

    const eqCalls = membersChain["eq"].mock.calls;
    const hasTierFilter = eqCalls.some(
      ([col, val]: [string, string]) => col === "membership_tier_id" && val === "tier-2",
    );
    expect(hasTierFilter).toBe(true);
  });

  it("searches via .or() when search param provided", async () => {
    const membersChain = createChainMock({ data: [] });
    const tiersChain = createChainMock({ data: [] });

    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      return callNum === 1 ? membersChain : tiersChain;
    });

    await GET(createRequest({ search: "jane" }));

    expect(membersChain["or"]).toHaveBeenCalledWith(
      expect.stringContaining("jane"),
    );
  });

  it("returns empty array when no members match", async () => {
    const membersChain = createChainMock({ data: [] });
    const tiersChain = createChainMock({ data: [] });

    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      return callNum === 1 ? membersChain : tiersChain;
    });

    const res = await GET(createRequest({ search: "nonexistent" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.members).toEqual([]);
  });

  it("returns tiers with club_id filter", async () => {
    const membersChain = createChainMock({ data: [] });
    const tiersChain = createChainMock({
      data: [{ id: "tier-1", name: "Premium", level: "premium" }],
    });

    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      return callNum === 1 ? membersChain : tiersChain;
    });

    await GET(createRequest());

    expectClubIdFilter(tiersChain, "club-1");
  });
});
