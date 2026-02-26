export default function MessagesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-[var(--muted-foreground)]">
            Announcements, newsletters, and member communications.
          </p>
        </div>
        <button className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          New Announcement
        </button>
      </div>

      <div className="rounded-xl border border-[var(--border)] p-8 text-center text-sm text-[var(--muted-foreground)]">
        No messages yet. Send your first announcement to club members.
      </div>
    </div>
  );
}
