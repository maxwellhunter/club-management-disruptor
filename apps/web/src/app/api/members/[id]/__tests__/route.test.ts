/**
 * Tests for GET/PATCH/DELETE /api/members/[id]
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
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ from: (...args: unknown[]) => mockAdminFrom(...args) })),
}));

import { GET, PATCH, DELETE } from "../route";

function createChainMock(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: result.data ?? null, error: result.error ?? null };
  const chain: Record<string, jest.Mock> = {};
  for (const m of ["select","eq","neq","in","gte","lte","not","or","order","limit","insert","update","delete","is"]) {
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

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/members/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new Request("http://localhost/api/members/m-1"), makeParams("m-1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when caller not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/members/m-1"), makeParams("m-1"));
    expect(res.status).toBe(404);
  });

  it("returns member detail", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockFrom.mockReturnValue(createChainMock({
      data: { id: "m-2", first_name: "Jane", last_name: "Doe", membership_tiers: { id: "t-1", name: "Premium", level: "premium" }, families: null },
    }));
    const res = await GET(new Request("http://localhost/api/members/m-2"), makeParams("m-2"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.member.first_name).toBe("Jane");
  });
});

describe("PATCH /api/members/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 when editing another member as non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const res = await PATCH(
      new Request("http://localhost/api/members/m-other", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: "New" }),
      }),
      makeParams("m-other"),
    );
    expect(res.status).toBe(403);
  });

  it("admin updates member", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockAdminFrom.mockReturnValue(createChainMock({ data: { id: "m-2", first_name: "Updated" } }));
    const res = await PATCH(
      new Request("http://localhost/api/members/m-2", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: "Updated" }),
      }),
      makeParams("m-2"),
    );
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/members/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when admin deletes self", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const res = await DELETE(new Request("http://localhost/api/members/m-1", { method: "DELETE" }), makeParams("m-1"));
    expect(res.status).toBe(400);
  });

  it("deactivates member", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockAdminFrom.mockReturnValue(createChainMock({ data: null }));
    const res = await DELETE(new Request("http://localhost/api/members/m-2", { method: "DELETE" }), makeParams("m-2"));
    expect(res.status).toBe(200);
  });
});
