/**
 * Tests for GET/POST /api/tiers
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

const mockAdminFrom = jest.fn();
jest.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: jest.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  })),
}));

import { GET, POST } from "../route";

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
const member: MemberWithTier = { ...admin, id: "m-2", user_id: "u-2", role: "member" };

describe("GET /api/tiers", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new Request("http://localhost/api/tiers"));
    expect(res.status).toBe(401);
  });

  it("returns tiers for member (no member counts)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    mockFrom.mockReturnValue(createChainMock({ data: [{ id: "t-1", name: "Premium" }] }));
    const res = await GET(new Request("http://localhost/api/tiers"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tiers).toHaveLength(1);
    expect(body.memberCounts).toEqual({});
  });

  it("returns tiers with member counts for admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const tiersChain = createChainMock({ data: [{ id: "t-1", name: "Premium" }] });
    const membersChain = createChainMock({ data: [{ membership_tier_id: "t-1" }, { membership_tier_id: "t-1" }] });
    mockFrom.mockReturnValue(tiersChain);
    mockAdminFrom.mockReturnValue(membersChain);
    const res = await GET(new Request("http://localhost/api/tiers"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.memberCounts["t-1"]).toBe(2);
  });
});

describe("POST /api/tiers", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const res = await POST(new Request("http://localhost/api/tiers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Gold", level: "premium", monthly_dues: 500 }),
    }));
    expect(res.status).toBe(403);
  });

  it("creates tier (201)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockAdminFrom.mockReturnValue(createChainMock({ data: { id: "t-new", name: "Gold" } }));
    const res = await POST(new Request("http://localhost/api/tiers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Gold", level: "premium", monthly_dues: 500 }),
    }));
    expect(res.status).toBe(201);
  });
});
