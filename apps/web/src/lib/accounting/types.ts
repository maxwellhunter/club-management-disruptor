/**
 * Internal types for the GL export engine.
 */
export interface JournalRow {
  date: string; // YYYY-MM-DD
  description: string;
  debitAccount: string; // account number
  debitAccountName: string;
  creditAccount: string;
  creditAccountName: string;
  amount: number;
  reference: string | null;
  memberName: string | null;
  source: string;
}

export interface ExportResult {
  content: string;
  filename: string;
  mimeType: string;
  entryCount: number;
  totalDebits: number;
  totalCredits: number;
}
