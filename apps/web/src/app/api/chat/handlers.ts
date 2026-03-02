import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberWithTier } from "@/lib/golf-eligibility";
import type { RsvpStatus } from "@club/shared";
import type { ChatEventData } from "./route";

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
    return { toolResult: JSON.stringify([]), events: [] };
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

  return { toolResult: JSON.stringify(events), events: enriched };
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
    return { toolResult: JSON.stringify([]), events: [] };
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
    return { toolResult: JSON.stringify([]), events: [] };
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

  return { toolResult: JSON.stringify(events), events: enriched };
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
