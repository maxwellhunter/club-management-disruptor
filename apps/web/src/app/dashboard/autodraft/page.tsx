"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Zap,
  Settings,
  Play,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  DollarSign,
  Users,
  CreditCard,
  Ban,
  RefreshCw,
  Eye,
} from "lucide-react";

interface AutodraftSettings {
  enabled: boolean;
  draft_day_of_month: number;
  grace_period_days: number;
  retry_failed: boolean;
  max_retries: number;
  notify_members: boolean;
  advance_notice_days: number;
}

interface AutodraftRun {
  id: string;
  period: string;
  status: string;
  members_attempted: number;
  members_succeeded: number;
  members_failed: number;
  members_skipped: number;
  total_collected: number;
  total_failed: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface AutodraftItemRow {
  id: string;
  member_id: string;
  member_name: string;
  member_number: string | null;
  payment_method_label: string | null;
  payment_method_type: string | null;
  amount: number;
  status: string;
  failure_reason: string | null;
}

interface Stats {
  members_with_payment_method: number;
  total_active_members: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const STATUS_BADGES: Record<string, { bg: string; icon: React.ReactNode }> = {
  succeeded: { bg: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300", icon: <CheckCircle2 className="h-3 w-3" /> },
  processing: { bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300", icon: <Clock className="h-3 w-3" /> },
  failed: { bg: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300", icon: <XCircle className="h-3 w-3" /> },
  skipped: { bg: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", icon: <Ban className="h-3 w-3" /> },
  requires_action: { bg: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300", icon: <AlertCircle className="h-3 w-3" /> },
  pending: { bg: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", icon: <Clock className="h-3 w-3" /> },
};

export default function AutodraftPage() {
  const now = new Date();
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [settings, setSettings] = useState<AutodraftSettings>({
    enabled: false,
    draft_day_of_month: 15,
    grace_period_days: 10,
    retry_failed: true,
    max_retries: 2,
    notify_members: true,
    advance_notice_days: 3,
  });
  const [runs, setRuns] = useState<AutodraftRun[]>([]);
  const [items, setItems] = useState<AutodraftItemRow[]>([]);
  const [stats, setStats] = useState<Stats>({ members_with_payment_method: 0, total_active_members: 0 });
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/billing/autodraft?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setRuns(data.runs ?? []);
        setItems(data.items ?? []);
        setStats(data.stats);
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

  async function handleRunDraft(dryRun: boolean) {
    setRunning(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/billing/autodraft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, dry_run: dryRun }),
      });
      const data = await res.json();

      if (res.ok) {
        const label = dryRun ? "Preview" : "Auto-draft";
        setStatusMsg({
          type: data.failed > 0 ? "info" : "success",
          text: `${label}: ${data.succeeded} succeeded, ${data.failed} failed, ${data.skipped} skipped — ${fmt(data.totalCollected)} collected`,
        });
        fetchData();
      } else {
        setStatusMsg({ type: "error", text: data.error ?? "Failed to run auto-draft." });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Request failed." });
    } finally {
      setRunning(false);
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/billing/autodraft", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setStatusMsg({ type: "success", text: "Settings saved." });
        setShowSettings(false);
      }
    } catch {
      setStatusMsg({ type: "error", text: "Failed to save settings." });
    } finally {
      setSavingSettings(false);
    }
  }

  // Period picker
  const monthOptions: { label: string; value: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push({
      label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    });
  }

  const latestRun = runs[0] ?? null;
  const coverage = stats.total_active_members > 0
    ? Math.round((stats.members_with_payment_method / stats.total_active_members) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-[var(--primary)]" />
            Auto-Draft
          </h1>
          <p className="text-[var(--muted-foreground)]">
            Automatically collect payments from members with bank accounts or cards on file.
          </p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>
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
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {statusMsg.text}
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <h3 className="text-sm font-semibold">Auto-Draft Settings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="rounded border-zinc-300 text-[var(--primary)]"
              />
              <span className="text-sm">Enable auto-draft</span>
            </label>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Draft day of month</label>
              <input
                type="number"
                min={1}
                max={28}
                value={settings.draft_day_of_month}
                onChange={(e) => setSettings({ ...settings, draft_day_of_month: Number(e.target.value) })}
                className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Grace period (days after statement)</label>
              <input
                type="number"
                min={0}
                max={30}
                value={settings.grace_period_days}
                onChange={(e) => setSettings({ ...settings, grace_period_days: Number(e.target.value) })}
                className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Advance notice (days before draft)</label>
              <input
                type="number"
                min={0}
                max={14}
                value={settings.advance_notice_days}
                onChange={(e) => setSettings({ ...settings, advance_notice_days: Number(e.target.value) })}
                className="mt-1 block w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900"
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.retry_failed}
                onChange={(e) => setSettings({ ...settings, retry_failed: e.target.checked })}
                className="rounded border-zinc-300 text-[var(--primary)]"
              />
              <span className="text-sm">Retry failed drafts (up to {settings.max_retries}x)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notify_members}
                onChange={(e) => setSettings({ ...settings, notify_members: e.target.checked })}
                className="rounded border-zinc-300 text-[var(--primary)]"
              />
              <span className="text-sm">Email members before drafting</span>
            </label>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="bg-[var(--primary)] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      )}

      {/* Period + Actions */}
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
                className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-900 text-sm outline-none"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={fetchData}
              className="mt-5 rounded-lg border border-zinc-300 dark:border-zinc-700 p-2 hover:bg-[var(--muted)] transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleRunDraft(true)}
              disabled={running}
              className="flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm hover:bg-[var(--muted)] disabled:opacity-50 transition-colors"
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
            <button
              onClick={() => handleRunDraft(false)}
              disabled={running}
              className="flex items-center gap-2 bg-[var(--primary)] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {running ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Auto-Draft
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard icon={<CreditCard className="h-5 w-5" />} label="On Autopay" value={`${stats.members_with_payment_method} / ${stats.total_active_members}`} sub={`${coverage}% coverage`} />
            {latestRun && (
              <>
                <StatCard icon={<DollarSign className="h-5 w-5" />} label="Collected" value={fmt(latestRun.total_collected)} valueColor="text-green-600" />
                <StatCard icon={<Users className="h-5 w-5" />} label="Succeeded" value={`${latestRun.members_succeeded}`} sub={`of ${latestRun.members_attempted} attempted`} />
                <StatCard
                  icon={<AlertCircle className="h-5 w-5" />}
                  label="Status"
                  value={latestRun.status.charAt(0).toUpperCase() + latestRun.status.slice(1)}
                  valueColor={
                    latestRun.status === "completed" ? "text-green-600" :
                    latestRun.status === "partial" ? "text-amber-600" :
                    latestRun.status === "failed" ? "text-red-600" : ""
                  }
                />
              </>
            )}
          </div>

          {/* Item details */}
          {items.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="text-sm font-semibold">Draft Results ({items.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--muted)] text-[var(--muted-foreground)] text-xs font-medium">
                      <th className="text-left px-4 py-2.5">Member</th>
                      <th className="text-left px-3 py-2.5">Payment Method</th>
                      <th className="text-right px-3 py-2.5">Amount</th>
                      <th className="text-center px-3 py-2.5">Status</th>
                      <th className="text-left px-3 py-2.5">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const badge = STATUS_BADGES[item.status] ?? STATUS_BADGES.pending;
                      return (
                        <tr key={item.id} className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-[var(--muted)]/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.member_name}</span>
                              {item.member_number && (
                                <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">
                                  #{item.member_number}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-[var(--muted-foreground)]">
                            {item.payment_method_label ?? "—"}
                          </td>
                          <td className="text-right px-3 py-3 font-medium tabular-nums">
                            {fmt(item.amount)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${badge.bg}`}>
                              {badge.icon}
                              {item.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs text-[var(--muted-foreground)] max-w-[200px] truncate">
                            {item.failure_reason ?? ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {latestRun?.error_message && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
              <p className="font-medium mb-1">Errors:</p>
              <pre className="whitespace-pre-wrap text-xs">{latestRun.error_message}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex items-center gap-2 text-[var(--muted-foreground)] mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-lg font-bold tabular-nums ${valueColor ?? ""}`}>{value}</p>
      {sub && <p className="text-xs text-[var(--muted-foreground)]">{sub}</p>}
    </div>
  );
}
