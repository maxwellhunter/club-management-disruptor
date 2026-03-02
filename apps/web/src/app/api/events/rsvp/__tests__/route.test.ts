/**
 * Tests for the RSVP API route (POST /api/events/rsvp).
 *
 * We mock Supabase and getMemberWithTier so we can test the
 * business logic in isolation: validation, capacity checks,
 * date checks, status checks, and the upsert path.
 */

import type { MemberWithTier } from "@/lib/golf-eligibility";

// ─── Module Mocks ────────────────────────────────────────────────────

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

// Import the handler after mocks are set up
import { POST } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/events/rsvp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createChainMock(result: {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}) {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
    count: result.count ?? null,
  };

  const chain: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "neq", "single", "upsert"]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain["single"] = jest.fn().mockResolvedValue(resolved);

  // Make thenable
  (chain as unknown as PromiseLike<typeof resolved>).then = ((
    onFulfilled: (v: typeof resolved) => unknown,
  ) => Promise.resolve(resolved).then(onFulfilled)) as never;

  return chain;
}

const mockMember: MemberWithTier = {
  id: "member-1",
  club_id: "club-1",
  user_id: "user-1",
  first_name: "John",
  last_name: "Doe",
  email: "john@example.com",
  role: "member",
  status: "active",
  membership_tier_id: "tier-1",
  tier_level: "premium",
  tier_name: "Premium",
};

const futureDate = new Date(Date.now() + 86400000).toISOString();
const pastDate = new Date(Date.now() - 86400000).toISOString();

const validBody = {
  event_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  status: "attending",
  guest_count: 0,
};

// ─── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Default: authenticated user
  mockGetUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
  });

  // Default: member found
  mockGetMemberWithTier.mockResolvedValue({
    member: mockMember,
    isGolfEligible: true,
  });
});

// ─── Tests ───────────────────────────────────────────────────────────

describe("POST /api/events/rsvp", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(createRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid input (bad status value)", async () => {
    const res = await POST(
      createRequest({
        ...validBody,
        status: "interested",
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid input");
  });

  it("returns 400 for missing event_id", async () => {
    const res = await POST(
      createRequest({
        status: "attending",
        guest_count: 0,
      }),
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 when member is not found", async () => {
    mockGetMemberWithTier.mockResolvedValue(null);

    const res = await POST(createRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Member not found");
  });

  it("returns 404 when event does not exist", async () => {
    mockFrom.mockReturnValue(
      createChainMock({ data: null, error: { message: "Not found" } }),
    );

    const res = await POST(createRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Event not found");
  });

  it("returns 400 when event is not published", async () => {
    mockFrom.mockReturnValue(
      createChainMock({
        data: {
          id: validBody.event_id,
          status: "draft",
          start_date: futureDate,
          capacity: null,
          club_id: "club-1",
        },
      }),
    );

    const res = await POST(createRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("This event is not accepting RSVPs");
  });

  it("returns 400 when event has already started", async () => {
    mockFrom.mockReturnValue(
      createChainMock({
        data: {
          id: validBody.event_id,
          status: "published",
          start_date: pastDate,
          capacity: null,
          club_id: "club-1",
        },
      }),
    );

    const res = await POST(createRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("This event has already started");
  });

  it("returns 409 when event is at capacity", async () => {
    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      if (callNum === 1) {
        // events query
        return createChainMock({
          data: {
            id: validBody.event_id,
            status: "published",
            start_date: futureDate,
            capacity: 10,
            club_id: "club-1",
          },
        });
      }
      // event_rsvps count query — 10 attending, capacity is 10
      return createChainMock({ count: 10 });
    });

    const res = await POST(
      createRequest({ ...validBody, guest_count: 0 }),
    );
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe("This event is at capacity");
  });

  it("successfully creates RSVP when all checks pass", async () => {
    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      if (callNum === 1) {
        // events query
        return createChainMock({
          data: {
            id: validBody.event_id,
            status: "published",
            start_date: futureDate,
            capacity: null,
            club_id: "club-1",
          },
        });
      }
      // event_rsvps upsert
      return createChainMock({
        data: { id: "rsvp-1", status: "attending" },
        error: null,
      });
    });

    const res = await POST(createRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.rsvp).toBeDefined();
  });

  it("returns 500 when RSVP upsert fails", async () => {
    let callNum = 0;
    mockFrom.mockImplementation(() => {
      callNum++;
      if (callNum === 1) {
        return createChainMock({
          data: {
            id: validBody.event_id,
            status: "published",
            start_date: futureDate,
            capacity: null,
            club_id: "club-1",
          },
        });
      }
      return createChainMock({
        data: null,
        error: { message: "Constraint violation" },
      });
    });

    const res = await POST(createRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Failed to update RSVP");
  });
});
