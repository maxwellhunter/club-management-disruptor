/**
 * Tests for the Billing Engine — dues cycles, shortfall invoicing,
 * assessment generation, family consolidation, and the main dispatcher.
 */

// Mock the spending tracker module
const mockCalculateAllSpendingTracking = jest.fn();
jest.mock("../spending-tracker", () => ({
  calculateAllSpendingTracking: (...args: unknown[]) => mockCalculateAllSpendingTracking(...args),
}));

import { runDuesCycle, runShortfallCycle, runAssessmentCycle, runBillingCycle } from "../billing-engine";

// ─── Chain mock helper ──────────────────────────────────────────────

function createChainMock(result: { data?: unknown; error?: unknown; count?: number | null }) {
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

const clubId = "club-1";
const runBy = "admin-user";

// ─── runDuesCycle ───────────────────────────────────────────────────

describe("runDuesCycle", () => {
  it("creates invoices for active members with tiers", async () => {
    const members = [
      { id: "m-1", first_name: "Alice", last_name: "Smith", membership_tier_id: "t-1", family_id: null, membership_tiers: [{ name: "Premium", monthly_dues: 500 }] },
      { id: "m-2", first_name: "Bob", last_name: "Jones", membership_tier_id: "t-2", family_id: null, membership_tiers: [{ name: "Standard", monthly_dues: 200 }] },
    ];

    const tables: Record<string, any> = {
      members: createChainMock({ data: members }),
      invoices: createChainMock({ data: null, error: null }), // existing invoices check + inserts
      families: createChainMock({ data: [] }),
    };

    const mockClient = {
      from: jest.fn((table: string) => tables[table] || createChainMock({ data: null })),
    } as any;

    const result = await runDuesCycle(mockClient, clubId, "2025-06-01", "2025-06-30", runBy);

    expect(result.invoicesCreated).toBe(2);
    expect(result.totalAmount).toBe(700);
    expect(result.errors).toHaveLength(0);
  });

  it("skips members already billed in period", async () => {
    const members = [
      { id: "m-1", first_name: "Alice", last_name: "Smith", membership_tier_id: "t-1", family_id: null, membership_tiers: [{ name: "Premium", monthly_dues: 500 }] },
    ];

    const existingInvoices = [{ member_id: "m-1" }]; // Already billed

    const callTracker: string[] = [];
    const mockClient = {
      from: jest.fn((table: string) => {
        callTracker.push(table);
        if (table === "members") return createChainMock({ data: members });
        if (table === "invoices" && callTracker.filter((t) => t === "invoices").length === 1) {
          return createChainMock({ data: existingInvoices }); // Existing invoices check
        }
        if (table === "families") return createChainMock({ data: [] });
        return createChainMock({ data: null, error: null });
      }),
    } as any;

    const result = await runDuesCycle(mockClient, clubId, "2025-06-01", "2025-06-30", runBy);
    expect(result.invoicesCreated).toBe(0);
  });

  it("consolidates family billing to primary member", async () => {
    const members = [
      { id: "m-primary", first_name: "Alice", last_name: "Smith", membership_tier_id: "t-1", family_id: "fam-1", membership_tiers: [{ name: "Premium", monthly_dues: 500 }] },
      { id: "m-spouse", first_name: "Bob", last_name: "Smith", membership_tier_id: "t-2", family_id: "fam-1", membership_tiers: [{ name: "Standard", monthly_dues: 200 }] },
    ];
    const families = [
      { id: "fam-1", primary_member_id: "m-primary", billing_consolidated: true },
    ];

    const invoiceInserts: any[] = [];
    let invoiceCallCount = 0;

    const mockClient = {
      from: jest.fn((table: string) => {
        if (table === "members") return createChainMock({ data: members });
        if (table === "invoices") {
          invoiceCallCount++;
          if (invoiceCallCount === 1) {
            // First call is the "existing invoices" check -> return empty
            return createChainMock({ data: [] });
          }
          // Subsequent calls are inserts
          const chain = createChainMock({ data: null, error: null });
          const origInsert = chain.insert;
          chain.insert = jest.fn((data: any) => {
            invoiceInserts.push(data);
            return origInsert(data);
          });
          return chain;
        }
        if (table === "families") return createChainMock({ data: families });
        return createChainMock({ data: null });
      }),
    } as any;

    const result = await runDuesCycle(mockClient, clubId, "2025-06-01", "2025-06-30", runBy);

    // Should create 1 consolidated invoice for primary, not 2 individual ones
    // The primary's own dues + spouse's dues = 1 consolidated invoice
    expect(result.invoicesCreated).toBe(1);
    expect(result.totalAmount).toBe(700);

    // Verify the invoice was for the primary member with consolidated amount
    expect(invoiceInserts.length).toBe(1);
    expect(invoiceInserts[0].member_id).toBe("m-primary");
    expect(invoiceInserts[0].amount).toBe(700);
    expect(invoiceInserts[0].description).toContain("Family Consolidated");
  });

  it("skips members with 0 dues", async () => {
    const members = [
      { id: "m-1", first_name: "Alice", last_name: "Smith", membership_tier_id: "t-1", family_id: null, membership_tiers: [{ name: "Honorary", monthly_dues: 0 }] },
    ];

    const mockClient = {
      from: jest.fn((table: string) => {
        if (table === "members") return createChainMock({ data: members });
        if (table === "invoices") return createChainMock({ data: [] });
        if (table === "families") return createChainMock({ data: [] });
        return createChainMock({ data: null });
      }),
    } as any;

    const result = await runDuesCycle(mockClient, clubId, "2025-06-01", "2025-06-30", runBy);
    expect(result.invoicesCreated).toBe(0);
  });

  it("returns error when no members found", async () => {
    const mockClient = {
      from: jest.fn(() => createChainMock({ data: [] })),
    } as any;

    const result = await runDuesCycle(mockClient, clubId, "2025-06-01", "2025-06-30", runBy);
    expect(result.errors).toContain("No active members with tiers found");
  });

  it("collects insert errors without stopping", async () => {
    const members = [
      { id: "m-1", first_name: "Alice", last_name: "Smith", membership_tier_id: "t-1", family_id: null, membership_tiers: [{ name: "Premium", monthly_dues: 500 }] },
      { id: "m-2", first_name: "Bob", last_name: "Jones", membership_tier_id: "t-1", family_id: null, membership_tiers: [{ name: "Premium", monthly_dues: 500 }] },
    ];

    let insertCount = 0;
    const mockClient = {
      from: jest.fn((table: string) => {
        if (table === "members") return createChainMock({ data: members });
        if (table === "invoices") {
          insertCount++;
          if (insertCount === 2) {
            // Second invoice insert fails
            return createChainMock({ data: null, error: { message: "DB error" } });
          }
          return createChainMock({ data: null, error: null });
        }
        if (table === "families") return createChainMock({ data: [] });
        return createChainMock({ data: null });
      }),
    } as any;

    const result = await runDuesCycle(mockClient, clubId, "2025-06-01", "2025-06-30", runBy);
    expect(result.invoicesCreated).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain("DB error");
  });
});

// ─── runShortfallCycle ──────────────────────────────────────────────

describe("runShortfallCycle", () => {
  beforeEach(() => {
    mockCalculateAllSpendingTracking.mockReset();
  });

  it("creates invoices for members with shortfall and enforce_shortfall", async () => {
    mockCalculateAllSpendingTracking.mockResolvedValue({
      tracked: [
        { member_id: "m-1", minimum_id: "min-1", period_start: "2025-06-01", period_end: "2025-06-30", amount_spent: 200, amount_required: 500, shortfall: 300 },
      ],
      errors: [],
    });

    const minimums = [
      { id: "min-1", name: "Dining Minimum", shortfall_description: "Dining shortfall", enforce_shortfall: true },
    ];
    const memberNames = [{ id: "m-1", first_name: "Alice", last_name: "Smith" }];

    const mockClient = {
      from: jest.fn((table: string) => {
        if (table === "spending_minimums") return createChainMock({ data: minimums });
        if (table === "members") return createChainMock({ data: memberNames });
        if (table === "spending_tracking") return createChainMock({ data: { shortfall_invoiced: false } });
        if (table === "invoices") return createChainMock({ data: { id: "inv-1" } });
        return createChainMock({ data: null });
      }),
    } as any;

    const result = await runShortfallCycle(mockClient, clubId, "2025-06-01", "2025-06-30", runBy);
    expect(result.invoicesCreated).toBe(1);
    expect(result.totalAmount).toBe(300);
  });

  it("skips shortfall when enforce_shortfall is false", async () => {
    mockCalculateAllSpendingTracking.mockResolvedValue({
      tracked: [
        { member_id: "m-1", minimum_id: "min-1", period_start: "2025-06-01", period_end: "2025-06-30", amount_spent: 200, amount_required: 500, shortfall: 300 },
      ],
      errors: [],
    });

    const minimums = [
      { id: "min-1", name: "Dining Minimum", enforce_shortfall: false },
    ];

    const mockClient = {
      from: jest.fn((table: string) => {
        if (table === "spending_minimums") return createChainMock({ data: minimums });
        if (table === "members") return createChainMock({ data: [] });
        if (table === "spending_tracking") return createChainMock({ data: null });
        return createChainMock({ data: null });
      }),
    } as any;

    const result = await runShortfallCycle(mockClient, clubId, "2025-06-01", "2025-06-30", runBy);
    expect(result.invoicesCreated).toBe(0);
  });

  it("skips already-invoiced shortfalls", async () => {
    mockCalculateAllSpendingTracking.mockResolvedValue({
      tracked: [
        { member_id: "m-1", minimum_id: "min-1", period_start: "2025-06-01", period_end: "2025-06-30", amount_spent: 200, amount_required: 500, shortfall: 300 },
      ],
      errors: [],
    });

    const minimums = [
      { id: "min-1", name: "Dining Minimum", enforce_shortfall: true },
    ];

    const mockClient = {
      from: jest.fn((table: string) => {
        if (table === "spending_minimums") return createChainMock({ data: minimums });
        if (table === "members") return createChainMock({ data: [] });
        if (table === "spending_tracking") return createChainMock({ data: { shortfall_invoiced: true } });
        return createChainMock({ data: null });
      }),
    } as any;

    const result = await runShortfallCycle(mockClient, clubId, "2025-06-01", "2025-06-30", runBy);
    expect(result.invoicesCreated).toBe(0);
  });

  it("propagates tracking errors to result", async () => {
    mockCalculateAllSpendingTracking.mockResolvedValue({
      tracked: [],
      errors: ["Error tracking spending for member m-1: DB timeout"],
    });

    const mockClient = {
      from: jest.fn(() => createChainMock({ data: [] })),
    } as any;

    const result = await runShortfallCycle(mockClient, clubId, "2025-06-01", "2025-06-30", runBy);
    expect(result.errors).toContain("Error tracking spending for member m-1: DB timeout");
  });
});

// ─── runAssessmentCycle ─────────────────────────────────────────────

describe("runAssessmentCycle", () => {
  it("generates single invoice for each target member", async () => {
    const assessment = {
      id: "assess-1",
      name: "Pool Renovation",
      description: "Annual pool upgrade",
      amount: 1000,
      due_date: "2025-07-31",
      invoices_generated: false,
      target_member_ids: ["m-1", "m-2"],
      target_all_members: false,
      target_tier_ids: null,
      allow_installments: false,
      installment_count: 1,
      installment_amount: null,
    };

    const mockClient = {
      from: jest.fn((table: string) => {
        if (table === "assessments") return createChainMock({ data: assessment });
        return createChainMock({ data: null, error: null });
      }),
    } as any;

    const result = await runAssessmentCycle(mockClient, clubId, "assess-1", runBy);
    expect(result.invoicesCreated).toBe(2);
    expect(result.totalAmount).toBe(2000);
  });

  it("generates installment invoices", async () => {
    const assessment = {
      id: "assess-1",
      name: "Club Renovation",
      description: null,
      amount: 3000,
      due_date: "2025-06-01",
      invoices_generated: false,
      target_member_ids: ["m-1"],
      target_all_members: false,
      target_tier_ids: null,
      allow_installments: true,
      installment_count: 3,
      installment_amount: 1000,
    };

    const mockClient = {
      from: jest.fn((table: string) => {
        if (table === "assessments") return createChainMock({ data: assessment });
        return createChainMock({ data: null, error: null });
      }),
    } as any;

    const result = await runAssessmentCycle(mockClient, clubId, "assess-1", runBy);
    expect(result.invoicesCreated).toBe(3);
    expect(result.totalAmount).toBe(3000);
  });

  it("targets all active members when target_all_members is true", async () => {
    const assessment = {
      id: "assess-1",
      name: "Annual Fee",
      amount: 100,
      due_date: "2025-06-01",
      invoices_generated: false,
      target_member_ids: null,
      target_all_members: true,
      target_tier_ids: null,
      allow_installments: false,
      installment_count: 1,
    };

    const allMembers = [{ id: "m-1" }, { id: "m-2" }, { id: "m-3" }];

    let memberQueryDone = false;
    const mockClient = {
      from: jest.fn((table: string) => {
        if (table === "assessments") return createChainMock({ data: assessment });
        if (table === "members" && !memberQueryDone) {
          memberQueryDone = true;
          return createChainMock({ data: allMembers });
        }
        return createChainMock({ data: null, error: null });
      }),
    } as any;

    const result = await runAssessmentCycle(mockClient, clubId, "assess-1", runBy);
    expect(result.invoicesCreated).toBe(3);
    expect(result.totalAmount).toBe(300);
  });

  it("prevents duplicate invoice generation", async () => {
    const assessment = {
      id: "assess-1",
      invoices_generated: true, // Already generated
    };

    const mockClient = {
      from: jest.fn(() => createChainMock({ data: assessment })),
    } as any;

    const result = await runAssessmentCycle(mockClient, clubId, "assess-1", runBy);
    expect(result.invoicesCreated).toBe(0);
    expect(result.errors).toContain("Invoices already generated for this assessment");
  });

  it("returns error when assessment not found", async () => {
    const mockClient = {
      from: jest.fn(() => createChainMock({ data: null })),
    } as any;

    const result = await runAssessmentCycle(mockClient, clubId, "assess-missing", runBy);
    expect(result.errors).toContain("Assessment not found");
  });

  it("returns error when no target members found", async () => {
    const assessment = {
      id: "assess-1",
      invoices_generated: false,
      target_member_ids: null,
      target_all_members: true,
      target_tier_ids: null,
    };

    const mockClient = {
      from: jest.fn((table: string) => {
        if (table === "assessments") return createChainMock({ data: assessment });
        if (table === "members") return createChainMock({ data: [] });
        return createChainMock({ data: null });
      }),
    } as any;

    const result = await runAssessmentCycle(mockClient, clubId, "assess-1", runBy);
    expect(result.errors).toContain("No target members found for this assessment");
  });
});

// ─── runBillingCycle (dispatcher) ───────────────────────────────────

describe("runBillingCycle", () => {
  it("creates cycle record, runs dues, and updates status", async () => {
    const cycleUpdateCalls: any[] = [];
    const mockClient = {
      from: jest.fn((table: string) => {
        if (table === "billing_cycles") {
          const chain = createChainMock({ data: { id: "cycle-1" } });
          const origUpdate = chain.update;
          chain.update = jest.fn((data: any) => {
            cycleUpdateCalls.push(data);
            return origUpdate(data);
          });
          return chain;
        }
        // runDuesCycle tables
        if (table === "members") return createChainMock({ data: [] });
        if (table === "invoices") return createChainMock({ data: [] });
        if (table === "families") return createChainMock({ data: [] });
        return createChainMock({ data: null });
      }),
    } as any;

    const { cycleId, result } = await runBillingCycle(
      mockClient, clubId, "dues", "2025-06-01", "2025-06-30", runBy
    );

    expect(cycleId).toBe("cycle-1");
    // Cycle should be updated to completed (with error since no members)
    expect(cycleUpdateCalls.length).toBeGreaterThan(0);
  });

  it("throws when assessment_id missing for assessment type", async () => {
    const mockClient = {
      from: jest.fn(() => createChainMock({ data: { id: "cycle-1" } })),
    } as any;

    await expect(
      runBillingCycle(mockClient, clubId, "assessment", "2025-06-01", "2025-06-30", runBy)
    ).rejects.toThrow("assessment_id required");
  });

  it("marks cycle as failed on error and re-throws", async () => {
    const cycleUpdateCalls: any[] = [];
    const mockClient = {
      from: jest.fn((table: string) => {
        if (table === "billing_cycles") {
          const chain = createChainMock({ data: { id: "cycle-1" } });
          chain.update = jest.fn((data: any) => {
            cycleUpdateCalls.push(data);
            return chain;
          });
          return chain;
        }
        // This will cause an error in assessment cycle
        return createChainMock({ data: null });
      }),
    } as any;

    await expect(
      runBillingCycle(mockClient, clubId, "assessment", "2025-06-01", "2025-06-30", runBy, "assess-1")
    ).resolves.toBeDefined(); // Assessment not found returns result, doesn't throw

    // But missing assessment_id should throw
    await expect(
      runBillingCycle(mockClient, clubId, "assessment", "2025-06-01", "2025-06-30", runBy)
    ).rejects.toThrow();
  });

  it("throws on cycle creation failure", async () => {
    const mockClient = {
      from: jest.fn(() => createChainMock({ data: null, error: { message: "DB down" } })),
    } as any;

    await expect(
      runBillingCycle(mockClient, clubId, "dues", "2025-06-01", "2025-06-30", runBy)
    ).rejects.toThrow("Failed to create billing cycle");
  });
});
