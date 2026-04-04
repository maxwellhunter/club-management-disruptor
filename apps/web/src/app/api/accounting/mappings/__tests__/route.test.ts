/**
 * Tests for POST/DELETE /api/accounting/mappings
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

import { POST, DELETE } from "../route";

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

const validMapping = {
  source_category: "membership_dues",
  gl_account_id: "00000000-0000-0000-0000-000000000001",
};

describe("POST /api/accounting/mappings", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(new Request("http://localhost/api/accounting/mappings", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validMapping),
    }));
    expect(res.status).toBe(401);
  });

  it("creates mapping (201)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockFrom.mockReturnValue(createChainMock({ data: { id: "map-1", ...validMapping } }));
    const res = await POST(new Request("http://localhost/api/accounting/mappings", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validMapping),
    }));
    expect(res.status).toBe(201);
  });
});

describe("DELETE /api/accounting/mappings", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when id missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const res = await DELETE(new Request("http://localhost/api/accounting/mappings", { method: "DELETE" }));
    expect(res.status).toBe(400);
  });

  it("deletes mapping", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockFrom.mockReturnValue(createChainMock({ data: null }));
    const res = await DELETE(new Request("http://localhost/api/accounting/mappings?id=map-1", { method: "DELETE" }));
    expect(res.status).toBe(200);
  });
});
