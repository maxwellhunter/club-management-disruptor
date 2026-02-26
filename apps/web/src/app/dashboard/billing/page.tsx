export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-[var(--muted-foreground)]">
          Manage dues, invoices, and payment processing.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] p-6">
          <p className="text-sm text-[var(--muted-foreground)]">
            Outstanding Balance
          </p>
          <p className="text-3xl font-bold mt-1">$0</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-6">
          <p className="text-sm text-[var(--muted-foreground)]">
            Collected (MTD)
          </p>
          <p className="text-3xl font-bold mt-1">$0</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-6">
          <p className="text-sm text-[var(--muted-foreground)]">
            Overdue Invoices
          </p>
          <p className="text-3xl font-bold mt-1">0</p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] p-6">
        <h2 className="font-semibold mb-4">Recent Invoices</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Connect Stripe to start processing payments and generating invoices.
        </p>
      </div>
    </div>
  );
}
