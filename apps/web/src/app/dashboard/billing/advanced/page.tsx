"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  TrendingDown,
  Building2,
  Users,
  Play,
  Plus,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  ChevronDown,
} from "lucide-react";
import type {
  AdvancedBillingSummary,
  SpendingMinimumWithTier,
  Assessment,
  BillingCycle,
  FamilyBillingInfo,
  MembershipTierLevel,
} from "@club/shared";

type Tab = "overview" | "minimums" | "assessments" | "families" | "cycles";

export default function AdvancedBillingPage() {
  const [summary, setSummary] = useState<AdvancedBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showCreateMinimum, setShowCreateMinimum] = useState(false);
  const [showCreateAssessment, setShowCreateAssessment] = useState(false);
  const [showRunCycle, setShowRunCycle] = useState(false);
  const [tiers, setTiers] = useState<{ id: string; name: string; level: MembershipTierLevel }[]>([]);

  const fetchSummary = useCallback(async () => {
    try {
      const [summaryRes, membersRes] = await Promise.all([
        fetch("/api/billing/advanced"),
        fetch("/api/members"),
      ]);
      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (membersRes.ok) {
        const data = await membersRes.json();
        if (data.tiers) setTiers(data.tiers);
      }
    } catch (err) {
      console.error("Failed to fetch advanced billing:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  }

  function formatDate(d: string) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "minimums", label: "Spending Minimums" },
    { key: "assessments", label: "Assessments" },
    { key: "families", label: "Family Billing" },
    { key: "cycles", label: "Billing Cycles" },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Advanced Billing</h1>
          <p className="text-[var(--muted-foreground)]">Minimums, assessments, and family billing</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Advanced Billing</h1>
          <p className="text-[var(--muted-foreground)]">Minimum spending, capital assessments, and family consolidation</p>
        </div>
        <button
          onClick={() => setShowRunCycle(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
        >
          <Play className="h-4 w-4" />
          Run Billing Cycle
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab summary={summary} formatCurrency={formatCurrency} />}
      {activeTab === "minimums" && (
        <MinimumsTab
          minimums={summary?.spending_minimums ?? []}
          tiers={tiers}
          showCreate={showCreateMinimum}
          onShowCreate={setShowCreateMinimum}
          onRefresh={fetchSummary}
          formatCurrency={formatCurrency}
        />
      )}
      {activeTab === "assessments" && (
        <AssessmentsTab
          assessments={summary?.assessments ?? []}
          tiers={tiers}
          showCreate={showCreateAssessment}
          onShowCreate={setShowCreateAssessment}
          onRefresh={fetchSummary}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />
      )}
      {activeTab === "families" && (
        <FamiliesTab
          families={summary?.families ?? []}
          onRefresh={fetchSummary}
          formatCurrency={formatCurrency}
        />
      )}
      {activeTab === "cycles" && (
        <CyclesTab
          cycles={summary?.recent_cycles ?? []}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />
      )}

      {/* Run Billing Cycle Modal */}
      {showRunCycle && (
        <RunCycleModal
          assessments={summary?.assessments?.filter((a) => a.status === "draft" && !a.invoices_generated) ?? []}
          onClose={() => setShowRunCycle(false)}
          onSuccess={() => { setShowRunCycle(false); fetchSummary(); }}
        />
      )}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────
function OverviewTab({
  summary,
  formatCurrency,
}: {
  summary: AdvancedBillingSummary | null;
  formatCurrency: (n: number) => string;
}) {
  if (!summary) return null;
  const s = summary.stats;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={TrendingDown} label="Active Minimums" value={String(s.active_minimums)} />
        <StatCard icon={Building2} label="Active Assessments" value={String(s.active_assessments)} />
        <StatCard icon={Users} label="Families (Consolidated)" value={String(s.families_with_consolidation)} />
        <StatCard icon={DollarSign} label="Total Assessed" value={formatCurrency(s.total_assessed)} />
        <StatCard icon={DollarSign} label="Total Collected" value={formatCurrency(s.total_collected)} />
        <StatCard
          icon={AlertTriangle}
          label="Pending Shortfalls"
          value={String(s.shortfall_pending)}
          highlight={s.shortfall_pending > 0}
        />
      </div>

      {/* Quick summary of recent cycles */}
      {summary.recent_cycles.length > 0 && (
        <div className="rounded-xl border border-[var(--border)]">
          <div className="p-5 border-b border-[var(--border)]">
            <h2 className="font-semibold">Recent Billing Cycles</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {summary.recent_cycles.slice(0, 5).map((cycle) => (
              <div key={cycle.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium capitalize">{cycle.type.replace("_", " ")}</span>
                  <span className="text-xs text-[var(--muted-foreground)] ml-2">
                    {cycle.period_start} to {cycle.period_end}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm">{cycle.invoices_created} invoices</span>
                  <CycleStatusBadge status={cycle.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Spending Minimums Tab ──────────────────────────────────────
function MinimumsTab({
  minimums,
  tiers,
  showCreate,
  onShowCreate,
  onRefresh,
  formatCurrency,
}: {
  minimums: SpendingMinimumWithTier[];
  tiers: { id: string; name: string; level: MembershipTierLevel }[];
  showCreate: boolean;
  onShowCreate: (v: boolean) => void;
  onRefresh: () => void;
  formatCurrency: (n: number) => string;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tier_id: "",
    name: "",
    category: "dining" as string,
    amount: "",
    period: "monthly" as string,
    enforce_shortfall: true,
  });

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetch("/api/billing/minimums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
      });
      if (res.ok) {
        onShowCreate(false);
        setForm({ tier_id: "", name: "", category: "dining", amount: "", period: "monthly", enforce_shortfall: true });
        onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create minimum");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Deactivate this spending minimum?")) return;
    const res = await fetch(`/api/billing/minimums?id=${id}`, { method: "DELETE" });
    if (res.ok) onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted-foreground)]">
          Set minimum spending thresholds per tier. Members who don&apos;t meet the minimum get charged the shortfall.
        </p>
        <button
          onClick={() => onShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Minimum
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-[var(--border)] p-5 space-y-4 bg-[var(--muted)]">
          <h3 className="font-semibold">New Spending Minimum</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Tier</label>
              <select
                value={form.tier_id}
                onChange={(e) => setForm({ ...form, tier_id: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="">Select tier...</option>
                {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="F&B Minimum"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="dining">Dining</option>
                <option value="pro_shop">Pro Shop</option>
                <option value="bar">Bar</option>
                <option value="total">Total Spending</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Amount ($)</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="500.00"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Period</label>
              <select
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <button
                onClick={() => setForm({ ...form, enforce_shortfall: !form.enforce_shortfall })}
                className="text-[var(--primary)]"
              >
                {form.enforce_shortfall ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
              </button>
              <span className="text-sm">Auto-invoice shortfall</span>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => onShowCreate(false)} className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--background)]">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={saving || !form.tier_id || !form.name || !form.amount} className="px-3 py-1.5 text-sm rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50">
              {saving ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Minimums list */}
      <div className="rounded-xl border border-[var(--border)]">
        {minimums.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Name</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Tier</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Category</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Amount</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Period</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Enforce</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {minimums.map((m) => (
                  <tr key={m.id} className="hover:bg-[var(--muted)]/50">
                    <td className="px-5 py-3 font-medium">{m.name}</td>
                    <td className="px-5 py-3">{m.tier_name}</td>
                    <td className="px-5 py-3 capitalize">{m.category.replace("_", " ")}</td>
                    <td className="px-5 py-3">{formatCurrency(m.amount)}</td>
                    <td className="px-5 py-3 capitalize">{m.period}</td>
                    <td className="px-5 py-3">{m.enforce_shortfall ? "Yes" : "No"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${m.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                        {m.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {m.is_active && (
                        <button onClick={() => handleDeactivate(m.id)} className="text-xs text-red-600 hover:underline">
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <TrendingDown className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-2" />
            <p className="text-sm text-[var(--muted-foreground)]">No spending minimums configured yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Assessments Tab ──────────────────────────────────────────
function AssessmentsTab({
  assessments,
  tiers,
  showCreate,
  onShowCreate,
  onRefresh,
  formatCurrency,
  formatDate,
}: {
  assessments: Assessment[];
  tiers: { id: string; name: string; level: MembershipTierLevel }[];
  showCreate: boolean;
  onShowCreate: (v: boolean) => void;
  onRefresh: () => void;
  formatCurrency: (n: number) => string;
  formatDate: (d: string) => string;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "capital_improvement" as string,
    amount: "",
    target_all_members: true,
    target_tier_ids: [] as string[],
    due_date: "",
    allow_installments: false,
    installment_count: 1,
  });

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetch("/api/billing/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          target_tier_ids: form.target_all_members ? null : form.target_tier_ids,
        }),
      });
      if (res.ok) {
        onShowCreate(false);
        setForm({ name: "", description: "", type: "capital_improvement", amount: "", target_all_members: true, target_tier_ids: [], due_date: "", allow_installments: false, installment_count: 1 });
        onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create assessment");
      }
    } finally {
      setSaving(false);
    }
  }

  function assessmentStatusBadge(status: string) {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      active: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-800"}`}>
        {status}
      </span>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted-foreground)]">
          Capital improvements, seasonal assessments, and special charges applied across members.
        </p>
        <button
          onClick={() => onShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Assessment
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-[var(--border)] p-5 space-y-4 bg-[var(--muted)]">
          <h3 className="font-semibold">New Assessment</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="2026 Clubhouse Renovation"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="capital_improvement">Capital Improvement</option>
                <option value="seasonal">Seasonal</option>
                <option value="special">Special Assessment</option>
                <option value="initiation">Initiation Fee</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Amount per Member ($)</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="5000.00"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Target</label>
              <select
                value={form.target_all_members ? "all" : "tiers"}
                onChange={(e) => setForm({ ...form, target_all_members: e.target.value === "all" })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="all">All Active Members</option>
                <option value="tiers">Specific Tiers</option>
              </select>
            </div>
            {!form.target_all_members && (
              <div>
                <label className="block text-sm font-medium mb-1">Select Tiers</label>
                <div className="space-y-1">
                  {tiers.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.target_tier_ids.includes(t.id)}
                        onChange={(e) => {
                          setForm({
                            ...form,
                            target_tier_ids: e.target.checked
                              ? [...form.target_tier_ids, t.id]
                              : form.target_tier_ids.filter((id) => id !== t.id),
                          });
                        }}
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.allow_installments}
                  onChange={(e) => setForm({ ...form, allow_installments: e.target.checked })}
                />
                Allow Installments
              </label>
              {form.allow_installments && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={2}
                    max={60}
                    value={form.installment_count}
                    onChange={(e) => setForm({ ...form, installment_count: parseInt(e.target.value) || 1 })}
                    className="w-20 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
                  />
                  <span className="text-sm text-[var(--muted-foreground)]">payments</span>
                </div>
              )}
            </div>
          </div>
          {form.allow_installments && form.amount && form.installment_count > 1 && (
            <p className="text-sm text-[var(--muted-foreground)]">
              Each installment: {formatCurrency(parseFloat(form.amount) / form.installment_count)} x {form.installment_count} payments
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => onShowCreate(false)} className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--background)]">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={saving || !form.name || !form.amount || !form.due_date} className="px-3 py-1.5 text-sm rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50">
              {saving ? "Creating..." : "Create Assessment"}
            </button>
          </div>
        </div>
      )}

      {/* Assessments list */}
      <div className="rounded-xl border border-[var(--border)]">
        {assessments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Name</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Type</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Amount</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Due</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Installments</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Status</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)] text-right">Collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {assessments.map((a) => (
                  <tr key={a.id} className="hover:bg-[var(--muted)]/50">
                    <td className="px-5 py-3 font-medium">{a.name}</td>
                    <td className="px-5 py-3 capitalize">{a.type.replace("_", " ")}</td>
                    <td className="px-5 py-3">{formatCurrency(a.amount)}</td>
                    <td className="px-5 py-3">{formatDate(a.due_date)}</td>
                    <td className="px-5 py-3">{a.allow_installments ? `${a.installment_count}x` : "—"}</td>
                    <td className="px-5 py-3">{assessmentStatusBadge(a.status)}</td>
                    <td className="px-5 py-3 text-right">
                      {a.total_assessed > 0
                        ? `${formatCurrency(a.total_collected)} / ${formatCurrency(a.total_assessed)}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <Building2 className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-2" />
            <p className="text-sm text-[var(--muted-foreground)]">No assessments created yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Family Billing Tab ──────────────────────────────────────
function FamiliesTab({
  families,
  onRefresh,
  formatCurrency,
}: {
  families: FamilyBillingInfo[];
  onRefresh: () => void;
  formatCurrency: (n: number) => string;
}) {
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);

  async function toggleConsolidation(familyId: string, current: boolean) {
    const res = await fetch("/api/billing/families", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ family_id: familyId, billing_consolidated: !current }),
    });
    if (res.ok) onRefresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted-foreground)]">
        When consolidated, all family member charges are billed to the primary member in a single statement.
      </p>

      {families.length > 0 ? (
        <div className="space-y-3">
          {families.map((fam) => (
            <div key={fam.family_id} className="rounded-xl border border-[var(--border)]">
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--muted)]/50"
                onClick={() => setExpandedFamily(expandedFamily === fam.family_id ? null : fam.family_id)}
              >
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-[var(--muted-foreground)]" />
                  <div>
                    <p className="font-medium">{fam.family_name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Primary: {fam.primary_member_name} &bull; {fam.members.length} members
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatCurrency(fam.total_outstanding)}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">outstanding</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleConsolidation(fam.family_id, fam.billing_consolidated); }}
                    className={`text-sm px-2 py-1 rounded ${fam.billing_consolidated ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                  >
                    {fam.billing_consolidated ? "Consolidated" : "Individual"}
                  </button>
                  <ChevronDown className={`h-4 w-4 transition-transform ${expandedFamily === fam.family_id ? "rotate-180" : ""}`} />
                </div>
              </div>

              {expandedFamily === fam.family_id && (
                <div className="border-t border-[var(--border)] p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="pb-2 font-medium text-[var(--muted-foreground)]">Member</th>
                        <th className="pb-2 font-medium text-[var(--muted-foreground)] text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {fam.members.map((m) => (
                        <tr key={m.id}>
                          <td className="py-2">
                            {m.first_name} {m.last_name}
                            {m.id === fam.primary_member_id && (
                              <span className="ml-2 text-xs bg-[var(--primary)] text-[var(--primary-foreground)] px-1.5 py-0.5 rounded">Primary</span>
                            )}
                          </td>
                          <td className="py-2 text-right">{formatCurrency(m.outstanding_balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center">
          <Users className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-2" />
          <p className="text-sm text-[var(--muted-foreground)]">No families configured. Create families in the Members section to enable consolidated billing.</p>
        </div>
      )}
    </div>
  );
}

// ── Billing Cycles Tab ──────────────────────────────────────
function CyclesTab({
  cycles,
  formatCurrency,
  formatDate,
}: {
  cycles: BillingCycle[];
  formatCurrency: (n: number) => string;
  formatDate: (d: string) => string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted-foreground)]">
        History of automated billing runs. Each cycle generates invoices for the specified period.
      </p>

      <div className="rounded-xl border border-[var(--border)]">
        {cycles.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Type</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Period</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Invoices</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Total</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Status</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Ran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {cycles.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--muted)]/50">
                    <td className="px-5 py-3 font-medium capitalize">{c.type.replace("_", " ")}</td>
                    <td className="px-5 py-3">{c.period_start} to {c.period_end}</td>
                    <td className="px-5 py-3">{c.invoices_created}</td>
                    <td className="px-5 py-3">{formatCurrency(c.total_amount)}</td>
                    <td className="px-5 py-3"><CycleStatusBadge status={c.status} /></td>
                    <td className="px-5 py-3 text-[var(--muted-foreground)]">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <Clock className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-2" />
            <p className="text-sm text-[var(--muted-foreground)]">No billing cycles run yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Run Billing Cycle Modal ──────────────────────────────────
function RunCycleModal({
  assessments,
  onClose,
  onSuccess,
}: {
  assessments: Assessment[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [type, setType] = useState<string>("dues");
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return lastDay.toISOString().split("T")[0];
  });
  const [assessmentId, setAssessmentId] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ invoices_created: number; total_amount: number; errors: string[] } | null>(null);

  async function handleRun() {
    setRunning(true);
    try {
      const res = await fetch("/api/billing/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          period_start: periodStart,
          period_end: periodEnd,
          ...(type === "assessment" ? { assessment_id: assessmentId } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        alert(data.error || "Failed to run billing cycle");
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[var(--background)] rounded-xl border border-[var(--border)] p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Run Billing Cycle</h2>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">Billing cycle complete</span>
              </div>
              <p className="text-sm text-green-700">
                Created {result.invoices_created} invoices totaling ${result.total_amount.toFixed(2)}
              </p>
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm font-medium text-amber-800 mb-1">Warnings ({result.errors.length})</p>
                <ul className="text-xs text-amber-700 space-y-1">
                  {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            <button onClick={onSuccess} className="w-full py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] font-medium hover:opacity-90">
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cycle Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="dues">Monthly Dues</option>
                <option value="minimum_shortfall">Minimum Spending Shortfalls</option>
                <option value="assessment">Assessment Invoicing</option>
              </select>
            </div>

            {type === "assessment" && (
              <div>
                <label className="block text-sm font-medium mb-1">Assessment</label>
                <select
                  value={assessmentId}
                  onChange={(e) => setAssessmentId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                >
                  <option value="">Select assessment...</option>
                  {assessments.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} — ${a.amount.toFixed(2)}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Period Start</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Period End</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="bg-[var(--muted)] rounded-lg p-3 text-xs text-[var(--muted-foreground)]">
              {type === "dues" && "Generates monthly dues invoices for all active members based on their tier pricing. Family consolidated billing will roll up to the primary member."}
              {type === "minimum_shortfall" && "Calculates spending against minimums and invoices any shortfall. Only members who haven't met their minimum for the period will be charged."}
              {type === "assessment" && "Generates invoices for the selected assessment. If installments are enabled, multiple invoices are created per member."}
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]">
                Cancel
              </button>
              <button
                onClick={handleRun}
                disabled={running || (type === "assessment" && !assessmentId)}
                className="px-4 py-2 text-sm rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] font-medium hover:opacity-90 disabled:opacity-50"
              >
                {running ? "Running..." : "Run Cycle"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared Components ──────────────────────────────────────
function StatCard({ icon: Icon, label, value, highlight }: { icon: React.ElementType; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${highlight ? "text-amber-500" : "text-[var(--muted-foreground)]"}`} />
        <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${highlight ? "text-amber-600" : ""}`}>{value}</p>
    </div>
  );
}

function CycleStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: React.ElementType }> = {
    completed: { color: "bg-green-100 text-green-800", icon: CheckCircle },
    running: { color: "bg-blue-100 text-blue-800", icon: Clock },
    failed: { color: "bg-red-100 text-red-800", icon: XCircle },
    pending: { color: "bg-gray-100 text-gray-800", icon: Clock },
  };
  const cfg = config[status] ?? config.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}
