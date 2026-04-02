"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import type { InviteInfo } from "@club/shared";

export default function InviteClaimPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadInvite() {
      try {
        const res = await fetch(`/api/invite/${token}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Invalid invite link");
          return;
        }
        const data: InviteInfo = await res.json();
        setInvite(data);
      } catch {
        setError("Failed to load invite. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    loadInvite();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create account");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="h-8 w-8 mx-auto rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
          <p className="text-sm text-[var(--muted-foreground)]">
            Loading your invitation...
          </p>
        </div>
      </div>
    );
  }

  // Error state (invalid/expired token)
  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Invite Not Found</h1>
          <p className="text-[var(--muted-foreground)]">
            {error || "This invite link is invalid or has expired."}
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            Contact your club administrator for a new invitation.
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-50 flex items-center justify-center">
            <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Welcome to {invite.club_name}!</h1>
          <p className="text-[var(--muted-foreground)]">
            Your account has been created. Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  // Main invite claim form
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-[var(--background)]">
      <div className="w-full max-w-md space-y-6">
        {/* Club branding */}
        <div className="text-center space-y-3">
          {invite.club_logo_url ? (
            <img
              src={invite.club_logo_url}
              alt={invite.club_name}
              className="h-16 w-16 mx-auto rounded-xl object-cover"
            />
          ) : (
            <div className="h-16 w-16 mx-auto rounded-xl bg-[var(--primary)] flex items-center justify-center">
              <span className="text-2xl font-bold text-[var(--primary-foreground)]">
                {invite.club_name.charAt(0)}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">{invite.club_name}</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              You&apos;ve been invited to join
            </p>
          </div>
        </div>

        {/* Member info card */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/50 p-4 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center text-sm font-semibold">
              {invite.first_name[0]}
              {invite.last_name[0]}
            </div>
            <div>
              <p className="font-semibold">
                {invite.first_name} {invite.last_name}
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">
                {invite.email}
              </p>
            </div>
          </div>
          {invite.tier_name && (
            <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <span>Membership:</span>
              <span className="font-medium text-[var(--foreground)]">
                {invite.tier_name}
              </span>
            </div>
          )}
        </div>

        {/* Password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Create a Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-sm font-medium">
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              minLength={8}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? "Creating your account..." : "Activate My Account"}
          </button>
        </form>

        <p className="text-center text-xs text-[var(--muted-foreground)]">
          Already have an account?{" "}
          <a href="/login" className="text-[var(--primary)] hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
