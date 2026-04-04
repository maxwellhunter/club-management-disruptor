/**
 * Tests for POST /api/billing/cycles — Run a billing cycle.
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

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({})),
}));

const mockRunBillingCycle = jest.fn();
jest.mock("@/lib/billing/billing-engine", () => ({
  runBillingCycle: (...args: unknown[]) => mockRunBillingCycle(...args),
}));

import { POST } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/billing/cycles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const adminMember: MemberWithTier = {
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

const validCycleBody = {
  type: "dues",
  period_start: "2026-01-01",
  period_end: "2026-01-31",
};

// ─── Tests ───────────────────────────────────────────────────────────

describe("POST /api/billing/cycles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(createRequest(validCycleBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({
      member: { ...adminMember, role: "member" },
    });

    const res = await POST(createRequest(validCycleBody));
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const res = await POST(createRequest({ type: "invalid" }));
    expect(res.status).toBe(400);
  });

  it("runs billing cycle successfully (201)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    mockRunBillingCycle.mockResolvedValue({
      cycleId: "cycle-1",
      result: { invoicesCreated: 15, totalAmount: 7500, errors: [] },
    });

    const res = await POST(createRequest(validCycleBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.cycle_id).toBe("cycle-1");
    expect(body.invoices_created).toBe(15);
    expect(body.total_amount).toBe(7500);
    expect(body.errors).toEqual([]);
  });

  it("returns 500 when billing engine throws", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    mockRunBillingCycle.mockRejectedValue(new Error("Cycle already exists"));

    const res = await POST(createRequest(validCycleBody));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Cycle already exists");
  });
});
