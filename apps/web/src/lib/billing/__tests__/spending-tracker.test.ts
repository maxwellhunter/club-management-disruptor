/**
 * Tests for the Spending Tracker — period boundary calculations,
 * member spending aggregation, and bulk tracking with shortfall detection.
 */

import { getPeriodBounds, getMemberSpending, calculateAllSpendingTracking } from "../spending-tracker";

// ─── Supabase chain mock helper ─────────────────────────────────────

function createChainMock(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
    count: result.count ?? null,
  };
  const chain: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "neq", "in", "gte", "lte", "not", "insert", "update", "upsert", "like", "order", "limit", "is"]) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain["single"] = jest.fn().mockResolvedValue(resolved);
  chain["maybeSingle"] = jest.fn().mockResolvedValue(resolved);
  // Thenable for direct await
  (chain as any).then = ((onFulfilled: (v: typeof resolved) => unknown) =>
    Promise.resolve(resolved).then(onFulfilled)) as never;
  return chain;
}

// ─── getPeriodBounds ────────────────────────────────────────────────

describe("getPeriodBounds", () => {
  it("returns correct monthly bounds for mid-month date", () => {
    const date = new Date(2025, 5, 15); // June 15, 2025
    const { start, end } = getPeriodBounds("monthly", date);
    expect(start).toBe("2025-06-01");
    expect(end).toBe("2025-06-30");
  });

  it("returns correct monthly bounds for January", () => {
    const date = new Date(2025, 0, 1); // Jan 1, 2025
    const { start, end } = getPeriodBounds("monthly", date);
    expect(start).toBe("2025-01-01");
    expect(end).toBe("2025-01-31");
  });

  it("handles February in leap year", () => {
    const date = new Date(2024, 1, 10); // Feb 10, 2024 (leap year)
    const { start, end } = getPeriodBounds("monthly", date);
    expect(start).toBe("2024-02-01");
    expect(end).toBe("2024-02-29");
  });

  it("handles February in non-leap year", () => {
    const date = new Date(2025, 1, 10); // Feb 10, 2025
    const { start, end } = getPeriodBounds("monthly", date);
    expect(start).toBe("2025-02-01");
    expect(end).toBe("2025-02-28");
  });

  it("returns correct quarterly bounds for Q1", () => {
    const date = new Date(2025, 1, 15); // Feb 15 (Q1)
    const { start, end } = getPeriodBounds("quarterly", date);
    expect(start).toBe("2025-01-01");
    expect(end).toBe("2025-03-31");
  });

  it("returns correct quarterly bounds for Q2", () => {
    const date = new Date(2025, 4, 1); // May 1 (Q2)
    const { start, end } = getPeriodBounds("quarterly", date);
    expect(start).toBe("2025-04-01");
    expect(end).toBe("2025-06-30");
  });

  it("returns correct quarterly bounds for Q3", () => {
    const date = new Date(2025, 8, 30); // Sep 30 (Q3)
    const { start, end } = getPeriodBounds("quarterly", date);
    expect(start).toBe("2025-07-01");
    expect(end).toBe("2025-09-30");
  });

  it("returns correct quarterly bounds for Q4", () => {
    const date = new Date(2025, 11, 25); // Dec 25 (Q4)
    const { start, end } = getPeriodBounds("quarterly", date);
    expect(start).toBe("2025-10-01");
    expect(end).toBe("2025-12-31");
  });

  it("returns correct annual bounds", () => {
    const date = new Date(2025, 6, 4);
    const { start, end } = getPeriodBounds("annually", date);
    expect(start).toBe("2025-01-01");
    expect(end).toBe("2025-12-31");
  });

  it("defaults to current date when no asOf provided", () => {
    const { start, end } = getPeriodBounds("annually");
    const year = new Date().getFullYear();
    expect(start).toBe(`${year}-01-01`);
    expect(end).toBe(`${year}-12-31`);
  });
});

// ─── getMemberSpending ──────────────────────────────────────────────

describe("getMemberSpending", () => {
  const clubId = "club-1";
  const memberId = "member-1";

  it("sums POS transactions for pro_shop category", async () => {
    const posChain = createChainMock({
      data: [{ total: "50.00" }, { total: "30.00" }],
    });

    const mockClient = {
      from: jest.fn().mockReturnValue(posChain),
    } as any;

    const result = await getMemberSpending(mockClient, clubId, memberId, "pro_shop", "2025-01-01", "2025-01-31");

    expect(result).toBe(80);
    expect(mockClient.from).toHaveBeenCalledWith("pos_transactions");
    // pro_shop should NOT query dining_orders
    expect(mockClient.from).toHaveBeenCalledTimes(1);
  });

  it("includes both POS and dining_orders for dining category", async () => {
    const posChain = createChainMock({ data: [{ total: "25.50" }] });
    const diningChain = createChainMock({ data: [{ total: "42.00" }] });

    const fromCalls: string[] = [];
    const mockClient = {
      from: jest.fn((table: string) => {
        fromCalls.push(table);
        if (table === "pos_transactions") return posChain;
        if (table === "dining_orders") return diningChain;
        return posChain;
      }),
    } as any;

    const result = await getMemberSpending(mockClient, clubId, memberId, "dining", "2025-01-01", "2025-01-31");

    expect(result).toBe(67.5);
    expect(fromCalls).toContain("pos_transactions");
    expect(fromCalls).toContain("dining_orders");
  });

  it("includes both POS and dining_orders for total category", async () => {
    const posChain = createChainMock({ data: [{ total: "100" }] });
    const diningChain = createChainMock({ data: [{ total: "200" }] });

    const fromCalls: string[] = [];
    const mockClient = {
      from: jest.fn((table: string) => {
        fromCalls.push(table);
        if (table === "pos_transactions") return posChain;
        return diningChain;
      }),
    } as any;

    const result = await getMemberSpending(mockClient, clubId, memberId, "total", "2025-01-01", "2025-01-31");

    expect(result).toBe(300);
    expect(fromCalls).toContain("dining_orders");
  });

  it("returns 0 when no transactions found", async () => {
    const chain = createChainMock({ data: [] });
    const mockClient = { from: jest.fn().mockReturnValue(chain) } as any;

    const result = await getMemberSpending(mockClient, clubId, memberId, "bar", "2025-01-01", "2025-01-31");
    expect(result).toBe(0);
  });

  it("handles null data from query", async () => {
    const chain = createChainMock({ data: null });
    const mockClient = { from: jest.fn().mockReturnValue(chain) } as any;

    const result = await getMemberSpending(mockClient, clubId, memberId, "pro_shop", "2025-01-01", "2025-01-31");
    expect(result).toBe(0);
  });

  it("rounds to 2 decimal places", async () => {
    const chain = createChainMock({
      data: [{ total: "10.333" }, { total: "20.666" }],
    });
    const mockClient = { from: jest.fn().mockReturnValue(chain) } as any;

    const result = await getMemberSpending(mockClient, clubId, memberId, "pro_shop", "2025-01-01", "2025-01-31");
    expect(result).toBe(31);
  });
});

// ─── calculateAllSpendingTracking ───────────────────────────────────

describe("calculateAllSpendingTracking", () => {
  const clubId = "club-1";

  it("returns empty when no active minimums", async () => {
    const chain = createChainMock({ data: [] });
    const mockClient = { from: jest.fn().mockReturnValue(chain) } as any;

    const { tracked, errors } = await calculateAllSpendingTracking(mockClient, clubId);
    expect(tracked).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it("calculates shortfall correctly", async () => {
    const minimums = [
      { id: "min-1", tier_id: "tier-1", category: "dining", period: "monthly", amount: "500", membership_tiers: [{ id: "tier-1", name: "Premium" }] },
    ];
    const members = [
      { id: "member-1", membership_tier_id: "tier-1" },
    ];

    let callIdx = 0;
    const mockClient = {
      from: jest.fn((table: string) => {
        if (table === "spending_minimums") {
          return createChainMock({ data: minimums });
        }
        if (table === "members") {
          return createChainMock({ data: members });
        }
        // POS + dining queries — return $200 total spending
        callIdx++;
        if (callIdx <= 1) return createChainMock({ data: [{ total: "150" }] });
        return createChainMock({ data: [{ total: "50" }] });
      }),
    } as any;

    const { tracked, errors } = await calculateAllSpendingTracking(mockClient, clubId, new Date(2025, 5, 15));

    expect(errors).toHaveLength(0);
    expect(tracked).toHaveLength(1);
    expect(tracked[0].member_id).toBe("member-1");
    expect(tracked[0].amount_required).toBe(500);
    expect(tracked[0].amount_spent).toBe(200);
    expect(tracked[0].shortfall).toBe(300);
  });

  it("returns 0 shortfall when spending exceeds minimum", async () => {
    const minimums = [
      { id: "min-1", tier_id: "tier-1", category: "pro_shop", period: "monthly", amount: "100", membership_tiers: [{ id: "tier-1", name: "Standard" }] },
    ];
    const members = [
      { id: "member-1", membership_tier_id: "tier-1" },
    ];

    const mockClient = {
      from: jest.fn((table: string) => {
        if (table === "spending_minimums") return createChainMock({ data: minimums });
        if (table === "members") return createChainMock({ data: members });
        return createChainMock({ data: [{ total: "250" }] }); // > 100
      }),
    } as any;

    const { tracked } = await calculateAllSpendingTracking(mockClient, clubId, new Date(2025, 5, 15));
    expect(tracked[0].shortfall).toBe(0);
  });

  it("skips members not in the minimum's tier", async () => {
    const minimums = [
      { id: "min-1", tier_id: "tier-1", category: "dining", period: "monthly", amount: "500", membership_tiers: [{ id: "tier-1", name: "Premium" }] },
    ];
    const members = [
      { id: "member-1", membership_tier_id: "tier-2" }, // Different tier
    ];

    const mockClient = {
      from: jest.fn((table: string) => {
        if (table === "spending_minimums") return createChainMock({ data: minimums });
        if (table === "members") return createChainMock({ data: members });
        return createChainMock({ data: [] });
      }),
    } as any;

    const { tracked } = await calculateAllSpendingTracking(mockClient, clubId);
    expect(tracked).toHaveLength(0);
  });

  it("collects errors per-member without stopping", async () => {
    const minimums = [
      { id: "min-1", tier_id: "tier-1", category: "dining", period: "monthly", amount: "500", membership_tiers: [{ id: "tier-1", name: "Premium" }] },
    ];
    const members = [
      { id: "member-1", membership_tier_id: "tier-1" },
      { id: "member-2", membership_tier_id: "tier-1" },
    ];

    let memberCall = 0;
    const mockClient = {
      from: jest.fn((table: string) => {
        if (table === "spending_minimums") return createChainMock({ data: minimums });
        if (table === "members") return createChainMock({ data: members });
        memberCall++;
        // First member's POS query throws
        if (memberCall === 1) {
          const chain = createChainMock({ data: null });
          (chain as any).then = ((onFulfilled: any, onRejected: any) =>
            Promise.reject(new Error("DB timeout")).then(onFulfilled, onRejected)) as never;
          return chain;
        }
        return createChainMock({ data: [{ total: "100" }] });
      }),
    } as any;

    const { tracked, errors } = await calculateAllSpendingTracking(mockClient, clubId, new Date(2025, 5, 15));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("member-1");
    // member-2 should still be tracked
    expect(tracked.some((t) => t.member_id === "member-2")).toBe(true);
  });
});
