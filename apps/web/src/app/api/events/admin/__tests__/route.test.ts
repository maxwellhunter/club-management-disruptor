/**
 * Tests for POST /api/events/admin (create event).
 *
 * Validates authentication, admin role enforcement, input validation,
 * club-scoped insertion, and default status assignment.
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

// Import handler after mocks
import { POST } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/events/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

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

const validBody = {
  title: "Spring Gala",
  description: "Annual spring celebration",
  location: "Main Ballroom",
  start_date: "2026-04-15T18:00:00.000Z",
  end_date: "2026-04-15T22:00:00.000Z",
  capacity: 200,
  price: 75,
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

// ─── Tests ───────────────────────────────────────────────────────────

describe("POST /api/events/admin", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(createRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 404 when member is not found", async () => {
    mockGetMemberWithTier.mockResolvedValue(null);

    const res = await POST(createRequest(validBody));
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not admin", async () => {
    mockGetMemberWithTier.mockResolvedValue({
      member: mockNonAdmin,
      isGolfEligible: true,
    });

    const res = await POST(createRequest(validBody));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Admin access required");
  });

  it("returns 400 for invalid input (empty title)", async () => {
    const res = await POST(createRequest({ ...validBody, title: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid input (bad datetime)", async () => {
    const res = await POST(
      createRequest({ ...validBody, start_date: "not-a-date" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 on successful event creation", async () => {
    const createdEvent = {
      id: "event-1",
      club_id: "club-1",
      ...validBody,
      status: "draft",
      created_by: "member-1",
    };

    const insertChain = createChainMock({ data: createdEvent });
    mockAdminFrom.mockReturnValue(insertChain);

    const res = await POST(createRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.event.id).toBe("event-1");
    expect(data.event.status).toBe("draft");

    // Verify insert was called with correct data via service role client
    expect(mockAdminFrom).toHaveBeenCalledWith("events");
    expect(insertChain["insert"]).toHaveBeenCalledWith(
      expect.objectContaining({
        club_id: "club-1",
        created_by: "member-1",
        status: "draft",
        title: "Spring Gala",
      })
    );
  });

  it("returns 500 when database insert fails", async () => {
    const insertChain = createChainMock({
      data: null,
      error: { message: "DB error" },
    });
    mockAdminFrom.mockReturnValue(insertChain);

    const res = await POST(createRequest(validBody));
    expect(res.status).toBe(500);
  });
});
