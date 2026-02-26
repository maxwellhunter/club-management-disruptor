import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {user?.user_metadata?.full_name || "there"}
        </h1>
        <p className="text-[var(--muted-foreground)]">
          Here&apos;s what&apos;s happening at your club today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Members" value="—" change="" />
        <StatCard label="Revenue (MTD)" value="—" change="" />
        <StatCard label="Bookings Today" value="—" change="" />
        <StatCard label="Upcoming Events" value="—" change="" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] p-6">
          <h2 className="font-semibold mb-4">Recent Activity</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Activity feed will appear here once members start using the platform.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] p-6">
          <h2 className="font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <QuickAction label="Add New Member" href="/dashboard/members" />
            <QuickAction label="Create Event" href="/dashboard/events" />
            <QuickAction label="Send Announcement" href="/dashboard/messages" />
            <QuickAction label="Ask AI Assistant" href="/dashboard/chat" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-6">
      <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {change && (
        <p className="text-xs text-[var(--primary)] mt-1">{change}</p>
      )}
    </div>
  );
}

function QuickAction({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="flex items-center justify-between rounded-lg border border-[var(--border)] px-4 py-3 text-sm hover:bg-[var(--muted)] transition-colors"
    >
      {label}
      <span className="text-[var(--muted-foreground)]">&rarr;</span>
    </a>
  );
}
