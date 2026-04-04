/**
 * Tests for GET/POST /api/pos/transactions
 */
import type { MemberWithTier } from "@/lib/golf-eligibility";

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

jest.mock("@/lib/pos", () => ({
  getPOSProvider: jest.fn(() => ({
    createSale: jest.fn().mockResolvedValue({ success: true, externalId: "ext-1" }),
  })),
}));

import { GET, POST } from "../route";

function createChainMock(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: result.data ?? null, error: result.error ?? null };
  const chain: Record<string, jest.Mock> = {};
  for (const m of ["select","eq","neq","in","gte","lte","not","or","order","limit","insert","update","delete","range"]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain["single"] = jest.fn().mockResolvedValue(resolved);
  chain["maybeSingle"] = jest.fn().mockResolvedValue(resolved);
  (chain as unknown as PromiseLike<typeof resolved>).then = ((
    onFulfilled: (v: typeof resolved) => unknown,
  ) => Promise.resolve(resolved).then(onFulfilled)) as never;
  return chain;
}

const admin: MemberWithTier = {
  id: "m-1", club_id: "c-1", user_id: "u-1", first_name: "Admin", last_name: "User",
  email: "admin@test.com", role: "admin", status: "active",
  membership_tier_id: "t-1", tier_level: "premium", tier_name: "Premium",
};
const member: MemberWithTier = { ...admin, id: "m-2", user_id: "u-2", role: "member" };

describe("GET /api/pos/transactions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new Request("http://localhost/api/pos/transactions"));
    expect(res.status).toBe(401);
  });

  it("returns transactions for member (own only)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    mockFrom.mockReturnValue(createChainMock({ data: [] }));
    const res = await GET(new Request("http://localhost/api/pos/transactions"));
    expect(res.status).toBe(200);
  });

  it("returns all transactions for admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockFrom.mockReturnValue(createChainMock({ data: [{ id: "t-1", total: 25 }] }));
    const res = await GET(new Request("http://localhost/api/pos/transactions"));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/pos/transactions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for member", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const res = await POST(new Request("http://localhost/api/pos/transactions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pos_config_id: "00000000-0000-0000-0000-000000000001",
        type: "sale", location: "dining", subtotal: 25, tax: 2, tip: 5,
        items: [{ name: "Burger", quantity: 1, unit_price: 25 }],
      }),
    }));
    expect(res.status).toBe(403);
  });

  it("creates transaction (201)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const chain = createChainMock({ data: { id: "txn-1", total: 32, provider: "manual", config: {} } });
    mockFrom.mockReturnValue(chain);
    const res = await POST(new Request("http://localhost/api/pos/transactions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pos_config_id: "00000000-0000-0000-0000-000000000001",
        type: "sale", location: "dining", subtotal: 25, tax: 2, tip: 5,
        items: [{ name: "Burger", quantity: 1, unit_price: 25 }],
      }),
    }));
    expect(res.status).toBe(201);
  });
});
