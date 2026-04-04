"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  Smartphone,
  Wifi,
  CheckCircle,
  XCircle,
  Clock,
  Palette,
  RefreshCw,
  Shield,
  Zap,
  Apple,
  Eye,
} from "lucide-react";
import type { DigitalCardsSummary, CardTemplate } from "@club/shared";

export default function DigitalCardsPage() {
  const [data, setData] = useState<DigitalCardsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "passes" | "taps" | "design">("overview");
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/passes");
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("Failed to fetch digital cards:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Digital Member Cards</h1>
          <p className="text-[var(--muted-foreground)]">Loading...</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "passes" as const, label: "Active Passes" },
    { id: "taps" as const, label: "Tap History" },
    { id: "design" as const, label: "Card Design" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-[var(--primary)]" />
            Digital Member Cards
          </h1>
          <p className="text-[var(--muted-foreground)]">
            Apple Wallet, Google Wallet, and NFC tap-to-check-in management.
          </p>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={CreditCard} label="Active Passes" value={String(data.active_passes)} color="text-[var(--primary)]" />
          <StatCard icon={Apple} label="Apple Wallet" value={String(data.apple_passes)} />
          <StatCard icon={Smartphone} label="Google Wallet" value={String(data.google_passes)} />
          <StatCard icon={Wifi} label="Taps Today" value={String(data.taps_today)} sub={`${data.taps_this_month} this month`} color="text-blue-600" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && data && <OverviewTab data={data} />}
      {activeTab === "passes" && data && <PassesTab data={data} onRefresh={fetchData} />}
      {activeTab === "taps" && data && <TapsTab data={data} />}
      {activeTab === "design" && data && <DesignTab template={data.template} onRefresh={fetchData} />}
    </div>
  );
}

function OverviewTab({ data }: { data: DigitalCardsSummary }) {
  return (
    <div className="space-y-6">
      {/* How it works */}
      <div className="rounded-xl border border-[var(--border)] p-5 bg-gradient-to-r from-[var(--primary)]/5 to-transparent">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Zap className="h-5 w-5 text-[var(--primary)]" />
          How Digital Member Cards Work
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">1. Provision</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Members add their card to Apple Wallet or Google Wallet from the mobile app.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">2. Tap or Scan</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Members tap their phone at NFC readers or show QR code at check-in points.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">3. Track</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Every tap is logged with time, location, and type. View analytics here.
            </p>
          </div>
        </div>
      </div>

      {/* Platform breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center">
              <Apple className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">Apple Wallet</h3>
              <p className="text-xs text-[var(--muted-foreground)]">iOS devices with NFC</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Active passes</span>
              <span className="font-medium">{data.apple_passes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">NFC support</span>
              <span className="text-green-600 font-medium">Supported</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Auto-update</span>
              <span className="text-green-600 font-medium">Push enabled</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">Google Wallet</h3>
              <p className="text-xs text-[var(--muted-foreground)]">Android devices with NFC</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Active passes</span>
              <span className="font-medium">{data.google_passes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Smart Tap</span>
              <span className="text-green-600 font-medium">Supported</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Auto-update</span>
              <span className="text-green-600 font-medium">API enabled</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent taps */}
      {data.recent_taps.length > 0 && (
        <div className="rounded-xl border border-[var(--border)]">
          <div className="p-5 border-b border-[var(--border)]">
            <h2 className="font-semibold">Recent Taps</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {data.recent_taps.slice(0, 10).map((tap) => (
              <div key={tap.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TapTypeIcon type={tap.tap_type} />
                  <div>
                    <p className="text-sm font-medium">{tap.member_name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {tap.location || tap.tap_type.replace(/_/g, " ")}
                      {tap.member_number && ` \u2022 ${tap.member_number}`}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {formatDate(tap.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PassesTab({ data, onRefresh }: { data: DigitalCardsSummary; onRefresh: () => void }) {
  const [revoking, setRevoking] = useState<string | null>(null);

  async function handleRevoke(passId: string) {
    if (!confirm("Revoke this pass? The member will need to generate a new one.")) return;
    setRevoking(passId);
    try {
      const res = await fetch("/api/wallet/passes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pass_id: passId }),
      });
      if (res.ok) onRefresh();
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)]">
      {data.passes.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Member</th>
                <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Platform</th>
                <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Tier</th>
                <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Status</th>
                <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Created</th>
                <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.passes.map((pass) => (
                <tr key={pass.id} className="hover:bg-[var(--muted)]/50">
                  <td className="px-5 py-3">
                    <div className="font-medium">{pass.member_name}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">{pass.member_number}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      pass.platform === "apple" ? "bg-gray-100 text-gray-800" : "bg-blue-100 text-blue-800"
                    }`}>
                      {pass.platform === "apple" ? <Apple className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                      {pass.platform === "apple" ? "Apple" : "Google"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[var(--muted-foreground)]">{pass.tier_name || "Standard"}</td>
                  <td className="px-5 py-3">
                    <PassStatusBadge status={pass.status} />
                  </td>
                  <td className="px-5 py-3 text-[var(--muted-foreground)]">{formatDate(pass.created_at)}</td>
                  <td className="px-5 py-3">
                    {pass.status === "active" && (
                      <button
                        onClick={() => handleRevoke(pass.id)}
                        disabled={revoking === pass.id}
                        className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                      >
                        {revoking === pass.id ? "Revoking..." : "Revoke"}
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
          <CreditCard className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-2" />
          <p className="text-sm text-[var(--muted-foreground)]">
            No digital passes provisioned yet. Members can add their card from the mobile app.
          </p>
        </div>
      )}
    </div>
  );
}

function TapsTab({ data }: { data: DigitalCardsSummary }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] p-4">
          <p className="text-xs text-[var(--muted-foreground)]">Check-ins Today</p>
          <p className="text-2xl font-bold text-[var(--primary)]">{data.taps_today}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-4">
          <p className="text-xs text-[var(--muted-foreground)]">Total Taps (Month)</p>
          <p className="text-2xl font-bold">{data.taps_this_month}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-4">
          <p className="text-xs text-[var(--muted-foreground)]">Unique Members</p>
          <p className="text-2xl font-bold">
            {new Set(data.recent_taps.map((t) => t.member_name)).size}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)]">
        {data.recent_taps.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Type</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Member</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Location</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Time</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.recent_taps.map((tap) => (
                  <tr key={tap.id} className="hover:bg-[var(--muted)]/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <TapTypeIcon type={tap.tap_type} />
                        <span className="capitalize">{tap.tap_type.replace(/_/g, " ")}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium">{tap.member_name}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">{tap.member_number}</div>
                    </td>
                    <td className="px-5 py-3 text-[var(--muted-foreground)]">{tap.location || "—"}</td>
                    <td className="px-5 py-3 text-[var(--muted-foreground)]">{formatDate(tap.created_at)}</td>
                    <td className="px-5 py-3">
                      {tap.verified ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <Wifi className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-2" />
            <p className="text-sm text-[var(--muted-foreground)]">
              No NFC taps recorded this month. Install readers at entry points to start tracking.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DesignTab({
  template,
  onRefresh,
}: {
  template: CardTemplate | null;
  onRefresh: () => void;
}) {
  const [bgColor, setBgColor] = useState(template?.apple_background_color || "#16a34a");
  const [fgColor, setFgColor] = useState(template?.apple_foreground_color || "#ffffff");
  const [labelColor, setLabelColor] = useState(template?.apple_label_color || "#ffffff");
  const [description, setDescription] = useState(template?.description || "Club Membership Card");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/wallet/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apple_background_color: bgColor,
          apple_foreground_color: fgColor,
          apple_label_color: labelColor,
          google_hex_background: bgColor,
          description,
        }),
      });
      if (res.ok) onRefresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Preview */}
      <div>
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Card Preview
        </h2>
        <div
          className="rounded-2xl p-6 shadow-lg max-w-sm"
          style={{ backgroundColor: bgColor }}
        >
          <div className="flex items-center justify-between mb-6">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: fgColor + "20", color: fgColor }}
            >
              CO
            </div>
            <span
              className="text-xs font-bold tracking-wider"
              style={{ color: labelColor }}
            >
              MEMBERSHIP
            </span>
          </div>
          <div className="mb-6">
            <p
              className="text-xs tracking-wide mb-1"
              style={{ color: labelColor + "AA" }}
            >
              MEMBER
            </p>
            <p
              className="text-lg font-bold"
              style={{ color: fgColor }}
            >
              Jane Smith
            </p>
          </div>
          <div className="flex justify-between mb-6">
            <div>
              <p
                className="text-xs tracking-wide mb-1"
                style={{ color: labelColor + "AA" }}
              >
                TIER
              </p>
              <p
                className="text-sm font-semibold"
                style={{ color: fgColor }}
              >
                Premium
              </p>
            </div>
            <div>
              <p
                className="text-xs tracking-wide mb-1"
                style={{ color: labelColor + "AA" }}
              >
                MEMBER #
              </p>
              <p
                className="text-sm font-semibold font-mono"
                style={{ color: fgColor }}
              >
                M-001234
              </p>
            </div>
          </div>
          <div
            className="flex items-center justify-center rounded-lg py-3"
            style={{ backgroundColor: fgColor + "15" }}
          >
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 49 }, (_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-sm"
                  style={{
                    backgroundColor:
                      i % 3 === 0 || i < 14
                        ? fgColor
                        : fgColor + "30",
                  }}
                />
              ))}
            </div>
          </div>
          <p
            className="text-center text-xs mt-2"
            style={{ color: labelColor + "80" }}
          >
            {description}
          </p>
        </div>
      </div>

      {/* Editor */}
      <div>
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Customize Design
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Background Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-10 h-10 rounded border border-[var(--border)] cursor-pointer"
              />
              <input
                type="text"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={fgColor}
                onChange={(e) => setFgColor(e.target.value)}
                className="w-10 h-10 rounded border border-[var(--border)] cursor-pointer"
              />
              <input
                type="text"
                value={fgColor}
                onChange={(e) => setFgColor(e.target.value)}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Label Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={labelColor}
                onChange={(e) => setLabelColor(e.target.value)}
                className="w-10 h-10 rounded border border-[var(--border)] cursor-pointer"
              />
              <input
                type="text"
                value={labelColor}
                onChange={(e) => setLabelColor(e.target.value)}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Palette className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Design"}
          </button>

          <div className="rounded-lg bg-[var(--muted)] p-3 text-xs text-[var(--muted-foreground)] space-y-1">
            <p className="font-medium text-[var(--foreground)]">Design Notes</p>
            <p>Changes apply to all newly generated passes. Existing passes update automatically via push (Apple) or API sync (Google).</p>
            <p>For best results, ensure high contrast between background and text colors.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper components
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color || "text-[var(--muted-foreground)]"}`} />
        <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${color || ""}`}>{value}</p>
      {sub && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{sub}</p>}
    </div>
  );
}

function TapTypeIcon({ type }: { type: string }) {
  const config: Record<string, { color: string; icon: React.ElementType }> = {
    check_in: { color: "text-green-600", icon: CheckCircle },
    pos_payment: { color: "text-blue-600", icon: CreditCard },
    access_gate: { color: "text-purple-600", icon: Shield },
    event_entry: { color: "text-amber-600", icon: Zap },
  };
  const c = config[type] || config.check_in;
  const Icon = c.icon;
  return <Icon className={`h-4 w-4 ${c.color}`} />;
}

function PassStatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    suspended: "bg-amber-100 text-amber-800",
    revoked: "bg-red-100 text-red-800",
    expired: "bg-gray-100 text-gray-800",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config[status] || config.active}`}>
      {status}
    </span>
  );
}

function formatDate(d: string) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
