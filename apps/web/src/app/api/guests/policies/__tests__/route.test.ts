/**
 * Tests for POST/DELETE /api/guests/policies
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

describe("POST /api/guests/policies", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(new Request("http://localhost/api/guests/policies", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Default Policy", max_guests_per_visit: 4 }),
    }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: { ...admin, role: "member" } });
    const res = await POST(new Request("http://localhost/api/guests/policies", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Default Policy", max_guests_per_visit: 4 }),
    }));
    expect(res.status).toBe(403);
  });

  it("creates policy (201)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockAdminFrom.mockReturnValue(createChainMock({ data: { id: "p-1" } }));
    const res = await POST(new Request("http://localhost/api/guests/policies", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Default Policy", max_guests_per_visit: 4 }),
    }));
    expect(res.status).toBe(201);
  });
});

describe("DELETE /api/guests/policies", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when id missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const res = await DELETE(new Request("http://localhost/api/guests/policies", { method: "DELETE" }));
    expect(res.status).toBe(400);
  });

  it("soft-deletes policy", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockAdminFrom.mockReturnValue(createChainMock({ data: null }));
    const res = await DELETE(new Request("http://localhost/api/guests/policies?id=p-1", { method: "DELETE" }));
    expect(res.status).toBe(200);
  });
});
