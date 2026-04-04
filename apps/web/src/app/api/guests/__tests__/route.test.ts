/**
 * Tests for GET/POST /api/guests
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

const mockAdminFrom = jest.fn();
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ from: (...args: unknown[]) => mockAdminFrom(...args) })),
}));

import { POST } from "../route";

function createChainMock(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const resolved = { data: result.data ?? null, error: result.error ?? null, count: result.count ?? null };
  const chain: Record<string, jest.Mock> = {};
  for (const m of ["select","eq","neq","in","gte","not","or","order","limit","insert","update","delete"]) {
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

describe("POST /api/guests", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(new Request("http://localhost/api/guests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first_name: "Guest", last_name: "User" }),
    }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });
    const res = await POST(new Request("http://localhost/api/guests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first_name: "" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns existing guest if email matches", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });

    mockAdminFrom.mockReturnValue(createChainMock({ data: { id: "g-existing" } }));

    const res = await POST(new Request("http://localhost/api/guests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first_name: "Guest", last_name: "User", email: "guest@test.com" }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.existing).toBe(true);
  });

  it("creates new guest (201)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member });

    // Email check (no match)
    const noMatchChain = createChainMock({ data: null });
    // Insert
    const insertChain = createChainMock({ data: { id: "g-1", first_name: "Guest", last_name: "User" } });

    mockAdminFrom.mockReturnValueOnce(noMatchChain).mockReturnValueOnce(insertChain);

    const res = await POST(new Request("http://localhost/api/guests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first_name: "Guest", last_name: "User", email: "new@test.com" }),
    }));
    expect(res.status).toBe(201);
  });
});
