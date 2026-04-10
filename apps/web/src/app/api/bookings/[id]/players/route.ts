import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";

/**
 * GET /api/bookings/[id]/players
 * Returns all players in a booking with member/guest details.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params;
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

    const { data: players, error } = await supabase
      .from("booking_players")
      .select(
        `
        *,
        members (first_name, last_name, email, membership_tiers (name)),
        guests (name, email)
      `
      )
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Booking players fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch booking players" },
        { status: 500 }
      );
    }

    const formatted = (players ?? []).map((p) => {
      const member = p.members as unknown as {
        first_name: string;
        last_name: string;
        email: string;
        membership_tiers: { name: string } | null;
      } | null;

      const guest = p.guests as unknown as {
        name: string;
        email: string | null;
      } | null;

      return {
        id: p.id,
        booking_id: p.booking_id,
        player_type: p.player_type,
        member_id: p.member_id,
        guest_id: p.guest_id,
        guest_name: p.guest_name,
        greens_fee: p.greens_fee,
        cart_fee: p.cart_fee,
        caddie_fee: p.caddie_fee,
        total_fee: p.total_fee,
        rate_id: p.rate_id,
        fee_invoiced: p.fee_invoiced,
        // Resolved display name
        display_name: member
          ? `${member.first_name} ${member.last_name}`
          : guest
            ? guest.name
            : p.guest_name ?? "Unknown",
        display_email: member?.email ?? guest?.email ?? null,
        tier_name: member?.membership_tiers?.name ?? null,
      };
    });

    return NextResponse.json({ players: formatted });
  } catch (error) {
    console.error("Booking players API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
