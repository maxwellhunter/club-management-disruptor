export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <main className="flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-5xl font-bold tracking-tight">
            Club<span className="text-[var(--primary)]">OS</span>
          </h1>
          <p className="text-lg text-[var(--muted-foreground)]">
            Modern club management, powered by AI
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl">
          <FeatureCard
            title="Member Management"
            description="Profiles, directories, family accounts, and membership tiers — all in one place."
          />
          <FeatureCard
            title="Smart Billing"
            description="Automated dues, invoicing, and payment processing with Stripe."
          />
          <FeatureCard
            title="Bookings & Events"
            description="Tee times, dining, courts, and club events with real-time availability."
          />
          <FeatureCard
            title="Communications"
            description="Announcements, newsletters, and targeted messaging to members."
          />
          <FeatureCard
            title="AI Assistant"
            description="Natural language booking, balance inquiries, and club information."
          />
          <FeatureCard
            title="Analytics"
            description="Member engagement, revenue trends, and facility utilization insights."
          />
        </div>

        <div className="flex gap-4 mt-4">
          <a
            href="/login"
            className="rounded-lg bg-[var(--primary)] px-6 py-3 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
          >
            Get Started
          </a>
          <a
            href="/login"
            className="rounded-lg border border-[var(--border)] px-6 py-3 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
          >
            Sign In
          </a>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-6 text-left hover:bg-[var(--accent)] transition-colors">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
    </div>
  );
}
