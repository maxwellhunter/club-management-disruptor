/**
 * Tests for PATCH /api/bookings/[id]/modify
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

import { PATCH } from "../route";

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

const futureDate = new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0];
const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("PATCH /api/bookings/[id]/modify", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await PATCH(
      new Request("http://localhost/api/bookings/b-1/modify", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ party_size: 3 }),
      }),
      makeParams("b-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid input", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const res = await PATCH(
      new Request("http://localhost/api/bookings/b-1/modify", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ party_size: -1 }),
      }),
      makeParams("b-1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when member not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue(null);
    const res = await PATCH(
      new Request("http://localhost/api/bookings/b-1/modify", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ party_size: 3 }),
      }),
      makeParams("b-1"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when modifying another member's booking", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const bookingChain = createChainMock({
      data: { id: "b-1", member_id: "m-other", facility_id: "f-1", date: futureDate, start_time: "08:00:00", status: "confirmed", club_id: "c-1" },
    });
    mockFrom.mockReturnValue(bookingChain);
    const res = await PATCH(
      new Request("http://localhost/api/bookings/b-1/modify", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ party_size: 3 }),
      }),
      makeParams("b-1"),
    );
    expect(res.status).toBe(403);
  });

  it("modifies booking party_size", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });

    const chain = createChainMock({
      data: { id: "b-1", member_id: "m-1", facility_id: "f-1", date: futureDate, start_time: "08:00:00", end_time: "08:30:00", status: "confirmed", party_size: 2, club_id: "c-1" },
    });
    mockFrom.mockReturnValue(chain);

    const res = await PATCH(
      new Request("http://localhost/api/bookings/b-1/modify", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ party_size: 3 }),
      }),
      makeParams("b-1"),
    );
    expect(res.status).toBe(200);
  });
});
