"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  AccountingSummary,
  GLAccount,
  GLAccountType,
  ExportFormat,
  AccountingProvider,
} from "@club/shared";

type Tab = "overview" | "accounts" | "mappings" | "export" | "history";

export default function AccountingPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<AccountingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/accounting");
      if (res.status === 403) {
        setError("admin");
        return;
      }
      if (!res.ok) throw new Error("Failed to load accounting data");
      setData(await res.json());
    } catch {
      setError("Failed to load accounting data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <LoadingSkeleton />;
  if (error === "admin") return <NoAccess />;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  if (!data) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "accounts", label: "Chart of Accounts" },
    { key: "mappings", label: "GL Mappings" },
    { key: "export", label: "Export" },
    { key: "history", label: "Export History" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Accounting & GL Export</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Manage your chart of accounts, GL mappings, and export to QuickBooks or Sage
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab data={data} />}
      {tab === "accounts" && <AccountsTab accounts={data.glAccounts} onRefresh={fetchData} />}
      {tab === "mappings" && <MappingsTab data={data} onRefresh={fetchData} />}
      {tab === "export" && <ExportTab />}
      {tab === "history" && <HistoryTab exports={data.recentExports} />}
    </div>
  );
}

/* ─── Overview Tab ─── */
function OverviewTab({ data }: { data: AccountingSummary }) {
  const stats = [
    { label: "GL Accounts", value: data.glAccounts.length },
    { label: "Mapped Categories", value: data.mappings.length },
    { label: "Unmapped", value: data.unmappedCategories.length, warn: data.unmappedCategories.length > 0 },
    { label: "Exports", value: data.recentExports.length },
  ];

  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <p className="text-xs text-[var(--muted-foreground)]">{s.label}</p>
            <p className={`text-2xl font-bold ${s.warn ? "text-amber-500" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Period summary */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
        <h3 className="text-sm font-semibold mb-3">Current Month Summary</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Invoiced Revenue</p>
            <p className="text-lg font-bold">{fmt(data.periodSummary.revenue)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Payments Received</p>
            <p className="text-lg font-bold text-[var(--primary)]">{fmt(data.periodSummary.payments)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">POS Sales</p>
            <p className="text-lg font-bold">{fmt(data.periodSummary.posSales)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Outstanding</p>
            <p className="text-lg font-bold text-amber-500">{fmt(data.periodSummary.outstanding)}</p>
          </div>
        </div>
      </div>

      {/* Unmapped categories warning */}
      {data.unmappedCategories.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4">
          <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2">
            Unmapped Revenue Categories
          </h3>
          <p className="text-xs text-amber-600 dark:text-amber-500 mb-2">
            These categories don&apos;t have GL account mappings. Exports will use default accounts.
          </p>
          <div className="flex flex-wrap gap-2">
            {data.unmappedCategories.map((c) => (
              <span
                key={c}
                className="rounded bg-amber-100 dark:bg-amber-900/40 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-300"
              >
                {c.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Chart of Accounts Tab ─── */
function AccountsTab({ accounts, onRefresh }: { accounts: GLAccount[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ account_number: "", name: "", type: "revenue" as GLAccountType, description: "" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/accounting/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to create account");
        return;
      }
      setForm({ account_number: "", name: "", type: "revenue", description: "" });
      setShowForm(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  const typeColors: Record<string, string> = {
    revenue: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    expense: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    asset: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    liability: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    equity: "bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">GL Accounts ({accounts.length})</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          {showForm ? "Cancel" : "Add Account"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Account Number</label>
              <input
                type="text"
                value={form.account_number}
                onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                className="mt-1 block w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
                placeholder="e.g. 4000"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 block w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
                placeholder="e.g. Membership Revenue"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as GLAccountType })}
                className="mt-1 block w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
              >
                <option value="revenue">Revenue</option>
                <option value="expense">Expense</option>
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 block w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
                placeholder="Optional"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create Account"}
          </button>
        </form>
      )}

      <div className="rounded-lg border border-[var(--border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)]">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Number</th>
              <th className="px-4 py-2 text-left font-medium">Name</th>
              <th className="px-4 py-2 text-left font-medium">Type</th>
              <th className="px-4 py-2 text-left font-medium">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                  No GL accounts yet. Add your chart of accounts to get started.
                </td>
              </tr>
            ) : (
              accounts.map((a) => (
                <tr key={a.id} className="hover:bg-[var(--muted)]/50">
                  <td className="px-4 py-2 font-mono">{a.account_number}</td>
                  <td className="px-4 py-2">{a.name}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${typeColors[a.type] ?? ""}`}>
                      {a.type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-[var(--muted-foreground)]">{a.description ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── GL Mappings Tab ─── */
function MappingsTab({ data, onRefresh }: { data: AccountingSummary; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ source_category: "", gl_account_id: "", description: "" });

  const categories = [
    { value: "membership_dues", label: "Membership Dues" },
    { value: "dining_revenue", label: "Dining Revenue" },
    { value: "bar_revenue", label: "Bar Revenue" },
    { value: "pro_shop_revenue", label: "Pro Shop Revenue" },
    { value: "snack_bar_revenue", label: "Snack Bar Revenue" },
    { value: "other_revenue", label: "Other Revenue" },
    { value: "accounts_receivable", label: "Accounts Receivable" },
    { value: "cash", label: "Cash / Bank" },
  ];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/accounting/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Failed to create mapping");
        return;
      }
      setForm({ source_category: "", gl_account_id: "", description: "" });
      setShowForm(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this mapping?")) return;
    await fetch(`/api/accounting/mappings?id=${id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">GL Mappings</h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            Map revenue source categories to GL accounts for accurate exports
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          {showForm ? "Cancel" : "Add Mapping"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium">Source Category</label>
              <select
                value={form.source_category}
                onChange={(e) => setForm({ ...form, source_category: e.target.value })}
                className="mt-1 block w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
                required
              >
                <option value="">Select...</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">GL Account</label>
              <select
                value={form.gl_account_id}
                onChange={(e) => setForm({ ...form, gl_account_id: e.target.value })}
                className="mt-1 block w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
                required
              >
                <option value="">Select...</option>
                {data.glAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_number} — {a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 block w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
                placeholder="Optional"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create Mapping"}
          </button>
        </form>
      )}

      <div className="rounded-lg border border-[var(--border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)]">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Source Category</th>
              <th className="px-4 py-2 text-left font-medium">GL Account</th>
              <th className="px-4 py-2 text-left font-medium">Description</th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {data.mappings.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                  No mappings yet. Map your revenue categories to GL accounts.
                </td>
              </tr>
            ) : (
              data.mappings.map((m) => (
                <tr key={m.id} className="hover:bg-[var(--muted)]/50">
                  <td className="px-4 py-2 capitalize">{m.source_category.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2 font-mono">{m.account_number} — {m.account_name}</td>
                  <td className="px-4 py-2 text-[var(--muted-foreground)]">{m.description ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Export Tab ─── */
function ExportTab() {
  const [form, setForm] = useState({
    format: "csv" as ExportFormat,
    provider: "csv" as AccountingProvider,
    date_from: "",
    date_to: "",
  });
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{
    file: { content: string; filename: string; mimeType: string };
    summary: { entryCount: number; totalDebits: number; totalCredits: number };
  } | null>(null);

  // Sync provider with format
  function handleFormatChange(format: ExportFormat) {
    const provider: AccountingProvider = format === "iif" ? "quickbooks" : format === "qbo" ? "quickbooks" : "csv";
    setForm({ ...form, format, provider });
  }

  async function handleExport(e: React.FormEvent) {
    e.preventDefault();
    setExporting(true);
    setResult(null);
    try {
      const res = await fetch("/api/accounting/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Export failed");
        return;
      }
      setResult(await res.json());
    } finally {
      setExporting(false);
    }
  }

  function handleDownload() {
    if (!result) return;
    const blob = new Blob([result.file.content], { type: result.file.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.file.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Generate GL Export</h3>
        <p className="text-xs text-[var(--muted-foreground)]">
          Export journal entries in your accounting software&apos;s format
        </p>
      </div>

      <form onSubmit={handleExport} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="text-xs font-medium">Format</label>
            <select
              value={form.format}
              onChange={(e) => handleFormatChange(e.target.value as ExportFormat)}
              className="mt-1 block w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
            >
              <option value="csv">CSV (Sage / Xero / Generic)</option>
              <option value="iif">IIF (QuickBooks Desktop)</option>
              <option value="qbo">QBO (QuickBooks Online)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Provider</label>
            <select
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value as AccountingProvider })}
              className="mt-1 block w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
            >
              <option value="quickbooks">QuickBooks</option>
              <option value="sage">Sage</option>
              <option value="xero">Xero</option>
              <option value="csv">Generic CSV</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">From Date</label>
            <input
              type="date"
              value={form.date_from}
              onChange={(e) => setForm({ ...form, date_from: e.target.value })}
              className="mt-1 block w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium">To Date</label>
            <input
              type="date"
              value={form.date_to}
              onChange={(e) => setForm({ ...form, date_to: e.target.value })}
              className="mt-1 block w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={exporting}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {exporting ? "Generating..." : "Generate Export"}
        </button>
      </form>

      {result && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--primary)]">Export Complete</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Entries</p>
              <p className="text-lg font-bold">{result.summary.entryCount}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Total Debits</p>
              <p className="text-lg font-bold">{fmt(result.summary.totalDebits)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Total Credits</p>
              <p className="text-lg font-bold">{fmt(result.summary.totalCredits)}</p>
            </div>
          </div>
          <button
            onClick={handleDownload}
            className="rounded-lg border border-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors"
          >
            Download {result.file.filename}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Export History Tab ─── */
function HistoryTab({ exports: exportHistory }: { exports: AccountingSummary["recentExports"] }) {
  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const statusColors: Record<string, string> = {
    completed: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Recent Exports</h3>
      <div className="rounded-lg border border-[var(--border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--muted)]">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Date</th>
              <th className="px-4 py-2 text-left font-medium">Period</th>
              <th className="px-4 py-2 text-left font-medium">Format</th>
              <th className="px-4 py-2 text-left font-medium">Provider</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Entries</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {exportHistory.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                  No exports yet. Generate your first export from the Export tab.
                </td>
              </tr>
            ) : (
              exportHistory.map((exp) => (
                <tr key={exp.id} className="hover:bg-[var(--muted)]/50">
                  <td className="px-4 py-2">{new Date(exp.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-xs">{exp.date_from} to {exp.date_to}</td>
                  <td className="px-4 py-2 uppercase font-mono text-xs">{exp.format}</td>
                  <td className="px-4 py-2 capitalize">{exp.provider}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[exp.status] ?? ""}`}>
                      {exp.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">{exp.entry_count}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(Number(exp.total_debits))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Loading / No Access ─── */
function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-64 animate-pulse rounded bg-[var(--muted)]" />
      <div className="h-4 w-96 animate-pulse rounded bg-[var(--muted)]" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-[var(--muted)]" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-lg bg-[var(--muted)]" />
    </div>
  );
}

function NoAccess() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <p className="text-lg font-semibold">Admin Access Required</p>
      <p className="text-sm text-[var(--muted-foreground)]">
        Accounting features are available to club administrators only.
      </p>
    </div>
  );
}
