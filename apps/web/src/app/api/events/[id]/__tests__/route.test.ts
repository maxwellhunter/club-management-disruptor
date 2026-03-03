/**
 * Tests for GET /api/events/[id].
 *
 * Validates authentication, club scoping, role-based visibility
 * (admins can see drafts, members cannot), and RSVP enrichment.
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
  return new Request("http://localhost:3000/api/events/event-1", {
    method: "GET",
  });
}

const makeParams = (id = "event-1") => Promise.resolve({ id });

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

  // Make the chain thenable
  (chain as unknown as PromiseLike<typeof resolved>).then = ((
    onFulfilled: (v: typeof resolved) => unknown,
  ) => Promise.resolve(resolved).then(onFulfilled)) as never;

  return chain;
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

const sampleEvent = {
  id: "event-1",
  club_id: "club-1",
  title: "Wine Tasting Evening",
  description: "An evening of fine wines.",
  location: "Main Clubhouse",
  start_date: new Date(Date.now() + 86400000).toISOString(),
  end_date: null,
  capacity: 50,
  price: 25,
  status: "published",
};

// ─── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
  });
});

// ─── Tests ───────────────────────────────────────────────────────────

describe("GET /api/events/[id]", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(createRequest(), { params: makeParams() });
    expect(res.status).toBe(401);
  });

  it("returns 404 when member is not found", async () => {
    mockGetMemberWithTier.mockResolvedValue(null);

    const res = await GET(createRequest(), { params: makeParams() });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Member not found");
  });

  it("returns 404 when event is not found", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockAdminMember,
      isGolfEligible: true,
    });

    const eventsChain = createChainMock({
      data: null,
      error: { message: "not found" },
    });
    mockFrom.mockReturnValue(eventsChain);

    const res = await GET(createRequest(), { params: makeParams() });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Event not found");
  });

  it("returns 404 when non-admin views a draft event", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockRegularMember,
      isGolfEligible: true,
    });

    // The single() call will fail since the event is draft and query filters status=published
    const eventsChain = createChainMock({
      data: null,
      error: { message: "not found" },
    });
    mockFrom.mockReturnValue(eventsChain);

    const res = await GET(createRequest(), { params: makeParams() });
    expect(res.status).toBe(404);

    // Verify that status=published filter was applied
    const eqCalls = eventsChain["eq"].mock.calls;
    const hasStatusFilter = eqCalls.some(
      ([col, val]: [string, string]) =>
        col === "status" && val === "published",
    );
    expect(hasStatusFilter).toBe(true);
  });

  it("returns enriched event with RSVP data for member", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockRegularMember,
      isGolfEligible: true,
    });

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        // events query
        return createChainMock({ data: sampleEvent });
      }
      if (fromCallCount === 2) {
        // RSVP count query
        return createChainMock({ count: 12 });
      }
      // user RSVP query
      return createChainMock({ data: { status: "attending" } });
    });

    const res = await GET(createRequest(), { params: makeParams() });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.event.title).toBe("Wine Tasting Evening");
    expect(data.event.rsvp_count).toBe(12);
    expect(data.event.user_rsvp_status).toBe("attending");
    expect(data.role).toBe("member");
  });

  it("admin can view draft event (no status filter)", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockAdminMember,
      isGolfEligible: true,
    });

    const draftEvent = { ...sampleEvent, status: "draft" };

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        // events query — return the draft event
        const chain = createChainMock({ data: draftEvent });
        // Track eq calls to verify no status filter
        return chain;
      }
      if (fromCallCount === 2) {
        return createChainMock({ count: 3 });
      }
      return createChainMock({ data: null });
    });

    const res = await GET(createRequest(), { params: makeParams() });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.event.title).toBe("Wine Tasting Evening");
    expect(data.event.rsvp_count).toBe(3);
    expect(data.event.user_rsvp_status).toBeNull();
    expect(data.role).toBe("admin");
  });

  it("scopes query to member's club_id", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockAdminMember,
      isGolfEligible: true,
    });

    const eventsChain = createChainMock({ data: null, error: { message: "not found" } });
    mockFrom.mockReturnValue(eventsChain);

    await GET(createRequest(), { params: makeParams() });

    const eqCalls = eventsChain["eq"].mock.calls;
    const hasClubIdFilter = eqCalls.some(
      ([col, val]: [string, string]) =>
        col === "club_id" && val === "club-1",
    );
    expect(hasClubIdFilter).toBe(true);
  });
});
