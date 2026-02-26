export default function EventsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-[var(--muted-foreground)]">
            Club events, tournaments, and social gatherings.
          </p>
        </div>
        <button className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          Create Event
        </button>
      </div>

      <div className="rounded-xl border border-[var(--border)] p-8 text-center text-sm text-[var(--muted-foreground)]">
        No upcoming events. Create your first event to get started.
      </div>
    </div>
  );
}
