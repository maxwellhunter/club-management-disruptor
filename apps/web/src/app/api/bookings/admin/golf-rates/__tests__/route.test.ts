/**
 * Tests for GET/POST/PATCH/DELETE /api/bookings/admin/golf-rates
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

import { GET, POST, PATCH, DELETE } from "../route";

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

const admin: MemberWithTier = {
  id: "m-1", club_id: "c-1", user_id: "u-1", first_name: "Admin", last_name: "User",
  email: "admin@test.com", role: "admin", status: "active",
  membership_tier_id: "t-1", tier_level: "premium", tier_name: "Premium",
};
const member: MemberWithTier = { ...admin, id: "m-2", user_id: "u-2", role: "member" };

describe("GET /api/bookings/admin/golf-rates", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new Request("http://localhost/api/bookings/admin/golf-rates"));
    expect(res.status).toBe(401);
  });

  it("returns rates for any member (read access)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const chain = createChainMock({ data: [{ id: "r-1", facilities: { name: "Course" } }] });
    mockFrom.mockReturnValue(chain);
    const res = await GET(new Request("http://localhost/api/bookings/admin/golf-rates"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rates).toBeDefined();
  });
});

describe("POST /api/bookings/admin/golf-rates", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const res = await POST(new Request("http://localhost/api/bookings/admin/golf-rates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facility_id: "00000000-0000-0000-0000-000000000001", name: "Weekday 18", holes: "18", day_type: "weekday", time_type: "prime", member_price: 50, guest_price: 75 }),
    }));
    expect(res.status).toBe(403);
  });

  it("creates rate (201)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const chain = createChainMock({ data: { id: "r-1" } });
    mockFrom.mockReturnValue(chain);
    const res = await POST(new Request("http://localhost/api/bookings/admin/golf-rates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facility_id: "00000000-0000-0000-0000-000000000001", name: "Weekday 18", holes: "18", day_type: "weekday", time_type: "prime", member_price: 50, guest_price: 75 }),
    }));
    expect(res.status).toBe(201);
  });
});

describe("DELETE /api/bookings/admin/golf-rates", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when id missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const res = await DELETE(new Request("http://localhost/api/bookings/admin/golf-rates", { method: "DELETE" }));
    expect(res.status).toBe(400);
  });

  it("deletes rate", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const chain = createChainMock({ data: null });
    mockFrom.mockReturnValue(chain);
    const res = await DELETE(new Request("http://localhost/api/bookings/admin/golf-rates?id=r-1", { method: "DELETE" }));
    expect(res.status).toBe(200);
  });
});
