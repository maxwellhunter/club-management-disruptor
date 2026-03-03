/**
 * Tests for POST /api/dining/orders and GET /api/dining/orders.
 *
 * Validates authentication, input validation, facility/menu item lookups,
 * price calculation, order creation, billing integration, and
 * cross-tenant isolation.
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

// Mock service role client (supabaseAdmin)
const mockAdminFrom = jest.fn();
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn().mockReturnValue({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  }),
}));

import { POST, GET } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createPostRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/dining/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createGetRequest(): Request {
  return new Request("http://localhost:3000/api/dining/orders");
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

const validOrderBody = {
  facility_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  items: [
    { menu_item_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", quantity: 2 },
  ],
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

// ─── POST Tests ──────────────────────────────────────────────────────

describe("POST /api/dining/orders", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(createPostRequest(validOrderBody));
    expect(res.status).toBe(401);
  });

  it("returns 404 when member is not found", async () => {
    mockGetMemberWithTier.mockResolvedValue(null);
    const res = await POST(createPostRequest(validOrderBody));
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid input (empty items)", async () => {
    const res = await POST(
      createPostRequest({
        facility_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        items: [],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing facility_id", async () => {
    const res = await POST(
      createPostRequest({ items: validOrderBody.items }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when facility not found (cross-tenant isolation)", async () => {
    const facilityChain = createChainMock({
      data: null,
      error: { message: "Not found" },
    });
    mockFrom.mockReturnValue(facilityChain);

    const res = await POST(createPostRequest(validOrderBody));
    expect(res.status).toBe(404);
    expectClubIdFilter(facilityChain, "club-1");
  });

  it("returns 400 when menu items not found", async () => {
    const facilityChain = createChainMock({
      data: { id: "fac-1", name: "Grill Room", type: "dining" },
    });
    const menuChain = createChainMock({ data: [] }); // no items found

    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      return callNum === 1 ? facilityChain : menuChain;
    });

    const res = await POST(createPostRequest(validOrderBody));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain("menu items not found");
  });

  it("returns 400 when menu items are unavailable", async () => {
    const facilityChain = createChainMock({
      data: { id: "fac-1", name: "Grill Room", type: "dining" },
    });
    const menuChain = createChainMock({
      data: [
        {
          id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          name: "Caesar Salad",
          price: 14.5,
          is_available: false,
        },
      ],
    });

    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      return callNum === 1 ? facilityChain : menuChain;
    });

    const res = await POST(createPostRequest(validOrderBody));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain("unavailable");
  });

  it("returns 201 on successful order creation", async () => {
    const facilityChain = createChainMock({
      data: { id: "fac-1", name: "Grill Room", type: "dining" },
    });
    const menuChain = createChainMock({
      data: [
        {
          id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          name: "Caesar Salad",
          price: 14.5,
          is_available: true,
        },
      ],
    });

    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      return callNum === 1 ? facilityChain : menuChain;
    });

    // Admin client chains: order insert, items insert, invoice insert, order update, full order, full items
    const orderInsertChain = createChainMock({
      data: { id: "order-1", club_id: "club-1", total: 31.32 },
    });
    const itemsInsertChain = createChainMock({ data: null });
    const invoiceInsertChain = createChainMock({
      data: { id: "inv-1" },
    });
    const orderUpdateChain = createChainMock({ data: null });
    const fullOrderChain = createChainMock({
      data: {
        id: "order-1",
        club_id: "club-1",
        status: "pending",
        subtotal: 29.0,
        tax: 2.32,
        total: 31.32,
      },
    });
    const fullItemsChain = createChainMock({
      data: [{ id: "item-1", name: "Caesar Salad", price: 14.5, quantity: 2 }],
    });

    let adminCallNum = 0;
    mockAdminFrom.mockImplementation(() => {
      adminCallNum++;
      if (adminCallNum === 1) return orderInsertChain;
      if (adminCallNum === 2) return itemsInsertChain;
      if (adminCallNum === 3) return invoiceInsertChain;
      if (adminCallNum === 4) return orderUpdateChain;
      if (adminCallNum === 5) return fullOrderChain;
      return fullItemsChain;
    });

    const res = await POST(createPostRequest(validOrderBody));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.order).toBeDefined();
    expect(data.order.club_id).toBe("club-1");
  });
});

// ─── GET Tests ───────────────────────────────────────────────────────

describe("GET /api/dining/orders", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(createGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns 404 when member is not found", async () => {
    mockGetMemberWithTier.mockResolvedValue(null);
    const res = await GET(createGetRequest());
    expect(res.status).toBe(404);
  });

  it("returns orders scoped to club_id", async () => {
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
          table_number: null,
          subtotal: 29.0,
          tax: 2.32,
          total: 31.32,
          notes: null,
          created_at: "2026-03-01",
          updated_at: "2026-03-01",
          facilities: { name: "Grill Room" },
          members: { first_name: "John", last_name: "Doe" },
          dining_order_items: [],
        },
      ],
    });

    mockFrom.mockReturnValue(ordersChain);

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.orders).toHaveLength(1);
    expect(data.orders[0].facility_name).toBe("Grill Room");
    expectClubIdFilter(ordersChain, "club-1");
  });

  it("filters to member's own orders for non-admin", async () => {
    const ordersChain = createChainMock({ data: [] });
    mockFrom.mockReturnValue(ordersChain);

    await GET(createGetRequest());

    // Should have called .eq("member_id", ...) for non-admin
    const eqCalls = ordersChain["eq"].mock.calls;
    const hasMemberFilter = eqCalls.some(
      ([col, val]: [string, string]) => col === "member_id" && val === "member-1",
    );
    expect(hasMemberFilter).toBe(true);
  });

  it("does not filter by member_id for admin", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockAdmin,
      isGolfEligible: false,
    });

    const ordersChain = createChainMock({ data: [] });
    mockFrom.mockReturnValue(ordersChain);

    await GET(createGetRequest());

    const eqCalls = ordersChain["eq"].mock.calls;
    const hasMemberFilter = eqCalls.some(
      ([col]: [string, string]) => col === "member_id",
    );
    expect(hasMemberFilter).toBe(false);
  });
});
