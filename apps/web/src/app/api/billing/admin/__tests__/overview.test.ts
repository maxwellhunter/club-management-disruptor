/**
 * Tests for GET /api/billing/admin/overview — Billing dashboard stats.
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

import { GET } from "../overview/route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createRequest(): Request {
  return new Request("http://localhost:3000/api/billing/admin/overview");
}

function createChainMock(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const resolved = { data: result.data ?? null, error: result.error ?? null, count: result.count ?? null };
  const chain: Record<string, jest.Mock> = {};
  for (const m of [
    "select", "eq", "neq", "in", "gte", "or", "order", "limit",
    "insert", "update", "delete",
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

const adminMember: MemberWithTier = {
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

// ─── Tests ───────────────────────────────────────────────────────────

describe("GET /api/billing/admin/overview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(createRequest());
    expect(res.status).toBe(401);
  });

  it("returns 404 when member not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue(null);

    const res = await GET(createRequest());
    expect(res.status).toBe(404);
  });

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({
      member: { ...adminMember, role: "member" },
    });

    const res = await GET(createRequest());
    expect(res.status).toBe(403);
  });

  it("returns billing overview with correct stats", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    // Unpaid invoices
    const unpaidChain = createChainMock({
      data: [{ amount: 500 }, { amount: 300 }],
    });
    // Monthly payments
    const paymentsChain = createChainMock({
      data: [{ amount: 200 }],
    });
    // Overdue count
    const overdueChain = createChainMock({ data: null, count: 2 });
    // Recent invoices with member join
    const invoicesChain = createChainMock({
      data: [
        {
          id: "inv-1",
          description: "Dues",
          amount: 500,
          status: "sent",
          due_date: "2026-02-28",
          member_id: "m-2",
          members: { first_name: "Jane", last_name: "Doe" },
        },
      ],
    });

    mockFrom
      .mockReturnValueOnce(unpaidChain)
      .mockReturnValueOnce(paymentsChain)
      .mockReturnValueOnce(overdueChain)
      .mockReturnValueOnce(invoicesChain);

    const res = await GET(createRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.outstandingBalance).toBe(800);
    expect(body.collectedMtd).toBe(200);
    expect(body.overdueCount).toBe(2);
    expect(body.recentInvoices).toHaveLength(1);
    expect(body.recentInvoices[0].member_name).toBe("Jane Doe");
  });

  it("handles empty data gracefully", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const emptyChain = createChainMock({ data: [] });
    const countChain = createChainMock({ data: null, count: 0 });

    mockFrom
      .mockReturnValueOnce(emptyChain)
      .mockReturnValueOnce(emptyChain)
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(emptyChain);

    const res = await GET(createRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.outstandingBalance).toBe(0);
    expect(body.collectedMtd).toBe(0);
    expect(body.overdueCount).toBe(0);
    expect(body.recentInvoices).toHaveLength(0);
  });
});
