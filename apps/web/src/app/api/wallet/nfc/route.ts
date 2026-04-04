import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { recordNfcTapSchema } from "@club/shared";
import { resolveBarcodeToMember } from "@/lib/wallet/pass-generator";

/**
 * POST /api/wallet/nfc — Record an NFC tap / QR scan
 * Used by mobile app or physical readers to log member check-ins
 */
export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller)
      return NextResponse.json({ error: "Not a member" }, { status: 403 });

    // Only admins/staff can record taps for other members
    const isStaff = ["admin", "staff"].includes(caller.member.role);

    const body = await request.json();
    const parsed = recordNfcTapSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );

    const input = parsed.data;
    const clubId = caller.member.club_id;

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Resolve member from barcode or direct ID
    let memberId = input.member_id;

    if (!memberId && input.barcode_payload) {
      const resolved = await resolveBarcodeToMember(input.barcode_payload);
      if (!resolved) {
        return NextResponse.json(
          { error: "Invalid barcode — no matching member found" },
          { status: 404 }
        );
      }
      if (resolved.clubId !== clubId) {
        return NextResponse.json(
          { error: "Member belongs to a different club" },
          { status: 403 }
        );
      }
      memberId = resolved.memberId;
    }

    if (!memberId) {
      // Self-tap: member tapping their own card
      memberId = caller.member.id;
    }

    // Non-staff can only record their own taps
    if (!isStaff && memberId !== caller.member.id) {
      return NextResponse.json(
        { error: "You can only record your own check-ins" },
        { status: 403 }
      );
    }

    // Verify member exists and is active
    const { data: targetMember } = await adminClient
      .from("members")
      .select("id, first_name, last_name, status, member_number")
      .eq("id", memberId)
      .eq("club_id", clubId)
      .single();

    if (!targetMember) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (targetMember.status !== "active") {
      return NextResponse.json(
        {
          error: `Member ${targetMember.first_name} ${targetMember.last_name} is ${targetMember.status} — tap denied`,
          member_status: targetMember.status,
        },
        { status: 403 }
      );
    }

    // Prevent duplicate taps within 30 seconds
    const thirtySecsAgo = new Date(Date.now() - 30_000).toISOString();
    const { data: recentTap } = await adminClient
      .from("nfc_tap_log")
      .select("id")
      .eq("member_id", memberId)
      .eq("tap_type", input.tap_type)
      .gte("created_at", thirtySecsAgo)
      .limit(1)
      .single();

    if (recentTap) {
      return NextResponse.json(
        { error: "Duplicate tap — already recorded within the last 30 seconds" },
        { status: 429 }
      );
    }

    // Record the tap
    const { data: tap, error: tapError } = await adminClient
      .from("nfc_tap_log")
      .insert({
        club_id: clubId,
        member_id: memberId,
        facility_id: input.facility_id || null,
        tap_type: input.tap_type,
        location: input.location || null,
        device_id: input.device_id || null,
        latitude: input.latitude || null,
        longitude: input.longitude || null,
        verified: true,
      })
      .select()
      .single();

    if (tapError) {
      console.error("NFC tap record error:", tapError);
      return NextResponse.json(
        { error: "Failed to record tap" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tap_id: tap.id,
      member_name: `${targetMember.first_name} ${targetMember.last_name}`,
      member_number: targetMember.member_number,
      tap_type: input.tap_type,
      timestamp: tap.created_at,
    });
  } catch (error) {
    console.error("NFC tap POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
