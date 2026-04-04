/**
 * Tests for the Digital Wallet Pass Generator — barcode generation,
 * Apple/Google pass structure, and barcode-to-member resolution.
 */

import {
  generateBarcodePayload,
  generatePassSerial,
  buildApplePassJson,
  buildGooglePassObject,
  provisionPass,
} from "../pass-generator";

// ─── generateBarcodePayload ─────────────────────────────────────────

describe("generateBarcodePayload", () => {
  it("produces deterministic output for same inputs", () => {
    const a = generateBarcodePayload("club-abc-123", "member-xyz-456");
    const b = generateBarcodePayload("club-abc-123", "member-xyz-456");
    expect(a).toBe(b);
  });

  it("produces different output for different inputs", () => {
    const a = generateBarcodePayload("club-1", "member-1");
    const b = generateBarcodePayload("club-1", "member-2");
    expect(a).not.toBe(b);
  });

  it("follows CLUBOS-{club}-{member}-{checksum} format", () => {
    const payload = generateBarcodePayload("abc-def-123", "xyz-789-000");
    expect(payload).toMatch(/^CLUBOS-[A-Z0-9]{6}-[A-Z0-9]{6}-[A-Z0-9]{4}$/);
  });

  it("handles UUIDs correctly", () => {
    const payload = generateBarcodePayload(
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "11223344-5566-7788-99aa-bbccddeeff00"
    );
    expect(payload).toMatch(/^CLUBOS-/);
    expect(payload.split("-")).toHaveLength(4);
  });
});

// ─── generatePassSerial ─────────────────────────────────────────────

describe("generatePassSerial", () => {
  it("starts with pass- prefix", () => {
    const serial = generatePassSerial();
    expect(serial).toMatch(/^pass-/);
  });

  it("produces unique values", () => {
    const a = generatePassSerial();
    const b = generatePassSerial();
    expect(a).not.toBe(b);
  });
});

// ─── buildApplePassJson ─────────────────────────────────────────────

describe("buildApplePassJson", () => {
  const member = {
    memberId: "m-1",
    memberNumber: "M-001234",
    fullName: "Jane Smith",
    tierName: "Premium",
    clubName: "The Lakes",
    clubId: "club-1",
    email: "jane@example.com",
  };

  const template = {
    apple_background_color: "#16a34a",
    apple_foreground_color: "#ffffff",
    apple_label_color: "#ffffffAA",
    google_hex_background: "#16a34a",
    logo_url: null,
    description: "Membership Card",
  };

  it("includes correct format version", () => {
    const pass = buildApplePassJson(member, template, "serial-1", "BARCODE-1");
    expect(pass.formatVersion).toBe(1);
  });

  it("sets organization name to club name", () => {
    const pass = buildApplePassJson(member, template, "serial-1", "BARCODE-1");
    expect(pass.organizationName).toBe("The Lakes");
    expect(pass.logoText).toBe("The Lakes");
  });

  it("applies template colors", () => {
    const pass = buildApplePassJson(member, template, "serial-1", "BARCODE-1");
    expect(pass.backgroundColor).toBe("#16a34a");
    expect(pass.foregroundColor).toBe("#ffffff");
  });

  it("includes member data in generic fields", () => {
    const pass = buildApplePassJson(member, template, "serial-1", "BARCODE-1");
    const primary = pass.generic.primaryFields[0];
    expect(primary.value).toBe("Jane Smith");

    const secondary = pass.generic.secondaryFields;
    expect(secondary.find((f: any) => f.key === "tier")?.value).toBe("Premium");
    expect(secondary.find((f: any) => f.key === "member_number")?.value).toBe("M-001234");
  });

  it("includes QR barcode with correct payload", () => {
    const pass = buildApplePassJson(member, template, "serial-1", "BARCODE-1");
    expect(pass.barcodes[0].format).toBe("PKBarcodeFormatQR");
    expect(pass.barcodes[0].message).toBe("BARCODE-1");
  });

  it("includes NFC data", () => {
    const pass = buildApplePassJson(member, template, "serial-1", "BARCODE-1");
    expect(pass.nfc.message).toBe("BARCODE-1");
  });

  it("is not voided by default", () => {
    const pass = buildApplePassJson(member, template, "serial-1", "BARCODE-1");
    expect(pass.voided).toBe(false);
  });
});

// ─── buildGooglePassObject ──────────────────────────────────────────

describe("buildGooglePassObject", () => {
  const member = {
    memberId: "m-1",
    memberNumber: "M-001234",
    fullName: "Jane Smith",
    tierName: "Premium",
    clubName: "The Lakes",
    clubId: "club-abc-123",
    email: "jane@example.com",
  };

  const template = {
    apple_background_color: "#16a34a",
    apple_foreground_color: "#ffffff",
    apple_label_color: "#ffffff",
    google_hex_background: "#1e40af",
    logo_url: "https://example.com/logo.png",
    description: "Membership Card",
  };

  it("creates class definition with club info", () => {
    const pass = buildGooglePassObject(member, template, "serial-1", "BARCODE-1");
    expect(pass.classDefinition.issuerName).toBe("The Lakes");
    expect(pass.classDefinition.hexBackgroundColor).toBe("#1e40af");
  });

  it("creates object definition with member data", () => {
    const pass = buildGooglePassObject(member, template, "serial-1", "BARCODE-1");
    const texts = pass.objectDefinition.textModulesData;
    expect(texts.find((t: any) => t.id === "member_name")?.body).toBe("Jane Smith");
    expect(texts.find((t: any) => t.id === "tier")?.body).toBe("Premium");
  });

  it("includes QR barcode", () => {
    const pass = buildGooglePassObject(member, template, "serial-1", "BARCODE-1");
    expect(pass.objectDefinition.barcode.type).toBe("QR_CODE");
    expect(pass.objectDefinition.barcode.value).toBe("BARCODE-1");
  });

  it("includes Smart Tap NFC value", () => {
    const pass = buildGooglePassObject(member, template, "serial-1", "BARCODE-1");
    expect(pass.objectDefinition.smartTapRedemptionValue).toBe("BARCODE-1");
  });

  it("includes logo when provided", () => {
    const pass = buildGooglePassObject(member, template, "serial-1", "BARCODE-1");
    expect(pass.classDefinition.logo?.sourceUri.uri).toBe("https://example.com/logo.png");
  });

  it("omits logo when not provided", () => {
    const noLogoTemplate = { ...template, logo_url: null };
    const pass = buildGooglePassObject(member, noLogoTemplate, "serial-1", "BARCODE-1");
    expect(pass.classDefinition.logo).toBeUndefined();
  });

  it("generates save URL", () => {
    const pass = buildGooglePassObject(member, template, "serial-1", "BARCODE-1");
    expect(pass.saveUrl).toContain("https://pay.google.com/gp/v/save/");
  });
});

// ─── provisionPass ──────────────────────────────────────────────────

describe("provisionPass", () => {
  const member = {
    memberId: "m-1",
    memberNumber: "M-001234",
    fullName: "Jane Smith",
    tierName: "Premium",
    clubName: "The Lakes",
    clubId: "club-1",
    email: "jane@example.com",
  };

  const template = {
    apple_background_color: "#16a34a",
    apple_foreground_color: "#ffffff",
    apple_label_color: "#ffffff",
    google_hex_background: "#16a34a",
    logo_url: null,
    description: "Membership Card",
  };

  it("returns serial, barcode, passData, and URL for apple", async () => {
    const result = await provisionPass(member, "apple", template);
    expect(result.serial).toMatch(/^pass-/);
    expect(result.barcodePayload).toMatch(/^CLUBOS-/);
    expect(result.passData).toBeDefined();
    expect(result.passUrl).toContain("/api/wallet/passes/");
    expect(result.passUrl).toContain("platform=apple");
  });

  it("returns save URL for google", async () => {
    const result = await provisionPass(member, "google", template);
    expect(result.passUrl).toContain("https://pay.google.com");
  });

  it("generates deterministic barcode for same member", async () => {
    const a = await provisionPass(member, "apple", template);
    const b = await provisionPass(member, "google", template);
    expect(a.barcodePayload).toBe(b.barcodePayload);
  });

  it("generates unique serials each time", async () => {
    const a = await provisionPass(member, "apple", template);
    const b = await provisionPass(member, "apple", template);
    expect(a.serial).not.toBe(b.serial);
  });
});
