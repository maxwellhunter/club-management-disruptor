"use client";

import { useState, useEffect } from "react";
import { X, FileText } from "lucide-react";

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface CreateInvoiceModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateInvoiceModal({ onClose, onSuccess }: CreateInvoiceModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
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
      const res = await fetch("/api/billing/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          amount: parsedAmount,
          description,
          due_date: dueDate,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create invoice");
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
            <FileText className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold">Create Invoice</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--muted)] transition-colors">
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
            <label htmlFor="inv-member" className="text-sm font-medium">
              Member <span className="text-red-500">*</span>
            </label>
            <select
              id="inv-member"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
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
            <label htmlFor="inv-description" className="text-sm font-medium">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              id="inv-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="e.g. Monthly dues - April 2026"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="inv-amount" className="text-sm font-medium">
                Amount ($) <span className="text-red-500">*</span>
              </label>
              <input
                id="inv-amount"
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
              <label htmlFor="inv-due" className="text-sm font-medium">
                Due Date <span className="text-red-500">*</span>
              </label>
              <input
                id="inv-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          </div>

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
              {submitting ? "Creating..." : "Create Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
