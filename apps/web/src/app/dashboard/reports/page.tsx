"use client";

import { useState, useEffect } from "react";
import {
  Users,
  DollarSign,
  Calendar,
  PartyPopper,
  TrendingUp,
  AlertTriangle,
  Clock,
  XCircle,
  BarChart3,
  PieChart,
} from "lucide-react";

interface ReportsData {
  membership: {
    total: number;
    active: number;
    pending: number;
    inactive: number;
    byTier: { name: string; count: number }[];
  };
  revenue: {
    mtd: number;
    outstanding: number;
    overdueCount: number;
    byMonth: { label: string; revenue: number }[];
  };
  bookings: {
    thisMonth: number;
    today: number;
    cancellations: number;
    byFacility: { type: string; count: number }[];
    byMonth: { label: string; count: number }[];
  };
  events: {
    thisMonth: number;
    upcoming: number;
    totalRsvps: number;
    topEvents: { title: string; attendees: number; capacity: number | null }[];
  };
}

type TabKey = "overview" | "membership" | "revenue" | "bookings" | "events";

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await fetch("/api/reports");
        if (res.status === 403) {
          setError("Reports are only available to administrators.");
          return;
        }
        if (!res.ok) throw new Error("Failed to load reports");
        setData(await res.json());
      } catch {
        setError("Failed to load reports. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded bg-[var(--muted)] animate-pulse" />
        <div className="h-4 w-96 rounded bg-[var(--muted)] animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse"
            />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-72 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-12 text-center">
        <BarChart3 className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)]" />
        <p className="font-semibold text-lg">Reports Unavailable</p>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "membership", label: "Membership" },
    { key: "revenue", label: "Revenue" },
    { key: "bookings", label: "Bookings" },
    { key: "events", label: "Events" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <p className="text-[var(--muted-foreground)]">
          Club performance metrics and trends
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-[var(--border)] p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab data={data} />}
      {activeTab === "membership" && <MembershipTab data={data.membership} />}
      {activeTab === "revenue" && <RevenueTab data={data.revenue} />}
      {activeTab === "bookings" && <BookingsTab data={data.bookings} />}
      {activeTab === "events" && <EventsTab data={data.events} />}
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────

function OverviewTab({ data }: { data: ReportsData }) {
  return (
    <div className="space-y-6">
      {/* Top-level KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5 text-blue-500" />}
          label="Active Members"
          value={data.membership.active.toString()}
          sub={`${data.membership.total} total`}
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-green-500" />}
          label="Revenue (MTD)"
          value={formatCurrency(data.revenue.mtd)}
          sub={
            data.revenue.outstanding > 0
              ? `${formatCurrency(data.revenue.outstanding)} outstanding`
              : undefined
          }
          subColor={data.revenue.outstanding > 0 ? "text-amber-600" : undefined}
        />
        <StatCard
          icon={<Calendar className="h-5 w-5 text-purple-500" />}
          label="Bookings (MTD)"
          value={data.bookings.thisMonth.toString()}
          sub={`${data.bookings.today} today`}
        />
        <StatCard
          icon={<PartyPopper className="h-5 w-5 text-amber-500" />}
          label="Events This Month"
          value={data.events.thisMonth.toString()}
          sub={`${data.events.totalRsvps} RSVPs`}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Revenue Trend" icon={<TrendingUp className="h-4 w-4" />}>
          <BarChart
            data={data.revenue.byMonth.map((m) => ({
              label: m.label,
              value: m.revenue,
            }))}
            formatValue={formatCurrency}
            color="bg-green-500"
          />
        </ChartCard>

        <ChartCard title="Booking Trend" icon={<BarChart3 className="h-4 w-4" />}>
          <BarChart
            data={data.bookings.byMonth.map((m) => ({
              label: m.label,
              value: m.count,
            }))}
            formatValue={(v) => v.toString()}
            color="bg-purple-500"
          />
        </ChartCard>
      </div>

      {/* Bottom row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Members by Tier" icon={<PieChart className="h-4 w-4" />}>
          <HorizontalBarList
            items={data.membership.byTier}
            color="bg-blue-500"
          />
        </ChartCard>

        <ChartCard title="Top Events" icon={<PartyPopper className="h-4 w-4" />}>
          {data.events.topEvents.length === 0 ? (
            <EmptyState text="No events this month." />
          ) : (
            <div className="space-y-3">
              {data.events.topEvents.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1 mr-3">{e.title}</span>
                  <span className="text-[var(--muted-foreground)] shrink-0">
                    {e.attendees} attending
                    {e.capacity ? ` / ${e.capacity}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

// ── Membership Tab ──────────────────────────────────────────

function MembershipTab({
  data,
}: {
  data: ReportsData["membership"];
}) {
  const statusBreakdown = [
    { name: "Active", count: data.active },
    { name: "Pending / Invited", count: data.pending },
    { name: "Inactive / Suspended", count: data.inactive },
  ].filter((s) => s.count > 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Users className="h-5 w-5 text-blue-500" />}
          label="Total Members"
          value={data.total.toString()}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-green-500" />}
          label="Active"
          value={data.active.toString()}
          sub={
            data.total > 0
              ? `${Math.round((data.active / data.total) * 100)}% of total`
              : undefined
          }
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          label="Pending / Invited"
          value={data.pending.toString()}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Members by Tier" icon={<PieChart className="h-4 w-4" />}>
          <HorizontalBarList items={data.byTier} color="bg-blue-500" />
        </ChartCard>

        <ChartCard title="Status Breakdown" icon={<Users className="h-4 w-4" />}>
          <HorizontalBarList items={statusBreakdown} color="bg-green-500" />
        </ChartCard>
      </div>
    </div>
  );
}

// ── Revenue Tab ─────────────────────────────────────────────

function RevenueTab({ data }: { data: ReportsData["revenue"] }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-green-500" />}
          label="Revenue (MTD)"
          value={formatCurrency(data.mtd)}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
          label="Outstanding"
          value={formatCurrency(data.outstanding)}
          sub={
            data.overdueCount > 0
              ? `${data.overdueCount} overdue invoice${data.overdueCount !== 1 ? "s" : ""}`
              : undefined
          }
          subColor="text-red-500"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
          label="Avg Monthly Revenue"
          value={formatCurrency(
            data.byMonth.length > 0
              ? data.byMonth.reduce((s, m) => s + m.revenue, 0) /
                  data.byMonth.length
              : 0
          )}
          sub="Last 6 months"
        />
      </div>

      <ChartCard title="Monthly Revenue" icon={<BarChart3 className="h-4 w-4" />}>
        <BarChart
          data={data.byMonth.map((m) => ({
            label: m.label,
            value: m.revenue,
          }))}
          formatValue={formatCurrency}
          color="bg-green-500"
        />
      </ChartCard>
    </div>
  );
}

// ── Bookings Tab ────────────────────────────────────────────

function BookingsTab({ data }: { data: ReportsData["bookings"] }) {
  const facilityLabels: Record<string, string> = {
    golf: "Golf",
    tennis: "Tennis",
    dining: "Dining",
    pool: "Pool",
    fitness: "Fitness",
    other: "Other",
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Calendar className="h-5 w-5 text-purple-500" />}
          label="Bookings (MTD)"
          value={data.thisMonth.toString()}
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-blue-500" />}
          label="Today"
          value={data.today.toString()}
        />
        <StatCard
          icon={<XCircle className="h-5 w-5 text-red-500" />}
          label="Cancellations (MTD)"
          value={data.cancellations.toString()}
          sub={
            data.thisMonth > 0
              ? `${Math.round((data.cancellations / (data.thisMonth + data.cancellations)) * 100)}% rate`
              : undefined
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Booking Trend" icon={<BarChart3 className="h-4 w-4" />}>
          <BarChart
            data={data.byMonth.map((m) => ({
              label: m.label,
              value: m.count,
            }))}
            formatValue={(v) => v.toString()}
            color="bg-purple-500"
          />
        </ChartCard>

        <ChartCard title="By Facility Type" icon={<PieChart className="h-4 w-4" />}>
          {data.byFacility.length === 0 ? (
            <EmptyState text="No bookings this month." />
          ) : (
            <HorizontalBarList
              items={data.byFacility.map((f) => ({
                name: facilityLabels[f.type] ?? f.type,
                count: f.count,
              }))}
              color="bg-purple-500"
            />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

// ── Events Tab ──────────────────────────────────────────────

function EventsTab({ data }: { data: ReportsData["events"] }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<PartyPopper className="h-5 w-5 text-amber-500" />}
          label="Events This Month"
          value={data.thisMonth.toString()}
        />
        <StatCard
          icon={<Calendar className="h-5 w-5 text-blue-500" />}
          label="Upcoming"
          value={data.upcoming.toString()}
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-green-500" />}
          label="Total RSVPs"
          value={data.totalRsvps.toString()}
        />
      </div>

      <ChartCard title="Top Events by Attendance" icon={<BarChart3 className="h-4 w-4" />}>
        {data.topEvents.length === 0 ? (
          <EmptyState text="No events this month." />
        ) : (
          <div className="space-y-4">
            {data.topEvents.map((event, i) => {
              const pct =
                event.capacity && event.capacity > 0
                  ? Math.min(
                      Math.round((event.attendees / event.capacity) * 100),
                      100
                    )
                  : null;
              const maxAttendees = Math.max(
                ...data.topEvents.map((e) => e.attendees),
                1
              );
              const barWidth = Math.round(
                (event.attendees / maxAttendees) * 100
              );

              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium truncate flex-1 mr-3">
                      {event.title}
                    </span>
                    <span className="text-[var(--muted-foreground)] shrink-0">
                      {event.attendees}
                      {event.capacity ? ` / ${event.capacity}` : ""}
                      {pct !== null ? ` (${pct}%)` : ""}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--muted)]">
                    <div
                      className="h-2 rounded-full bg-amber-500 transition-all"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ChartCard>
    </div>
  );
}

// ── Shared Components ───────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  subColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
      {sub && (
        <p
          className={`text-xs mt-1 ${subColor ?? "text-[var(--muted-foreground)]"}`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-3.5 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function BarChart({
  data,
  formatValue,
  color,
}: {
  data: { label: string; value: number }[];
  formatValue: (v: number) => string;
  color: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-1">
      {/* Bars */}
      <div className="flex items-end gap-2 h-40">
        {data.map((d, i) => {
          const height = Math.max((d.value / max) * 100, 2);
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end h-full"
            >
              <span className="text-[10px] text-[var(--muted-foreground)] mb-1 truncate max-w-full">
                {formatValue(d.value)}
              </span>
              <div
                className={`w-full rounded-t ${color} transition-all`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      {/* Labels */}
      <div className="flex gap-2">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 text-center text-[10px] text-[var(--muted-foreground)]"
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBarList({
  items,
  color,
}: {
  items: { name: string; count: number }[];
  color: string;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);

  if (items.length === 0) {
    return <EmptyState text="No data available." />;
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const pct = Math.max(Math.round((item.count / max) * 100), 2);
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium">{item.name}</span>
              <span className="text-[var(--muted-foreground)]">
                {item.count}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--muted)]">
              <div
                className={`h-2 rounded-full ${color} transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
      {text}
    </p>
  );
}

// ── Helpers ─────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
