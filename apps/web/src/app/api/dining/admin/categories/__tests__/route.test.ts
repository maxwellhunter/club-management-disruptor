/**
 * Tests for POST /api/dining/admin/categories.
 *
 * Validates authentication, admin-only access, input validation,
 * category creation, and cross-tenant isolation.
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

// ─── Helpers ─────────────────────────────────────────────────────────

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/dining/admin/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
    "select", "eq", "neq", "in", "order", "limit",
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

const validBody = {
  facility_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  name: "Appetizers",
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

// ─── Tests ───────────────────────────────────────────────────────────

describe("POST /api/dining/admin/categories", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(createRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockMember,
      isGolfEligible: false,
    });

    const res = await POST(createRequest(validBody));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Admin only");
  });

  it("returns 400 for invalid input (missing name)", async () => {
    const res = await POST(
      createRequest({
        facility_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid input (empty name)", async () => {
    const res = await POST(
      createRequest({ ...validBody, name: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 on successful category creation", async () => {
    const insertChain = createChainMock({
      data: {
        id: "cat-1",
        club_id: "club-1",
        facility_id: validBody.facility_id,
        name: "Appetizers",
        sort_order: 0,
      },
    });
    mockFrom.mockReturnValue(insertChain);

    const res = await POST(createRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.category).toBeDefined();
    expect(data.category.name).toBe("Appetizers");

    // Verify club_id was included in insert
    const insertCalls = insertChain["insert"].mock.calls;
    expect(insertCalls[0][0].club_id).toBe("club-1");
  });
});
