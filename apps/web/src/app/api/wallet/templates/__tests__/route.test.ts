/**
 * Tests for GET/POST /api/wallet/templates
 */
import type { MemberWithTier } from "@/lib/golf-eligibility";

const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/api", () => ({
  createApiClient: jest.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
  }),
}));

const mockGetMemberWithTier = jest.fn();
jest.mock("@/lib/golf-eligibility", () => ({
  getMemberWithTier: (...args: unknown[]) => mockGetMemberWithTier(...args),
}));

const mockAdminFrom = jest.fn();
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ from: (...args: unknown[]) => mockAdminFrom(...args) })),
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

describe("GET /api/wallet/templates", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new Request("http://localhost/api/wallet/templates"));
    expect(res.status).toBe(401);
  });

  it("returns template for member", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    mockAdminFrom.mockReturnValue(createChainMock({ data: { id: "tmpl-1", apple_background_color: "#16a34a" } }));
    const res = await GET(new Request("http://localhost/api/wallet/templates"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.template).toBeDefined();
  });
});

describe("POST /api/wallet/templates", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const res = await POST(new Request("http://localhost/api/wallet/templates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apple_background_color: "#000000" }),
    }));
    expect(res.status).toBe(403);
  });

  it("creates new template", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    // Check existing → null, then insert
    const noExistingChain = createChainMock({ data: null });
    const insertChain = createChainMock({ data: { id: "tmpl-new", apple_background_color: "#000000" } });
    mockAdminFrom.mockReturnValueOnce(noExistingChain).mockReturnValueOnce(insertChain);
    const res = await POST(new Request("http://localhost/api/wallet/templates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apple_background_color: "#000000" }),
    }));
    expect(res.status).toBe(200);
  });

  it("updates existing template", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const existingChain = createChainMock({ data: { id: "tmpl-1" } });
    const updateChain = createChainMock({ data: { id: "tmpl-1", apple_background_color: "#111111" } });
    mockAdminFrom.mockReturnValueOnce(existingChain).mockReturnValueOnce(updateChain);
    const res = await POST(new Request("http://localhost/api/wallet/templates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apple_background_color: "#111111" }),
    }));
    expect(res.status).toBe(200);
  });
});
