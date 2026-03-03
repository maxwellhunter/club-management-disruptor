/**
 * Tests for GET /api/dining/menu.
 *
 * Validates authentication, required parameters, facility lookup,
 * menu categories with items, and cross-tenant isolation.
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
  const url = new URL("http://localhost:3000/api/dining/menu");
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

describe("GET /api/dining/menu", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(createRequest({ facility_id: "fac-1" }));
    expect(res.status).toBe(401);
  });

  it("returns 404 when member is not found", async () => {
    mockGetMemberWithTier.mockResolvedValue(null);
    const res = await GET(createRequest({ facility_id: "fac-1" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when facility_id is missing", async () => {
    const res = await GET(createRequest());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("facility_id");
  });

  it("returns 404 when facility not found (cross-tenant isolation)", async () => {
    const facilityChain = createChainMock({ data: null, error: { message: "Not found" } });
    mockFrom.mockReturnValue(facilityChain);

    const res = await GET(createRequest({ facility_id: "fac-1" }));
    expect(res.status).toBe(404);
    expectClubIdFilter(facilityChain, "club-1");
  });

  it("returns empty categories when none exist", async () => {
    const facilityChain = createChainMock({
      data: { id: "fac-1", name: "Grill Room", type: "dining" },
    });
    const categoriesChain = createChainMock({ data: [] });

    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      return callNum === 1 ? facilityChain : categoriesChain;
    });

    const res = await GET(createRequest({ facility_id: "fac-1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.facility.name).toBe("Grill Room");
    expect(data.categories).toEqual([]);
  });

  it("returns categories with grouped items", async () => {
    const facilityChain = createChainMock({
      data: { id: "fac-1", name: "Grill Room", type: "dining" },
    });
    const categoriesChain = createChainMock({
      data: [
        { id: "cat-1", name: "Appetizers", sort_order: 0 },
        { id: "cat-2", name: "Entrees", sort_order: 1 },
      ],
    });
    const itemsChain = createChainMock({
      data: [
        { id: "item-1", category_id: "cat-1", name: "Wings", price: 12.0 },
        { id: "item-2", category_id: "cat-1", name: "Nachos", price: 14.0 },
        { id: "item-3", category_id: "cat-2", name: "Steak", price: 38.0 },
      ],
    });

    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      if (callNum === 1) return facilityChain;
      if (callNum === 2) return categoriesChain;
      return itemsChain;
    });

    const res = await GET(createRequest({ facility_id: "fac-1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.categories).toHaveLength(2);
    expect(data.categories[0].name).toBe("Appetizers");
    expect(data.categories[0].items).toHaveLength(2);
    expect(data.categories[1].name).toBe("Entrees");
    expect(data.categories[1].items).toHaveLength(1);

    // Verify club_id filters on categories and items queries
    expectClubIdFilter(categoriesChain, "club-1");
    expectClubIdFilter(itemsChain, "club-1");
  });
});
