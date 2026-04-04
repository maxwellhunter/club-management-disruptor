/**
 * Tests for POST/DELETE /api/billing/minimums — Spending minimum management.
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
  createClient: jest.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  })),
}));

import { POST, DELETE } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createPostRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/billing/minimums", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createDeleteRequest(id: string): Request {
  return new Request(`http://localhost:3000/api/billing/minimums?id=${id}`, {
    method: "DELETE",
  });
}

function createChainMock(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: result.data ?? null, error: result.error ?? null };
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

const validMinimumBody = {
  tier_id: "00000000-0000-0000-0000-000000000001",
  name: "Dining Minimum",
  category: "dining",
  amount: 200,
  period: "monthly",
};

// ─── POST Tests ──────────────────────────────────────────────────────

describe("POST /api/billing/minimums", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(createPostRequest(validMinimumBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({
      member: { ...adminMember, role: "member" },
    });

    const res = await POST(createPostRequest(validMinimumBody));
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const res = await POST(createPostRequest({ category: "dining" }));
    expect(res.status).toBe(400);
  });

  it("creates spending minimum (201)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const insertChain = createChainMock({
      data: { id: "min-1", ...validMinimumBody, club_id: "club-1" },
    });
    mockAdminFrom.mockReturnValue(insertChain);

    const res = await POST(createPostRequest(validMinimumBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.minimum).toBeDefined();
  });
});

// ─── DELETE Tests ────────────────────────────────────────────────────

describe("DELETE /api/billing/minimums", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await DELETE(createDeleteRequest("min-1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const req = new Request("http://localhost:3000/api/billing/minimums", {
      method: "DELETE",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("soft-deletes spending minimum successfully", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const updateChain = createChainMock({ data: null });
    mockAdminFrom.mockReturnValue(updateChain);

    const res = await DELETE(createDeleteRequest("min-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
