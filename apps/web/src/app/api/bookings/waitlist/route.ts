import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";

// POST — Join waitlist for a booked slot
export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { facility_id, date, start_time, end_time, party_size } = body;

    if (!facility_id || !date || !start_time || !end_time) {
      return NextResponse.json(
        { error: "facility_id, date, start_time, and end_time are required" },
        { status: 400 }
      );
    }

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Check golf eligibility
    if (!result.isGolfEligible) {
      return NextResponse.json(
        { error: "Golf booking requires a Golf, Platinum, or Legacy membership" },
        { status: 403 }
      );
    }

    // Verify the slot is actually booked (no point waitlisting an open slot)
    const { data: existingBooking } = await supabase
      .from("bookings")
      .select("id")
      .eq("facility_id", facility_id)
      .eq("date", date)
      .eq("start_time", start_time)
      .eq("club_id", result.member.club_id)
      .in("status", ["confirmed", "pending"])
      .maybeSingle();

    if (!existingBooking) {
      return NextResponse.json(
        { error: "This slot is available — book it directly instead" },
        { status: 400 }
      );
    }

    // Check if member already has a booking for this slot
    const { data: ownBooking } = await supabase
      .from("bookings")
      .select("id")
      .eq("facility_id", facility_id)
      .eq("date", date)
      .eq("start_time", start_time)
      .eq("member_id", result.member.id)
      .in("status", ["confirmed", "pending"])
      .maybeSingle();

    if (ownBooking) {
      return NextResponse.json(
        { error: "You already have this slot booked" },
        { status: 409 }
      );
    }

    // Check if already on waitlist
    const { data: existingWaitlist } = await supabase
      .from("booking_waitlist")
      .select("id")
      .eq("facility_id", facility_id)
      .eq("date", date)
      .eq("start_time", start_time)
      .eq("member_id", result.member.id)
      .eq("status", "waiting")
      .maybeSingle();

    if (existingWaitlist) {
      return NextResponse.json(
        { error: "You're already on the waitlist for this slot" },
        { status: 409 }
      );
    }

    // Get current max position for this slot
    const { data: lastEntry } = await supabase
      .from("booking_waitlist")
      .select("position")
      .eq("facility_id", facility_id)
      .eq("date", date)
      .eq("start_time", start_time)
      .eq("status", "waiting")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextPosition = (lastEntry?.position ?? 0) + 1;

    // Add to waitlist
    const { data: entry, error } = await supabase
      .from("booking_waitlist")
      .insert({
        club_id: result.member.club_id,
        facility_id,
        member_id: result.member.id,
        date,
        start_time,
        end_time,
        party_size: party_size ?? 4,
        position: nextPosition,
        status: "waiting",
      })
      .select()
      .single();

    if (error) {
      console.error("Waitlist insert error:", error);
      return NextResponse.json(
        { error: "Failed to join waitlist" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { waitlist: entry, position: nextPosition },
      { status: 201 }
    );
  } catch (error) {
    console.error("Waitlist API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET — Get member's waitlist entries
export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get("facility_id");
    const date = searchParams.get("date");
    const startTime = searchParams.get("start_time");

    // If specific slot requested, return waitlist info for that slot
    if (facilityId && date && startTime) {
      const { data: entries } = await supabase
        .from("booking_waitlist")
        .select("id, position, status, member_id, party_size, created_at")
        .eq("facility_id", facilityId)
        .eq("date", date)
        .eq("start_time", startTime)
        .eq("status", "waiting")
        .order("position", { ascending: true });

      const myEntry = (entries ?? []).find(
        (e) => e.member_id === result.member.id
      );

      return NextResponse.json({
        waitlist_count: entries?.length ?? 0,
        my_position: myEntry?.position ?? null,
        my_entry_id: myEntry?.id ?? null,
        is_on_waitlist: !!myEntry,
      });
    }

    // Otherwise return all active waitlist entries for this member
    const today = new Date().toISOString().split("T")[0];
    const { data: entries } = await supabase
      .from("booking_waitlist")
      .select(
        "id, facility_id, date, start_time, end_time, party_size, position, status, created_at"
      )
      .eq("member_id", result.member.id)
      .eq("status", "waiting")
      .gte("date", today)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    // Enrich with facility names
    const facilityIds = [
      ...new Set((entries ?? []).map((e) => e.facility_id)),
    ];
    const { data: facilities } = await supabase
      .from("facilities")
      .select("id, name")
      .in("id", facilityIds.length > 0 ? facilityIds : ["none"]);

    const facilityMap = new Map(
      (facilities ?? []).map((f) => [f.id, f.name])
    );

    const enriched = (entries ?? []).map((e) => ({
      ...e,
      facility_name: facilityMap.get(e.facility_id) ?? "Unknown",
      start_time: e.start_time.substring(0, 5),
      end_time: e.end_time.substring(0, 5),
    }));

    return NextResponse.json({ waitlist: enriched });
  } catch (error) {
    console.error("Waitlist GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE — Leave waitlist
export async function DELETE(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get("id");

    if (!entryId) {
      return NextResponse.json(
        { error: "Waitlist entry id is required" },
        { status: 400 }
      );
    }

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    const { data: entry } = await supabase
      .from("booking_waitlist")
      .select("id, member_id, facility_id, date, start_time, position")
      .eq("id", entryId)
      .eq("status", "waiting")
      .single();

    if (!entry) {
      return NextResponse.json(
        { error: "Waitlist entry not found" },
        { status: 404 }
      );
    }

    if (entry.member_id !== result.member.id && result.member.role !== "admin") {
      return NextResponse.json(
        { error: "You can only remove your own waitlist entries" },
        { status: 403 }
      );
    }

    // Cancel the entry
    const { error } = await supabase
      .from("booking_waitlist")
      .update({ status: "cancelled" })
      .eq("id", entryId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to leave waitlist" },
        { status: 500 }
      );
    }

    // Reorder remaining positions for this slot
    const { data: remaining } = await supabase
      .from("booking_waitlist")
      .select("id")
      .eq("facility_id", entry.facility_id)
      .eq("date", entry.date)
      .eq("start_time", entry.start_time)
      .eq("status", "waiting")
      .order("position", { ascending: true });

    if (remaining) {
      for (let i = 0; i < remaining.length; i++) {
        await supabase
          .from("booking_waitlist")
          .update({ position: i + 1 })
          .eq("id", remaining[i].id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Waitlist DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
