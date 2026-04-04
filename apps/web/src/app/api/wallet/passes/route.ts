import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { generatePassSchema, revokePassSchema } from "@club/shared";
import {
  provisionPass,
  generateBarcodePayload,
} from "@/lib/wallet/pass-generator";

/**
 * GET /api/wallet/passes — Get digital card dashboard summary
 * POST /api/wallet/passes — Generate a new digital pass
 * DELETE /api/wallet/passes — Revoke a pass (admin)
 */
export async function GET(request: Request) {
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

    const clubId = caller.member.club_id;
    const isAdmin = caller.member.role === "admin";

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date();
    const todayStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T00:00:00`;
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    if (isAdmin) {
      // Admin: full dashboard
      const [passesRes, tapsMonthRes, tapsTodayRes, templateRes] =
        await Promise.all([
          adminClient
            .from("digital_passes")
            .select("*, members(first_name, last_name, member_number, membership_tiers(name))")
            .eq("club_id", clubId)
            .order("created_at", { ascending: false }),
          adminClient
            .from("nfc_tap_log")
            .select("*, members(first_name, last_name, member_number)")
            .eq("club_id", clubId)
            .gte("created_at", monthStart)
            .order("created_at", { ascending: false })
            .limit(50),
          adminClient
            .from("nfc_tap_log")
            .select("id")
            .eq("club_id", clubId)
            .gte("created_at", todayStart),
          adminClient
            .from("card_templates")
            .select("*")
            .eq("club_id", clubId)
            .eq("is_active", true)
            .single(),
        ]);

      const passes = (passesRes.data ?? []).map((p: any) => ({
        ...p,
        member_name: p.members
          ? `${p.members.first_name} ${p.members.last_name}`
          : "Unknown",
        member_number: p.members?.member_number,
        tier_name: (p.members?.membership_tiers as any)?.name || null,
        members: undefined,
      }));

      const recentTaps = (tapsMonthRes.data ?? []).map((t: any) => ({
        ...t,
        member_name: t.members
          ? `${t.members.first_name} ${t.members.last_name}`
          : "Unknown",
        member_number: t.members?.member_number,
        members: undefined,
      }));

      const activePasses = passes.filter(
        (p: any) => p.status === "active"
      ).length;

      return NextResponse.json({
        total_passes: passes.length,
        active_passes: activePasses,
        apple_passes: passes.filter((p: any) => p.platform === "apple").length,
        google_passes: passes.filter((p: any) => p.platform === "google")
          .length,
        taps_today: tapsTodayRes.data?.length ?? 0,
        taps_this_month: recentTaps.length,
        recent_taps: recentTaps.slice(0, 20),
        passes,
        template: templateRes.data,
      });
    } else {
      // Member: own passes + taps
      const [passesRes, tapsRes] = await Promise.all([
        adminClient
          .from("digital_passes")
          .select("*")
          .eq("member_id", caller.member.id),
        adminClient
          .from("nfc_tap_log")
          .select("*")
          .eq("member_id", caller.member.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      return NextResponse.json({
        passes: passesRes.data ?? [],
        recent_taps: tapsRes.data ?? [],
      });
    }
  } catch (error) {
    console.error("Wallet passes GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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

    const body = await request.json();
    const parsed = generatePassSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );

    const { platform } = parsed.data;
    const clubId = caller.member.club_id;

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if member already has a pass for this platform
    const { data: existing } = await adminClient
      .from("digital_passes")
      .select("id, status")
      .eq("member_id", caller.member.id)
      .eq("platform", platform)
      .single();

    if (existing && existing.status === "active") {
      return NextResponse.json(
        { error: `You already have an active ${platform === "apple" ? "Apple Wallet" : "Google Wallet"} pass` },
        { status: 409 }
      );
    }

    // Get club info
    const { data: club } = await adminClient
      .from("clubs")
      .select("name")
      .eq("id", clubId)
      .single();

    // Get card template
    const { data: template } = await adminClient
      .from("card_templates")
      .select("*")
      .eq("club_id", clubId)
      .eq("is_active", true)
      .single();

    const templateData = template || {
      apple_background_color: "#16a34a",
      apple_foreground_color: "#ffffff",
      apple_label_color: "#ffffff",
      google_hex_background: "#16a34a",
      logo_url: null,
      description: "Club Membership Card",
    };

    // Fetch member_number separately (not on MemberWithTier)
    const { data: memberExtra } = await adminClient
      .from("members")
      .select("member_number")
      .eq("id", caller.member.id)
      .single();

    const memberData = {
      memberId: caller.member.id,
      memberNumber: memberExtra?.member_number || `M-${caller.member.id.slice(0, 6).toUpperCase()}`,
      fullName: `${caller.member.first_name} ${caller.member.last_name}`,
      tierName: caller.member.tier_name || "Standard",
      clubName: club?.name || "Club",
      clubId,
      email: caller.member.email,
    };

    const result = await provisionPass(memberData, platform, templateData);

    // Upsert pass record
    if (existing) {
      // Reactivate revoked/expired pass
      await adminClient
        .from("digital_passes")
        .update({
          status: "active",
          pass_serial: result.serial,
          barcode_payload: result.barcodePayload,
          metadata: result.passData,
          installed_at: null,
        })
        .eq("id", existing.id);
    } else {
      await adminClient.from("digital_passes").insert({
        club_id: clubId,
        member_id: caller.member.id,
        platform,
        pass_serial: result.serial,
        pass_type_id:
          platform === "apple"
            ? process.env.APPLE_PASS_TYPE_ID || "pass.com.clubos.membership"
            : `clubos_membership_${clubId.replace(/-/g, "_")}`,
        status: "active",
        barcode_payload: result.barcodePayload,
        metadata: result.passData,
      });
    }

    return NextResponse.json({
      pass_url: result.passUrl,
      platform,
      serial: result.serial,
      barcode_payload: result.barcodePayload,
    });
  } catch (error) {
    console.error("Wallet pass POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller || caller.member.role !== "admin")
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );

    const body = await request.json();
    const parsed = revokePassSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await adminClient
      .from("digital_passes")
      .update({ status: "revoked" })
      .eq("id", parsed.data.pass_id)
      .eq("club_id", caller.member.club_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Wallet pass DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
