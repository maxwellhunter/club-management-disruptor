import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportEntityType } from "@club/shared";
import { transformRow } from "./validator";

/**
 * Execute the actual import — insert validated rows into the database.
 * Returns counts of imported and skipped rows.
 */
export async function executeImport(
  supabase: SupabaseClient,
  clubId: string,
  entityType: ImportEntityType,
  validRows: Record<string, string>[],
  mapping: Record<string, string>,
  adminMemberId: string,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  switch (entityType) {
    case "members":
      return importMembers(supabase, clubId, validRows, mapping);
    case "invoices":
      return importInvoices(supabase, clubId, validRows, mapping);
    case "payments":
      return importPayments(supabase, clubId, validRows, mapping);
    case "events":
      return importEvents(supabase, clubId, validRows, mapping, adminMemberId);
    default:
      return { imported: 0, skipped: 0, errors: [`Unsupported entity type: ${entityType}`] };
  }
}

async function importMembers(
  supabase: SupabaseClient,
  clubId: string,
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Load existing tier names for matching
  const { data: tiers } = await supabase
    .from("membership_tiers")
    .select("id, name")
    .eq("club_id", clubId);
  const tierByName = new Map((tiers ?? []).map((t) => [t.name.toLowerCase(), t.id]));

  // Load existing emails to avoid duplicates
  const { data: existing } = await supabase
    .from("members")
    .select("email")
    .eq("club_id", clubId);
  const existingEmails = new Set((existing ?? []).map((m) => m.email.toLowerCase()));

  for (const row of rows) {
    const mapped = transformRow(row, mapping);

    if (!mapped.email || !mapped.first_name || !mapped.last_name) {
      skipped++;
      continue;
    }

    if (existingEmails.has(mapped.email.toLowerCase())) {
      skipped++;
      continue;
    }

    // Resolve tier
    let tierId: string | null = null;
    if (mapped.tier_name) {
      tierId = tierByName.get(mapped.tier_name.toLowerCase()) ?? null;
    }

    // Map status
    const statusMap: Record<string, string> = {
      active: "active",
      inactive: "inactive",
      suspended: "suspended",
      pending: "pending",
      a: "active",
      i: "inactive",
    };
    const status = statusMap[mapped.status?.toLowerCase() ?? ""] ?? "active";

    const { error } = await supabase.from("members").insert({
      club_id: clubId,
      first_name: mapped.first_name,
      last_name: mapped.last_name,
      email: mapped.email,
      phone: mapped.phone || null,
      member_number: mapped.member_number || null,
      role: mapped.role === "admin" || mapped.role === "staff" ? mapped.role : "member",
      status,
      membership_tier_id: tierId,
      join_date: parseDate(mapped.join_date) || new Date().toISOString().slice(0, 10),
      notes: mapped.notes || null,
    });

    if (error) {
      errors.push(`Row ${mapped.email}: ${error.message}`);
      skipped++;
    } else {
      imported++;
      existingEmails.add(mapped.email.toLowerCase());
    }
  }

  return { imported, skipped, errors };
}

async function importInvoices(
  supabase: SupabaseClient,
  clubId: string,
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Load member emails → IDs
  const { data: members } = await supabase
    .from("members")
    .select("id, email")
    .eq("club_id", clubId);
  const memberByEmail = new Map((members ?? []).map((m) => [m.email.toLowerCase(), m.id]));

  for (const row of rows) {
    const mapped = transformRow(row, mapping);

    const memberId = memberByEmail.get(mapped.member_email?.toLowerCase() ?? "");
    if (!memberId) {
      errors.push(`Row: member "${mapped.member_email}" not found`);
      skipped++;
      continue;
    }

    const amount = parseAmount(mapped.amount);
    if (!amount) {
      skipped++;
      continue;
    }

    const statusMap: Record<string, string> = {
      paid: "paid",
      sent: "sent",
      overdue: "overdue",
      draft: "draft",
      open: "sent",
      unpaid: "sent",
    };

    const { error } = await supabase.from("invoices").insert({
      club_id: clubId,
      member_id: memberId,
      amount,
      description: mapped.description || "Imported invoice",
      due_date: parseDate(mapped.due_date) || new Date().toISOString().slice(0, 10),
      status: statusMap[mapped.status?.toLowerCase() ?? ""] ?? "sent",
    });

    if (error) {
      errors.push(`Invoice for ${mapped.member_email}: ${error.message}`);
      skipped++;
    } else {
      imported++;
    }
  }

  return { imported, skipped, errors };
}

async function importPayments(
  supabase: SupabaseClient,
  clubId: string,
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const { data: members } = await supabase
    .from("members")
    .select("id, email")
    .eq("club_id", clubId);
  const memberByEmail = new Map((members ?? []).map((m) => [m.email.toLowerCase(), m.id]));

  for (const row of rows) {
    const mapped = transformRow(row, mapping);

    const memberId = memberByEmail.get(mapped.member_email?.toLowerCase() ?? "");
    if (!memberId) {
      skipped++;
      continue;
    }

    const amount = parseAmount(mapped.amount);
    if (!amount) {
      skipped++;
      continue;
    }

    const methodMap: Record<string, string> = {
      card: "card",
      credit: "card",
      "credit card": "card",
      check: "check",
      cheque: "check",
      cash: "cash",
      ach: "ach",
      wire: "ach",
    };

    const { error } = await supabase.from("payments").insert({
      club_id: clubId,
      member_id: memberId,
      amount,
      method: methodMap[mapped.method?.toLowerCase() ?? ""] ?? "other",
      description: mapped.description || "Imported payment",
    });

    if (error) {
      errors.push(`Payment for ${mapped.member_email}: ${error.message}`);
      skipped++;
    } else {
      imported++;
    }
  }

  return { imported, skipped, errors };
}

async function importEvents(
  supabase: SupabaseClient,
  clubId: string,
  rows: Record<string, string>[],
  mapping: Record<string, string>,
  adminMemberId: string,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const mapped = transformRow(row, mapping);

    if (!mapped.title || !mapped.start_date) {
      skipped++;
      continue;
    }

    const startDate = parseDateTime(mapped.start_date);
    if (!startDate) {
      errors.push(`Event "${mapped.title}": invalid start date "${mapped.start_date}"`);
      skipped++;
      continue;
    }

    const { error } = await supabase.from("events").insert({
      club_id: clubId,
      title: mapped.title,
      description: mapped.description || null,
      location: mapped.location || null,
      start_date: startDate,
      end_date: mapped.end_date ? parseDateTime(mapped.end_date) : null,
      capacity: mapped.capacity ? parseInt(mapped.capacity, 10) || null : null,
      price: mapped.price ? parseAmount(mapped.price) : null,
      status: "published",
      created_by: adminMemberId,
    });

    if (error) {
      errors.push(`Event "${mapped.title}": ${error.message}`);
      skipped++;
    } else {
      imported++;
    }
  }

  return { imported, skipped, errors };
}

// ── Helpers ──

function parseDate(value?: string): string | null {
  if (!value) return null;
  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  // US format MM/DD/YYYY
  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (us) {
    const year = us[3].length === 2 ? `20${us[3]}` : us[3];
    return `${year}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  // Try Date.parse as fallback
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function parseDateTime(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const date = parseDate(value);
  if (date) return `${date}T00:00:00`;
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

function parseAmount(value?: string): number | null {
  if (!value) return null;
  const clean = value.replace(/[$,]/g, "").trim();
  const num = Number(clean);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}
