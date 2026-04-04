"use client";

import { useState, useEffect, useCallback } from "react";
import {
  UserPlus,
  Users,
  Calendar,
  DollarSign,
  ShieldX,
  ClipboardCheck,
  LogIn,
  LogOut,
  XCircle,
  Plus,
  Search,
  AlertTriangle,
} from "lucide-react";
import type {
  GuestManagementSummary,
  Guest,
  GuestVisitWithDetails,
  GuestPolicy,
  GuestFeeSchedule,
  MemberRole,
  MembershipTierLevel,
} from "@club/shared";

type Tab = "visits" | "guests" | "policies" | "fees";

export default function GuestsPage() {
  const [data, setData] = useState<GuestManagementSummary & { role: MemberRole } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("visits");
  const [showRegisterVisit, setShowRegisterVisit] = useState(false);
  const [tiers, setTiers] = useState<{ id: string; name: string; level: MembershipTierLevel }[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [guestRes, membersRes] = await Promise.all([
        fetch("/api/guests"),
        fetch("/api/members"),
      ]);
      if (guestRes.ok) setData(await guestRes.json());
      if (membersRes.ok) {
        const mData = await membersRes.json();
        if (mData.tiers) setTiers(mData.tiers);
      }
    } catch (err) {
      console.error("Failed to fetch guest data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isAdmin = data?.role === "admin";

  function formatCurrency(n: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  }

  function formatDate(d: string) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const tabs: { key: Tab; label: string; adminOnly?: boolean }[] = [
    { key: "visits", label: "Visits" },
    { key: "guests", label: "Guest Directory", adminOnly: true },
    { key: "policies", label: "Policies", adminOnly: true },
    { key: "fees", label: "Fee Schedule", adminOnly: true },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Guest Management</h1>
          <p className="text-[var(--muted-foreground)]">Register guests, track visits, and manage policies.</p>
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
          <h1 className="text-2xl font-bold">Guest Management</h1>
          <p className="text-[var(--muted-foreground)]">
            {isAdmin ? "Register guests, track visits, manage policies and fees." : "Register guests and view your visit history."}
          </p>
        </div>
        <button
          onClick={() => setShowRegisterVisit(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
        >
          <UserPlus className="h-4 w-4" />
          Register Guest Visit
        </button>
      </div>

      {/* Stat cards (admin only) */}
      {isAdmin && data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={Users} label="Total Guests" value={String(data.stats.total_guests)} />
          <StatCard icon={Calendar} label="Visits This Month" value={String(data.stats.visits_this_month)} />
          <StatCard icon={DollarSign} label="Guest Fees (MTD)" value={formatCurrency(data.stats.guest_fees_this_month)} />
          <StatCard icon={ClipboardCheck} label="Upcoming" value={String(data.stats.upcoming_visits)} />
          <StatCard icon={ShieldX} label="Blocked" value={String(data.stats.blocked_guests)} highlight={data.stats.blocked_guests > 0} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {tabs.filter((t) => !t.adminOnly || isAdmin).map((tab) => (
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

      {activeTab === "visits" && (
        <VisitsTab visits={data?.recent_visits ?? []} isAdmin={isAdmin} onRefresh={fetchData} formatDate={formatDate} formatCurrency={formatCurrency} />
      )}
      {activeTab === "guests" && isAdmin && (
        <GuestDirectoryTab guests={data?.guests ?? []} onRefresh={fetchData} formatDate={formatDate} />
      )}
      {activeTab === "policies" && isAdmin && (
        <PoliciesTab policies={data?.policies ?? []} onRefresh={fetchData} formatCurrency={formatCurrency} />
      )}
      {activeTab === "fees" && isAdmin && (
        <FeesTab fees={data?.fee_schedules ?? []} tiers={tiers} onRefresh={fetchData} formatCurrency={formatCurrency} />
      )}

      {showRegisterVisit && (
        <RegisterVisitModal
          guests={data?.guests ?? []}
          onClose={() => setShowRegisterVisit(false)}
          onSuccess={() => { setShowRegisterVisit(false); fetchData(); }}
        />
      )}
    </div>
  );
}

// ── Visits Tab ──────────────────────────────────────────
function VisitsTab({
  visits,
  isAdmin,
  onRefresh,
  formatDate,
  formatCurrency,
}: {
  visits: GuestVisitWithDetails[];
  isAdmin: boolean;
  onRefresh: () => void;
  formatDate: (d: string) => string;
  formatCurrency: (n: number) => string;
}) {
  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/guests/visits?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) onRefresh();
    else {
      const data = await res.json();
      alert(data.error || "Failed to update");
    }
  }

  function statusBadge(status: string) {
    const colors: Record<string, string> = {
      registered: "bg-blue-100 text-blue-800",
      checked_in: "bg-green-100 text-green-800",
      checked_out: "bg-gray-100 text-gray-800",
      no_show: "bg-amber-100 text-amber-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-800"}`}>
        {status.replace("_", " ")}
      </span>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)]">
      {visits.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Guest</th>
                <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Host</th>
                <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Date</th>
                <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Facility</th>
                <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Fee</th>
                <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {visits.map((v) => (
                <tr key={v.id} className="hover:bg-[var(--muted)]/50">
                  <td className="px-5 py-3 font-medium">{v.guest_first_name} {v.guest_last_name}</td>
                  <td className="px-5 py-3">{v.host_first_name} {v.host_last_name}</td>
                  <td className="px-5 py-3">{formatDate(v.visit_date)}</td>
                  <td className="px-5 py-3 capitalize">{v.facility_type || "—"}</td>
                  <td className="px-5 py-3">{v.guest_fee > 0 ? formatCurrency(v.guest_fee) : "Free"}</td>
                  <td className="px-5 py-3">{statusBadge(v.status)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      {v.status === "registered" && (
                        <>
                          <button
                            onClick={() => updateStatus(v.id, "checked_in")}
                            className="p-1 rounded hover:bg-green-50 text-green-600"
                            title="Check In"
                          >
                            <LogIn className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => updateStatus(v.id, "cancelled")}
                            className="p-1 rounded hover:bg-red-50 text-red-600"
                            title="Cancel"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {v.status === "checked_in" && (
                        <button
                          onClick={() => updateStatus(v.id, "checked_out")}
                          className="p-1 rounded hover:bg-blue-50 text-blue-600"
                          title="Check Out"
                        >
                          <LogOut className="h-4 w-4" />
                        </button>
                      )}
                      {v.status === "registered" && isAdmin && (
                        <button
                          onClick={() => updateStatus(v.id, "no_show")}
                          className="p-1 rounded hover:bg-amber-50 text-amber-600"
                          title="No Show"
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center">
          <Calendar className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-2" />
          <p className="text-sm text-[var(--muted-foreground)]">No guest visits recorded yet.</p>
        </div>
      )}
    </div>
  );
}

// ── Guest Directory Tab ──────────────────────────────────
function GuestDirectoryTab({
  guests,
  onRefresh,
  formatDate,
}: {
  guests: Guest[];
  onRefresh: () => void;
  formatDate: (d: string) => string;
}) {
  const [search, setSearch] = useState("");
  const filtered = guests.filter((g) => {
    const q = search.toLowerCase();
    return g.first_name.toLowerCase().includes(q) || g.last_name.toLowerCase().includes(q) || (g.email?.toLowerCase().includes(q) ?? false);
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search guests..."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-10 pr-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-xl border border-[var(--border)]">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Name</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Email</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Phone</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Visits</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Last Visit</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((g) => (
                  <tr key={g.id} className="hover:bg-[var(--muted)]/50">
                    <td className="px-5 py-3 font-medium">{g.first_name} {g.last_name}</td>
                    <td className="px-5 py-3 text-[var(--muted-foreground)]">{g.email || "—"}</td>
                    <td className="px-5 py-3 text-[var(--muted-foreground)]">{g.phone || "—"}</td>
                    <td className="px-5 py-3">{g.total_visits}</td>
                    <td className="px-5 py-3">{g.last_visit_date ? formatDate(g.last_visit_date) : "—"}</td>
                    <td className="px-5 py-3">
                      {g.is_blocked ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800">Blocked</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <Users className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-2" />
            <p className="text-sm text-[var(--muted-foreground)]">{search ? "No guests match your search." : "No guests registered yet."}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Policies Tab ──────────────────────────────────────────
function PoliciesTab({
  policies,
  onRefresh,
  formatCurrency,
}: {
  policies: GuestPolicy[];
  onRefresh: () => void;
  formatCurrency: (n: number) => string;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    facility_type: "" as string,
    max_guests_per_visit: 4,
    max_guest_visits_per_month: "",
    max_same_guest_per_month: 4,
    guest_fee: "0",
    require_member_present: true,
    blackout_days: [] as number[],
    advance_registration_required: false,
  });

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetch("/api/guests/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          facility_type: form.facility_type || null,
          max_guest_visits_per_month: form.max_guest_visits_per_month ? parseInt(form.max_guest_visits_per_month) : null,
          guest_fee: parseFloat(form.guest_fee),
        }),
      });
      if (res.ok) { setShowCreate(false); onRefresh(); }
      else { const d = await res.json(); alert(d.error || "Failed"); }
    } finally { setSaving(false); }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Deactivate this policy?")) return;
    const res = await fetch(`/api/guests/policies?id=${id}`, { method: "DELETE" });
    if (res.ok) onRefresh();
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted-foreground)]">Define guest visit rules, limits, and blackout days.</p>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90">
          <Plus className="h-3.5 w-3.5" />
          Add Policy
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-[var(--border)] p-5 space-y-4 bg-[var(--muted)]">
          <h3 className="font-semibold">New Guest Policy</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Standard Guest Policy" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Facility (optional)</label>
              <select value={form.facility_type} onChange={(e) => setForm({ ...form, facility_type: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                <option value="">All Facilities</option>
                <option value="golf">Golf</option>
                <option value="tennis">Tennis</option>
                <option value="dining">Dining</option>
                <option value="pool">Pool</option>
                <option value="fitness">Fitness</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Guests Per Visit</label>
              <input type="number" value={form.max_guests_per_visit} onChange={(e) => setForm({ ...form, max_guests_per_visit: parseInt(e.target.value) || 1 })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Visits/Month (blank=unlimited)</label>
              <input type="number" value={form.max_guest_visits_per_month} onChange={(e) => setForm({ ...form, max_guest_visits_per_month: e.target.value })} placeholder="Unlimited" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Same Guest/Month</label>
              <input type="number" value={form.max_same_guest_per_month} onChange={(e) => setForm({ ...form, max_same_guest_per_month: parseInt(e.target.value) || 1 })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Guest Fee ($)</label>
              <input type="number" value={form.guest_fee} onChange={(e) => setForm({ ...form, guest_fee: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Blackout Days</label>
              <div className="flex gap-1">
                {dayNames.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setForm({
                      ...form,
                      blackout_days: form.blackout_days.includes(i)
                        ? form.blackout_days.filter((x) => x !== i)
                        : [...form.blackout_days, i],
                    })}
                    className={`px-2 py-1 text-xs rounded ${form.blackout_days.includes(i) ? "bg-red-100 text-red-800" : "bg-[var(--background)] border border-[var(--border)]"}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.require_member_present} onChange={(e) => setForm({ ...form, require_member_present: e.target.checked })} />
                Member must be present
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.advance_registration_required} onChange={(e) => setForm({ ...form, advance_registration_required: e.target.checked })} />
                Advance registration required
              </label>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--background)]">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.name} className="px-3 py-1.5 text-sm rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50">
              {saving ? "Creating..." : "Create Policy"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {policies.length > 0 ? policies.map((p) => (
          <div key={p.id} className="rounded-xl border border-[var(--border)] p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{p.name}</h3>
                {p.facility_type && <span className="text-xs bg-[var(--muted)] px-2 py-0.5 rounded capitalize">{p.facility_type}</span>}
                <span className={`text-xs px-2 py-0.5 rounded ${p.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                  {p.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              {p.is_active && (
                <button onClick={() => handleDeactivate(p.id)} className="text-xs text-red-600 hover:underline">Deactivate</button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-[var(--muted-foreground)]">
              <div>Max guests/visit: <span className="font-medium text-[var(--foreground)]">{p.max_guests_per_visit}</span></div>
              <div>Max visits/month: <span className="font-medium text-[var(--foreground)]">{p.max_guest_visits_per_month ?? "Unlimited"}</span></div>
              <div>Same guest/month: <span className="font-medium text-[var(--foreground)]">{p.max_same_guest_per_month}</span></div>
              <div>Fee: <span className="font-medium text-[var(--foreground)]">{p.guest_fee > 0 ? formatCurrency(p.guest_fee) : "Free"}</span></div>
              {p.blackout_days.length > 0 && (
                <div className="col-span-2">Blackouts: <span className="font-medium text-red-600">{p.blackout_days.map((d) => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]).join(", ")}</span></div>
              )}
            </div>
          </div>
        )) : (
          <div className="rounded-xl border border-[var(--border)] p-8 text-center">
            <ShieldX className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-2" />
            <p className="text-sm text-[var(--muted-foreground)]">No guest policies configured yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Fees Tab ──────────────────────────────────────────
function FeesTab({
  fees,
  tiers,
  onRefresh,
  formatCurrency,
}: {
  fees: (GuestFeeSchedule & { tier_name: string | null })[];
  tiers: { id: string; name: string; level: MembershipTierLevel }[];
  onRefresh: () => void;
  formatCurrency: (n: number) => string;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ facility_type: "golf" as string, tier_id: "" as string, guest_fee: "", weekend_surcharge: "0" });

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetch("/api/guests/policies?type=fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tier_id: form.tier_id || null,
          guest_fee: parseFloat(form.guest_fee),
          weekend_surcharge: parseFloat(form.weekend_surcharge),
        }),
      });
      if (res.ok) { setShowCreate(false); setForm({ facility_type: "golf", tier_id: "", guest_fee: "", weekend_surcharge: "0" }); onRefresh(); }
      else { const d = await res.json(); alert(d.error || "Failed"); }
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted-foreground)]">Set per-facility guest fees with optional tier-specific pricing and weekend surcharges.</p>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90">
          <Plus className="h-3.5 w-3.5" />
          Add Fee Schedule
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-[var(--border)] p-5 space-y-4 bg-[var(--muted)]">
          <h3 className="font-semibold">New Fee Schedule</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Facility Type</label>
              <select value={form.facility_type} onChange={(e) => setForm({ ...form, facility_type: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                <option value="golf">Golf</option>
                <option value="tennis">Tennis</option>
                <option value="dining">Dining</option>
                <option value="pool">Pool</option>
                <option value="fitness">Fitness</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tier (optional)</label>
              <select value={form.tier_id} onChange={(e) => setForm({ ...form, tier_id: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                <option value="">All Tiers</option>
                {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Guest Fee ($)</label>
              <input type="number" value={form.guest_fee} onChange={(e) => setForm({ ...form, guest_fee: e.target.value })} placeholder="75.00" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Weekend Surcharge ($)</label>
              <input type="number" value={form.weekend_surcharge} onChange={(e) => setForm({ ...form, weekend_surcharge: e.target.value })} placeholder="25.00" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--background)]">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !form.guest_fee} className="px-3 py-1.5 text-sm rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50">
              {saving ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)]">
        {fees.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Facility</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Tier</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Guest Fee</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Weekend Surcharge</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {fees.map((f) => (
                  <tr key={f.id} className="hover:bg-[var(--muted)]/50">
                    <td className="px-5 py-3 capitalize font-medium">{f.facility_type}</td>
                    <td className="px-5 py-3">{f.tier_name || "All Tiers"}</td>
                    <td className="px-5 py-3">{formatCurrency(f.guest_fee)}</td>
                    <td className="px-5 py-3">{f.weekend_surcharge > 0 ? formatCurrency(f.weekend_surcharge) : "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${f.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                        {f.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <DollarSign className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-2" />
            <p className="text-sm text-[var(--muted-foreground)]">No fee schedules configured yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Register Visit Modal ──────────────────────────────────
function RegisterVisitModal({
  guests,
  onClose,
  onSuccess,
}: {
  guests: Guest[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [guestId, setGuestId] = useState("");
  const [guestSearch, setGuestSearch] = useState("");
  const [guestForm, setGuestForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split("T")[0]);
  const [facilityType, setFacilityType] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredGuests = guests.filter((g) => {
    const q = guestSearch.toLowerCase();
    return g.first_name.toLowerCase().includes(q) || g.last_name.toLowerCase().includes(q);
  });

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        visit_date: visitDate,
        facility_type: facilityType || null,
        notes: notes || null,
      };

      if (mode === "existing") {
        body.guest_id = guestId;
      } else {
        body.guest = {
          first_name: guestForm.first_name,
          last_name: guestForm.last_name,
          email: guestForm.email || null,
          phone: guestForm.phone || null,
        };
      }

      const res = await fetch("/api/guests/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to register visit");
      }
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = mode === "existing"
    ? guestId && visitDate
    : guestForm.first_name && guestForm.last_name && visitDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[var(--background)] rounded-xl border border-[var(--border)] p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Register Guest Visit</h2>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Guest selection mode */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode("new")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border ${mode === "new" ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]" : "border-[var(--border)] hover:bg-[var(--muted)]"}`}
            >
              New Guest
            </button>
            <button
              onClick={() => setMode("existing")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border ${mode === "existing" ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]" : "border-[var(--border)] hover:bg-[var(--muted)]"}`}
            >
              Returning Guest
            </button>
          </div>

          {mode === "new" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">First Name *</label>
                <input value={guestForm.first_name} onChange={(e) => setGuestForm({ ...guestForm, first_name: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name *</label>
                <input value={guestForm.last_name} onChange={(e) => setGuestForm({ ...guestForm, last_name: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" value={guestForm.email} onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input value={guestForm.phone} onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">Search Guest</label>
              <input value={guestSearch} onChange={(e) => setGuestSearch(e.target.value)} placeholder="Type to search..." className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm mb-2" />
              <div className="max-h-40 overflow-y-auto border border-[var(--border)] rounded-lg divide-y divide-[var(--border)]">
                {filteredGuests.slice(0, 10).map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGuestId(g.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--muted)] ${guestId === g.id ? "bg-[var(--primary)]/10 font-medium" : ""}`}
                  >
                    {g.first_name} {g.last_name} {g.email && <span className="text-[var(--muted-foreground)]">({g.email})</span>}
                    {g.is_blocked && <span className="ml-1 text-xs text-red-600">[BLOCKED]</span>}
                  </button>
                ))}
                {filteredGuests.length === 0 && (
                  <p className="p-3 text-sm text-[var(--muted-foreground)]">No guests found</p>
                )}
              </div>
            </div>
          )}

          {/* Visit details */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Visit Date *</label>
              <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Facility</label>
              <select value={facilityType} onChange={(e) => setFacilityType(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                <option value="">General</option>
                <option value="golf">Golf</option>
                <option value="tennis">Tennis</option>
                <option value="dining">Dining</option>
                <option value="pool">Pool</option>
                <option value="fitness">Fitness</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={saving || !canSubmit}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Registering..." : "Register Visit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared Components ──────────────────────────────────
function StatCard({ icon: Icon, label, value, highlight }: { icon: React.ElementType; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${highlight ? "text-red-500" : "text-[var(--muted-foreground)]"}`} />
        <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${highlight ? "text-red-600" : ""}`}>{value}</p>
    </div>
  );
}
