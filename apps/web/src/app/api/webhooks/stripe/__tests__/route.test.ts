/**
 * Tests for POST /api/webhooks/stripe
 */
const mockConstructEvent = jest.fn();
jest.mock("@/lib/stripe", () => ({
  getStripe: jest.fn(() => ({
    webhooks: { constructEvent: (...args: unknown[]) => mockConstructEvent(...args) },
  })),
}));

const mockAdminFrom = jest.fn();
jest.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: jest.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  })),
}));

import { POST } from "../route";

function createChainMock(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const resolved = { data: result.data ?? null, error: result.error ?? null, count: result.count ?? null };
  const chain: Record<string, jest.Mock> = {};
  for (const m of ["select","eq","neq","in","gte","lte","not","or","order","limit","insert","update","delete","upsert"]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain["single"] = jest.fn().mockResolvedValue(resolved);
  chain["maybeSingle"] = jest.fn().mockResolvedValue(resolved);
  (chain as unknown as PromiseLike<typeof resolved>).then = ((
    onFulfilled: (v: typeof resolved) => unknown,
  ) => Promise.resolve(resolved).then(onFulfilled)) as never;
  return chain;
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when signature missing", async () => {
    const res = await POST(new Request("http://localhost/api/webhooks/stripe", {
      method: "POST", body: "{}",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when signature verification fails", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mockConstructEvent.mockImplementation(() => { throw new Error("Bad sig"); });
    const res = await POST(new Request("http://localhost/api/webhooks/stripe", {
      method: "POST", body: "{}", headers: { "stripe-signature": "bad" },
    }));
    expect(res.status).toBe(400);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("handles verified event", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mockConstructEvent.mockReturnValue({ type: "some.unknown.event", data: { object: {} } });
    const res = await POST(new Request("http://localhost/api/webhooks/stripe", {
      method: "POST", body: "{}", headers: { "stripe-signature": "valid" },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("handles checkout.session.completed", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { mode: "subscription", subscription: "sub-1", metadata: { member_id: "m-1" } } },
    });
    mockAdminFrom.mockReturnValue(createChainMock({ data: { id: "m-1", club_id: "c-1", stripe_customer_id: "cus-1" } }));
    const res = await POST(new Request("http://localhost/api/webhooks/stripe", {
      method: "POST", body: "{}", headers: { "stripe-signature": "valid" },
    }));
    expect(res.status).toBe(200);
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });
});
