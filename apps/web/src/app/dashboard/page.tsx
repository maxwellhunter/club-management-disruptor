"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  CalendarDays,
  DollarSign,
  Clock,
  Megaphone,
  ArrowRight,
  UserPlus,
  PartyPopper,
  MessageSquare,
  Bot,
  TrendingUp,
  AlertTriangle,
  MapPin,
} from "lucide-react";

interface DashboardData {
  role: "admin" | "member";
  memberName: string;
  tierName?: string;
  stats: Record<string, number>;
  recentBookings?: BookingItem[];
  myBookings?: BookingItem[];
  upcomingEvents?: EventItem[];
  recentAnnouncements?: AnnouncementItem[];
  myRsvps?: RsvpItem[];
}

interface BookingItem {
  id: string;
  date: string;
  start_time: string;
  party_size: number;
  status: string;
  facilities: { name: string; type: string } | null;
  members?: { first_name: string; last_name: string } | null;
}

interface EventItem {
  id: string;
  title: string;
  start_date: string;
  location: string | null;
  capacity: number | null;
}

interface AnnouncementItem {
  id: string;
  title: string;
  priority: string;
  published_at: string;
}

interface RsvpItem {
  id: string;
  status: string;
  events: { id: string; title: string; start_date: string; location: string | null } | null;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
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
              className="h-64 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-8 text-center">
        <p className="text-[var(--muted-foreground)]">
          Failed to load dashboard. Please refresh the page.
        </p>
      </div>
    );
  }

  const isAdmin = data.role === "admin";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {data.memberName}
        </h1>
        <p className="text-[var(--muted-foreground)]">
          {isAdmin
            ? "Here\u2019s what\u2019s happening at your club today."
            : `${data.tierName ? data.tierName + " Member" : "Member"} \u2014 here\u2019s your club at a glance.`}
        </p>
      </div>

      {/* Stat cards */}
      {isAdmin ? (
        <AdminStats stats={data.stats} />
      ) : (
        <MemberStats stats={data.stats} />
      )}

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* Bookings */}
          {isAdmin ? (
            <DashboardCard
              title="Upcoming Bookings"
              icon={<CalendarDays className="h-4 w-4" />}
              actionLabel="View All"
              onAction={() => router.push("/dashboard/bookings")}
            >
              {(data.recentBookings ?? []).length === 0 ? (
                <EmptyState text="No bookings in the next 3 days." />
              ) : (
                <div className="space-y-2">
                  {data.recentBookings!.slice(0, 5).map((b) => (
                    <BookingRow key={b.id} booking={b} showMember />
                  ))}
                </div>
              )}
            </DashboardCard>
          ) : (
            <DashboardCard
              title="My Upcoming Bookings"
              icon={<CalendarDays className="h-4 w-4" />}
              actionLabel="Book Tee Time"
              onAction={() => router.push("/dashboard/bookings")}
            >
              {(data.myBookings ?? []).length === 0 ? (
                <EmptyState text="No upcoming bookings. Book a tee time!" />
              ) : (
                <div className="space-y-2">
                  {data.myBookings!.map((b) => (
                    <BookingRow key={b.id} booking={b} />
                  ))}
                </div>
              )}
            </DashboardCard>
          )}

          {/* Announcements */}
          <DashboardCard
            title="Recent Announcements"
            icon={<Megaphone className="h-4 w-4" />}
            actionLabel={isAdmin ? "Manage" : "View All"}
            onAction={() => router.push("/dashboard/messages")}
          >
            {(data.recentAnnouncements ?? []).length === 0 ? (
              <EmptyState
                text={
                  isAdmin
                    ? "No announcements yet. Send one to your members!"
                    : "No announcements from your club."
                }
              />
            ) : (
              <div className="space-y-2">
                {data.recentAnnouncements!.map((a) => (
                  <AnnouncementRow key={a.id} announcement={a} />
                ))}
              </div>
            )}
          </DashboardCard>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Events */}
          <DashboardCard
            title="Upcoming Events"
            icon={<PartyPopper className="h-4 w-4" />}
            actionLabel={isAdmin ? "Manage Events" : "Browse Events"}
            onAction={() => router.push("/dashboard/events")}
          >
            {(data.upcomingEvents ?? []).length === 0 ? (
              <EmptyState text="No upcoming events." />
            ) : (
              <div className="space-y-2">
                {data.upcomingEvents!.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </div>
            )}
          </DashboardCard>

          {/* Quick Actions */}
          <DashboardCard
            title="Quick Actions"
            icon={<ArrowRight className="h-4 w-4" />}
          >
            <div className="grid grid-cols-2 gap-2">
              {isAdmin ? (
                <>
                  <QuickAction
                    icon={<UserPlus className="h-4 w-4" />}
                    label="Add Member"
                    onClick={() => router.push("/dashboard/members")}
                  />
                  <QuickAction
                    icon={<PartyPopper className="h-4 w-4" />}
                    label="Create Event"
                    onClick={() => router.push("/dashboard/events")}
                  />
                  <QuickAction
                    icon={<Megaphone className="h-4 w-4" />}
                    label="Send Announcement"
                    onClick={() => router.push("/dashboard/messages")}
                  />
                  <QuickAction
                    icon={<DollarSign className="h-4 w-4" />}
                    label="Create Invoice"
                    onClick={() => router.push("/dashboard/billing")}
                  />
                  <QuickAction
                    icon={<CalendarDays className="h-4 w-4" />}
                    label="Manage Bookings"
                    onClick={() => router.push("/dashboard/bookings")}
                  />
                  <QuickAction
                    icon={<Bot className="h-4 w-4" />}
                    label="AI Assistant"
                    onClick={() => router.push("/dashboard/chat")}
                  />
                </>
              ) : (
                <>
                  <QuickAction
                    icon={<CalendarDays className="h-4 w-4" />}
                    label="Book Tee Time"
                    onClick={() => router.push("/dashboard/bookings")}
                  />
                  <QuickAction
                    icon={<PartyPopper className="h-4 w-4" />}
                    label="Browse Events"
                    onClick={() => router.push("/dashboard/events")}
                  />
                  <QuickAction
                    icon={<DollarSign className="h-4 w-4" />}
                    label="View Billing"
                    onClick={() => router.push("/dashboard/billing")}
                  />
                  <QuickAction
                    icon={<Bot className="h-4 w-4" />}
                    label="AI Assistant"
                    onClick={() => router.push("/dashboard/chat")}
                  />
                </>
              )}
            </div>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────

function AdminStats({ stats }: { stats: Record<string, number> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<Users className="h-5 w-5 text-blue-500" />}
        label="Active Members"
        value={stats.activeMembers?.toString() ?? "0"}
        sub={
          stats.pendingInvites
            ? `${stats.pendingInvites} pending invite${stats.pendingInvites !== 1 ? "s" : ""}`
            : undefined
        }
      />
      <StatCard
        icon={<DollarSign className="h-5 w-5 text-green-500" />}
        label="Revenue (MTD)"
        value={formatCurrency(stats.revenueMtd ?? 0)}
        sub={
          stats.outstandingBalance
            ? `${formatCurrency(stats.outstandingBalance)} outstanding`
            : undefined
        }
        subColor={stats.outstandingBalance ? "text-amber-600" : undefined}
      />
      <StatCard
        icon={<Clock className="h-5 w-5 text-purple-500" />}
        label="Bookings Today"
        value={stats.bookingsToday?.toString() ?? "0"}
      />
      <StatCard
        icon={<PartyPopper className="h-5 w-5 text-amber-500" />}
        label="Upcoming Events"
        value={stats.upcomingEvents?.toString() ?? "0"}
      />
    </div>
  );
}

function MemberStats({ stats }: { stats: Record<string, number> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        icon={<CalendarDays className="h-5 w-5 text-green-500" />}
        label="Upcoming Bookings"
        value={stats.upcomingBookings?.toString() ?? "0"}
      />
      <StatCard
        icon={<PartyPopper className="h-5 w-5 text-amber-500" />}
        label="Events Attending"
        value={stats.eventsAttending?.toString() ?? "0"}
      />
      <StatCard
        icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
        label="Club Events"
        value={stats.upcomingEvents?.toString() ?? "0"}
      />
    </div>
  );
}

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
        <p className={`text-xs mt-1 ${subColor ?? "text-[var(--muted-foreground)]"}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

function DashboardCard({
  title,
  icon,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </div>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="text-xs font-medium text-[var(--primary)] hover:underline flex items-center gap-1"
          >
            {actionLabel}
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="p-5">{children}</div>
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

function BookingRow({
  booking,
  showMember,
}: {
  booking: BookingItem;
  showMember?: boolean;
}) {
  const facilityIcon =
    booking.facilities?.type === "golf"
      ? "⛳"
      : booking.facilities?.type === "tennis"
        ? "🎾"
        : booking.facilities?.type === "dining"
          ? "🍽️"
          : booking.facilities?.type === "pool"
            ? "🏊"
            : "📅";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3.5 py-2.5">
      <span className="text-lg">{facilityIcon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {booking.facilities?.name ?? "Facility"}
          {showMember && booking.members
            ? ` — ${booking.members.first_name} ${booking.members.last_name}`
            : ""}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          {formatDate(booking.date)} &middot; {formatTime(booking.start_time)}{" "}
          &middot; {booking.party_size}{" "}
          {booking.party_size === 1 ? "player" : "players"}
        </p>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: EventItem }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3.5 py-2.5">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 shrink-0">
        <PartyPopper className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{event.title}</p>
        <p className="text-xs text-[var(--muted-foreground)]">
          {formatDateTime(event.start_date)}
          {event.location && (
            <>
              {" "}
              &middot; <MapPin className="inline h-3 w-3" /> {event.location}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function AnnouncementRow({ announcement }: { announcement: AnnouncementItem }) {
  const priorityColor: Record<string, string> = {
    urgent: "bg-red-100 text-red-600",
    high: "bg-amber-100 text-amber-600",
    normal: "bg-blue-100 text-blue-600",
    low: "bg-gray-100 text-gray-500",
  };

  const priorityIcon: Record<string, React.ReactNode> = {
    urgent: <AlertTriangle className="h-3.5 w-3.5" />,
    high: <Megaphone className="h-3.5 w-3.5" />,
    normal: <MessageSquare className="h-3.5 w-3.5" />,
    low: <MessageSquare className="h-3.5 w-3.5" />,
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3.5 py-2.5">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
          priorityColor[announcement.priority] ?? "bg-gray-100 text-gray-500"
        }`}
      >
        {priorityIcon[announcement.priority] ?? (
          <MessageSquare className="h-3.5 w-3.5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{announcement.title}</p>
        <p className="text-xs text-[var(--muted-foreground)]">
          {timeAgo(announcement.published_at)}
        </p>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] px-3.5 py-3 text-sm font-medium hover:bg-[var(--muted)] transition-colors text-left"
    >
      <span className="text-[var(--primary)]">{icon}</span>
      {label}
    </button>
  );
}

// ── Helpers ────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${ampm}`;
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDateTime(dateStr);
}
