/**
 * Tests for POST /api/billing/payments — Admin records a manual payment.
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
  return new Request("http://localhost:3000/api/billing/payments", {
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

const validPaymentBody = {
  member_id: "00000000-0000-0000-0000-000000000002",
  amount: 250,
  method: "check",
  description: "Check payment for January dues",
};

// ─── Tests ───────────────────────────────────────────────────────────

describe("POST /api/billing/payments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(createRequest(validPaymentBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({
      member: { ...adminMember, role: "member" },
    });

    const res = await POST(createRequest(validPaymentBody));
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body (missing fields)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const res = await POST(createRequest({ amount: 100 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("returns 400 for invalid payment method", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const res = await POST(createRequest({
      ...validPaymentBody,
      method: "bitcoin",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when member not found in club", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const chain = createChainMock({ data: null });
    mockFrom.mockReturnValue(chain);

    const res = await POST(createRequest(validPaymentBody));
    expect(res.status).toBe(404);
  });

  it("records payment successfully (201)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    // Member lookup
    const memberChain = createChainMock({ data: { id: validPaymentBody.member_id } });
    mockFrom.mockReturnValue(memberChain);

    // Payment insert
    const insertChain = createChainMock({
      data: { id: "pay-1", ...validPaymentBody, club_id: "club-1" },
    });
    mockAdminFrom.mockReturnValue(insertChain);

    const res = await POST(createRequest(validPaymentBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.payment).toBeDefined();
    expect(body.payment.method).toBe("check");
  });

  it("records payment with linked invoice and marks invoice as paid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const invoiceId = "00000000-0000-0000-0000-000000000099";
    const bodyWithInvoice = { ...validPaymentBody, invoice_id: invoiceId };

    // Member lookup
    const memberChain = createChainMock({ data: { id: validPaymentBody.member_id } });
    mockFrom.mockReturnValue(memberChain);

    // Payment insert
    const insertChain = createChainMock({
      data: { id: "pay-1", ...bodyWithInvoice, club_id: "club-1" },
    });
    // Invoice update
    const invoiceUpdateChain = createChainMock({ data: {} });

    mockAdminFrom
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(invoiceUpdateChain);

    const res = await POST(createRequest(bodyWithInvoice));
    expect(res.status).toBe(201);

    // Verify invoice was updated
    expect(mockAdminFrom).toHaveBeenCalledWith("invoices");
  });

  it("accepts all valid payment methods", async () => {
    const methods = ["card", "ach", "check", "cash", "other"];

    for (const method of methods) {
      jest.clearAllMocks();
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

      const memberChain = createChainMock({ data: { id: validPaymentBody.member_id } });
      mockFrom.mockReturnValue(memberChain);

      const insertChain = createChainMock({
        data: { id: "pay-1", method, club_id: "club-1" },
      });
      mockAdminFrom.mockReturnValue(insertChain);

      const res = await POST(createRequest({ ...validPaymentBody, method }));
      expect(res.status).toBe(201);
    }
  });

  it("returns 500 when insert fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const memberChain = createChainMock({ data: { id: validPaymentBody.member_id } });
    mockFrom.mockReturnValue(memberChain);

    const insertChain = createChainMock({ error: { message: "DB error" } });
    mockAdminFrom.mockReturnValue(insertChain);

    const res = await POST(createRequest(validPaymentBody));
    expect(res.status).toBe(500);
  });
});
