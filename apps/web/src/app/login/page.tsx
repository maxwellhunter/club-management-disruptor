"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wrench } from "lucide-react";

const DEV_ACCOUNTS = [
  {
    label: "Max Hunter — Admin",
    description: "Full access (manage members, billing, events)",
    email: "admin@greenfieldcc.com",
    role: "admin" as const,
  },
  {
    label: "Sarah Chen — Staff",
    description: "Staff access (manage bookings, events)",
    email: "staff@greenfieldcc.com",
    role: "staff" as const,
  },
  {
    label: "James Wilson — Standard Member",
    description: "Standard tier (dining, pool, social events)",
    email: "member@greenfieldcc.com",
    role: "member" as const,
  },
  {
    label: "Emily Brooks — Golf Member",
    description: "Golf tier (unlimited golf, cart, pro shop)",
    email: "golf@greenfieldcc.com",
    role: "member" as const,
  },
];

const DEV_PASSWORD = "clubos-demo-2026";

const isDev = process.env.NODE_ENV === "development";

const roleBadgeColors = {
  admin: "bg-red-100 text-red-700 border-red-200",
  staff: "bg-blue-100 text-blue-700 border-blue-200",
  member: "bg-green-100 text-green-700 border-green-200",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  function handleDevSelect(account: (typeof DEV_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(DEV_PASSWORD);
    setError(null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">
            Club<span className="text-[var(--primary)]">OS</span>
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Sign in to your account
          </p>
        </div>

        {isDev && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-amber-600" />
              <p className="text-xs font-semibold text-amber-800">
                Dev Mode — Greenfield Country Club
              </p>
            </div>
            <div className="space-y-2">
              {DEV_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => handleDevSelect(account)}
                  className={`w-full text-left rounded-lg border bg-white px-3 py-2.5 transition-all hover:shadow-sm ${
                    email === account.email
                      ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/20"
                      : "border-amber-200 hover:border-amber-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {account.label}
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${roleBadgeColors[account.role]}`}
                    >
                      {account.role}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {account.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourclub.com"
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--muted-foreground)]">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="text-[var(--primary)] hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
