/**
 * Tests for GET/PATCH/DELETE /api/tiers/[id]
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

import { GET, PATCH, DELETE } from "../route";

function createChainMock(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const resolved = { data: result.data ?? null, error: result.error ?? null, count: result.count ?? null };
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

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/tiers/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new Request("http://localhost/api/tiers/t-1"), makeParams("t-1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when tier not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockFrom.mockReturnValue(createChainMock({ data: null, error: { message: "not found" } }));
    const res = await GET(new Request("http://localhost/api/tiers/t-999"), makeParams("t-999"));
    expect(res.status).toBe(404);
  });

  it("returns tier", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockFrom.mockReturnValue(createChainMock({ data: { id: "t-1", name: "Premium" } }));
    const res = await GET(new Request("http://localhost/api/tiers/t-1"), makeParams("t-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tier.name).toBe("Premium");
  });
});

describe("PATCH /api/tiers/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: { ...admin, role: "member" } });
    const res = await PATCH(
      new Request("http://localhost/api/tiers/t-1", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Gold" }),
      }),
      makeParams("t-1"),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when no valid fields", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const res = await PATCH(
      new Request("http://localhost/api/tiers/t-1", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unknown_field: "x" }),
      }),
      makeParams("t-1"),
    );
    expect(res.status).toBe(400);
  });

  it("updates tier", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockAdminFrom.mockReturnValue(createChainMock({ data: { id: "t-1", name: "Gold" } }));
    const res = await PATCH(
      new Request("http://localhost/api/tiers/t-1", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Gold" }),
      }),
      makeParams("t-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tier.name).toBe("Gold");
  });
});

describe("DELETE /api/tiers/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 409 when members assigned to tier", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockAdminFrom.mockReturnValue(createChainMock({ data: null, count: 3 }));
    const res = await DELETE(new Request("http://localhost/api/tiers/t-1", { method: "DELETE" }), makeParams("t-1"));
    expect(res.status).toBe(409);
  });

  it("deletes tier when no members assigned", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockAdminFrom.mockReturnValue(createChainMock({ data: null, count: 0 }));
    const res = await DELETE(new Request("http://localhost/api/tiers/t-1", { method: "DELETE" }), makeParams("t-1"));
    expect(res.status).toBe(200);
  });
});
