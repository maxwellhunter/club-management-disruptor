export default function MembersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-[var(--muted-foreground)]">
            Manage your club&apos;s membership directory.
          </p>
        </div>
        <button className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          Add Member
        </button>
      </div>

      <div className="rounded-xl border border-[var(--border)]">
        <div className="border-b border-[var(--border)] p-4">
          <input
            type="search"
            placeholder="Search members..."
            className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">
          No members yet. Add your first member to get started.
        </div>
      </div>
    </div>
  );
}
