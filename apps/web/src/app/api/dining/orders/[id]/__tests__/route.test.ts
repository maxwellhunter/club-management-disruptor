/**
 * Tests for GET /api/dining/orders/[id] and PATCH /api/dining/orders/[id].
 *
 * Validates authentication, order detail retrieval, admin-only status updates,
 * invoice voiding on cancel, and cross-tenant isolation.
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
jest.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: jest.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  })),
}));

import { GET, PATCH } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createGetRequest(): Request {
  return new Request("http://localhost:3000/api/dining/orders/order-1");
}

function createPatchRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/dining/orders/order-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
    member: mockMember,
    isGolfEligible: false,
  });
});

// ─── GET Tests ───────────────────────────────────────────────────────

describe("GET /api/dining/orders/[id]", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(createGetRequest(), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when member is not found", async () => {
    mockGetMemberWithTier.mockResolvedValue(null);
    const res = await GET(createGetRequest(), { params });
    expect(res.status).toBe(404);
  });

  it("returns 404 when order not found (cross-tenant isolation)", async () => {
    const orderChain = createChainMock({ data: null, error: { message: "Not found" } });
    mockFrom.mockReturnValue(orderChain);

    const res = await GET(createGetRequest(), { params });
    expect(res.status).toBe(404);
    expectClubIdFilter(orderChain, "club-1");
  });

  it("returns order detail on success", async () => {
    const orderChain = createChainMock({
      data: {
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
        members: { first_name: "John", last_name: "Doe" },
        dining_order_items: [
          { id: "item-1", name: "Caesar Salad", price: 14.5, quantity: 2 },
        ],
      },
    });
    mockFrom.mockReturnValue(orderChain);

    const res = await GET(createGetRequest(), { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.order.id).toBe("order-1");
    expect(data.order.facility_name).toBe("Grill Room");
    expect(data.order.items).toHaveLength(1);
  });
});

// ─── PATCH Tests ─────────────────────────────────────────────────────

describe("PATCH /api/dining/orders/[id]", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await PATCH(createPatchRequest({ status: "confirmed" }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    const res = await PATCH(createPatchRequest({ status: "confirmed" }), { params });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Admin only");
  });

  it("returns 400 for invalid status", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockAdmin,
      isGolfEligible: false,
    });

    const res = await PATCH(createPatchRequest({ status: "invalid" }), { params });
    expect(res.status).toBe(400);
  });

  it("returns 404 when order not found", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockAdmin,
      isGolfEligible: false,
    });

    const orderChain = createChainMock({ data: null, error: { message: "Not found" } });
    mockAdminFrom.mockReturnValue(orderChain);

    const res = await PATCH(createPatchRequest({ status: "confirmed" }), { params });
    expect(res.status).toBe(404);
  });

  it("updates order status successfully", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockAdmin,
      isGolfEligible: false,
    });

    const getOrderChain = createChainMock({
      data: { id: "order-1", invoice_id: null, status: "pending" },
    });
    const updateChain = createChainMock({
      data: { id: "order-1", status: "confirmed" },
    });

    let adminCallNum = 0;
    mockAdminFrom.mockImplementation(() => {
      adminCallNum++;
      return adminCallNum === 1 ? getOrderChain : updateChain;
    });

    const res = await PATCH(createPatchRequest({ status: "confirmed" }), { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.order.status).toBe("confirmed");
  });

  it("voids invoice when order is cancelled", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockAdmin,
      isGolfEligible: false,
    });

    const getOrderChain = createChainMock({
      data: { id: "order-1", invoice_id: "inv-1", status: "pending" },
    });
    const updateChain = createChainMock({
      data: { id: "order-1", status: "cancelled" },
    });
    const invoiceChain = createChainMock({ data: null });

    let adminCallNum = 0;
    mockAdminFrom.mockImplementation(() => {
      adminCallNum++;
      if (adminCallNum === 1) return getOrderChain;
      if (adminCallNum === 2) return updateChain;
      return invoiceChain;
    });

    const res = await PATCH(createPatchRequest({ status: "cancelled" }), { params });
    expect(res.status).toBe(200);

    // Verify invoices table was updated
    expect(mockAdminFrom).toHaveBeenCalledWith("invoices");
  });
});
