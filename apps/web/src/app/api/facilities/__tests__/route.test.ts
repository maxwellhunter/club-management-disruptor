/**
 * Tests for GET /api/facilities.
 *
 * Validates authentication, club-scoped facility retrieval (cross-tenant
 * isolation), type filtering, and empty results.
 *
 * Cross-tenant tests verify that .eq("club_id", ...) is called on the
 * facilities query, preventing data leakage between clubs.
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
import { GET } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createRequest(params?: Record<string, string>): Request {
  const url = new URL("http://localhost:3000/api/facilities");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
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
  for (const m of ["select", "eq", "order", "limit"]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }

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

const sampleFacilities = [
  {
    id: "fac-1",
    name: "Championship Course",
    type: "golf",
    description: "18 holes",
    capacity: 144,
    is_active: true,
  },
  {
    id: "fac-2",
    name: "Executive 9",
    type: "golf",
    description: "9-hole executive",
    capacity: 72,
    is_active: true,
  },
];

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

describe("GET /api/facilities", () => {
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

  it("returns facilities filtered by club_id with cross-tenant isolation", async () => {
    const facilitiesChain = createChainMock({ data: sampleFacilities });
    mockFrom.mockReturnValue(facilitiesChain);

    const res = await GET(createRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.facilities).toHaveLength(2);
    expect(data.facilities[0].name).toBe("Championship Course");
    expect(mockFrom).toHaveBeenCalledWith("facilities");
    // Verify club_id filter was applied to facilities query
    expectClubIdFilter(facilitiesChain, "club-1");
  });

  it("filters by type when query param provided with club_id isolation", async () => {
    const facilitiesChain = createChainMock({
      data: [sampleFacilities[0]],
    });
    mockFrom.mockReturnValue(facilitiesChain);

    const res = await GET(createRequest({ type: "golf" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.facilities).toHaveLength(1);
    // Verify club_id filter was applied even with type filter
    expectClubIdFilter(facilitiesChain, "club-1");
    // Verify type filter was also applied
    const eqCalls = facilitiesChain["eq"].mock.calls;
    const hasTypeFilter = eqCalls.some(
      ([col, val]: [string, string]) => col === "type" && val === "golf",
    );
    expect(hasTypeFilter).toBe(true);
  });

  it("returns empty array when no facilities match", async () => {
    const facilitiesChain = createChainMock({ data: [] });
    mockFrom.mockReturnValue(facilitiesChain);

    const res = await GET(createRequest({ type: "tennis" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.facilities).toEqual([]);
    // Verify club_id filter was still applied
    expectClubIdFilter(facilitiesChain, "club-1");
  });
});
