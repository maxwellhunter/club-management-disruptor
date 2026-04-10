import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { buildPkpass } from "@/lib/wallet/pkpass-builder";

/**
 * GET /api/wallet/passes/[serial]/download?platform=apple
 *
 * Serves a signed .pkpass file for Apple Wallet.
 * The pass must exist in the database with status "active".
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ serial: string }> }
) {
  try {
    const { serial } = await params;

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Look up the pass record
    const { data: pass, error } = await adminClient
      .from("digital_passes")
      .select(
        "*, members(first_name, last_name, member_number, email, membership_tiers(name)), clubs(name)"
      )
      .eq("id", serial)
      .eq("status", "active")
      .single();

    if (error || !pass) {
      return NextResponse.json({ error: "Pass not found" }, { status: 404 });
    }

    if (pass.platform !== "apple") {
      return NextResponse.json(
        { error: "Only Apple passes can be downloaded" },
        { status: 400 }
      );
    }

    // Check that signing credentials are configured
    if (!process.env.APPLE_PASS_CERTIFICATE_BASE64 && !process.env.APPLE_PASS_CERTIFICATE_PATH) {
      return NextResponse.json(
        {
          error: "Apple Wallet signing not configured",
          details:
            "Set APPLE_PASS_CERTIFICATE_BASE64 (or APPLE_PASS_CERTIFICATE_PATH) and APPLE_PASS_CERTIFICATE_PASSWORD environment variables.",
        },
        { status: 501 }
      );
    }

    const member = pass.members as any;
    const club = pass.clubs as any;
    const tierName = member?.membership_tiers?.name || "Standard";

    const passData = {
      serialNumber: pass.pass_serial || serial,
      teamIdentifier: process.env.APPLE_TEAM_ID || "XXXXXXXXXX",
      passTypeIdentifier:
        process.env.APPLE_PASS_TYPE_ID || "pass.com.clubos.membership",
      organizationName: club?.name || "ClubOS",
      description: "Club Membership Card",
      memberName: member
        ? `${member.first_name} ${member.last_name}`
        : "Member",
      memberNumber: member?.member_number || `M-${pass.member_id.slice(0, 6)}`,
      tierName,
      clubName: club?.name || "ClubOS",
      barcodePayload: pass.barcode_payload,
      backgroundColor:
        (pass.metadata as any)?.backgroundColor || "#0d5c2e",
      foregroundColor:
        (pass.metadata as any)?.foregroundColor || "#ffffff",
      labelColor:
        (pass.metadata as any)?.labelColor || "#a8d8b8",
    };

    const pkpassBuffer = await buildPkpass(passData);

    // Mark as installed
    await adminClient
      .from("digital_passes")
      .update({ installed_at: new Date().toISOString() })
      .eq("id", serial);

    return new NextResponse(new Uint8Array(pkpassBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="clubos-membership.pkpass"`,
      },
    });
  } catch (error) {
    console.error("Pass download error:", error);
    return NextResponse.json(
      { error: "Failed to generate pass file" },
      { status: 500 }
    );
  }
}
