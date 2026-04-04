/**
 * Tests for GET /api/billing/invoices/[id]/pdf — Download invoice as PDF.
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

const mockGenerateInvoicePdf = jest.fn();
jest.mock("@/lib/billing/invoice-pdf", () => ({
  generateInvoicePdf: (...args: unknown[]) => mockGenerateInvoicePdf(...args),
}));

import { GET } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createRequest(): Request {
  return new Request("http://localhost:3000/api/billing/invoices/inv-1/pdf");
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
  user_id: "user-2",
  role: "member",
};

const params = Promise.resolve({ id: "inv-1" });

// ─── Tests ───────────────────────────────────────────────────────────

describe("GET /api/billing/invoices/[id]/pdf", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(createRequest(), { params });
    expect(res.status).toBe(401);
  });

  it("returns 403 when member not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue(null);

    const res = await GET(createRequest(), { params });
    expect(res.status).toBe(403);
  });

  it("returns 404 when invoice not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const chain = createChainMock({ data: null });
    mockAdminFrom.mockReturnValue(chain);

    const res = await GET(createRequest(), { params });
    expect(res.status).toBe(404);
  });

  it("returns 403 when member tries to access another member's invoice", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: regularMember });

    const invoiceChain = createChainMock({
      data: {
        id: "inv-1", member_id: "member-99", club_id: "club-1",
        status: "sent", description: "Dues", amount: 500,
        due_date: "2026-02-28", created_at: "2026-01-01", paid_at: null,
      },
    });
    mockAdminFrom.mockReturnValue(invoiceChain);

    const res = await GET(createRequest(), { params });
    expect(res.status).toBe(403);
  });

  it("returns PDF for admin accessing any club invoice", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const invoiceChain = createChainMock({
      data: {
        id: "inv-1", member_id: "member-99", club_id: "club-1",
        status: "sent", description: "Dues", amount: 500,
        due_date: "2026-02-28", created_at: "2026-01-01", paid_at: null,
      },
    });
    const memberChain = createChainMock({
      data: { first_name: "Jane", last_name: "Doe", email: "jane@example.com", member_number: "1042" },
    });
    const clubChain = createChainMock({
      data: { name: "Test Club", address: "123 Main St", phone: "555-0100", email: "club@example.com" },
    });

    mockAdminFrom
      .mockReturnValueOnce(invoiceChain)
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(clubChain);

    const fakePdf = Buffer.from("%PDF-1.4 test");
    mockGenerateInvoicePdf.mockResolvedValue(fakePdf);

    const res = await GET(createRequest(), { params });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("INV-");
  });

  it("allows member to download their own invoice", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: regularMember });

    const invoiceChain = createChainMock({
      data: {
        id: "inv-1", member_id: "member-2", club_id: "club-1",
        status: "sent", description: "Dues", amount: 500,
        due_date: "2026-02-28", created_at: "2026-01-01", paid_at: null,
      },
    });
    const memberChain = createChainMock({
      data: { first_name: "John", last_name: "Doe", email: "john@example.com", member_number: null },
    });
    const clubChain = createChainMock({
      data: { name: "Test Club", address: null, phone: null, email: null },
    });

    mockAdminFrom
      .mockReturnValueOnce(invoiceChain)
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(clubChain);

    const fakePdf = Buffer.from("%PDF-1.4 test");
    mockGenerateInvoicePdf.mockResolvedValue(fakePdf);

    const res = await GET(createRequest(), { params });
    expect(res.status).toBe(200);
  });
});
