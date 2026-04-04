/**
 * Tests for POST /api/members/[id]/resend-invite
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
const mockAdminRpc = jest.fn();
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
    rpc: (...args: unknown[]) => mockAdminRpc(...args),
  })),
}));

jest.mock("@/lib/email", () => ({
  sendInviteEmail: jest.fn().mockResolvedValue({ success: true }),
}));

import { POST } from "../route";

function createChainMock(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: result.data ?? null, error: result.error ?? null };
  const chain: Record<string, jest.Mock> = {};
  for (const m of ["select","eq","neq","in","gte","or","order","limit","insert","update","delete"]) {
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

const req = new Request("http://localhost/api/members/m-2/resend-invite", { method: "POST" });

describe("POST /api/members/[id]/resend-invite", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req, { params: Promise.resolve({ id: "m-2" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: { ...admin, role: "member" } });
    const res = await POST(req, { params: Promise.resolve({ id: "m-2" }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 when member not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockAdminFrom.mockReturnValue(createChainMock({ data: null }));
    const res = await POST(req, { params: Promise.resolve({ id: "m-2" }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 when member is not in invited status", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockAdminFrom.mockReturnValue(createChainMock({
      data: { id: "m-2", email: "test@test.com", first_name: "John", last_name: "Doe", status: "active" },
    }));
    const res = await POST(req, { params: Promise.resolve({ id: "m-2" }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("invited");
  });

  it("resends invite with fallback path", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });

    // First call: member lookup (invited)
    const memberChain = createChainMock({
      data: { id: "m-2", email: "test@test.com", first_name: "John", last_name: "Doe", status: "invited" },
    });
    // RPC fails (function doesn't exist) → fallback path
    mockAdminRpc.mockResolvedValue({ data: null, error: { message: "function not found" } });
    // Fallback update
    const updateChain = createChainMock({ data: null });
    // Club name
    const clubChain = createChainMock({ data: { name: "Test Club" } });
    // Tier name
    const tierChain = createChainMock({ data: { membership_tiers: { name: "Premium" } } });

    mockAdminFrom
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(tierChain);
    mockFrom.mockReturnValue(clubChain);

    const res = await POST(req, { params: Promise.resolve({ id: "m-2" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invite_url).toBeDefined();
    expect(body.email_sent).toBe(true);
  });
});
