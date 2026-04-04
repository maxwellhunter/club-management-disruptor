/**
 * Tests for POST /api/billing/setup — Create Stripe checkout session.
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

const mockCreateStripeCustomer = jest.fn();
const mockCreateSubscriptionCheckout = jest.fn();
jest.mock("@/lib/stripe", () => ({
  createStripeCustomer: (...args: unknown[]) => mockCreateStripeCustomer(...args),
  createSubscriptionCheckout: (...args: unknown[]) => mockCreateSubscriptionCheckout(...args),
}));

const mockAdminFrom = jest.fn();
jest.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: jest.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  })),
}));

import { POST } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createRequest(): Request {
  return new Request("http://localhost:3000/api/billing/setup", {
    method: "POST",
    headers: { origin: "http://localhost:3000" },
  });
}

function createChainMock(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: result.data ?? null, error: result.error ?? null };
  const chain: Record<string, jest.Mock> = {};
  for (const m of [
    "select", "eq", "neq", "in", "gte", "or", "order", "limit",
    "insert", "update", "delete",
  ]) {
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

// ─── Tests ───────────────────────────────────────────────────────────

describe("POST /api/billing/setup", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, STRIPE_SECRET_KEY: "sk_test_123" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns 503 when Stripe is not configured", async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const res = await POST(createRequest());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Stripe is not configured" });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(createRequest());
    expect(res.status).toBe(401);
  });

  it("returns 404 when member not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue(null);

    const res = await POST(createRequest());
    expect(res.status).toBe(404);
  });

  it("returns 400 when tier has no stripe_price_id", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });

    const tierChain = createChainMock({ data: { stripe_price_id: null, name: "Premium" } });
    mockFrom.mockReturnValue(tierChain);

    const res = await POST(createRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No billing plan");
  });

  it("creates checkout session with existing Stripe customer", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });

    // Tier lookup
    const tierChain = createChainMock({
      data: { stripe_price_id: "price_123", name: "Premium" },
    });
    mockFrom.mockReturnValue(tierChain);

    // Existing customer
    const memberDataChain = createChainMock({
      data: { stripe_customer_id: "cus_existing" },
    });
    mockAdminFrom.mockReturnValue(memberDataChain);

    mockCreateSubscriptionCheckout.mockResolvedValue({
      url: "https://checkout.stripe.com/session_123",
    });

    const res = await POST(createRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checkoutUrl).toBe("https://checkout.stripe.com/session_123");
    expect(mockCreateStripeCustomer).not.toHaveBeenCalled();
  });

  it("creates new Stripe customer when none exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });

    const tierChain = createChainMock({
      data: { stripe_price_id: "price_123", name: "Premium" },
    });
    mockFrom.mockReturnValue(tierChain);

    // No existing customer
    const noCustomerChain = createChainMock({
      data: { stripe_customer_id: null },
    });
    // Save customer ID
    const saveChain = createChainMock({ data: null });

    mockAdminFrom
      .mockReturnValueOnce(noCustomerChain)
      .mockReturnValueOnce(saveChain);

    mockCreateStripeCustomer.mockResolvedValue({ id: "cus_new" });
    mockCreateSubscriptionCheckout.mockResolvedValue({
      url: "https://checkout.stripe.com/session_456",
    });

    const res = await POST(createRequest());
    expect(res.status).toBe(200);
    expect(mockCreateStripeCustomer).toHaveBeenCalled();
  });
});
