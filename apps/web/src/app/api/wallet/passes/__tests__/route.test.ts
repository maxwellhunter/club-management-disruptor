/**
 * Tests for GET/POST/DELETE /api/wallet/passes
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

const mockProvisionPass = jest.fn();
const mockGenerateBarcodePayload = jest.fn();
jest.mock("@/lib/wallet/pass-generator", () => ({
  provisionPass: (...args: unknown[]) => mockProvisionPass(...args),
  generateBarcodePayload: (...args: unknown[]) => mockGenerateBarcodePayload(...args),
}));

import { GET, POST, DELETE } from "../route";

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

describe("GET /api/wallet/passes", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new Request("http://localhost/api/wallet/passes"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-member", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-x" } } });
    mockGetMemberWithTier.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/wallet/passes"));
    expect(res.status).toBe(403);
  });

  it("returns member passes", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const chain = createChainMock({ data: [] });
    mockAdminFrom.mockReturnValue(chain);
    const res = await GET(new Request("http://localhost/api/wallet/passes"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.passes).toBeDefined();
  });
});

describe("POST /api/wallet/passes", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns existing pass when one already exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    mockAdminFrom.mockReturnValue(createChainMock({ data: { id: "p-1", status: "active" } }));
    const res = await POST(new Request("http://localhost/api/wallet/passes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: "apple" }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.serial).toBe("p-1");
  });

  it("generates new pass", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    // existing check → null, club → name, template → null, member_number → M-xxx
    mockAdminFrom.mockReturnValue(createChainMock({ data: null }));
    mockProvisionPass.mockResolvedValue({
      passUrl: "https://pass.example.com/abc",
      serial: "serial-123",
      barcodePayload: "CLUBOS-m-2",
      passData: {},
    });
    const res = await POST(new Request("http://localhost/api/wallet/passes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: "apple" }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.serial).toBe("serial-123");
  });
});

describe("DELETE /api/wallet/passes", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const res = await DELETE(new Request("http://localhost/api/wallet/passes", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pass_id: "00000000-0000-0000-0000-000000000001" }),
    }));
    expect(res.status).toBe(403);
  });

  it("revokes pass", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockAdminFrom.mockReturnValue(createChainMock({ data: null }));
    const res = await DELETE(new Request("http://localhost/api/wallet/passes", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pass_id: "00000000-0000-0000-0000-000000000001" }),
    }));
    expect(res.status).toBe(200);
  });
});
