"use client";

import { useState } from "react";
import { X, Send, UserPlus, Copy, Check } from "lucide-react";
import type { MembershipTierLevel } from "@club/shared";

interface AddMemberModalProps {
  tiers: { id: string; name: string; level: MembershipTierLevel }[];
  onClose: () => void;
  onSuccess: () => void;
}

export function AddMemberModal({ tiers, onClose, onSuccess }: AddMemberModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"admin" | "staff" | "member">("member");
  const [tierId, setTierId] = useState<string>("");
  const [memberNumber, setMemberNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [sendInvite, setSendInvite] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          phone: phone || undefined,
          role,
          membership_tier_id: tierId || null,
          member_number: memberNumber || undefined,
          notes: notes || undefined,
          send_invite: sendInvite,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create member");
        return;
      }

      // Show the invite URL so admin can share it
      if (data.invite_url) {
        setInviteUrl(data.invite_url);
      } else {
        onSuccess();
        onClose();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyInviteUrl() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDone() {
    onSuccess();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold">
              {inviteUrl ? "Invite Created" : "Add New Member"}
            </h2>
          </div>
          <button
            onClick={inviteUrl ? handleDone : onClose}
            className="rounded-lg p-1 hover:bg-[var(--muted)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Invite URL success state */}
        {inviteUrl ? (
          <div className="p-6 space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-4">
              <p className="text-sm text-green-800 font-medium">
                Member created! Share this invite link with {firstName}:
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inviteUrl}
                readOnly
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm font-mono"
              />
              <button
                onClick={copyInviteUrl}
                className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-[var(--muted-foreground)]">
              This link expires in 7 days. The member will use it to set their password and activate their account.
            </p>

            <button
              onClick={handleDone}
              className="w-full rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="first-name" className="text-sm font-medium">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="last-name" className="text-sm font-medium">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-sm font-medium">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            {/* Role + Tier row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="role" className="text-sm font-medium">
                  Role
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "admin" | "staff" | "member")
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                >
                  <option value="member">Member</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="tier" className="text-sm font-medium">
                  Membership Tier
                </label>
                <select
                  id="tier"
                  value={tierId}
                  onChange={(e) => setTierId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                >
                  <option value="">No tier</option>
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Member number */}
            <div className="space-y-1.5">
              <label htmlFor="member-number" className="text-sm font-medium">
                Member Number <span className="text-[var(--muted-foreground)] font-normal">(optional)</span>
              </label>
              <input
                id="member-number"
                type="text"
                value={memberNumber}
                onChange={(e) => setMemberNumber(e.target.value)}
                placeholder="e.g. 1001"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label htmlFor="notes" className="text-sm font-medium">
                Notes <span className="text-[var(--muted-foreground)] font-normal">(optional)</span>
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
              />
            </div>

            {/* Send invite toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={sendInvite}
                onChange={(e) => setSendInvite(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]"
              />
              <div>
                <span className="text-sm font-medium">Send invite link</span>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Generate a link for the member to set their password and activate their account
                </p>
              </div>
            </label>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  "Creating..."
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {sendInvite ? "Create & Invite" : "Create Member"}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
