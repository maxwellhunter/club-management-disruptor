/**
 * Tests for GET/POST /api/pos/config
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
    validateConfig: jest.fn().mockResolvedValue({ valid: true }),
  })),
}));

import { GET, POST } from "../route";

function createChainMock(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: result.data ?? null, error: result.error ?? null };
  const chain: Record<string, jest.Mock> = {};
  for (const m of ["select","eq","neq","in","gte","lte","not","or","order","limit","insert","update","delete"]) {
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

describe("GET /api/pos/config", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new Request("http://localhost/api/pos/config"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for member", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const res = await GET(new Request("http://localhost/api/pos/config"));
    expect(res.status).toBe(403);
  });

  it("returns configs for admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockFrom.mockReturnValue(createChainMock({ data: [{ id: "cfg-1", name: "Main POS" }] }));
    const res = await GET(new Request("http://localhost/api/pos/config"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configs).toHaveLength(1);
  });
});

describe("POST /api/pos/config", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const res = await POST(new Request("http://localhost/api/pos/config", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New POS", provider: "manual", location: "dining", config: {} }),
    }));
    expect(res.status).toBe(403);
  });

  it("creates POS config (201)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockFrom.mockReturnValue(createChainMock({ data: { id: "cfg-new", name: "New POS" } }));
    const res = await POST(new Request("http://localhost/api/pos/config", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New POS", provider: "manual", location: "dining", config: {} }),
    }));
    expect(res.status).toBe(201);
  });
});
