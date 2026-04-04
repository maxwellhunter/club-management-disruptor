/**
 * Tests for POST /api/accounting/accounts
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

import { POST } from "../route";

function createChainMock(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: result.data ?? null, error: result.error ?? null };
  const chain: Record<string, jest.Mock> = {};
  for (const m of ["select","eq","neq","in","gte","not","or","order","limit","insert","update","delete"]) {
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

const validAccount = { account_number: "4000", name: "Revenue", type: "revenue" };

describe("POST /api/accounting/accounts", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(new Request("http://localhost/api/accounting/accounts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validAccount),
    }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: { ...admin, role: "member" } });
    const res = await POST(new Request("http://localhost/api/accounting/accounts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validAccount),
    }));
    expect(res.status).toBe(403);
  });

  it("creates GL account (201)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockFrom.mockReturnValue(createChainMock({ data: { id: "gl-1", ...validAccount } }));
    const res = await POST(new Request("http://localhost/api/accounting/accounts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validAccount),
    }));
    expect(res.status).toBe(201);
  });

  it("returns 409 for duplicate account number", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockFrom.mockReturnValue(createChainMock({ error: { code: "23505", message: "duplicate" } }));
    const res = await POST(new Request("http://localhost/api/accounting/accounts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validAccount),
    }));
    expect(res.status).toBe(409);
  });
});
