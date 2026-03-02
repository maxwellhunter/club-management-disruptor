/**
 * Tests for PATCH /api/bookings/[id]/cancel.
 *
 * Validates authentication, club-scoped booking lookup (cross-tenant
 * isolation), ownership checks, status validation, and successful
 * cancellation.
 *
 * Cross-tenant tests verify that .eq("club_id", ...) is called on the
 * booking lookup, preventing a user from cancelling bookings at other clubs.
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
import { PATCH } from "../[id]/cancel/route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createRequest(): Request {
  return new Request("http://localhost:3000/api/bookings/booking-1/cancel", {
    method: "PATCH",
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
    "update",
    "insert",
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

const futureDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];

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

describe("PATCH /api/bookings/[id]/cancel", () => {
  const params = { params: Promise.resolve({ id: "booking-1" }) };

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await PATCH(createRequest(), params);
    expect(res.status).toBe(401);
  });

  it("returns 404 when member is not found", async () => {
    mockGetMemberWithTier.mockResolvedValue(null);

    const res = await PATCH(createRequest(), params);
    expect(res.status).toBe(404);
  });

  it("returns 404 when booking not found (club_id mismatch — cross-tenant isolation)", async () => {
    const bookingChain = createChainMock({
      data: null,
      error: { message: "Not found" },
    });
    mockFrom.mockReturnValue(bookingChain);

    const res = await PATCH(createRequest(), params);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Booking not found");
    expect(mockFrom).toHaveBeenCalledWith("bookings");
    // Verify club_id filter was applied to booking lookup
    expectClubIdFilter(bookingChain, "club-1");
  });

  it("returns 403 when non-owner non-admin tries to cancel", async () => {
    mockFrom.mockReturnValue(
      createChainMock({
        data: {
          id: "booking-1",
          member_id: "other-member",
          date: futureDate,
          status: "confirmed",
        },
      }),
    );

    const res = await PATCH(createRequest(), params);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("only cancel your own");
  });

  it("returns 400 when booking is already cancelled", async () => {
    mockFrom.mockReturnValue(
      createChainMock({
        data: {
          id: "booking-1",
          member_id: "member-1",
          date: futureDate,
          status: "cancelled",
        },
      }),
    );

    const res = await PATCH(createRequest(), params);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("cannot be cancelled");
  });

  it("returns 200 on successful cancellation with club_id filter on booking lookup", async () => {
    const bookingFetchChain = createChainMock({
      data: {
        id: "booking-1",
        member_id: "member-1",
        date: futureDate,
        status: "confirmed",
      },
    });
    const updateChain = createChainMock({
      data: {
        id: "booking-1",
        status: "cancelled",
      },
    });

    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      return callNum === 1 ? bookingFetchChain : updateChain;
    });

    const res = await PATCH(createRequest(), params);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.booking).toBeDefined();
    // Verify club_id filter was applied to booking fetch
    expectClubIdFilter(bookingFetchChain, "club-1");
  });
});
