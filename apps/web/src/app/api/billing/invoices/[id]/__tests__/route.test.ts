/**
 * Tests for PATCH /api/billing/invoices/[id] — Admin updates invoice status.
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

jest.mock("@/lib/email", () => ({
  sendInvoiceEmail: jest.fn().mockResolvedValue(undefined),
}));

import { PATCH } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/billing/invoices/inv-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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

const params = Promise.resolve({ id: "inv-1" });

// ─── Tests ───────────────────────────────────────────────────────────

describe("PATCH /api/billing/invoices/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await PATCH(createRequest({ status: "sent" }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({
      member: { ...adminMember, role: "member" },
    });

    const res = await PATCH(createRequest({ status: "sent" }), { params });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid status", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const res = await PATCH(createRequest({ status: "invalid" }), { params });
    expect(res.status).toBe(400);
  });

  it("returns 404 when invoice not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const chain = createChainMock({ data: null });
    mockAdminFrom.mockReturnValue(chain);

    const res = await PATCH(createRequest({ status: "sent" }), { params });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid status transition (paid → sent)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const getChain = createChainMock({
      data: { id: "inv-1", status: "paid", club_id: "club-1", member_id: "m-2" },
    });
    mockAdminFrom.mockReturnValue(getChain);

    const res = await PATCH(createRequest({ status: "sent" }), { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Cannot change");
  });

  it("transitions draft → sent successfully", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const getChain = createChainMock({
      data: {
        id: "inv-1", status: "draft", club_id: "club-1",
        member_id: "m-2", description: "Test", amount: 100, due_date: "2026-02-28",
      },
    });
    const updateChain = createChainMock({
      data: { id: "inv-1", status: "sent" },
    });
    const memberChain = createChainMock({
      data: { email: "test@example.com", first_name: "Test" },
    });
    const clubChain = createChainMock({
      data: { name: "Test Club" },
    });

    mockAdminFrom
      .mockReturnValueOnce(getChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(memberChain);
    mockFrom.mockReturnValue(clubChain);

    const res = await PATCH(createRequest({ status: "sent" }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invoice.status).toBe("sent");
  });

  it("transitions sent → paid and creates payment record", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const getChain = createChainMock({
      data: {
        id: "inv-1", status: "sent", club_id: "club-1",
        member_id: "m-2", description: "Dues", amount: 500,
      },
    });
    const updateChain = createChainMock({
      data: { id: "inv-1", status: "paid" },
    });
    const paymentChain = createChainMock({ data: {} });

    mockAdminFrom
      .mockReturnValueOnce(getChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(paymentChain);

    const res = await PATCH(createRequest({ status: "paid" }), { params });
    expect(res.status).toBe(200);
    expect(mockAdminFrom).toHaveBeenCalledWith("payments");
  });

  it("transitions sent → void successfully", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const getChain = createChainMock({
      data: { id: "inv-1", status: "sent", club_id: "club-1", member_id: "m-2" },
    });
    const updateChain = createChainMock({
      data: { id: "inv-1", status: "void" },
    });

    mockAdminFrom
      .mockReturnValueOnce(getChain)
      .mockReturnValueOnce(updateChain);

    const res = await PATCH(createRequest({ status: "void" }), { params });
    expect(res.status).toBe(200);
  });
});
