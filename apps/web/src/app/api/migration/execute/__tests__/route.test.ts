/**
 * Tests for POST /api/migration/execute
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

jest.mock("@/lib/migration/csv-parser", () => ({ parseCSV: jest.fn() }));
jest.mock("@/lib/migration/validator", () => ({ validateRows: jest.fn() }));
jest.mock("@/lib/migration/importer", () => ({ executeImport: jest.fn() }));

import { POST } from "../route";

const admin: MemberWithTier = {
  id: "m-1", club_id: "c-1", user_id: "u-1", first_name: "Admin", last_name: "User",
  email: "admin@test.com", role: "admin", status: "active",
  membership_tier_id: "t-1", tier_level: "premium", tier_name: "Premium",
};

describe("POST /api/migration/execute", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(new Request("http://localhost/api/migration/execute", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-2" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: { ...admin, role: "member" } });
    const res = await POST(new Request("http://localhost/api/migration/execute", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } } });
    mockGetMemberWithTier.mockResolvedValue({ member: admin });
    const res = await POST(new Request("http://localhost/api/migration/execute", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bad_field: true }),
    }));
    expect(res.status).toBe(400);
  });
});
