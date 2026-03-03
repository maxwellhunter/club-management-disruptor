/**
 * Tests for GET /api/events.
 *
 * Validates authentication, role-based event visibility (admins see all
 * events, members see only published upcoming), and club_id isolation.
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

function createRequest(): Request {
  return new Request("http://localhost:3000/api/events", { method: "GET" });
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
  for (const m of ["select", "eq", "neq", "gte", "order", "limit", "in"]) {
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
    ([col, val]: [string, string]) =>
      col === "club_id" && val === expectedClubId,
  );
  expect(hasClubIdFilter).toBe(true);
}

const mockAdminMember: MemberWithTier = {
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

const mockRegularMember: MemberWithTier = {
  ...mockAdminMember,
  id: "member-2",
  first_name: "Regular",
  email: "member@example.com",
  role: "member",
};

// ─── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
  });
});

// ─── Tests ───────────────────────────────────────────────────────────

describe("GET /api/events", () => {
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

  it("returns role in response body", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockAdminMember,
      isGolfEligible: true,
    });

    // Events query
    const eventsChain = createChainMock({ data: [] });
    mockFrom.mockReturnValue(eventsChain);

    const res = await GET(createRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.role).toBe("admin");
  });

  it("admin sees all events (no status/date filter)", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockAdminMember,
      isGolfEligible: true,
    });

    const eventsChain = createChainMock({ data: [] });
    mockFrom.mockReturnValue(eventsChain);

    await GET(createRequest());

    // Verify club_id filter is applied
    expectClubIdFilter(eventsChain, "club-1");

    // Verify status = "published" filter was NOT applied for admin
    const eqCalls = eventsChain["eq"].mock.calls;
    const hasStatusFilter = eqCalls.some(
      ([col]: [string]) => col === "status",
    );
    expect(hasStatusFilter).toBe(false);

    // Verify gte (future date) filter was NOT applied for admin
    expect(eventsChain["gte"]).not.toHaveBeenCalled();
  });

  it("member sees only published upcoming events", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockRegularMember,
      isGolfEligible: true,
    });

    const eventsChain = createChainMock({ data: [] });
    mockFrom.mockReturnValue(eventsChain);

    await GET(createRequest());

    // Verify club_id filter is applied
    expectClubIdFilter(eventsChain, "club-1");

    // Verify status = "published" filter WAS applied
    const eqCalls = eventsChain["eq"].mock.calls;
    const hasStatusFilter = eqCalls.some(
      ([col, val]: [string, string]) =>
        col === "status" && val === "published",
    );
    expect(hasStatusFilter).toBe(true);

    // Verify gte (future date) filter WAS applied
    expect(eventsChain["gte"]).toHaveBeenCalledWith(
      "start_date",
      expect.any(String),
    );
  });
});
