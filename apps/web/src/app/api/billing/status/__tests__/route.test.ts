/**
 * Tests for GET /api/billing/status
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

jest.mock("@/lib/stripe", () => ({
  getSubscription: jest.fn(),
}));

import { GET } from "../route";

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

const member: MemberWithTier = {
  id: "m-1", club_id: "c-1", user_id: "u-1", first_name: "John", last_name: "Doe",
  email: "john@test.com", role: "member", status: "active",
  membership_tier_id: "t-1", tier_level: "premium", tier_name: "Premium",
};

describe("GET /api/billing/status", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new Request("http://localhost/api/billing/status"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when member not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/billing/status"));
    expect(res.status).toBe(404);
  });

  it("returns billing status without stripe", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    mockAdminFrom.mockReturnValue(createChainMock({ data: { stripe_customer_id: null, stripe_subscription_id: null, subscription_status: null } }));
    mockFrom.mockReturnValue(createChainMock({ data: [] }));
    const res = await GET(new Request("http://localhost/api/billing/status"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasStripeCustomer).toBe(false);
    expect(body.tierName).toBe("Premium");
  });
});
