/**
 * Tests for POST/PATCH /api/billing/assessments — Assessment management.
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

const mockAdminFrom = jest.fn();
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  })),
}));

import { POST, PATCH } from "../route";

// ─── Helpers ─────────────────────────────────────────────────────────

function createPostRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/billing/assessments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createPatchRequest(id: string, body: unknown): Request {
  return new Request(`http://localhost:3000/api/billing/assessments?id=${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

const validAssessmentBody = {
  name: "Capital Assessment 2026",
  type: "capital_improvement",
  amount: 5000,
  target_all_members: true,
  due_date: "2026-06-30",
  allow_installments: true,
  installment_count: 12,
};

// ─── POST Tests ──────────────────────────────────────────────────────

describe("POST /api/billing/assessments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(createPostRequest(validAssessmentBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({
      member: { ...adminMember, role: "member" },
    });

    const res = await POST(createPostRequest(validAssessmentBody));
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const res = await POST(createPostRequest({ name: "Test" }));
    expect(res.status).toBe(400);
  });

  it("creates assessment with installments calculated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const insertChain = createChainMock({
      data: {
        id: "assess-1",
        ...validAssessmentBody,
        installment_amount: 416.67,
        status: "draft",
      },
    });
    mockAdminFrom.mockReturnValue(insertChain);

    const res = await POST(createPostRequest(validAssessmentBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.assessment).toBeDefined();
    expect(body.assessment.status).toBe("draft");
  });

  it("returns 500 when insert fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const insertChain = createChainMock({ error: { message: "DB error" } });
    mockAdminFrom.mockReturnValue(insertChain);

    const res = await POST(createPostRequest(validAssessmentBody));
    expect(res.status).toBe(500);
  });
});

// ─── PATCH Tests ─────────────────────────────────────────────────────

describe("PATCH /api/billing/assessments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await PATCH(createPatchRequest("assess-1", { status: "active" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const req = new Request("http://localhost:3000/api/billing/assessments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid status", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const res = await PATCH(createPatchRequest("assess-1", { status: "invalid" }));
    expect(res.status).toBe(400);
  });

  it("updates assessment status successfully", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: adminMember });

    const updateChain = createChainMock({ data: null });
    mockAdminFrom.mockReturnValue(updateChain);

    const res = await PATCH(createPatchRequest("assess-1", { status: "active" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
