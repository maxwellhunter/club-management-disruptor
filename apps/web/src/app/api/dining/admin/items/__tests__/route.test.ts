/**
 * Tests for POST /api/dining/admin/items, PUT /api/dining/admin/items/[id],
 * and DELETE /api/dining/admin/items/[id].
 *
 * Validates authentication, admin-only access, input validation,
 * CRUD operations, and cross-tenant isolation.
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

import { POST } from "../route";
import { PUT, DELETE } from "../[id]/route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createPostRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/dining/admin/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createPutRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/dining/admin/items/item-1", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createDeleteRequest(): Request {
  return new Request("http://localhost:3000/api/dining/admin/items/item-1", {
    method: "DELETE",
  });
}

const itemParams = Promise.resolve({ id: "item-1" });

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
    "select", "eq", "neq", "in", "order", "limit",
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

const validItemBody = {
  category_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  name: "Caesar Salad",
  price: 14.5,
};

// ─── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
  });
  mockGetMemberWithTier.mockResolvedValue({
    member: mockAdmin,
    isGolfEligible: false,
  });
});

// ─── POST Tests ──────────────────────────────────────────────────────

describe("POST /api/dining/admin/items", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(createPostRequest(validItemBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockMember,
      isGolfEligible: false,
    });
    const res = await POST(createPostRequest(validItemBody));
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid input (missing name)", async () => {
    const res = await POST(
      createPostRequest({
        category_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        price: 14.5,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 on successful item creation", async () => {
    const insertChain = createChainMock({
      data: {
        id: "item-1",
        club_id: "club-1",
        ...validItemBody,
      },
    });
    mockFrom.mockReturnValue(insertChain);

    const res = await POST(createPostRequest(validItemBody));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.item.name).toBe("Caesar Salad");

    const insertCalls = insertChain["insert"].mock.calls;
    expect(insertCalls[0][0].club_id).toBe("club-1");
  });
});

// ─── PUT Tests ───────────────────────────────────────────────────────

describe("PUT /api/dining/admin/items/[id]", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await PUT(createPutRequest({ price: 18.0 }), { params: itemParams });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockMember,
      isGolfEligible: false,
    });
    const res = await PUT(createPutRequest({ price: 18.0 }), { params: itemParams });
    expect(res.status).toBe(403);
  });

  it("updates item successfully with club_id filter", async () => {
    const updateChain = createChainMock({
      data: { id: "item-1", name: "Caesar Salad", price: 18.0 },
    });
    mockFrom.mockReturnValue(updateChain);

    const res = await PUT(createPutRequest({ price: 18.0 }), { params: itemParams });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.item.price).toBe(18.0);
    expectClubIdFilter(updateChain, "club-1");
  });
});

// ─── DELETE Tests ────────────────────────────────────────────────────

describe("DELETE /api/dining/admin/items/[id]", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await DELETE(createDeleteRequest(), { params: itemParams });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockMember,
      isGolfEligible: false,
    });
    const res = await DELETE(createDeleteRequest(), { params: itemParams });
    expect(res.status).toBe(403);
  });

  it("deletes item successfully with club_id filter", async () => {
    const deleteChain = createChainMock({ data: null });
    mockFrom.mockReturnValue(deleteChain);

    const res = await DELETE(createDeleteRequest(), { params: itemParams });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expectClubIdFilter(deleteChain, "club-1");
  });
});
