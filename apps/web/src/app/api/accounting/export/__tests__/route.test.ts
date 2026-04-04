/**
 * Tests for POST /api/accounting/export
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

const mockGenerateExport = jest.fn();
jest.mock("@/lib/accounting", () => ({
  generateExport: (...args: unknown[]) => mockGenerateExport(...args),
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

const admin: MemberWithTier = {
  id: "m-1", club_id: "c-1", user_id: "u-1", first_name: "Admin", last_name: "User",
  email: "admin@test.com", role: "admin", status: "active",
  membership_tier_id: "t-1", tier_level: "premium", tier_name: "Premium",
};

const validExport = {
  format: "csv",
  provider: "quickbooks",
  date_from: "2024-01-01",
  date_to: "2024-12-31",
};

describe("POST /api/accounting/export", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(new Request("http://localhost/api/accounting/export", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validExport),
    }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: { ...admin, role: "member" } });
    const res = await POST(new Request("http://localhost/api/accounting/export", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validExport),
    }));
    expect(res.status).toBe(403);
  });

  it("creates export successfully", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });

    const batchChain = createChainMock({ data: { id: "batch-1", status: "pending" } });
    const updateChain = createChainMock({ data: null });
    mockFrom.mockReturnValueOnce(batchChain).mockReturnValue(updateChain);

    mockGenerateExport.mockResolvedValue({
      content: "csv-data",
      filename: "export.csv",
      mimeType: "text/csv",
      entryCount: 10,
      totalDebits: 5000,
      totalCredits: 5000,
    });

    const res = await POST(new Request("http://localhost/api/accounting/export", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validExport),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.file.filename).toBe("export.csv");
    expect(body.summary.entryCount).toBe(10);
  });
});
