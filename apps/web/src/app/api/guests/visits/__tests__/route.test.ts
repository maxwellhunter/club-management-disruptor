/**
 * Tests for POST /api/guests/visits -- Guest visit registration
 * with policy enforcement (blackout days, monthly limits, same-guest
 * frequency, blocked guests, fee calculation, weekend surcharges).
 *
 * Also tests PATCH -- status updates with auto-invoicing on check-in.
 */

import type { MemberWithTier } from "@/lib/golf-eligibility";

// ---- Module Mocks ----

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
  createClient: jest.fn(() => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  })),
}));

import { POST, PATCH } from "../route";

// ---- Helpers ----

// Valid UUIDs to pass Zod validation
const GUEST_ID = "00000000-0000-0000-0000-000000000001";
const GUEST_BLOCKED_ID = "00000000-0000-0000-0000-000000000002";
const MEMBER_ID = "00000000-0000-0000-0000-000000000010";
const CLUB_ID = "00000000-0000-0000-0000-000000000100";
const USER_ID = "00000000-0000-0000-0000-000000001000";
const TIER_ID = "00000000-0000-0000-0000-000000010000";

function createRequest(body: Record<string, unknown>, method = "POST", query = ""): Request {
  return new Request(`http://localhost:3000/api/guests/visits${query}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createChainMock(result: {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}) {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
    count: result.count ?? null,
  };
  const chain: Record<string, jest.Mock> = {};
  for (const m of [
    "select", "eq", "neq", "in", "gte", "lte", "not", "insert", "update",
    "upsert", "like", "order", "limit", "is",
  ]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain["single"] = jest.fn().mockResolvedValue(resolved);
  chain["maybeSingle"] = jest.fn().mockResolvedValue(resolved);
  (chain as any).then = ((onFulfilled: (v: typeof resolved) => unknown) =>
    Promise.resolve(resolved).then(onFulfilled)) as never;
  return chain;
}

const baseMember: MemberWithTier = {
  id: MEMBER_ID,
  club_id: CLUB_ID,
  user_id: USER_ID,
  first_name: "Alice",
  last_name: "Smith",
  email: "alice@example.com",
  role: "member",
  status: "active",
  membership_tier_id: TIER_ID,
  tier_level: "premium",
  tier_name: "Premium",
};

function setAuthenticatedMember(member: MemberWithTier = baseMember) {
  mockGetUser.mockResolvedValue({ data: { user: { id: member.user_id } } });
  mockGetMemberWithTier.mockResolvedValue({ member, isGolfEligible: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  setAuthenticatedMember();
});

// ---- POST: Authentication & Validation ----

describe("POST /api/guests/visits", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = createRequest({ guest_id: GUEST_ID, visit_date: "2025-06-17" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 404 when member not found", async () => {
    mockGetMemberWithTier.mockResolvedValue(null);
    const req = createRequest({ guest_id: GUEST_ID, visit_date: "2025-06-17" });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid body", async () => {
    const req = createRequest({}); // Missing required fields
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // ---- Blocked guest enforcement ----

  it("returns 403 when guest is blocked", async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "guests") {
        return createChainMock({ data: { is_blocked: true, block_reason: "Incident" } });
      }
      return createChainMock({ data: null });
    });

    const req = createRequest({ guest_id: GUEST_BLOCKED_ID, visit_date: "2025-06-17" });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("blocked");
  });

  // ---- Blackout days ----

  it("returns 400 on blackout day", async () => {
    // June 15, 2025 is a Sunday (day 0)
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "guests") {
        return createChainMock({ data: { is_blocked: false } });
      }
      if (table === "guest_policies") {
        return createChainMock({
          data: [{ facility_type: null, blackout_days: [6], guest_fee: 50, max_guest_visits_per_month: null, max_same_guest_per_month: null }],
        });
      }
      return createChainMock({ data: null });
    });

    const req = createRequest({ guest_id: GUEST_ID, visit_date: "2025-06-15" }); // Saturday (day 6)
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("not allowed on this day");
  });

  // ---- Monthly guest limit ----

  it("returns 400 when monthly guest limit reached", async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "guests") return createChainMock({ data: { is_blocked: false } });
      if (table === "guest_policies") {
        return createChainMock({
          data: [{ facility_type: null, blackout_days: [], guest_fee: 0, max_guest_visits_per_month: 2, max_same_guest_per_month: null }],
        });
      }
      if (table === "guest_visits") {
        return createChainMock({ count: 2 }); // Already at limit
      }
      return createChainMock({ data: null });
    });

    const req = createRequest({ guest_id: GUEST_ID, visit_date: "2025-06-17" }); // Monday
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Monthly guest visit limit");
  });

  // ---- Same-guest frequency limit ----

  it("returns 400 when same-guest frequency limit reached", async () => {
    let visitQueryCount = 0;
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "guests") return createChainMock({ data: { is_blocked: false } });
      if (table === "guest_policies") {
        return createChainMock({
          data: [{ facility_type: null, blackout_days: [], guest_fee: 0, max_guest_visits_per_month: 10, max_same_guest_per_month: 1 }],
        });
      }
      if (table === "guest_visits") {
        visitQueryCount++;
        if (visitQueryCount === 1) return createChainMock({ count: 0 });
        return createChainMock({ count: 1 });
      }
      return createChainMock({ data: null });
    });

    const req = createRequest({ guest_id: GUEST_ID, visit_date: "2025-06-17" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("maximum visits per month");
  });

  // ---- Fee calculation ----

  it("applies fee from schedule, overriding policy fee", async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "guests") return createChainMock({ data: { is_blocked: false, total_visits: 0 } });
      if (table === "guest_policies") {
        return createChainMock({
          data: [{ facility_type: null, blackout_days: [], guest_fee: 25, max_guest_visits_per_month: null, max_same_guest_per_month: null }],
        });
      }
      if (table === "guest_fee_schedules") {
        // Only one schedule, no tier specificity to test
        return createChainMock({
          data: [
            { facility_type: "golf", tier_id: null, guest_fee: 75, weekend_surcharge: 0 },
          ],
        });
      }
      if (table === "guest_visits") {
        return createChainMock({ data: { id: "visit-1", guest_fee: 75 } });
      }
      return createChainMock({ data: null });
    });

    const req = createRequest({ guest_id: GUEST_ID, visit_date: "2025-06-17", facility_type: "golf" });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.guest_fee).toBe(75);
  });

  it("adds weekend surcharge on Saturday", async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "guests") return createChainMock({ data: { is_blocked: false, total_visits: 0 } });
      if (table === "guest_policies") {
        return createChainMock({ data: [{ facility_type: null, blackout_days: [], guest_fee: 25, max_guest_visits_per_month: null, max_same_guest_per_month: null }] });
      }
      if (table === "guest_fee_schedules") {
        return createChainMock({
          data: [{ facility_type: "golf", tier_id: null, guest_fee: 50, weekend_surcharge: 20 }],
        });
      }
      if (table === "guest_visits") return createChainMock({ data: { id: "visit-1" } });
      return createChainMock({ data: null });
    });

    // June 15, 2025 is a Saturday (getDay()=6) in UTC — triggers weekend surcharge
    const req = createRequest({ guest_id: GUEST_ID, visit_date: "2025-06-15", facility_type: "golf" });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.guest_fee).toBe(70); // 50 + 20 surcharge
  });

  // ---- Successful visit creation ----

  it("creates visit and returns 201 on success", async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "guests") {
        const chain = createChainMock({ data: { is_blocked: false, total_visits: 5 } });
        chain.update = jest.fn(() => chain);
        return chain;
      }
      if (table === "guest_policies") return createChainMock({ data: [] });
      if (table === "guest_fee_schedules") return createChainMock({ data: [] });
      if (table === "guest_visits") {
        return createChainMock({ data: { id: "visit-1", guest_fee: 0, status: "registered" } });
      }
      return createChainMock({ data: null });
    });

    const req = createRequest({ guest_id: GUEST_ID, visit_date: "2025-06-17" });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});

// ---- PATCH: Status Updates & Auto-Invoicing ----

describe("PATCH /api/guests/visits", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = createRequest({ status: "checked_in" }, "PATCH", "?id=visit-1");
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    const req = createRequest({ status: "checked_in" }, "PATCH");
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid status", async () => {
    const req = createRequest({ status: "invalid_status" }, "PATCH", "?id=visit-1");
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("auto-invoices guest fee on check-in", async () => {
    let invoiceInserted = false;

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "guest_visits") {
        const chain = createChainMock({
          data: { guest_fee: 75, host_member_id: MEMBER_ID, fee_invoiced: false, visit_date: "2025-06-17" },
        });
        chain.update = jest.fn(() => chain);
        return chain;
      }
      if (table === "invoices") {
        invoiceInserted = true;
        return createChainMock({ data: { id: "inv-1" } });
      }
      return createChainMock({ data: null });
    });

    const req = createRequest({ status: "checked_in" }, "PATCH", "?id=visit-1");
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(invoiceInserted).toBe(true);
  });

  it("does not invoice when fee is 0", async () => {
    let invoiceInserted = false;

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "guest_visits") {
        return createChainMock({
          data: { guest_fee: 0, host_member_id: MEMBER_ID, fee_invoiced: false, visit_date: "2025-06-17" },
        });
      }
      if (table === "invoices") {
        invoiceInserted = true;
        return createChainMock({ data: { id: "inv-1" } });
      }
      return createChainMock({ data: null });
    });

    const req = createRequest({ status: "checked_in" }, "PATCH", "?id=visit-1");
    const res = await PATCH(req);
    expect(invoiceInserted).toBe(false);
  });

  it("does not double-invoice when already invoiced", async () => {
    let invoiceInserted = false;

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "guest_visits") {
        return createChainMock({
          data: { guest_fee: 75, host_member_id: MEMBER_ID, fee_invoiced: true, visit_date: "2025-06-17" },
        });
      }
      if (table === "invoices") {
        invoiceInserted = true;
        return createChainMock({ data: { id: "inv-1" } });
      }
      return createChainMock({ data: null });
    });

    const req = createRequest({ status: "checked_in" }, "PATCH", "?id=visit-1");
    const res = await PATCH(req);
    expect(invoiceInserted).toBe(false);
  });

  it("accepts all valid status values", async () => {
    for (const status of ["registered", "checked_in", "checked_out", "no_show", "cancelled"]) {
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === "guest_visits") {
          return createChainMock({
            data: { guest_fee: 0, host_member_id: MEMBER_ID, fee_invoiced: false, visit_date: "2025-06-17" },
          });
        }
        return createChainMock({ data: null, error: null });
      });

      const req = createRequest({ status }, "PATCH", "?id=visit-1");
      const res = await PATCH(req);
      expect(res.status).toBe(200);
    }
  });
});
