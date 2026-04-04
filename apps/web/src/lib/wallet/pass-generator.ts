import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import crypto from "crypto";

/**
 * Digital Wallet Pass Generator
 *
 * Generates Apple Wallet (.pkpass) and Google Wallet pass URLs.
 * In production, Apple passes require signing with a Pass Type ID certificate.
 * Google passes use the Google Wallet API with a service account.
 *
 * This module provides the data structures and serialization —
 * actual signing/API calls require the respective platform credentials.
 */

interface MemberPassData {
  memberId: string;
  memberNumber: string;
  fullName: string;
  tierName: string;
  clubName: string;
  clubId: string;
  email: string;
}

interface CardTemplateData {
  apple_background_color: string;
  apple_foreground_color: string;
  apple_label_color: string;
  google_hex_background: string;
  logo_url: string | null;
  description: string;
}

/**
 * Generate a unique, deterministic barcode payload for a member.
 * Format: CLUBOS-{clubId_short}-{memberId_short}-{checksum}
 */
export function generateBarcodePayload(clubId: string, memberId: string): string {
  const raw = `${clubId}:${memberId}`;
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const clubShort = clubId.replace(/-/g, "").slice(0, 6).toUpperCase();
  const memberShort = memberId.replace(/-/g, "").slice(0, 6).toUpperCase();
  const checksum = hash.slice(0, 4).toUpperCase();
  return `CLUBOS-${clubShort}-${memberShort}-${checksum}`;
}

/**
 * Generate a unique serial number for a pass.
 */
export function generatePassSerial(): string {
  return `pass-${crypto.randomUUID()}`;
}

/**
 * Build the Apple Wallet pass.json structure.
 * In production this would be bundled into a .pkpass (signed ZIP).
 */
export function buildApplePassJson(
  member: MemberPassData,
  template: CardTemplateData,
  serial: string,
  barcodePayload: string
) {
  const passTypeId = process.env.APPLE_PASS_TYPE_ID || "pass.com.clubos.membership";
  const teamId = process.env.APPLE_TEAM_ID || "XXXXXXXXXX";

  return {
    formatVersion: 1,
    passTypeIdentifier: passTypeId,
    serialNumber: serial,
    teamIdentifier: teamId,
    organizationName: member.clubName,
    description: template.description || "Club Membership Card",
    logoText: member.clubName,
    backgroundColor: template.apple_background_color,
    foregroundColor: template.apple_foreground_color,
    labelColor: template.apple_label_color,
    // Generic pass style for membership
    generic: {
      primaryFields: [
        {
          key: "member_name",
          label: "MEMBER",
          value: member.fullName,
        },
      ],
      secondaryFields: [
        {
          key: "tier",
          label: "TIER",
          value: member.tierName,
        },
        {
          key: "member_number",
          label: "MEMBER #",
          value: member.memberNumber,
        },
      ],
      auxiliaryFields: [
        {
          key: "club",
          label: "CLUB",
          value: member.clubName,
        },
      ],
      backFields: [
        {
          key: "info",
          label: "About This Pass",
          value: `This is your digital membership card for ${member.clubName}. Present at check-in, POS terminals, or facility access points. Contact the club for assistance.`,
        },
        {
          key: "email",
          label: "Member Email",
          value: member.email,
        },
      ],
    },
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: barcodePayload,
        messageEncoding: "iso-8859-1",
        altText: member.memberNumber,
      },
    ],
    // NFC — used by Apple Wallet for tap interactions
    nfc: {
      message: barcodePayload,
      encryptionPublicKey: "", // Would be set with actual NFC certificate
    },
    voided: false,
  };
}

/**
 * Build the Google Wallet pass object structure.
 * In production this would be sent to the Google Wallet API.
 */
export function buildGooglePassObject(
  member: MemberPassData,
  template: CardTemplateData,
  serial: string,
  barcodePayload: string
) {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID || "3388000000000000000";
  const classId = `${issuerId}.clubos_membership_${member.clubId.replace(/-/g, "_")}`;
  const objectId = `${issuerId}.${serial.replace(/-/g, "_")}`;

  return {
    // Class definition (created once per club)
    classDefinition: {
      id: classId,
      issuerName: member.clubName,
      reviewStatus: "UNDER_REVIEW",
      hexBackgroundColor: template.google_hex_background,
      genericType: "GENERIC_TYPE_UNSPECIFIED",
      logo: template.logo_url
        ? {
            sourceUri: { uri: template.logo_url },
            contentDescription: { defaultValue: { language: "en-US", value: member.clubName } },
          }
        : undefined,
    },
    // Object definition (created per member)
    objectDefinition: {
      id: objectId,
      classId: classId,
      state: "ACTIVE",
      heroImage: template.logo_url
        ? {
            sourceUri: { uri: template.logo_url },
            contentDescription: { defaultValue: { language: "en-US", value: "Membership Card" } },
          }
        : undefined,
      textModulesData: [
        { header: "Member", body: member.fullName, id: "member_name" },
        { header: "Tier", body: member.tierName, id: "tier" },
        { header: "Member #", body: member.memberNumber, id: "member_number" },
      ],
      barcode: {
        type: "QR_CODE",
        value: barcodePayload,
        alternateText: member.memberNumber,
      },
      // Smart Tap (NFC)
      smartTapRedemptionValue: barcodePayload,
      passConstraints: {
        nfcConstraint: ["NFC_CONSTRAINT_UNSPECIFIED"],
      },
    },
    // Save link for "Add to Google Wallet" button
    saveUrl: `https://pay.google.com/gp/v/save/${objectId}`,
  };
}

/**
 * Provision a digital pass for a member.
 * Creates the pass record in the database and returns the pass data.
 */
export async function provisionPass(
  member: MemberPassData,
  platform: "apple" | "google",
  template: CardTemplateData
): Promise<{
  serial: string;
  barcodePayload: string;
  passData: ReturnType<typeof buildApplePassJson> | ReturnType<typeof buildGooglePassObject>;
  passUrl: string;
}> {
  const serial = generatePassSerial();
  const barcodePayload = generateBarcodePayload(member.clubId, member.memberId);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (platform === "apple") {
    const passData = buildApplePassJson(member, template, serial, barcodePayload);
    // In production: sign the pass, upload to CDN, return download URL
    // For now: return a URL to our API that would serve the .pkpass file
    const passUrl = `${appUrl}/api/wallet/passes/${serial}/download?platform=apple`;
    return { serial, barcodePayload, passData, passUrl };
  } else {
    const passData = buildGooglePassObject(member, template, serial, barcodePayload);
    // In production: create the object via Google Wallet API, return save URL
    const passUrl = passData.saveUrl;
    return { serial, barcodePayload, passData, passUrl };
  }
}

/**
 * Resolve a barcode payload to a member ID.
 * Used when scanning a QR code or NFC tap.
 */
export async function resolveBarcodeToMember(
  barcodePayload: string
): Promise<{ memberId: string; clubId: string } | null> {
  const adminClient = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await adminClient
    .from("digital_passes")
    .select("member_id, club_id")
    .eq("barcode_payload", barcodePayload)
    .eq("status", "active")
    .single();

  return data ? { memberId: data.member_id, clubId: data.club_id } : null;
}
