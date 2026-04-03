import type { JournalRow, ExportResult } from "./types";

/**
 * Generate a QuickBooks Desktop IIF (Intuit Interchange Format) export.
 * IIF is a tab-delimited format with header rows (!TRNS, !SPL, !ENDTRNS).
 */
export function generateIIF(rows: JournalRow[], dateFrom: string, dateTo: string): ExportResult {
  const lines: string[] = [];
  let totalDebits = 0;
  let totalCredits = 0;

  // IIF header rows
  lines.push(["!TRNS", "TRNSID", "TRNSTYPE", "DATE", "ACCNT", "NAME", "AMOUNT", "DOCNUM", "MEMO"].join("\t"));
  lines.push(["!SPL", "SPLID", "TRNSTYPE", "DATE", "ACCNT", "NAME", "AMOUNT", "DOCNUM", "MEMO"].join("\t"));
  lines.push("!ENDTRNS");

  for (const row of rows) {
    const date = formatIIFDate(row.date);
    const trnsType = mapSourceToTrnsType(row.source);

    // TRNS line (debit)
    lines.push([
      "TRNS",
      "",
      trnsType,
      date,
      row.debitAccountName,
      row.memberName ?? "",
      row.amount.toFixed(2),
      row.reference ?? "",
      row.description,
    ].join("\t"));
    totalDebits += row.amount;

    // SPL line (credit — negative amount)
    lines.push([
      "SPL",
      "",
      trnsType,
      date,
      row.creditAccountName,
      row.memberName ?? "",
      (-row.amount).toFixed(2),
      row.reference ?? "",
      row.description,
    ].join("\t"));
    totalCredits += row.amount;

    lines.push("ENDTRNS");
  }

  return {
    content: lines.join("\r\n"),
    filename: `gl-export-${dateFrom}-to-${dateTo}.iif`,
    mimeType: "application/x-iif",
    entryCount: rows.length,
    totalDebits,
    totalCredits,
  };
}

/** IIF dates are MM/DD/YYYY */
function formatIIFDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${m}/${d}/${y}`;
}

function mapSourceToTrnsType(source: string): string {
  switch (source) {
    case "invoice": return "INVOICE";
    case "payment": return "PAYMENT";
    case "pos_transaction": return "CASH SALE";
    case "refund": return "CREDIT MEMO";
    default: return "GENERAL JOURNAL";
  }
}
