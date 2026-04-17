import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { generateBarcodePayload } from "@/lib/wallet/pass-generator";
import QRCode from "qrcode";

/**
 * GET /api/admin/member-qrcodes — Admin-only: returns every active
 * member in the club with a rendered QR code PNG (data URL) that
 * the iOS scanner will resolve via POST /api/wallet/nfc.
 *
 * The QR encodes each member's deterministic barcode payload. To
 * ensure the scan resolves, we provision an active `digital_passes`
 * row on the fly for any member that doesn't already have one —
 * this is idempotent because `generateBarcodePayload` is
 * deterministic on (clubId, memberId).
 */
export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller || caller.member.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const clubId = caller.member.club_id;
    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [membersRes, passesRes] = await Promise.all([
      adminClient
        .from("members")
        .select("id, first_name, last_name, email, member_number, status, membership_tiers(name)")
        .eq("club_id", clubId)
        .eq("status", "active")
        .order("last_name", { ascending: true }),
      adminClient
        .from("digital_passes")
        .select("member_id, barcode_payload, status, platform")
        .eq("club_id", clubId),
    ]);

    const members = membersRes.data ?? [];
    const passes = passesRes.data ?? [];
    const passByMember = new Map<string, (typeof passes)[number]>();
    for (const p of passes) {
      if (p.status !== "active") continue;
      // Prefer any active pass; the payload is platform-agnostic.
      if (!passByMember.has(p.member_id)) passByMember.set(p.member_id, p);
    }

    // Batch-insert passes for members missing one so their QR is
    // resolvable on scan. We use the Apple platform slot as the
    // "staff QR" — if the member later installs an actual Apple
    // Wallet pass, POST /api/wallet/passes will reuse this row
    // (same `generateBarcodePayload` output).
    const missingInserts: Array<{
      club_id: string;
      member_id: string;
      platform: string;
      pass_serial: string;
      pass_type_id: string;
      status: string;
      barcode_payload: string;
    }> = [];
    for (const m of members) {
      if (passByMember.has(m.id)) continue;
      const payload = generateBarcodePayload(clubId, m.id);
      missingInserts.push({
        club_id: clubId,
        member_id: m.id,
        platform: "staff_qr",
        pass_serial: `staff-${m.id}`,
        pass_type_id: "pass.com.clubos.membership",
        status: "active",
        barcode_payload: payload,
      });
    }

    if (missingInserts.length > 0) {
      // Unique index is on (member_id, platform). Since we always
      // use platform "staff_qr" here, re-running this endpoint
      // updates the existing staff row in place instead of erroring.
      const { error: insertError } = await adminClient
        .from("digital_passes")
        .upsert(missingInserts, { onConflict: "member_id,platform" });
      if (insertError) {
        console.error("Staff QR provisioning error:", insertError);
      } else {
        for (const row of missingInserts) {
          passByMember.set(row.member_id, {
            member_id: row.member_id,
            barcode_payload: row.barcode_payload,
            status: row.status,
            platform: row.platform,
          });
        }
      }
    }

    // Render QRs. Keep the payload authoritative — if a pass row
    // exists with a different payload (shouldn't happen under
    // deterministic generation, but defensive), honor the stored
    // value so the scan resolves.
    const rows = await Promise.all(
      members.map(async (m) => {
        const pass = passByMember.get(m.id);
        const payload = pass?.barcode_payload ?? generateBarcodePayload(clubId, m.id);
        const qr = await QRCode.toDataURL(payload, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 320,
          color: { dark: "#0a0a0a", light: "#ffffff" },
        });
        const tiers = m.membership_tiers as unknown as { name: string }[] | { name: string } | null;
        const tierName = Array.isArray(tiers) ? tiers[0]?.name : tiers?.name;
        return {
          member_id: m.id,
          name: `${m.first_name} ${m.last_name}`,
          email: m.email,
          member_number: m.member_number,
          tier_name: tierName ?? null,
          barcode_payload: payload,
          qr_data_url: qr,
          has_pass: !!pass,
        };
      })
    );

    return NextResponse.json({
      members: rows,
      provisioned: missingInserts.length,
    });
  } catch (error) {
    console.error("Member QR codes GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
