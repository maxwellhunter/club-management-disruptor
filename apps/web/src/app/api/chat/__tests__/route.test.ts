import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberWithTier } from "@/lib/golf-eligibility";
import {
  handleGetUpcomingEvents,
  handleRsvpToEvent,
  handleGetMyRsvps,
  handleCancelRsvp,
} from "../handlers";

// ─── Supabase Mock Helpers ───────────────────────────────────────────

type ChainResult = {
  data: unknown;
  error: unknown;
  count: number | null;
};

/** Build a chainable mock that resolves to `result` at the end of the chain. */
function createChainMock(result: Partial<ChainResult> = {}) {
  const resolved: ChainResult = {
    data: result.data ?? null,
    error: result.error ?? null,
    count: result.count ?? null,
  };

  const chain: Record<string, jest.Mock> = {};
  const methods = [
    "select",
    "eq",
    "neq",
    "in",
    "gte",
    "ilike",
    "order",
    "limit",
    "single",
    "maybeSingle",
    "upsert",
    "head",
  ];

  for (const method of methods) {
    chain[method] = jest.fn().mockReturnValue(chain);
  }

  // Terminal methods resolve
  chain["single"] = jest.fn().mockResolvedValue(resolved);
  chain["maybeSingle"] = jest.fn().mockResolvedValue(resolved);

  // Make the chain itself thenable (for awaiting without terminal method)
  (chain as unknown as Promise<ChainResult>).then = ((
    onFulfilled: (value: ChainResult) => unknown,
  ) => Promise.resolve(resolved).then(onFulfilled)) as never;

  return chain;
}

function createMockSupabase(
  fromHandler: (table: string) => ReturnType<typeof createChainMock>,
) {
  return {
    from: jest.fn((table: string) => fromHandler(table)),
  } as unknown as SupabaseClient;
}

// ─── Fixtures ────────────────────────────────────────────────────────

const mockMember: MemberWithTier = {
  id: "member-1",
  club_id: "club-1",
  user_id: "user-1",
  first_name: "John",
  last_name: "Doe",
  email: "john@example.com",
  role: "member",
  status: "active",
  membership_tier_id: "tier-1",
  tier_name: "Premium",
  tier_level: "premium",
};

const futureDate = new Date(Date.now() + 86400000).toISOString();

const sampleEvent = {
  id: "event-1",
  title: "Wine Tasting Evening",
  description: "An evening of fine wines",
  location: "Main Clubhouse",
  start_date: futureDate,
  end_date: null,
  capacity: 50,
  price: 25,
};

// ─── handleGetUpcomingEvents ─────────────────────────────────────────

describe("handleGetUpcomingEvents", () => {
  it("returns enriched events with RSVP counts", async () => {
    const supabase = createMockSupabase((table) => {
      if (table === "events") {
        return createChainMock({ data: [sampleEvent] });
      }
      // event_rsvps — called for count and user status
      return createChainMock({ count: 5, data: { status: "attending" } });
    });

    const result = await handleGetUpcomingEvents(supabase, mockMember);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].rsvp_count).toBe(5);
    expect(result.events[0].title).toBe("Wine Tasting Evening");
    expect(JSON.parse(result.toolResult)).toHaveLength(1);
  });

  it("returns empty arrays when no events found", async () => {
    const supabase = createMockSupabase(() =>
      createChainMock({ data: [] }),
    );

    const result = await handleGetUpcomingEvents(supabase, mockMember);

    expect(result.events).toEqual([]);
    expect(JSON.parse(result.toolResult)).toEqual([]);
  });

  it("returns empty arrays when data is null", async () => {
    const supabase = createMockSupabase(() =>
      createChainMock({ data: null }),
    );

    const result = await handleGetUpcomingEvents(supabase, mockMember);

    expect(result.events).toEqual([]);
  });
});

// ─── handleRsvpToEvent ───────────────────────────────────────────────

describe("handleRsvpToEvent", () => {
  it("successfully RSVPs to an event", async () => {
    const supabase = createMockSupabase((table) => {
      if (table === "events") {
        return createChainMock({ data: [{ ...sampleEvent, capacity: null }] });
      }
      // event_rsvps upsert
      return createChainMock({ data: { id: "rsvp-1" }, error: null });
    });

    const result = JSON.parse(
      await handleRsvpToEvent(supabase, mockMember, {
        event_title: "Wine Tasting",
      }),
    );

    expect(result.success).toBe(true);
    expect(result.event_title).toBe("Wine Tasting Evening");
    expect(result.status).toBe("attending");
  });

  it("returns error when no matching event is found", async () => {
    const supabase = createMockSupabase(() =>
      createChainMock({ data: [] }),
    );

    const result = JSON.parse(
      await handleRsvpToEvent(supabase, mockMember, {
        event_title: "Nonexistent Event",
      }),
    );

    expect(result.error).toContain("No upcoming event found");
  });

  it("returns error when event is at full capacity", async () => {
    const supabase = createMockSupabase((table) => {
      if (table === "events") {
        return createChainMock({
          data: [{ ...sampleEvent, capacity: 5 }],
        });
      }
      // RSVP count = 5, capacity = 5 → full
      return createChainMock({ count: 5 });
    });

    const result = JSON.parse(
      await handleRsvpToEvent(supabase, mockMember, {
        event_title: "Wine Tasting",
      }),
    );

    expect(result.error).toContain("full capacity");
  });

  it("returns error when RSVP upsert fails", async () => {
    let callCount = 0;
    const supabase = createMockSupabase((table) => {
      if (table === "events") {
        return createChainMock({
          data: [{ ...sampleEvent, capacity: null }],
        });
      }
      // event_rsvps — first call for count check if needed, then upsert fails
      callCount++;
      return createChainMock({
        error: { message: "DB error" },
        data: null,
      });
    });

    const result = JSON.parse(
      await handleRsvpToEvent(supabase, mockMember, {
        event_title: "Wine Tasting",
      }),
    );

    expect(result.error).toContain("Failed to RSVP");
  });
});

// ─── handleGetMyRsvps ────────────────────────────────────────────────

describe("handleGetMyRsvps", () => {
  it("returns user's attended events", async () => {
    const supabase = createMockSupabase((table) => {
      if (table === "event_rsvps") {
        return createChainMock({
          data: [{ event_id: "event-1" }],
          count: 3,
        });
      }
      return createChainMock({ data: [sampleEvent] });
    });

    const result = await handleGetMyRsvps(supabase, mockMember);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].user_rsvp_status).toBe("attending");
  });

  it("returns empty when user has no RSVPs", async () => {
    const supabase = createMockSupabase(() =>
      createChainMock({ data: [] }),
    );

    const result = await handleGetMyRsvps(supabase, mockMember);

    expect(result.events).toEqual([]);
    expect(JSON.parse(result.toolResult)).toEqual([]);
  });

  it("returns empty when RSVP'd events are no longer published", async () => {
    let firstCall = true;
    const supabase = createMockSupabase((table) => {
      if (table === "event_rsvps" && firstCall) {
        firstCall = false;
        return createChainMock({
          data: [{ event_id: "event-1" }],
        });
      }
      // events query returns empty (event was unpublished)
      return createChainMock({ data: [] });
    });

    const result = await handleGetMyRsvps(supabase, mockMember);

    expect(result.events).toEqual([]);
  });
});

// ─── handleCancelRsvp ────────────────────────────────────────────────

describe("handleCancelRsvp", () => {
  it("finds matching attended event and returns it", async () => {
    const supabase = createMockSupabase((table) => {
      if (table === "event_rsvps") {
        return createChainMock({
          data: [{ event_id: "event-1" }],
          count: 8,
        });
      }
      return createChainMock({ data: [sampleEvent] });
    });

    const result = await handleCancelRsvp(supabase, mockMember, {
      event_title: "Wine",
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].title).toBe("Wine Tasting Evening");
    expect(result.events[0].user_rsvp_status).toBe("attending");

    const toolData = JSON.parse(result.toolResult);
    expect(toolData.event_title).toBe("Wine Tasting Evening");
  });

  it("returns error when user has no active RSVPs", async () => {
    const supabase = createMockSupabase(() =>
      createChainMock({ data: [] }),
    );

    const result = await handleCancelRsvp(supabase, mockMember, {
      event_title: "Wine",
    });

    expect(result.events).toEqual([]);
    const toolData = JSON.parse(result.toolResult);
    expect(toolData.error).toContain("don't have any active RSVPs");
  });

  it("returns error when no RSVP matches the title", async () => {
    let firstCall = true;
    const supabase = createMockSupabase((table) => {
      if (table === "event_rsvps" && firstCall) {
        firstCall = false;
        return createChainMock({
          data: [{ event_id: "event-1" }],
        });
      }
      // events query returns no match
      return createChainMock({ data: [] });
    });

    const result = await handleCancelRsvp(supabase, mockMember, {
      event_title: "Nonexistent",
    });

    expect(result.events).toEqual([]);
    const toolData = JSON.parse(result.toolResult);
    expect(toolData.error).toContain("No active RSVP found");
  });
});
