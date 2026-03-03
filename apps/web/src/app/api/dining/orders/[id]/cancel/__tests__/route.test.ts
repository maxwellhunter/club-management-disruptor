/**
 * Tests for PATCH /api/dining/orders/[id]/cancel.
 *
 * Validates authentication, ownership checks, status constraints
 * (only pending can be cancelled), invoice voiding, and cross-tenant isolation.
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

const mockAdminFrom = jest.fn();
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn().mockReturnValue({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  }),
}));

import { PATCH } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createRequest(): Request {
  return new Request("http://localhost:3000/api/dining/orders/order-1/cancel", {
    method: "PATCH",
  });
}

const params = Promise.resolve({ id: "order-1" });

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

describe("PATCH /api/dining/orders/[id]/cancel", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await PATCH(createRequest(), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when member is not found", async () => {
    mockGetMemberWithTier.mockResolvedValue(null);
    const res = await PATCH(createRequest(), { params });
    expect(res.status).toBe(404);
  });

  it("returns 404 when order not found (cross-tenant isolation)", async () => {
    const orderChain = createChainMock({ data: null, error: { message: "Not found" } });
    mockFrom.mockReturnValue(orderChain);

    const res = await PATCH(createRequest(), { params });
    expect(res.status).toBe(404);
    expectClubIdFilter(orderChain, "club-1");
  });

  it("returns 403 when trying to cancel another member's order", async () => {
    const orderChain = createChainMock({
      data: {
        id: "order-1",
        member_id: "other-member",
        status: "pending",
        invoice_id: null,
      },
    });
    mockFrom.mockReturnValue(orderChain);

    const res = await PATCH(createRequest(), { params });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("another member");
  });

  it("returns 400 when order is not pending", async () => {
    const orderChain = createChainMock({
      data: {
        id: "order-1",
        member_id: "member-1",
        status: "confirmed",
        invoice_id: null,
      },
    });
    mockFrom.mockReturnValue(orderChain);

    const res = await PATCH(createRequest(), { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("pending");
  });

  it("cancels own pending order successfully", async () => {
    const orderChain = createChainMock({
      data: {
        id: "order-1",
        member_id: "member-1",
        status: "pending",
        invoice_id: null,
      },
    });
    mockFrom.mockReturnValue(orderChain);

    const updateChain = createChainMock({
      data: { id: "order-1", status: "cancelled" },
    });
    mockAdminFrom.mockReturnValue(updateChain);

    const res = await PATCH(createRequest(), { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.order.status).toBe("cancelled");
  });

  it("voids linked invoice when cancelling", async () => {
    const orderChain = createChainMock({
      data: {
        id: "order-1",
        member_id: "member-1",
        status: "pending",
        invoice_id: "inv-1",
      },
    });
    mockFrom.mockReturnValue(orderChain);

    const updateChain = createChainMock({
      data: { id: "order-1", status: "cancelled" },
    });
    const invoiceChain = createChainMock({ data: null });

    let adminCallNum = 0;
    mockAdminFrom.mockImplementation(() => {
      adminCallNum++;
      return adminCallNum === 1 ? updateChain : invoiceChain;
    });

    const res = await PATCH(createRequest(), { params });
    expect(res.status).toBe(200);
    expect(mockAdminFrom).toHaveBeenCalledWith("invoices");
  });
});
