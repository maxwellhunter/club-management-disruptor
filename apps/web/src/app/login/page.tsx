"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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

function MaterialIcon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}
    >
      {name}
    </span>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
    <div
      className="font-body text-reserve-on-background min-h-screen flex flex-col items-center justify-center p-6"
      style={{
        backgroundColor: "#f9f9f8",
        backgroundImage: "radial-gradient(#d1d1cf 0.5px, transparent 0.5px)",
        backgroundSize: "24px 24px",
      }}
    >
      <main className="w-full max-w-md flex flex-col">
        {/* Brand Identity Section */}
        <header className="mb-16 text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 flex items-center justify-center bg-reserve-primary text-reserve-on-primary rounded-full shadow-lg">
              <MaterialIcon name="temp_preferences_custom" className="text-4xl" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="font-headline text-xl tracking-[0.2em] text-reserve-primary uppercase">
              ClubOS
            </h2>
            <div className="h-px w-8 bg-reserve-tertiary mx-auto opacity-40" />
          </div>
        </header>

        {/* Login Container */}
        <section className="bg-reserve-surface-container-lowest/60 backdrop-blur-sm rounded-xl p-8 md:p-12 shadow-[0_8px_24px_-4px_rgba(25,28,28,0.04)] border border-reserve-outline-variant/10">
          <div className="mb-10 text-center">
            <h1 className="font-headline text-4xl text-reserve-primary tracking-tight mb-2">
              Sign In
            </h1>
            <p className="text-reserve-on-surface-variant font-body text-sm tracking-wide">
              Enter your credentials to access your club.
            </p>
          </div>

          {isDev && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3 mb-8">
              <div className="flex items-center gap-2">
                <MaterialIcon name="construction" className="text-base text-amber-600" />
                <p className="text-xs font-semibold text-amber-800">
                  Dev Mode — The Lakes
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
                        ? "border-reserve-primary ring-2 ring-reserve-primary/20"
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

          <form onSubmit={handleLogin} className="space-y-8">
            {error && (
              <div className="rounded-lg bg-reserve-error-container border border-reserve-error/20 p-3 text-sm text-reserve-error flex items-center gap-2">
                <MaterialIcon name="error" className="text-lg" />
                {error}
              </div>
            )}

            {/* Email Field */}
            <div className="group relative">
              <label
                className="absolute -top-2.5 left-0 text-[10px] font-semibold tracking-widest text-reserve-primary uppercase"
                htmlFor="email"
              >
                Email Address
              </label>
              <div className="flex items-center border-b border-reserve-outline-variant group-focus-within:border-reserve-primary py-2 transition-colors">
                <MaterialIcon
                  name="mail"
                  className="text-reserve-outline group-focus-within:text-reserve-primary mr-3 text-xl"
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-reserve-on-surface placeholder:text-reserve-outline-variant/60 font-body py-1"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="group relative">
              <label
                className="absolute -top-2.5 left-0 text-[10px] font-semibold tracking-widest text-reserve-primary uppercase"
                htmlFor="password"
              >
                Password
              </label>
              <div className="flex items-center border-b border-reserve-outline-variant group-focus-within:border-reserve-primary py-2 transition-colors">
                <MaterialIcon
                  name="lock_open"
                  className="text-reserve-outline group-focus-within:text-reserve-primary mr-3 text-xl"
                />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-reserve-on-surface placeholder:text-reserve-outline-variant/60 font-body py-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center space-x-2 cursor-pointer group">
                <div className="w-5 h-5 rounded border border-reserve-outline-variant group-hover:border-reserve-primary flex items-center justify-center transition-colors">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <MaterialIcon
                    name="check"
                    className={`text-sm text-reserve-primary transition-opacity ${
                      rememberMe ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </div>
                <span className="text-xs text-reserve-on-surface-variant group-hover:text-reserve-primary transition-colors">
                  Remember Me
                </span>
              </label>
              <a
                className="text-xs text-reserve-primary font-medium hover:underline underline-offset-4"
                href="#"
              >
                Forgot Password?
              </a>
            </div>

            {/* Action Section */}
            <div className="space-y-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-reserve-primary hover:bg-reserve-primary-container text-reserve-on-primary font-body font-semibold tracking-wide py-4 rounded-lg shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 group"
              >
                {loading ? "Signing in..." : "Sign In"}
                {!loading && (
                  <MaterialIcon
                    name="arrow_right_alt"
                    className="text-lg group-hover:translate-x-1 transition-transform"
                  />
                )}
              </button>

              <div className="relative flex items-center py-4">
                <div className="flex-grow border-t border-reserve-outline-variant/30" />
                <span className="flex-shrink mx-4 text-[10px] uppercase tracking-widest text-reserve-outline">
                  or
                </span>
                <div className="flex-grow border-t border-reserve-outline-variant/30" />
              </div>

              {/* Biometric Option */}
              <button
                type="button"
                className="w-full bg-reserve-surface-container-high hover:bg-reserve-secondary-fixed text-reserve-on-surface font-body font-medium text-sm py-4 rounded-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                <MaterialIcon name="fingerprint" className="text-2xl" />
                Fast Sign-in with Biometrics
              </button>
            </div>
          </form>
        </section>

        {/* Footer Links */}
        <footer className="mt-12 flex flex-col items-center gap-6">
          <div className="flex items-center gap-8">
            <a
              className="text-xs font-medium text-reserve-on-surface-variant hover:text-reserve-primary transition-colors flex items-center gap-2"
              href="#"
            >
              <MaterialIcon name="help_outline" className="text-sm" />
              Need help?
            </a>
            <a
              className="text-xs font-medium text-reserve-on-surface-variant hover:text-reserve-primary transition-colors flex items-center gap-2"
              href="#"
            >
              <MaterialIcon name="verified_user" className="text-sm" />
              Security
            </a>
          </div>
          <p className="text-[10px] text-reserve-outline text-center leading-relaxed">
            Reserved access for registered club members.
            <br />
            Unauthorized access is strictly prohibited.
          </p>
        </footer>
      </main>

      {/* Side Decoration - Editorial feel */}
      <div className="fixed left-8 bottom-8 hidden lg:block origin-left -rotate-90">
        <p className="font-headline text-xs tracking-[0.5em] text-reserve-outline/30 uppercase italic">
          Established MCMXXIV
        </p>
      </div>

      {/* Background Decorative Blurs */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[60%] bg-reserve-primary-container/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[30%] h-[50%] bg-reserve-tertiary-container/5 rounded-full blur-[100px]" />
      </div>
    </div>
  );
}
