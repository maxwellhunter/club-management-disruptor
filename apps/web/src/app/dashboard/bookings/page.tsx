export default function BookingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-[var(--muted-foreground)]">
            Tee times, dining reservations, and court bookings.
          </p>
        </div>
        <button className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          New Booking
        </button>
      </div>

      <div className="flex gap-2">
        {["All", "Golf", "Tennis", "Dining", "Pool"].map((tab) => (
          <button
            key={tab}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "All"
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--border)] p-8 text-center text-sm text-[var(--muted-foreground)]">
        No bookings yet. Configure your facilities to enable booking.
      </div>
    </div>
  );
}
