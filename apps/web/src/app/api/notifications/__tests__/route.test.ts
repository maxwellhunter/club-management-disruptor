/**
 * Tests for GET/POST /api/notifications
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

const mockSendToClub = jest.fn();
const mockSendToMember = jest.fn();
jest.mock("@/lib/notifications/push-sender", () => ({
  sendToClub: (...args: unknown[]) => mockSendToClub(...args),
  sendToMember: (...args: unknown[]) => mockSendToMember(...args),
}));

import { GET, POST } from "../route";

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

describe("GET /api/notifications", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new Request("http://localhost/api/notifications"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: { ...admin, role: "member" } });
    const res = await GET(new Request("http://localhost/api/notifications"));
    expect(res.status).toBe(403);
  });

  it("returns notification data for admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const chain = createChainMock({ data: [], count: 0 });
    mockAdminFrom.mockReturnValue(chain);
    const res = await GET(new Request("http://localhost/api/notifications"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.log).toBeDefined();
    expect(body.stats).toBeDefined();
  });
});

describe("POST /api/notifications", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when fields missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const res = await POST(new Request("http://localhost/api/notifications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test" }),
    }));
    expect(res.status).toBe(400);
  });

  it("sends broadcast (201)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockSendToClub.mockResolvedValue({ sent: 5, failed: 0 });
    const res = await POST(new Request("http://localhost/api/notifications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test", message: "Hello all", category: "general" }),
    }));
    expect(res.status).toBe(201);
  });

  it("sends to single member (201)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockSendToMember.mockResolvedValue({ sent: 1 });
    const res = await POST(new Request("http://localhost/api/notifications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test", message: "Hi", category: "general", target: "member", member_id: "m-2" }),
    }));
    expect(res.status).toBe(201);
  });
});
