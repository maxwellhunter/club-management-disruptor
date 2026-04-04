/**
 * Tests for GET/POST /api/announcements
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

jest.mock("@/lib/email", () => ({
  sendAnnouncementEmail: jest.fn().mockResolvedValue({ success: true }),
}));

import { GET, POST } from "../route";

function createChainMock(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const resolved = { data: result.data ?? null, error: result.error ?? null, count: result.count ?? null };
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
const member: MemberWithTier = { ...admin, id: "m-2", user_id: "u-2", role: "member" };

describe("GET /api/announcements", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new Request("http://localhost/api/announcements"));
    expect(res.status).toBe(401);
  });

  it("returns announcements for admin (all + tiers)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });

    const announcementsChain = createChainMock({ data: [{ id: "a-1", title: "Test", target_tier_ids: null }] });
    const tiersChain = createChainMock({ data: [{ id: "t-1", name: "Premium", level: "premium" }] });
    mockFrom.mockReturnValueOnce(announcementsChain).mockReturnValueOnce(tiersChain);

    const res = await GET(new Request("http://localhost/api/announcements"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("admin");
    expect(body.tiers).toHaveLength(1);
  });

  it("filters by tier for members", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: { ...member, membership_tier_id: "t-1" } });

    const chain = createChainMock({
      data: [
        { id: "a-1", title: "All", target_tier_ids: null, published_at: "2026-01-01" },
        { id: "a-2", title: "Premium Only", target_tier_ids: ["t-1"], published_at: "2026-01-02" },
        { id: "a-3", title: "Gold Only", target_tier_ids: ["t-99"], published_at: "2026-01-03" },
      ],
    });
    mockFrom.mockReturnValue(chain);

    const res = await GET(new Request("http://localhost/api/announcements"));
    const body = await res.json();
    expect(body.announcements).toHaveLength(2);
    expect(body.tiers).toHaveLength(0); // members don't get tiers
  });
});

describe("POST /api/announcements", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(new Request("http://localhost/api/announcements", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test", content: "Content" }),
    }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const res = await POST(new Request("http://localhost/api/announcements", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test", content: "Content" }),
    }));
    expect(res.status).toBe(403);
  });

  it("creates announcement (201)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });

    const insertChain = createChainMock({ data: { id: "a-1", title: "Test", content: "Content" } });
    mockAdminFrom.mockReturnValue(insertChain);

    const res = await POST(new Request("http://localhost/api/announcements", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test", content: "Content" }),
    }));
    expect(res.status).toBe(201);
  });

  it("returns 400 for invalid body", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });

    const res = await POST(new Request("http://localhost/api/announcements", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    }));
    expect(res.status).toBe(400);
  });
});
