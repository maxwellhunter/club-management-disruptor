/**
 * Tests for POST /api/wallet/nfc
 */
import type { MemberWithTier } from "@/lib/golf-eligibility";

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

const mockAdminFrom = jest.fn();
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ from: (...args: unknown[]) => mockAdminFrom(...args) })),
}));

const mockResolveBarcodeToMember = jest.fn();
jest.mock("@/lib/wallet/pass-generator", () => ({
  resolveBarcodeToMember: (...args: unknown[]) => mockResolveBarcodeToMember(...args),
}));

import { POST } from "../route";

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

describe("POST /api/wallet/nfc", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(new Request("http://localhost/api/wallet/nfc", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tap_type: "check_in" }),
    }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-member", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-x" } } });
    mockGetMemberWithTier.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost/api/wallet/nfc", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tap_type: "check_in" }),
    }));
    expect(res.status).toBe(403);
  });

  it("records self-tap successfully", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    // Member lookup, dedup check (no recent), tap insert
    const memberChain = createChainMock({ data: { id: "m-1", first_name: "John", last_name: "Doe", status: "active", member_number: "M001" } });
    const dedupChain = createChainMock({ data: null });
    const insertChain = createChainMock({ data: { id: "tap-1", created_at: new Date().toISOString() } });
    mockAdminFrom.mockReturnValueOnce(memberChain).mockReturnValueOnce(dedupChain).mockReturnValueOnce(insertChain);
    const res = await POST(new Request("http://localhost/api/wallet/nfc", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tap_type: "check_in" }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.member_name).toBe("John Doe");
  });

  it("returns 429 on duplicate tap", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const memberChain = createChainMock({ data: { id: "m-1", first_name: "John", last_name: "Doe", status: "active", member_number: "M001" } });
    const dedupChain = createChainMock({ data: { id: "tap-recent" } });
    mockAdminFrom.mockReturnValueOnce(memberChain).mockReturnValueOnce(dedupChain);
    const res = await POST(new Request("http://localhost/api/wallet/nfc", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tap_type: "check_in" }),
    }));
    expect(res.status).toBe(429);
  });

  it("returns 404 for invalid barcode", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: { ...member, role: "admin" } });
    mockResolveBarcodeToMember.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost/api/wallet/nfc", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode_payload: "INVALID-CODE", tap_type: "check_in" }),
    }));
    expect(res.status).toBe(404);
  });
});
