/**
 * Tests for GET /api/billing/stripe-status — Check Stripe connection.
 */

import type { MemberWithTier } from "@/lib/golf-eligibility";

// ─── Module Mocks ────────────────────────────────────────────────────

const mockGetUser = jest.fn();

jest.mock("@/lib/supabase/api", () => ({
  createApiClient: jest.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
  }),
}));

const mockGetMemberWithTier = jest.fn();
jest.mock("@/lib/golf-eligibility", () => ({
  getMemberWithTier: (...args: unknown[]) => mockGetMemberWithTier(...args),
}));

import { GET } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createRequest(): Request {
  return new Request("http://localhost:3000/api/billing/stripe-status");
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

// ─── Tests ───────────────────────────────────────────────────────────

describe("GET /api/billing/stripe-status", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(createRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({
      member: { ...adminMember, role: "member" },
    });

    const res = await GET(createRequest());
    expect(res.status).toBe(403);
  });

  it("returns connected: true when both keys are set", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_123";
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const res = await GET(createRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(body.details.secretKey).toBe(true);
    expect(body.details.publishableKey).toBe(true);
  });

  it("returns connected: false when keys are missing", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const res = await GET(createRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(false);
  });

  it("returns connected: false when only secret key is set", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const res = await GET(createRequest());
    const body = await res.json();
    expect(body.connected).toBe(false);
    expect(body.details.secretKey).toBe(true);
    expect(body.details.publishableKey).toBe(false);
  });
});
