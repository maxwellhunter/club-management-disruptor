/**
 * Tests for GET /api/dashboard
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

import { GET } from "../route";

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
const member: MemberWithTier = { ...admin, id: "m-2", user_id: "u-2", role: "member" };

describe("GET /api/dashboard", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new Request("http://localhost/api/dashboard"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when member not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/dashboard"));
    expect(res.status).toBe(404);
  });

  it("returns admin dashboard", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });

    const chain = createChainMock({ data: [], count: 0 });
    mockFrom.mockReturnValue(chain);

    const res = await GET(new Request("http://localhost/api/dashboard"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("admin");
    expect(body.stats).toBeDefined();
  });

  it("returns member dashboard", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });

    const chain = createChainMock({ data: [], count: 0 });
    mockFrom.mockReturnValue(chain);

    const res = await GET(new Request("http://localhost/api/dashboard"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("member");
    expect(body.tierName).toBe("Premium");
  });
});
