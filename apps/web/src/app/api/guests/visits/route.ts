import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { registerGuestVisitSchema } from "@club/shared";

/**
 * POST /api/guests/visits — Register a guest visit (with policy enforcement)
 * PATCH /api/guests/visits?id=xxx — Update visit status (check-in, check-out, etc.)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const body = await request.json();
    const parsed = registerGuestVisitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const clubId = caller.member.club_id;
    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Resolve guest ID — either use existing or create inline
    let guestId = input.guest_id;

    if (!guestId && input.guest) {
      // Check for existing by email first
      if (input.guest.email) {
        const { data: existing } = await adminClient
          .from("guests")
          .select("id, is_blocked, block_reason")
          .eq("club_id", clubId)
          .eq("email", input.guest.email)
          .maybeSingle();

        if (existing) {
          if (existing.is_blocked) {
            return NextResponse.json(
              { error: `Guest is blocked: ${existing.block_reason || "No reason provided"}` },
              { status: 403 }
            );
          }
          guestId = existing.id;
        }
      }

      if (!guestId) {
        const { data: newGuest, error: guestErr } = await adminClient
          .from("guests")
          .insert({ club_id: clubId, ...input.guest })
          .select("id")
          .single();

        if (guestErr) {
          return NextResponse.json({ error: `Failed to create guest: ${guestErr.message}` }, { status: 500 });
        }
        guestId = newGuest.id;
      }
    }

    if (!guestId) {
      return NextResponse.json({ error: "guest_id or guest object required" }, { status: 400 });
    }

    // Check if guest is blocked
    const { data: guestRecord } = await adminClient
      .from("guests")
      .select("is_blocked, block_reason")
      .eq("id", guestId)
      .single();

    if (guestRecord?.is_blocked) {
      return NextResponse.json(
        { error: `Guest is blocked: ${guestRecord.block_reason || "Contact admin"}` },
        { status: 403 }
      );
    }

    // Enforce guest policies
    const { data: policies } = await adminClient
      .from("guest_policies")
      .select("*")
      .eq("club_id", clubId)
      .eq("is_active", true);

    const applicablePolicy = (policies ?? []).find(
      (p) => !p.facility_type || p.facility_type === input.facility_type
    ) ?? (policies ?? []).find((p) => !p.facility_type);

    if (applicablePolicy) {
      // Check blackout days
      const visitDay = new Date(input.visit_date).getDay();
      if (applicablePolicy.blackout_days?.includes(visitDay)) {
        return NextResponse.json(
          { error: "Guests are not allowed on this day" },
          { status: 400 }
        );
      }

      // Check max guest visits per month for this member
      if (applicablePolicy.max_guest_visits_per_month) {
        const monthStart = input.visit_date.substring(0, 7) + "-01";
        const { count } = await adminClient
          .from("guest_visits")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId)
          .eq("host_member_id", caller.member.id)
          .gte("visit_date", monthStart)
          .not("status", "eq", "cancelled");

        if ((count ?? 0) >= applicablePolicy.max_guest_visits_per_month) {
          return NextResponse.json(
            { error: `Monthly guest visit limit reached (${applicablePolicy.max_guest_visits_per_month})` },
            { status: 400 }
          );
        }
      }

      // Check max same guest per month
      if (applicablePolicy.max_same_guest_per_month) {
        const monthStart = input.visit_date.substring(0, 7) + "-01";
        const { count } = await adminClient
          .from("guest_visits")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId)
          .eq("guest_id", guestId)
          .gte("visit_date", monthStart)
          .not("status", "eq", "cancelled");

        if ((count ?? 0) >= applicablePolicy.max_same_guest_per_month) {
          return NextResponse.json(
            { error: `This guest has reached the maximum visits per month (${applicablePolicy.max_same_guest_per_month})` },
            { status: 400 }
          );
        }
      }
    }

    // Determine guest fee
    let guestFee = applicablePolicy?.guest_fee ?? 0;

    // Check fee schedule for facility-specific pricing
    const { data: feeSchedules } = await adminClient
      .from("guest_fee_schedules")
      .select("*")
      .eq("club_id", clubId)
      .eq("is_active", true);

    if (feeSchedules && input.facility_type) {
      const tierFee = feeSchedules.find(
        (f) => f.facility_type === input.facility_type && f.tier_id === caller.member.membership_tier_id
      );
      const genericFee = feeSchedules.find(
        (f) => f.facility_type === input.facility_type && !f.tier_id
      );
      const fee = tierFee ?? genericFee;

      if (fee) {
        guestFee = Number(fee.guest_fee);
        // Weekend surcharge
        const visitDay = new Date(input.visit_date).getDay();
        if (visitDay === 0 || visitDay === 6) {
          guestFee += Number(fee.weekend_surcharge);
        }
      }
    }

    // Create the visit
    const { data: visit, error: visitErr } = await adminClient
      .from("guest_visits")
      .insert({
        club_id: clubId,
        guest_id: guestId,
        host_member_id: caller.member.id,
        visit_date: input.visit_date,
        facility_type: input.facility_type ?? null,
        guest_fee: guestFee,
        booking_id: input.booking_id ?? null,
        notes: input.notes ?? null,
        status: "registered",
      })
      .select("*")
      .single();

    if (visitErr) {
      return NextResponse.json({ error: visitErr.message }, { status: 500 });
    }

    // Update guest's visit count + last visit date
    const { data: currentGuest } = await adminClient
      .from("guests")
      .select("total_visits")
      .eq("id", guestId)
      .single();

    await adminClient
      .from("guests")
      .update({
        total_visits: (currentGuest?.total_visits ?? 0) + 1,
        last_visit_date: input.visit_date,
      })
      .eq("id", guestId);

    return NextResponse.json({ visit, guest_fee: guestFee }, { status: 201 });
  } catch (error) {
    console.error("Register guest visit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const body = await request.json();
    const { status } = body;

    if (!["registered", "checked_in", "checked_out", "no_show", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const updates: Record<string, unknown> = { status };
    if (status === "checked_in") updates.check_in_time = new Date().toISOString();
    if (status === "checked_out") updates.check_out_time = new Date().toISOString();

    // Auto-invoice guest fee on check-in
    if (status === "checked_in") {
      const { data: visit } = await adminClient
        .from("guest_visits")
        .select("guest_fee, host_member_id, fee_invoiced, visit_date")
        .eq("id", id)
        .single();

      if (visit && Number(visit.guest_fee) > 0 && !visit.fee_invoiced) {
        const { data: invoice } = await adminClient
          .from("invoices")
          .insert({
            club_id: caller.member.club_id,
            member_id: visit.host_member_id,
            amount: visit.guest_fee,
            description: `Guest fee — ${visit.visit_date}`,
            due_date: visit.visit_date,
            status: "sent",
          })
          .select("id")
          .single();

        if (invoice) {
          updates.fee_invoiced = true;
          updates.invoice_id = invoice.id;
        }
      }
    }

    const { error } = await adminClient
      .from("guest_visits")
      .update(updates)
      .eq("id", id)
      .eq("club_id", caller.member.club_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update guest visit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
