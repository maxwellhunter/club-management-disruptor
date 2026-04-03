import type { JournalRow, ExportResult } from "./types";

/**
 * Generate a standard CSV export compatible with Sage, Xero, and generic accounting imports.
 * Columns: Date, Reference, Description, Account Number, Account Name, Debit, Credit, Member
 */
export function generateCSV(rows: JournalRow[], dateFrom: string, dateTo: string): ExportResult {
  const headers = [
    "Date",
    "Reference",
    "Description",
    "Account Number",
    "Account Name",
    "Debit",
    "Credit",
    "Source",
    "Member",
  ];

  const lines: string[] = [headers.join(",")];
  let totalDebits = 0;
  let totalCredits = 0;

  for (const row of rows) {
    // Debit line
    lines.push(csvLine([
      row.date,
      row.reference ?? "",
      row.description,
      row.debitAccount,
      row.debitAccountName,
      row.amount.toFixed(2),
      "",
      row.source,
      row.memberName ?? "",
    ]));
    totalDebits += row.amount;

    // Credit line
    lines.push(csvLine([
      row.date,
      row.reference ?? "",
      row.description,
      row.creditAccount,
      row.creditAccountName,
      "",
      row.amount.toFixed(2),
      row.source,
      row.memberName ?? "",
    ]));
    totalCredits += row.amount;
  }

  return {
    content: lines.join("\n"),
    filename: `gl-export-${dateFrom}-to-${dateTo}.csv`,
    mimeType: "text/csv",
    entryCount: rows.length,
    totalDebits,
    totalCredits,
  };
}

function csvLine(fields: string[]): string {
  return fields.map((f) => {
    if (f.includes(",") || f.includes('"') || f.includes("\n")) {
      return `"${f.replace(/"/g, '""')}"`;
    }
    return f;
  }).join(",");
}
