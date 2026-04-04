"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  SkipForward,
  Smartphone,
  Users,
} from "lucide-react";
import type { NotificationDashboard, MembershipTierLevel } from "@club/shared";

export default function NotificationsPage() {
  const [data, setData] = useState<NotificationDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSend, setShowSend] = useState(false);
  const [tiers, setTiers] = useState<{ id: string; name: string; level: MembershipTierLevel }[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [notifRes, membersRes] = await Promise.all([
        fetch("/api/notifications"),
        fetch("/api/members"),
      ]);
      if (notifRes.ok) setData(await notifRes.json());
      if (membersRes.ok) {
        const mData = await membersRes.json();
        if (mData.tiers) setTiers(mData.tiers);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function formatDate(d: string) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Push Notifications</h1>
          <p className="text-[var(--muted-foreground)]">Send and manage push notifications.</p>
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
          <h1 className="text-2xl font-bold">Push Notifications</h1>
          <p className="text-[var(--muted-foreground)]">Send notifications and view delivery history.</p>
        </div>
        <button
          onClick={() => setShowSend(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
        >
          <Send className="h-4 w-4" />
          Send Notification
        </button>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Smartphone} label="Members with Push" value={String(data.stats.members_with_tokens)} />
          <StatCard icon={CheckCircle} label="Sent (MTD)" value={String(data.stats.sent_this_month)} color="text-green-600" />
          <StatCard icon={XCircle} label="Failed (MTD)" value={String(data.stats.failed_this_month)} color="text-red-600" />
          <StatCard icon={SkipForward} label="Skipped (MTD)" value={String(data.stats.skipped_this_month)} color="text-amber-600" />
        </div>
      )}

      {/* Notification Log */}
      <div className="rounded-xl border border-[var(--border)]">
        <div className="p-5 border-b border-[var(--border)]">
          <h2 className="font-semibold">Recent Notifications</h2>
        </div>

        {data?.log && data.log.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Title</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Category</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Channel</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Status</th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.log.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[var(--muted)]/50">
                    <td className="px-5 py-3">
                      <div className="font-medium">{entry.title}</div>
                      <div className="text-xs text-[var(--muted-foreground)] truncate max-w-xs">{entry.body}</div>
                    </td>
                    <td className="px-5 py-3 capitalize">{entry.category}</td>
                    <td className="px-5 py-3 capitalize">{entry.channel}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="px-5 py-3 text-[var(--muted-foreground)]">{formatDate(entry.sent_at || entry.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <Bell className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-2" />
            <p className="text-sm text-[var(--muted-foreground)]">No notifications sent yet. Use the button above to send your first push notification.</p>
          </div>
        )}
      </div>

      {showSend && (
        <SendNotificationModal
          tiers={tiers}
          onClose={() => setShowSend(false)}
          onSuccess={() => { setShowSend(false); fetchData(); }}
        />
      )}
    </div>
  );
}

function SendNotificationModal({
  tiers,
  onClose,
  onSuccess,
}: {
  tiers: { id: string; name: string; level: MembershipTierLevel }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("announcements");
  const [target, setTarget] = useState<"all" | "tiers">("all");
  const [selectedTiers, setSelectedTiers] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; skipped: number; failed: number } | null>(null);

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          category,
          target: "club",
          tier_ids: target === "tiers" ? selectedTiers : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data.result);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to send");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[var(--background)] rounded-xl border border-[var(--border)] p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Send Push Notification</h2>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">Notification sent!</span>
              </div>
              <div className="text-sm text-green-700 space-y-1">
                <p>Delivered: {result.sent}</p>
                <p>Skipped (opted out): {result.skipped}</p>
                {result.failed > 0 && <p className="text-red-700">Failed: {result.failed}</p>}
              </div>
            </div>
            <button onClick={onSuccess} className="w-full py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] font-medium hover:opacity-90">
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Important Club Update" className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="The notification body text..." className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                <option value="announcements">Announcements</option>
                <option value="events">Events</option>
                <option value="billing">Billing</option>
                <option value="bookings">Bookings</option>
                <option value="dining">Dining</option>
                <option value="marketing">Marketing</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Target</label>
              <div className="flex gap-2">
                <button onClick={() => setTarget("all")} className={`flex-1 py-2 text-sm rounded-lg border ${target === "all" ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]" : "border-[var(--border)] hover:bg-[var(--muted)]"}`}>
                  <Users className="h-4 w-4 inline mr-1" />
                  All Members
                </button>
                <button onClick={() => setTarget("tiers")} className={`flex-1 py-2 text-sm rounded-lg border ${target === "tiers" ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]" : "border-[var(--border)] hover:bg-[var(--muted)]"}`}>
                  Specific Tiers
                </button>
              </div>
            </div>
            {target === "tiers" && (
              <div className="space-y-1">
                {tiers.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selectedTiers.includes(t.id)} onChange={(e) => setSelectedTiers(e.target.checked ? [...selectedTiers, t.id] : selectedTiers.filter((id) => id !== t.id))} />
                    {t.name}
                  </label>
                ))}
              </div>
            )}

            {/* Preview */}
            {title && message && (
              <div className="rounded-lg bg-[var(--muted)] p-3 border border-[var(--border)]">
                <p className="text-xs text-[var(--muted-foreground)] mb-1">Preview</p>
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center text-white text-xs font-bold shrink-0">CO</div>
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{message}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--muted)]">Cancel</button>
              <button onClick={handleSend} disabled={sending || !title || !message} className="px-4 py-2 text-sm rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] font-medium hover:opacity-90 disabled:opacity-50">
                {sending ? "Sending..." : "Send to Members"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color || "text-[var(--muted-foreground)]"}`} />
        <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${color || ""}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: React.ElementType }> = {
    sent: { color: "bg-green-100 text-green-800", icon: CheckCircle },
    delivered: { color: "bg-green-100 text-green-800", icon: CheckCircle },
    failed: { color: "bg-red-100 text-red-800", icon: XCircle },
    skipped: { color: "bg-amber-100 text-amber-800", icon: SkipForward },
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
