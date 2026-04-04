/**
 * Tests for POST /api/billing/invoices — Admin creates a manual invoice.
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

import { POST } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/billing/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

const regularMember: MemberWithTier = {
  ...adminMember,
  id: "member-2",
  role: "member",
  first_name: "Regular",
};

const validInvoiceBody = {
  member_id: "00000000-0000-0000-0000-000000000002",
  amount: 500,
  description: "Initiation Fee",
  due_date: "2026-02-28",
};

// ─── Tests ───────────────────────────────────────────────────────────

describe("POST /api/billing/invoices", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(createRequest(validInvoiceBody));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 when caller is not admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: regularMember });

    const res = await POST(createRequest(validInvoiceBody));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Admin access required" });
  });

  it("returns 400 for invalid body", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const res = await POST(createRequest({ amount: -10 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details).toBeDefined();
  });

  it("returns 404 when target member not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const memberChain = createChainMock({ data: null });
    mockFrom.mockReturnValue(memberChain);

    const res = await POST(createRequest(validInvoiceBody));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Member not found in this club" });
  });

  it("creates invoice successfully (201)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    // Member lookup succeeds
    const memberChain = createChainMock({
      data: { id: validInvoiceBody.member_id, first_name: "Jane", last_name: "Doe" },
    });
    mockFrom.mockReturnValue(memberChain);

    // Admin client insert succeeds
    const insertChain = createChainMock({
      data: { id: "inv-1", ...validInvoiceBody, status: "draft" },
    });
    mockAdminFrom.mockReturnValue(insertChain);

    const res = await POST(createRequest(validInvoiceBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.invoice).toBeDefined();
    expect(body.invoice.status).toBe("draft");
  });

  it("returns 500 when insert fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const memberChain = createChainMock({
      data: { id: validInvoiceBody.member_id },
    });
    mockFrom.mockReturnValue(memberChain);

    const insertChain = createChainMock({
      error: { message: "DB error" },
    });
    mockAdminFrom.mockReturnValue(insertChain);

    const res = await POST(createRequest(validInvoiceBody));
    expect(res.status).toBe(500);
  });
});
