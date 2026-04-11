"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Send,
  Eye,
  Trash2,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  Users,
  Mail,
  RefreshCw,
} from "lucide-react";

interface StatementRun {
  id: string;
  period: string;
  status: string;
  members_processed: number;
  statements_sent: number;
  total_amount: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface MemberStatementRow {
  id: string;
  member_id: string;
  member_name: string;
  member_email: string;
  member_number: string | null;
  tier_name: string | null;
  dues_amount: number;
  charges_amount: number;
  assessments_amount: number;
  credits_amount: number;
  previous_balance: number;
  total_due: number;
  email_sent: boolean;
  pdf_generated: boolean;
}

interface Preview {
  memberCount: number;
  totalDues: number;
  totalCharges: number;
  totalAssessments: number;
  totalCredits: number;
  totalPreviousBalance: number;
  estimatedTotal: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default function StatementsPage() {
  const now = new Date();
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [run, setRun] = useState<StatementRun | null>(null);
  const [memberStatements, setMemberStatements] = useState<MemberStatementRow[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendEmails, setSendEmails] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch existing run + preview in parallel
      const [runRes, previewRes] = await Promise.all([
        fetch(`/api/billing/statements?period=${period}`),
        fetch(`/api/billing/statements?period=${period}&preview=true`),
      ]);

      if (runRes.ok) {
        const data = await runRes.json();
        const latestRun = data.runs?.[0] ?? null;
        setRun(latestRun);
        setMemberStatements(data.member_statements ?? []);
      }

      if (previewRes.ok) {
        const data = await previewRes.json();
        setPreview(data.preview ?? null);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
    setStatusMsg(null);
  }, [fetchData]);

  async function handleGenerate() {
    setGenerating(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/billing/statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, send_emails: sendEmails }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatusMsg({
          type: "success",
          text: `Generated ${data.members_processed} statements (${fmt(data.total_amount)} total)${data.statements_sent > 0 ? ` — ${data.statements_sent} emails sent` : ""}`,
        });
        fetchData();
      } else if (res.status === 409) {
        setStatusMsg({
          type: "info",
          text: data.error ?? "Statements already generated for this period.",
        });
      } else {
        setStatusMsg({
          type: "error",
          text: data.error ?? "Failed to generate statements.",
        });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Request failed. Please try again." });
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete all statements for this period? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/billing/statements?period=${period}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setStatusMsg({ type: "success", text: "Statements deleted. You can regenerate." });
        fetchData();
      } else {
        const data = await res.json();
        setStatusMsg({ type: "error", text: data.error ?? "Failed to delete." });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Delete request failed." });
    } finally {
      setDeleting(false);
    }
  }

  // Period picker options (past 12 months)
  const monthOptions: { label: string; value: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push({
      label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    });
  }

  const periodLabel =
    monthOptions.find((o) => o.value === period)?.label ?? period;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Monthly Statements</h1>
        <p className="text-[var(--muted-foreground)]">
          Generate and send monthly account statements to members.
        </p>
      </div>

      {/* Status message */}
      {statusMsg && (
        <div
          className={`rounded-lg border p-3 text-sm flex items-center gap-2 ${
            statusMsg.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
              : statusMsg.type === "info"
                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {statusMsg.text}
        </div>
      )}

      {/* Period selector + actions */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div>
              <label className="text-xs font-medium text-[var(--muted-foreground)] block mb-1">
                Billing Period
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchData}
              className="mt-5 rounded-lg border border-zinc-300 dark:border-zinc-700 p-2 hover:bg-[var(--muted)] transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {run && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting..." : "Delete & Redo"}
              </button>
            )}

            {!run && (
              <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendEmails}
                  onChange={(e) => setSendEmails(e.target.checked)}
                  className="rounded border-zinc-300 text-[var(--primary)] focus:ring-[var(--ring)]"
                />
                <Mail className="h-4 w-4" />
                Send emails
              </label>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating || !!run}
              className="flex items-center gap-2 bg-[var(--primary)] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {generating ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Generating...
                </>
              ) : run ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Generated
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Generate Statements
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse"
            />
          ))}
        </div>
      ) : run ? (
        <>
          {/* Run summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="Members"
              value={String(run.members_processed)}
            />
            <StatCard
              icon={<DollarSign className="h-5 w-5" />}
              label="Total Due"
              value={fmt(run.total_amount)}
            />
            <StatCard
              icon={<Send className="h-5 w-5" />}
              label="Emails Sent"
              value={String(run.statements_sent)}
            />
            <StatCard
              icon={<Clock className="h-5 w-5" />}
              label="Status"
              value={run.status.charAt(0).toUpperCase() + run.status.slice(1)}
              valueColor={
                run.status === "completed"
                  ? "text-green-600"
                  : run.status === "failed"
                    ? "text-red-600"
                    : "text-amber-600"
              }
            />
          </div>

          {run.error_message && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
              <p className="font-medium mb-1">Warnings/Errors:</p>
              <pre className="whitespace-pre-wrap text-xs">{run.error_message}</pre>
            </div>
          )}

          {/* Member statements table */}
          {memberStatements.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="text-sm font-semibold">
                  Member Statements ({memberStatements.length})
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--muted)] text-[var(--muted-foreground)] text-xs font-medium">
                      <th className="text-left px-4 py-2.5">Member</th>
                      <th className="text-right px-3 py-2.5">Prev. Bal</th>
                      <th className="text-right px-3 py-2.5">Dues</th>
                      <th className="text-right px-3 py-2.5">Charges</th>
                      <th className="text-right px-3 py-2.5">Credits</th>
                      <th className="text-right px-3 py-2.5 font-bold">Total Due</th>
                      <th className="text-center px-3 py-2.5">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberStatements.map((stmt) => (
                      <tr
                        key={stmt.id}
                        className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-[var(--muted)]/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{stmt.member_name}</span>
                            {stmt.member_number && (
                              <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">
                                #{stmt.member_number}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {stmt.tier_name ?? "Member"}
                            {stmt.email_sent && (
                              <span className="ml-2 text-green-600">
                                <Mail className="inline h-3 w-3" /> sent
                              </span>
                            )}
                          </p>
                        </td>
                        <td className="text-right px-3 py-3 tabular-nums text-[var(--muted-foreground)]">
                          {stmt.previous_balance > 0 ? fmt(stmt.previous_balance) : "—"}
                        </td>
                        <td className="text-right px-3 py-3 tabular-nums">
                          {stmt.dues_amount > 0 ? fmt(stmt.dues_amount) : "—"}
                        </td>
                        <td className="text-right px-3 py-3 tabular-nums">
                          {stmt.charges_amount > 0 ? fmt(stmt.charges_amount) : "—"}
                        </td>
                        <td className="text-right px-3 py-3 tabular-nums text-green-600">
                          {stmt.credits_amount > 0 ? `-${fmt(stmt.credits_amount)}` : "—"}
                        </td>
                        <td className="text-right px-3 py-3 tabular-nums font-bold">
                          <span className={stmt.total_due > 0 ? "text-red-600" : "text-green-600"}>
                            {fmt(stmt.total_due)}
                          </span>
                        </td>
                        <td className="text-center px-3 py-3">
                          <a
                            href={`/api/billing/statements/${stmt.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-[var(--muted)] transition-colors"
                          >
                            <Download className="h-3 w-3" />
                            PDF
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : preview ? (
        /* Preview card when no statements generated yet */
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="h-5 w-5 text-[var(--muted-foreground)]" />
            <h3 className="text-sm font-semibold">Preview — {periodLabel}</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Active Members</p>
              <p className="text-lg font-bold">{preview.memberCount}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Previous Balance</p>
              <p className="text-lg font-bold tabular-nums">
                {preview.totalPreviousBalance > 0 ? fmt(preview.totalPreviousBalance) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Dues</p>
              <p className="text-lg font-bold tabular-nums">
                {preview.totalDues > 0 ? fmt(preview.totalDues) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Member Charges</p>
              <p className="text-lg font-bold tabular-nums">
                {preview.totalCharges > 0 ? fmt(preview.totalCharges) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Assessments</p>
              <p className="text-lg font-bold tabular-nums">
                {preview.totalAssessments > 0 ? fmt(preview.totalAssessments) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Credits</p>
              <p className="text-lg font-bold tabular-nums text-green-600">
                {preview.totalCredits > 0 ? `-${fmt(preview.totalCredits)}` : "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-700">
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Estimated Total</p>
              <p className="text-2xl font-bold tabular-nums">
                {fmt(preview.estimatedTotal)}
              </p>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] max-w-xs text-right">
              This is an estimate. The actual statements will compute per-member
              balances including all invoices, charges, and payments.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
          <FileText className="h-8 w-8 text-[var(--muted-foreground)]/30 mx-auto mb-2" />
          <p className="text-sm text-[var(--muted-foreground)]">
            No data available for this period.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex items-center gap-2 text-[var(--muted-foreground)] mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-lg font-bold tabular-nums ${valueColor ?? ""}`}>
        {value}
      </p>
    </div>
  );
}
