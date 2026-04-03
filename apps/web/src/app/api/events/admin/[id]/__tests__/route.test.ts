/**
 * Tests for PUT and DELETE /api/events/admin/[id].
 *
 * Validates authentication, admin role enforcement, input validation,
 * club-scoped update/delete (cross-tenant isolation), and success paths.
 */

import type { MemberWithTier } from "@/lib/golf-eligibility";

// ─── Module Mocks ────────────────────────────────────────────────────

const mockGetUser = jest.fn();
const mockFrom = jest.fn();
const mockAdminFrom = jest.fn();

jest.mock("@/lib/supabase/api", () => ({
  createApiClient: jest.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

jest.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: jest.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  })),
}));

const mockGetMemberWithTier = jest.fn();
jest.mock("@/lib/golf-eligibility", () => ({
  getMemberWithTier: (...args: unknown[]) => mockGetMemberWithTier(...args),
}));

// Import handlers after mocks
import { PUT, DELETE } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createPutRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/events/admin/event-1", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createDeleteRequest(): Request {
  return new Request("http://localhost:3000/api/events/admin/event-1", {
    method: "DELETE",
  });
}

const mockParams = Promise.resolve({ id: "event-1" });

function createChainMock(result: {
  data?: unknown;
  error?: unknown;
}) {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
    count: null,
  };

  const chain: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "insert", "update", "delete", "order"]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain["single"] = jest.fn().mockResolvedValue(resolved);

  // Make thenable
  (chain as unknown as PromiseLike<typeof resolved>).then = ((
    onFulfilled: (v: typeof resolved) => unknown,
  ) => Promise.resolve(resolved).then(onFulfilled)) as never;

  return chain;
}

/** Assert that a chain mock's .eq() was called with ("club_id", expectedClubId). */
function expectClubIdFilter(
  chain: Record<string, jest.Mock>,
  expectedClubId: string,
) {
  const eqCalls = chain["eq"].mock.calls;
  const hasClubIdFilter = eqCalls.some(
    ([col, val]: [string, string]) =>
      col === "club_id" && val === expectedClubId,
  );
  expect(hasClubIdFilter).toBe(true);
}

const mockAdmin: MemberWithTier = {
  id: "member-1",
  club_id: "club-1",
  user_id: "user-1",
  first_name: "Admin",
  last_name: "User",
  email: "admin@example.com",
  role: "admin",
  status: "active",
  membership_tier_id: "tier-1",
  tier_level: "premium",
  tier_name: "Premium",
};

const mockNonAdmin: MemberWithTier = {
  ...mockAdmin,
  id: "member-2",
  role: "member",
};

// ─── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
  });
  mockGetMemberWithTier.mockResolvedValue({
    member: mockAdmin,
    isGolfEligible: true,
  });
});

// ─── PUT Tests ──────────────────────────────────────────────────────

describe("PUT /api/events/admin/[id]", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await PUT(createPutRequest({ title: "New Title" }), {
      params: mockParams,
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when member is not found", async () => {
    mockGetMemberWithTier.mockResolvedValue(null);

    const res = await PUT(createPutRequest({ title: "New Title" }), {
      params: mockParams,
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not admin", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockNonAdmin,
      isGolfEligible: true,
    });

    const res = await PUT(createPutRequest({ title: "New Title" }), {
      params: mockParams,
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid input (empty title)", async () => {
    const res = await PUT(createPutRequest({ title: "" }), {
      params: mockParams,
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when event not found (cross-tenant isolation)", async () => {
    const updateChain = createChainMock({
      data: null,
      error: { message: "Not found" },
    });
    mockAdminFrom.mockReturnValue(updateChain);

    const res = await PUT(createPutRequest({ title: "New Title" }), {
      params: mockParams,
    });
    expect(res.status).toBe(404);
    expectClubIdFilter(updateChain, "club-1");
  });

  it("returns 200 on successful update with club_id filter", async () => {
    const updatedEvent = {
      id: "event-1",
      club_id: "club-1",
      title: "Updated Gala",
      status: "published",
    };
    const updateChain = createChainMock({ data: updatedEvent });
    mockAdminFrom.mockReturnValue(updateChain);

    const res = await PUT(
      createPutRequest({ title: "Updated Gala", status: "published" }),
      { params: mockParams }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.event.title).toBe("Updated Gala");
    expect(mockAdminFrom).toHaveBeenCalledWith("events");
    expectClubIdFilter(updateChain, "club-1");
  });
});

// ─── DELETE Tests ───────────────────────────────────────────────────

describe("DELETE /api/events/admin/[id]", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await DELETE(createDeleteRequest(), { params: mockParams });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockNonAdmin,
      isGolfEligible: true,
    });

    const res = await DELETE(createDeleteRequest(), { params: mockParams });
    expect(res.status).toBe(403);
  });

  it("returns 200 on successful deletion with club_id filter", async () => {
    const deleteChain = createChainMock({ data: null });
    mockAdminFrom.mockReturnValue(deleteChain);

    const res = await DELETE(createDeleteRequest(), { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockAdminFrom).toHaveBeenCalledWith("events");
    expectClubIdFilter(deleteChain, "club-1");
  });

  it("returns 500 when database delete fails", async () => {
    const deleteChain = createChainMock({
      data: null,
      error: { message: "DB error" },
    });
    mockAdminFrom.mockReturnValue(deleteChain);

    const res = await DELETE(createDeleteRequest(), { params: mockParams });
    expect(res.status).toBe(500);
  });
});
