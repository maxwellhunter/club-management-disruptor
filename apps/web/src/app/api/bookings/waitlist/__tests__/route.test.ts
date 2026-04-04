/**
 * Tests for GET/POST/DELETE /api/bookings/waitlist
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

const member: MemberWithTier = {
  id: "m-1", club_id: "c-1", user_id: "u-1", first_name: "John", last_name: "Doe",
  email: "john@test.com", role: "member", status: "active",
  membership_tier_id: "t-1", tier_level: "premium", tier_name: "Premium",
};

describe("POST /api/bookings/waitlist", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(new Request("http://localhost/api/bookings/waitlist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facility_id: "f-1", date: "2026-05-01", start_time: "08:00", end_time: "08:30" }),
    }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when fields missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    const res = await POST(new Request("http://localhost/api/bookings/waitlist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facility_id: "f-1" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when not golf eligible", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member, isGolfEligible: false });
    const res = await POST(new Request("http://localhost/api/bookings/waitlist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facility_id: "f-1", date: "2026-05-01", start_time: "08:00", end_time: "08:30" }),
    }));
    expect(res.status).toBe(403);
  });
});

describe("GET /api/bookings/waitlist", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new Request("http://localhost/api/bookings/waitlist"));
    expect(res.status).toBe(401);
  });

  it("returns member's waitlist entries", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    mockFrom.mockReturnValue(createChainMock({ data: [] }));
    const res = await GET(new Request("http://localhost/api/bookings/waitlist"));
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/bookings/waitlist", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when id missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const res = await DELETE(new Request("http://localhost/api/bookings/waitlist", { method: "DELETE" }));
    expect(res.status).toBe(400);
  });
});
