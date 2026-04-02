"use client";

import { useState, useEffect } from "react";
import type { MembershipTier, MembershipTierLevel } from "@club/shared";

interface TierFormModalProps {
  tier?: MembershipTier | null;
  onClose: () => void;
  onSaved: () => void;
}

const TIER_LEVELS: { value: MembershipTierLevel; label: string; description: string }[] = [
  { value: "standard", label: "Standard", description: "Basic club access" },
  { value: "premium", label: "Premium", description: "Enhanced privileges (e.g. golf)" },
  { value: "vip", label: "VIP", description: "All-access with priority" },
  { value: "honorary", label: "Honorary", description: "Complimentary / legacy" },
];

export function TierFormModal({ tier, onClose, onSaved }: TierFormModalProps) {
  const isEditing = !!tier;

  const [name, setName] = useState(tier?.name ?? "");
  const [level, setLevel] = useState<MembershipTierLevel>(tier?.level ?? "standard");
  const [description, setDescription] = useState(tier?.description ?? "");
  const [monthlyDues, setMonthlyDues] = useState(tier?.monthly_dues?.toString() ?? "");
  const [annualDues, setAnnualDues] = useState(tier?.annual_dues?.toString() ?? "");
  const [benefits, setBenefits] = useState<string[]>(tier?.benefits ?? []);
  const [newBenefit, setNewBenefit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function addBenefit() {
    const trimmed = newBenefit.trim();
    if (trimmed && !benefits.includes(trimmed)) {
      setBenefits([...benefits, trimmed]);
      setNewBenefit("");
    }
  }

  function removeBenefit(index: number) {
    setBenefits(benefits.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const monthly = parseFloat(monthlyDues);
    if (isNaN(monthly) || monthly < 0) {
      setError("Monthly dues must be a valid number >= 0");
      setSaving(false);
      return;
    }

    const annual = annualDues ? parseFloat(annualDues) : undefined;
    if (annual !== undefined && (isNaN(annual) || annual < 0)) {
      setError("Annual dues must be a valid number >= 0");
      setSaving(false);
      return;
    }

    const payload = {
      name: name.trim(),
      level,
      description: description.trim() || undefined,
      monthly_dues: monthly,
      annual_dues: annual,
      benefits,
    };

    try {
      const url = isEditing ? `/api/tiers/${tier.id}` : "/api/tiers";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save tier");
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-[var(--background)] border border-[var(--border)] shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[var(--border)] p-6">
          <h2 className="text-lg font-semibold">
            {isEditing ? "Edit Tier" : "Create Membership Tier"}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Tier Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Gold, Platinum, Family"
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          {/* Level */}
          <div>
            <label className="block text-sm font-medium mb-1">Access Level</label>
            <div className="grid grid-cols-2 gap-2">
              {TIER_LEVELS.map((tl) => (
                <button
                  key={tl.value}
                  type="button"
                  onClick={() => setLevel(tl.value)}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                    level === tl.value
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                      : "border-[var(--border)] hover:border-[var(--muted-foreground)]"
                  }`}
                >
                  <div className="font-medium">{tl.label}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {tl.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Description <span className="text-[var(--muted-foreground)]">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description of this tier..."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
            />
          </div>

          {/* Dues */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Monthly Dues ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={monthlyDues}
                onChange={(e) => setMonthlyDues(e.target.value)}
                placeholder="0.00"
                required
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Annual Dues ($) <span className="text-[var(--muted-foreground)]">(optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={annualDues}
                onChange={(e) => setAnnualDues(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
          </div>

          {/* Benefits */}
          <div>
            <label className="block text-sm font-medium mb-1">Benefits</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newBenefit}
                onChange={(e) => setNewBenefit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addBenefit();
                  }
                }}
                placeholder="Add a benefit and press Enter"
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
              <button
                type="button"
                onClick={addBenefit}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
              >
                Add
              </button>
            </div>
            {benefits.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {benefits.map((b, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] px-3 py-1 text-xs font-medium"
                  >
                    {b}
                    <button
                      type="button"
                      onClick={() => removeBenefit(i)}
                      className="ml-0.5 hover:text-red-500"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
            {benefits.length === 0 && (
              <p className="text-xs text-[var(--muted-foreground)]">
                No benefits added yet. Type and press Enter to add.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Tier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
