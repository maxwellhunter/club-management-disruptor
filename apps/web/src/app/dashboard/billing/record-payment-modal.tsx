"use client";

import { useState, useEffect } from "react";
import { X, DollarSign } from "lucide-react";

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface RecordPaymentModalProps {
  onClose: () => void;
  onSuccess: () => void;
  /** Pre-fill from an invoice */
  prefill?: {
    memberId: string;
    invoiceId: string;
    amount: number;
    description: string;
  };
}

const PAYMENT_METHODS = [
  { value: "check", label: "Check" },
  { value: "cash", label: "Cash" },
  { value: "ach", label: "ACH / Bank Transfer" },
  { value: "card", label: "Card (manual)" },
  { value: "other", label: "Other" },
];

export function RecordPaymentModal({
  onClose,
  onSuccess,
  prefill,
}: RecordPaymentModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [memberId, setMemberId] = useState(prefill?.memberId ?? "");
  const [amount, setAmount] = useState(prefill?.amount?.toString() ?? "");
  const [method, setMethod] = useState("check");
  const [description, setDescription] = useState(prefill?.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMembers() {
      const res = await fetch("/api/members?status=active");
      if (res.ok) {
        const data = await res.json();
        setMembers(
          (data.members || []).map((m: Member) => ({
            id: m.id,
            first_name: m.first_name,
            last_name: m.last_name,
            email: m.email,
          }))
        );
      }
    }
    fetchMembers();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/billing/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          amount: parsedAmount,
          method,
          description,
          invoice_id: prefill?.invoiceId || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to record payment");
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold">Record Payment</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-[var(--muted)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="pay-member" className="text-sm font-medium">
              Member <span className="text-red-500">*</span>
            </label>
            <select
              id="pay-member"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              required
              disabled={!!prefill?.memberId}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60"
            >
              <option value="">Select a member...</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name} ({m.email})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="pay-description" className="text-sm font-medium">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              id="pay-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="e.g. Check #1234 — April dues"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="pay-amount" className="text-sm font-medium">
                Amount ($) <span className="text-red-500">*</span>
              </label>
              <input
                id="pay-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="0.00"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="pay-method" className="text-sm font-medium">
                Method <span className="text-red-500">*</span>
              </label>
              <select
                id="pay-method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {prefill?.invoiceId && (
            <p className="text-xs text-[var(--muted-foreground)]">
              This payment will be linked to invoice and mark it as paid.
            </p>
          )}

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
              className="flex-1 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
