import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberWithTier } from "@/lib/golf-eligibility";
import type { RsvpStatus, MembershipTierLevel } from "@club/shared";
import { GOLF_ELIGIBLE_TIERS } from "@club/shared";
import type { ChatEventData, ChatTeeTimeSlot, ChatBookingData } from "./route";

export async function handleGetUpcomingEvents(
  supabase: SupabaseClient,
  member: MemberWithTier
): Promise<{ toolResult: string; events: ChatEventData[] }> {
  const { data: events } = await supabase
    .from("events")
    .select("id, title, description, location, start_date, end_date, capacity, price")
    .eq("club_id", member.club_id)
    .eq("status", "published")
    .gte("start_date", new Date().toISOString())
    .order("start_date", { ascending: true })
    .limit(10);

  if (!events?.length) {
    return { toolResult: JSON.stringify({ count: 0, event_titles: [], note: "No events found." }), events: [] };
  }

  // Enrich with RSVP count + user's RSVP status for the frontend cards
  const enriched: ChatEventData[] = await Promise.all(
    events.map(async (event) => {
      const { count } = await supabase
        .from("event_rsvps")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "attending");

      const { data: userRsvp } = await supabase
        .from("event_rsvps")
        .select("status")
        .eq("event_id", event.id)
        .eq("member_id", member.id)
        .maybeSingle();

      return {
        ...event,
        rsvp_count: count ?? 0,
        user_rsvp_status: (userRsvp?.status as RsvpStatus) ?? null,
      };
    })
  );

  // Send only a brief summary to the LLM — the frontend renders rich event cards
  const titles = enriched.map((e) => e.title);
  return {
    toolResult: JSON.stringify({
      count: enriched.length,
      event_titles: titles,
      note: "Event cards are displayed to the user automatically. Provide a brief introductory sentence only — do NOT list event details.",
    }),
    events: enriched,
  };
}

export async function handleRsvpToEvent(
  supabase: SupabaseClient,
  member: MemberWithTier,
  args: { event_title: string }
): Promise<string> {
  // Find the event by fuzzy title match
  const { data: events } = await supabase
    .from("events")
    .select("id, title, capacity, start_date, status")
    .eq("club_id", member.club_id)
    .eq("status", "published")
    .gte("start_date", new Date().toISOString())
    .ilike("title", `%${args.event_title}%`);

  if (!events?.length) {
    return JSON.stringify({ error: `No upcoming event found matching "${args.event_title}".` });
  }

  const event = events[0];

  // Check capacity
  if (event.capacity) {
    const { count } = await supabase
      .from("event_rsvps")
      .select("*", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("status", "attending")
      .neq("member_id", member.id);

    if ((count ?? 0) + 1 > event.capacity) {
      return JSON.stringify({ error: `"${event.title}" is at full capacity.` });
    }
  }

  // Upsert RSVP
  const { error: rsvpError } = await supabase
    .from("event_rsvps")
    .upsert(
      {
        event_id: event.id,
        member_id: member.id,
        status: "attending",
        guest_count: 0,
      },
      { onConflict: "event_id,member_id" }
    )
    .select()
    .single();

  if (rsvpError) {
    return JSON.stringify({ error: "Failed to RSVP. Please try again." });
  }

  return JSON.stringify({ success: true, event_title: event.title, status: "attending" });
}

export async function handleGetMyRsvps(
  supabase: SupabaseClient,
  member: MemberWithTier
): Promise<{ toolResult: string; events: ChatEventData[] }> {
  // Get all events the user is attending
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select("event_id")
    .eq("member_id", member.id)
    .eq("status", "attending");

  if (!rsvps?.length) {
    return { toolResult: JSON.stringify({ count: 0, event_titles: [], note: "No events found." }), events: [] };
  }

  const eventIds = rsvps.map((r) => r.event_id);

  const { data: events } = await supabase
    .from("events")
    .select("id, title, description, location, start_date, end_date, capacity, price")
    .in("id", eventIds)
    .eq("club_id", member.club_id)
    .eq("status", "published")
    .gte("start_date", new Date().toISOString())
    .order("start_date", { ascending: true });

  if (!events?.length) {
    return { toolResult: JSON.stringify({ count: 0, event_titles: [], note: "No events found." }), events: [] };
  }

  const enriched: ChatEventData[] = await Promise.all(
    events.map(async (event) => {
      const { count } = await supabase
        .from("event_rsvps")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "attending");

      return {
        ...event,
        rsvp_count: count ?? 0,
        user_rsvp_status: "attending" as RsvpStatus,
      };
    })
  );

  // Send only a brief summary to the LLM — the frontend renders rich event cards
  const titles = enriched.map((e) => e.title);
  return {
    toolResult: JSON.stringify({
      count: enriched.length,
      event_titles: titles,
      note: "Event cards are displayed to the user automatically. Provide a brief introductory sentence only — do NOT list event details.",
    }),
    events: enriched,
  };
}

export async function handleCancelRsvp(
  supabase: SupabaseClient,
  member: MemberWithTier,
  args: { event_title: string }
): Promise<{ toolResult: string; events: ChatEventData[] }> {
  // Find user's attended events matching the title
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select("event_id")
    .eq("member_id", member.id)
    .eq("status", "attending");

  if (!rsvps?.length) {
    return {
      toolResult: JSON.stringify({ error: "You don't have any active RSVPs." }),
      events: [],
    };
  }

  const eventIds = rsvps.map((r) => r.event_id);

  const { data: events } = await supabase
    .from("events")
    .select("id, title, description, location, start_date, end_date, capacity, price")
    .in("id", eventIds)
    .eq("club_id", member.club_id)
    .eq("status", "published")
    .ilike("title", `%${args.event_title}%`);

  if (!events?.length) {
    return {
      toolResult: JSON.stringify({
        error: `No active RSVP found matching "${args.event_title}".`,
      }),
      events: [],
    };
  }

  const event = events[0];

  const { count } = await supabase
    .from("event_rsvps")
    .select("*", { count: "exact", head: true })
    .eq("event_id", event.id)
    .eq("status", "attending");

  const enriched: ChatEventData = {
    ...event,
    rsvp_count: count ?? 0,
    user_rsvp_status: "attending" as RsvpStatus,
  };

  return {
    toolResult: JSON.stringify({ event_title: event.title, status: "attending" }),
    events: [enriched],
  };
}

// ─── Tee Time Helpers ───────────────────────────────────────────────

function isGolfEligible(member: MemberWithTier): boolean {
  return (
    member.role === "admin" ||
    member.role === "staff" ||
    (member.tier_level !== null &&
      GOLF_ELIGIBLE_TIERS.includes(member.tier_level as MembershipTierLevel))
  );
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function getDateRange(startDate: string, endDate?: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + "T12:00:00");
  const end = endDate ? new Date(endDate + "T12:00:00") : start;
  const maxDays = 7;

  const current = new Date(start);
  for (let i = 0; i < maxDays && current <= end; i++) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, "0");
    const dd = String(current.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// ─── Tee Time Handlers ──────────────────────────────────────────────

export async function handleSearchTeeTimes(
  supabase: SupabaseClient,
  member: MemberWithTier,
  args: {
    start_date: string;
    end_date?: string;
    time_preference?: "morning" | "afternoon" | "any";
    facility_name?: string;
  }
): Promise<{ toolResult: string; slots: ChatTeeTimeSlot[] }> {
  if (!isGolfEligible(member)) {
    return {
      toolResult: JSON.stringify({
        error:
          "You need a Golf, Platinum, or Legacy membership to book tee times. Contact the front desk to upgrade your membership.",
      }),
      slots: [],
    };
  }

  // Find golf facilities
  let facilityQuery = supabase
    .from("facilities")
    .select("id, name")
    .eq("club_id", member.club_id)
    .eq("type", "golf")
    .eq("is_active", true);

  if (args.facility_name) {
    facilityQuery = facilityQuery.ilike("name", `%${args.facility_name}%`);
  }

  const { data: facilities } = await facilityQuery;

  if (!facilities?.length) {
    return {
      toolResult: JSON.stringify({ error: "No golf courses found at your club." }),
      slots: [],
    };
  }

  const dates = getDateRange(args.start_date, args.end_date);
  const timePref = args.time_preference ?? "any";

  // Compute the set of day_of_week values we need
  const dayOfWeekSet = new Set<number>();
  for (const date of dates) {
    dayOfWeekSet.add(new Date(date + "T12:00:00").getDay());
  }
  const dayOfWeekValues = Array.from(dayOfWeekSet);

  const allSlots: ChatTeeTimeSlot[] = [];

  for (const facility of facilities) {
    // Bulk query: get all active booking slots for relevant days of week
    const { data: bookingSlots } = await supabase
      .from("booking_slots")
      .select("start_time, end_time, day_of_week")
      .eq("facility_id", facility.id)
      .eq("is_active", true)
      .in("day_of_week", dayOfWeekValues)
      .order("start_time", { ascending: true });

    if (!bookingSlots?.length) continue;

    // Bulk query: get all existing bookings in the date range
    const { data: existingBookings } = await supabase
      .from("bookings")
      .select("start_time, date")
      .eq("facility_id", facility.id)
      .eq("club_id", member.club_id)
      .in("status", ["confirmed", "pending"])
      .gte("date", dates[0])
      .lte("date", dates[dates.length - 1]);

    // Build a set of booked (date, start_time) pairs
    const bookedSet = new Set<string>();
    if (existingBookings) {
      for (const b of existingBookings) {
        const timeKey = b.start_time.substring(0, 5);
        bookedSet.add(`${b.date}|${timeKey}`);
      }
    }

    // Group slots by day_of_week for lookup
    const slotsByDay = new Map<number, typeof bookingSlots>();
    for (const slot of bookingSlots) {
      const existing = slotsByDay.get(slot.day_of_week) ?? [];
      existing.push(slot);
      slotsByDay.set(slot.day_of_week, existing);
    }

    // For each date, merge slots with booking data
    for (const date of dates) {
      const dow = new Date(date + "T12:00:00").getDay();
      const slotsForDay = slotsByDay.get(dow) ?? [];

      for (const slot of slotsForDay) {
        const startTime = slot.start_time.substring(0, 5);
        const endTime = slot.end_time.substring(0, 5);

        // Filter by time preference
        if (timePref === "morning" && startTime >= "12:00") continue;
        if (timePref === "afternoon" && startTime < "12:00") continue;

        // Check availability
        const isBooked = bookedSet.has(`${date}|${startTime}`);
        if (isBooked) continue;

        allSlots.push({
          facility_id: facility.id,
          facility_name: facility.name,
          date,
          day_label: formatDayLabel(date),
          start_time: startTime,
          end_time: endTime,
        });
      }
    }
  }

  // Sort by date then time, cap at 20
  allSlots.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.start_time.localeCompare(b.start_time);
  });
  const capped = allSlots.slice(0, 20);

  if (capped.length === 0) {
    return {
      toolResult: JSON.stringify({
        count: 0,
        note: "No available tee times found for the requested dates and time preference.",
      }),
      slots: [],
    };
  }

  const facilityNames = [...new Set(capped.map((s) => s.facility_name))];
  return {
    toolResult: JSON.stringify({
      count: capped.length,
      facilities: facilityNames,
      date_range: dates.length === 1 ? dates[0] : `${dates[0]} to ${dates[dates.length - 1]}`,
      note: "Tee time cards are displayed to the user automatically. Provide a brief introductory sentence only — do NOT list times, dates, or course details in your response.",
    }),
    slots: capped,
  };
}

export async function handleBookTeeTime(
  supabase: SupabaseClient,
  member: MemberWithTier,
  args: {
    facility_id: string;
    date: string;
    start_time: string;
    end_time: string;
    party_size?: number;
  }
): Promise<{ toolResult: string; booking: ChatBookingData | null }> {
  if (!isGolfEligible(member)) {
    return {
      toolResult: JSON.stringify({
        error: "You need a Golf, Platinum, or Legacy membership to book tee times.",
      }),
      booking: null,
    };
  }

  const partySize = args.party_size ?? 1;

  if (partySize > 4) {
    return {
      toolResult: JSON.stringify({ error: "Golf tee times support a maximum of 4 players." }),
      booking: null,
    };
  }

  // Verify facility
  const { data: facility } = await supabase
    .from("facilities")
    .select("id, name, type")
    .eq("id", args.facility_id)
    .eq("club_id", member.club_id)
    .single();

  if (!facility || facility.type !== "golf") {
    return {
      toolResult: JSON.stringify({ error: "Golf course not found." }),
      booking: null,
    };
  }

  // Double-booking check
  const { data: existing } = await supabase
    .from("bookings")
    .select("id")
    .eq("facility_id", args.facility_id)
    .eq("date", args.date)
    .eq("start_time", args.start_time)
    .eq("club_id", member.club_id)
    .in("status", ["confirmed", "pending"])
    .maybeSingle();

  if (existing) {
    return {
      toolResult: JSON.stringify({ error: "This tee time is already booked. Please select a different time." }),
      booking: null,
    };
  }

  // Create booking
  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      club_id: member.club_id,
      facility_id: args.facility_id,
      member_id: member.id,
      date: args.date,
      start_time: args.start_time,
      end_time: args.end_time,
      party_size: partySize,
      notes: null,
      status: "confirmed",
    })
    .select()
    .single();

  if (error || !booking) {
    return {
      toolResult: JSON.stringify({ error: "Failed to create booking. Please try again." }),
      booking: null,
    };
  }

  const bookingData: ChatBookingData = {
    id: booking.id,
    facility_name: facility.name,
    date: args.date,
    day_label: formatDayLabel(args.date),
    start_time: args.start_time.substring(0, 5),
    end_time: args.end_time.substring(0, 5),
    party_size: partySize,
    status: "confirmed",
  };

  return {
    toolResult: JSON.stringify({
      success: true,
      facility: facility.name,
      date: args.date,
      time: args.start_time,
      party_size: partySize,
    }),
    booking: bookingData,
  };
}

export async function handleGetMyTeeTimes(
  supabase: SupabaseClient,
  member: MemberWithTier
): Promise<{ toolResult: string; bookings: ChatBookingData[] }> {
  const today = new Date().toISOString().split("T")[0];

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, date, start_time, end_time, party_size, status, facility_id, facilities(name, type)")
    .eq("member_id", member.id)
    .eq("club_id", member.club_id)
    .in("status", ["confirmed", "pending"])
    .gte("date", today)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (!bookings?.length) {
    return {
      toolResult: JSON.stringify({ count: 0, note: "You don't have any upcoming tee times." }),
      bookings: [],
    };
  }

  // Filter to golf facilities only
  const golfBookings = bookings.filter((b) => {
    const facility = b.facilities as unknown as { name: string; type: string } | null;
    return facility?.type === "golf";
  });

  if (!golfBookings.length) {
    return {
      toolResult: JSON.stringify({ count: 0, note: "You don't have any upcoming tee times." }),
      bookings: [],
    };
  }

  const result: ChatBookingData[] = golfBookings.map((b) => {
    const facility = b.facilities as unknown as { name: string; type: string };
    return {
      id: b.id,
      facility_name: facility.name,
      date: b.date,
      day_label: formatDayLabel(b.date),
      start_time: b.start_time.substring(0, 5),
      end_time: b.end_time.substring(0, 5),
      party_size: b.party_size,
      status: b.status,
    };
  });

  return {
    toolResult: JSON.stringify({
      count: result.length,
      note: "Tee time cards are displayed to the user automatically. Provide a brief introductory sentence only — do NOT list times, dates, or course details in your response.",
    }),
    bookings: result,
  };
}

export async function handleCancelTeeTime(
  supabase: SupabaseClient,
  member: MemberWithTier,
  args: { booking_description: string }
): Promise<{ toolResult: string; bookings: ChatBookingData[] }> {
  const today = new Date().toISOString().split("T")[0];

  // Fetch member's upcoming golf bookings
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, date, start_time, end_time, party_size, status, facility_id, facilities(name, type)")
    .eq("member_id", member.id)
    .eq("club_id", member.club_id)
    .in("status", ["confirmed", "pending"])
    .gte("date", today)
    .order("date", { ascending: true });

  if (!bookings?.length) {
    return {
      toolResult: JSON.stringify({ error: "You don't have any upcoming tee times to cancel." }),
      bookings: [],
    };
  }

  const golfBookings = bookings.filter((b) => {
    const facility = b.facilities as unknown as { name: string; type: string } | null;
    return facility?.type === "golf";
  });

  if (!golfBookings.length) {
    return {
      toolResult: JSON.stringify({ error: "You don't have any upcoming tee times to cancel." }),
      bookings: [],
    };
  }

  // Fuzzy match: check if description matches date, time, or facility name
  const desc = args.booking_description.toLowerCase();
  const matches = golfBookings.filter((b) => {
    const facility = b.facilities as unknown as { name: string; type: string };
    const dayLabel = formatDayLabel(b.date).toLowerCase();
    const startTime = b.start_time.substring(0, 5);
    return (
      dayLabel.includes(desc) ||
      desc.includes(dayLabel) ||
      b.date.includes(desc) ||
      desc.includes(b.date) ||
      startTime.includes(desc) ||
      desc.includes(startTime) ||
      facility.name.toLowerCase().includes(desc) ||
      desc.includes(facility.name.toLowerCase())
    );
  });

  if (matches.length === 0) {
    // Return all bookings so user can clarify
    const all: ChatBookingData[] = golfBookings.map((b) => {
      const facility = b.facilities as unknown as { name: string; type: string };
      return {
        id: b.id,
        facility_name: facility.name,
        date: b.date,
        day_label: formatDayLabel(b.date),
        start_time: b.start_time.substring(0, 5),
        end_time: b.end_time.substring(0, 5),
        party_size: b.party_size,
        status: b.status,
      };
    });

    return {
      toolResult: JSON.stringify({
        error: `No tee time found matching "${args.booking_description}". Here are your upcoming tee times — please specify which one to cancel.`,
        count: all.length,
      }),
      bookings: all,
    };
  }

  if (matches.length > 1) {
    const multiple: ChatBookingData[] = matches.map((b) => {
      const facility = b.facilities as unknown as { name: string; type: string };
      return {
        id: b.id,
        facility_name: facility.name,
        date: b.date,
        day_label: formatDayLabel(b.date),
        start_time: b.start_time.substring(0, 5),
        end_time: b.end_time.substring(0, 5),
        party_size: b.party_size,
        status: b.status,
      };
    });

    return {
      toolResult: JSON.stringify({
        error: "Multiple tee times match your description. Please be more specific or select one from the list.",
        count: multiple.length,
      }),
      bookings: multiple,
    };
  }

  // Single match — cancel it
  const toCancel = matches[0];
  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", toCancel.id)
    .eq("member_id", member.id);

  if (error) {
    return {
      toolResult: JSON.stringify({ error: "Failed to cancel the tee time. Please try again." }),
      bookings: [],
    };
  }

  const facility = toCancel.facilities as unknown as { name: string; type: string };
  const cancelled: ChatBookingData = {
    id: toCancel.id,
    facility_name: facility.name,
    date: toCancel.date,
    day_label: formatDayLabel(toCancel.date),
    start_time: toCancel.start_time.substring(0, 5),
    end_time: toCancel.end_time.substring(0, 5),
    party_size: toCancel.party_size,
    status: "cancelled",
  };

  return {
    toolResult: JSON.stringify({
      success: true,
      cancelled_booking: `${facility.name} on ${cancelled.day_label} at ${cancelled.start_time}`,
    }),
    bookings: [cancelled],
  };
}
