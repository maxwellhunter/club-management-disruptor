/**
 * Tests for GET/PATCH/DELETE /api/announcements/[id]
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

import { GET, PATCH, DELETE } from "../route";

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
const member: MemberWithTier = { ...admin, id: "m-2", user_id: "u-2", role: "member" };
const params = Promise.resolve({ id: "a-1" });

describe("GET /api/announcements/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new Request("http://localhost/api/announcements/a-1"), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockFrom.mockReturnValue(createChainMock({ data: null, error: { message: "not found" } }));
    const res = await GET(new Request("http://localhost/api/announcements/a-1"), { params });
    expect(res.status).toBe(404);
  });

  it("hides unpublished from members", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    mockFrom.mockReturnValue(createChainMock({ data: { id: "a-1", published_at: null } }));
    const res = await GET(new Request("http://localhost/api/announcements/a-1"), { params });
    expect(res.status).toBe(404);
  });

  it("returns announcement for admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockFrom.mockReturnValue(createChainMock({ data: { id: "a-1", title: "Test", published_at: null } }));
    const res = await GET(new Request("http://localhost/api/announcements/a-1"), { params });
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/announcements/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const res = await PATCH(new Request("http://localhost/api/announcements/a-1", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated" }),
    }), { params });
    expect(res.status).toBe(403);
  });

  it("returns 400 when no updates", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const res = await PATCH(new Request("http://localhost/api/announcements/a-1", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }), { params });
    expect(res.status).toBe(400);
  });

  it("updates announcement", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockAdminFrom.mockReturnValue(createChainMock({ data: { id: "a-1", title: "Updated" } }));
    const res = await PATCH(new Request("http://localhost/api/announcements/a-1", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated" }),
    }), { params });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/announcements/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const res = await DELETE(new Request("http://localhost/api/announcements/a-1"), { params });
    expect(res.status).toBe(403);
  });

  it("deletes successfully", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    mockAdminFrom.mockReturnValue(createChainMock({ data: null }));
    const res = await DELETE(new Request("http://localhost/api/announcements/a-1"), { params });
    expect(res.status).toBe(200);
  });
});
