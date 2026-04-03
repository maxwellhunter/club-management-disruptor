import type { SupabaseClient } from "@supabase/supabase-js";
import type { JournalRow, ExportResult } from "./types";
import type { ExportFormat } from "@club/shared";
import { generateCSV } from "./csv-export";
import { generateIIF } from "./iif-export";

/**
 * Main GL export engine.
 * Queries invoices, payments, and POS transactions for a date range,
 * maps them to journal entries using the club's GL mappings,
 * and generates an export file in the requested format.
 */
export async function generateExport(
  supabase: SupabaseClient,
  clubId: string,
  format: ExportFormat,
  dateFrom: string,
  dateTo: string,
): Promise<ExportResult> {
  // 1. Load GL accounts and mappings for this club
  const [accountsRes, mappingsRes] = await Promise.all([
    supabase
      .from("gl_accounts")
      .select("id, account_number, name, type")
      .eq("club_id", clubId)
      .eq("is_active", true),
    supabase
      .from("gl_mappings")
      .select("source_category, gl_account_id")
      .eq("club_id", clubId),
  ]);

  const accounts = accountsRes.data ?? [];
  const mappings = mappingsRes.data ?? [];

  // Build lookup maps
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const mappingByCategory = new Map(mappings.map((m) => [m.source_category, m.gl_account_id]));

  // Default accounts (fallbacks when no mapping exists)
  const defaultRevenue = accounts.find((a) => a.type === "revenue");
  const defaultAR = accounts.find((a) => a.type === "asset");
  const defaultCash = accounts.find((a) => a.name.toLowerCase().includes("cash")) ?? defaultAR;

  // 2. Query financial data for the date range
  const [invoicesRes, paymentsRes, posRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, member_id, amount, description, due_date, status, created_at, members(first_name, last_name)")
      .eq("club_id", clubId)
      .gte("due_date", dateFrom)
      .lte("due_date", dateTo)
      .in("status", ["sent", "paid", "overdue"]),
    supabase
      .from("payments")
      .select("id, member_id, invoice_id, amount, method, description, created_at, members(first_name, last_name)")
      .eq("club_id", clubId)
      .gte("created_at", `${dateFrom}T00:00:00`)
      .lte("created_at", `${dateTo}T23:59:59`),
    supabase
      .from("pos_transactions")
      .select("id, member_id, subtotal, tax, tip, total, location, description, created_at, status, type")
      .eq("club_id", clubId)
      .eq("status", "completed")
      .gte("created_at", `${dateFrom}T00:00:00`)
      .lte("created_at", `${dateTo}T23:59:59`),
  ]);

  const invoices = invoicesRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const posTransactions = posRes.data ?? [];

  // 3. Build journal rows
  const rows: JournalRow[] = [];

  // Invoices: Debit Accounts Receivable, Credit Revenue
  for (const inv of invoices) {
    const revenueAccountId = mappingByCategory.get("membership_dues") ?? defaultRevenue?.id;
    const arAccountId = mappingByCategory.get("accounts_receivable") ?? defaultAR?.id;
    const revenueAcct = revenueAccountId ? accountById.get(revenueAccountId) : null;
    const arAcct = arAccountId ? accountById.get(arAccountId) : null;

    const members = inv.members as unknown as { first_name: string; last_name: string }[] | null;
    const member = members?.[0] ?? null;

    rows.push({
      date: inv.due_date,
      description: inv.description || "Invoice",
      debitAccount: arAcct?.account_number ?? "1200",
      debitAccountName: arAcct?.name ?? "Accounts Receivable",
      creditAccount: revenueAcct?.account_number ?? "4000",
      creditAccountName: revenueAcct?.name ?? "Revenue",
      amount: Number(inv.amount),
      reference: inv.id.slice(0, 8),
      memberName: member ? `${member.first_name} ${member.last_name}` : null,
      source: "invoice",
    });
  }

  // Payments: Debit Cash/Bank, Credit Accounts Receivable
  for (const pmt of payments) {
    const cashAccountId = mappingByCategory.get("cash") ?? defaultCash?.id;
    const arAccountId = mappingByCategory.get("accounts_receivable") ?? defaultAR?.id;
    const cashAcct = cashAccountId ? accountById.get(cashAccountId) : null;
    const arAcct = arAccountId ? accountById.get(arAccountId) : null;

    const members = pmt.members as unknown as { first_name: string; last_name: string }[] | null;
    const member = members?.[0] ?? null;

    rows.push({
      date: pmt.created_at.slice(0, 10),
      description: pmt.description || `Payment (${pmt.method})`,
      debitAccount: cashAcct?.account_number ?? "1000",
      debitAccountName: cashAcct?.name ?? "Cash",
      creditAccount: arAcct?.account_number ?? "1200",
      creditAccountName: arAcct?.name ?? "Accounts Receivable",
      amount: Number(pmt.amount),
      reference: pmt.invoice_id?.slice(0, 8) ?? pmt.id.slice(0, 8),
      memberName: member ? `${member.first_name} ${member.last_name}` : null,
      source: "payment",
    });
  }

  // POS Transactions: Debit Cash/Bank, Credit appropriate revenue account based on location
  for (const txn of posTransactions) {
    if (txn.type === "refund") {
      // Refunds reverse the entry
      const revenueCategory = mapPOSLocationToCategory(txn.location);
      const revenueAccountId = mappingByCategory.get(revenueCategory) ?? defaultRevenue?.id;
      const cashAccountId = mappingByCategory.get("cash") ?? defaultCash?.id;
      const revenueAcct = revenueAccountId ? accountById.get(revenueAccountId) : null;
      const cashAcct = cashAccountId ? accountById.get(cashAccountId) : null;

      rows.push({
        date: txn.created_at.slice(0, 10),
        description: txn.description || `POS Refund (${txn.location})`,
        debitAccount: revenueAcct?.account_number ?? "4000",
        debitAccountName: revenueAcct?.name ?? "Revenue",
        creditAccount: cashAcct?.account_number ?? "1000",
        creditAccountName: cashAcct?.name ?? "Cash",
        amount: Number(txn.total),
        reference: txn.id.slice(0, 8),
        memberName: null,
        source: "refund",
      });
      continue;
    }

    // Regular sale
    const revenueCategory = mapPOSLocationToCategory(txn.location);
    const revenueAccountId = mappingByCategory.get(revenueCategory) ?? defaultRevenue?.id;
    const cashAccountId = mappingByCategory.get("cash") ?? defaultCash?.id;
    const revenueAcct = revenueAccountId ? accountById.get(revenueAccountId) : null;
    const cashAcct = cashAccountId ? accountById.get(cashAccountId) : null;

    rows.push({
      date: txn.created_at.slice(0, 10),
      description: txn.description || `POS Sale (${txn.location})`,
      debitAccount: cashAcct?.account_number ?? "1000",
      debitAccountName: cashAcct?.name ?? "Cash",
      creditAccount: revenueAcct?.account_number ?? "4000",
      creditAccountName: revenueAcct?.name ?? "Revenue",
      amount: Number(txn.total),
      reference: txn.id.slice(0, 8),
      memberName: null,
      source: "pos_transaction",
    });
  }

  // Sort by date
  rows.sort((a, b) => a.date.localeCompare(b.date));

  // 4. Generate export in requested format
  switch (format) {
    case "iif":
      return generateIIF(rows, dateFrom, dateTo);
    case "csv":
      return generateCSV(rows, dateFrom, dateTo);
    case "qbo":
      // QBO uses the same CSV format but with QuickBooks Online column headers
      return generateCSV(rows, dateFrom, dateTo);
    default:
      return generateCSV(rows, dateFrom, dateTo);
  }
}

function mapPOSLocationToCategory(location: string): string {
  switch (location) {
    case "dining": return "dining_revenue";
    case "bar": return "bar_revenue";
    case "pro_shop": return "pro_shop_revenue";
    case "snack_bar": return "snack_bar_revenue";
    default: return "other_revenue";
  }
}
