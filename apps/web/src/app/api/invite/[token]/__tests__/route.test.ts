/**
 * Tests for GET/POST /api/invite/[token]
 */
const mockAdminFrom = jest.fn();
const mockAdminAuth = {
  admin: {
    createUser: jest.fn(),
    listUsers: jest.fn(),
    deleteUser: jest.fn(),
  },
};
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
    auth: mockAdminAuth,
  })),
}));

import { GET, POST } from "../route";

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

const makeParams = (token: string) => ({ params: Promise.resolve({ token }) });

describe("GET /api/invite/[token]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 404 for invalid token", async () => {
    mockAdminFrom.mockReturnValue(createChainMock({ data: null }));
    const res = await GET(new Request("http://localhost/api/invite/bad-token"), makeParams("bad-token"));
    expect(res.status).toBe(404);
  });

  it("returns 410 for expired invite", async () => {
    mockAdminFrom.mockReturnValue(createChainMock({
      data: {
        id: "m-1", first_name: "John", last_name: "Doe", email: "john@test.com",
        status: "invited", invite_token: "tok-1",
        invite_expires_at: "2020-01-01T00:00:00Z",
        membership_tiers: { name: "Premium" },
        clubs: { name: "Greenfield CC", logo_url: null },
      },
    }));
    const res = await GET(new Request("http://localhost/api/invite/tok-1"), makeParams("tok-1"));
    expect(res.status).toBe(410);
  });

  it("returns invite info", async () => {
    const futureDate = new Date(Date.now() + 86400000 * 7).toISOString();
    mockAdminFrom.mockReturnValue(createChainMock({
      data: {
        id: "m-1", first_name: "John", last_name: "Doe", email: "john@test.com",
        status: "invited", invite_token: "tok-1",
        invite_expires_at: futureDate,
        membership_tiers: { name: "Premium" },
        clubs: { name: "Greenfield CC", logo_url: null },
      },
    }));
    const res = await GET(new Request("http://localhost/api/invite/tok-1"), makeParams("tok-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.club_name).toBe("Greenfield CC");
  });
});

describe("POST /api/invite/[token]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 for invalid body", async () => {
    const res = await POST(
      new Request("http://localhost/api/invite/tok-1", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "ab" }),
      }),
      makeParams("tok-1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for invalid token", async () => {
    mockAdminFrom.mockReturnValue(createChainMock({ data: null }));
    const res = await POST(
      new Request("http://localhost/api/invite/bad-token", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "SecureP@ss1!" }),
      }),
      makeParams("bad-token"),
    );
    expect(res.status).toBe(404);
  });

  it("claims invite successfully", async () => {
    const futureDate = new Date(Date.now() + 86400000 * 7).toISOString();
    mockAdminFrom.mockReturnValue(createChainMock({
      data: {
        id: "m-1", email: "john@test.com", first_name: "John", last_name: "Doe",
        club_id: "c-1", status: "invited", invite_expires_at: futureDate,
      },
    }));
    mockAdminAuth.admin.createUser.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });
    const res = await POST(
      new Request("http://localhost/api/invite/tok-1", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "SecureP@ss1!" }),
      }),
      makeParams("tok-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.redirect).toBe("/login");
  });
});
