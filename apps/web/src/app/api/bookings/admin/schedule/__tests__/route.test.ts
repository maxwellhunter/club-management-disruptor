/**
 * Tests for GET/POST/DELETE /api/bookings/admin/schedule
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

import { GET, POST, DELETE } from "../route";

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

describe("GET /api/bookings/admin/schedule", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new Request("http://localhost/api/bookings/admin/schedule?facility_id=00000000-0000-0000-0000-000000000001"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const res = await GET(new Request("http://localhost/api/bookings/admin/schedule?facility_id=00000000-0000-0000-0000-000000000001"));
    expect(res.status).toBe(403);
  });

  it("returns 400 when facility_id missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const res = await GET(new Request("http://localhost/api/bookings/admin/schedule"));
    expect(res.status).toBe(400);
  });

  it("returns schedule slots", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const chain = createChainMock({ data: [{ id: "s-1", day_of_week: 1, start_time: "08:00", end_time: "08:30" }] });
    mockFrom.mockReturnValue(chain);
    const res = await GET(new Request("http://localhost/api/bookings/admin/schedule?facility_id=00000000-0000-0000-0000-000000000001"));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/bookings/admin/schedule", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const res = await POST(new Request("http://localhost/api/bookings/admin/schedule", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facility_id: "00000000-0000-0000-0000-000000000001", days_of_week: [1], start_time: "07:00", end_time: "12:00", interval_minutes: 10, max_bookings: 1 }),
    }));
    expect(res.status).toBe(403);
  });

  it("generates schedule slots (201)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const chain = createChainMock({ data: { id: "00000000-0000-0000-0000-000000000001", name: "Course" } });
    mockFrom.mockReturnValue(chain);
    const res = await POST(new Request("http://localhost/api/bookings/admin/schedule", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facility_id: "00000000-0000-0000-0000-000000000001", days_of_week: [1], start_time: "07:00", end_time: "12:00", interval_minutes: 10, max_bookings: 1 }),
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.count).toBeGreaterThan(0);
  });
});

describe("DELETE /api/bookings/admin/schedule", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when facility_id missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const res = await DELETE(new Request("http://localhost/api/bookings/admin/schedule", { method: "DELETE" }));
    expect(res.status).toBe(400);
  });

  it("clears schedule", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const facilityChain = createChainMock({ data: { id: "00000000-0000-0000-0000-000000000001" } });
    const deleteChain = createChainMock({ data: null });
    mockFrom.mockReturnValueOnce(facilityChain).mockReturnValueOnce(deleteChain);
    const res = await DELETE(new Request("http://localhost/api/bookings/admin/schedule?facility_id=00000000-0000-0000-0000-000000000001", { method: "DELETE" }));
    expect(res.status).toBe(200);
  });
});
