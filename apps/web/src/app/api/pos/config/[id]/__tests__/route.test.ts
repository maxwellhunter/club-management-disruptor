/**
 * Tests for PATCH/DELETE /api/pos/config/[id]
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

import { PATCH, DELETE } from "../route";

function createChainMock(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const resolved = { data: result.data ?? null, error: result.error ?? null, count: result.count ?? null };
  const chain: Record<string, jest.Mock> = {};
  for (const m of ["select","eq","neq","in","gte","lte","not","or","order","limit","insert","update","delete","head"]) {
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

describe("PATCH /api/pos/config/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await PATCH(
      new Request("http://localhost/api/pos/config/cfg-1", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated POS" }),
      }),
      makeParams("cfg-1"),
    );
    expect(res.status).toBe(401);
  });

  it("updates config", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockFrom.mockReturnValue(createChainMock({ data: { id: "cfg-1", name: "Updated POS" } }));
    const res = await PATCH(
      new Request("http://localhost/api/pos/config/cfg-1", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated POS" }),
      }),
      makeParams("cfg-1"),
    );
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/pos/config/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 409 when transactions exist", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockFrom.mockReturnValue(createChainMock({ data: null, count: 5 }));
    const res = await DELETE(new Request("http://localhost/api/pos/config/cfg-1", { method: "DELETE" }), makeParams("cfg-1"));
    expect(res.status).toBe(409);
  });

  it("deletes config when no transactions", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const countChain = createChainMock({ data: null, count: 0 });
    const deleteChain = createChainMock({ data: null });
    mockFrom.mockReturnValueOnce(countChain).mockReturnValueOnce(deleteChain);
    const res = await DELETE(new Request("http://localhost/api/pos/config/cfg-1", { method: "DELETE" }), makeParams("cfg-1"));
    expect(res.status).toBe(200);
  });
});
