"use client";

import { useState, useEffect, useCallback } from "react";
import type { MembershipTier, MembershipTierLevel } from "@club/shared";
import { TierFormModal } from "./tier-form-modal";

const LEVEL_BADGES: Record<MembershipTierLevel, { label: string; color: string }> = {
  standard: { label: "Standard", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  premium: { label: "Premium", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  vip: { label: "VIP", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  honorary: { label: "Honorary", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SettingsPage() {
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [role, setRole] = useState<string>("member");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTier, setEditingTier] = useState<MembershipTier | null>(null);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchTiers = useCallback(async () => {
    try {
      const res = await fetch("/api/tiers");
      if (res.ok) {
        const data = await res.json();
        setTiers(data.tiers);
        setMemberCounts(data.memberCounts || {});
        setRole(data.role);
      }
    } catch {
      console.error("Failed to fetch tiers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  // Close action menu on outside click
  useEffect(() => {
    if (!actionMenu) return;
    const handler = () => setActionMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [actionMenu]);

  const isAdmin = role === "admin";

  async function toggleActive(tier: MembershipTier) {
    try {
      const res = await fetch(`/api/tiers/${tier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !tier.is_active }),
      });
      if (res.ok) {
        fetchTiers();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update tier");
      }
    } catch {
      setError("Something went wrong");
    }
  }

  async function deleteTier(tier: MembershipTier) {
    if (!confirm(`Delete "${tier.name}" tier? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/tiers/${tier.id}`, { method: "DELETE" });
      if (res.ok) {
        fetchTiers();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete tier");
      }
    } catch {
      setError("Something went wrong");
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-[var(--muted)] rounded" />
          <div className="h-64 bg-[var(--muted)] rounded-xl" />
        </div>
      </div>
    );
  }

  // Non-admin view: read-only tier listing
  if (!isAdmin) {
    return (
      <div className="p-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Membership Tiers</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          {tiers
            .filter((t) => t.is_active)
            .map((tier) => (
              <div
                key={tier.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-5"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{tier.name}</h3>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      LEVEL_BADGES[tier.level].color
                    }`}
                  >
                    {LEVEL_BADGES[tier.level].label}
                  </span>
                </div>
                {tier.description && (
                  <p className="text-sm text-[var(--muted-foreground)] mb-3">
                    {tier.description}
                  </p>
                )}
                <div className="text-lg font-bold text-[var(--primary)]">
                  {formatCurrency(tier.monthly_dues)}
                  <span className="text-sm font-normal text-[var(--muted-foreground)]">
                    /month
                  </span>
                </div>
                {tier.annual_dues != null && tier.annual_dues > 0 && (
                  <div className="text-sm text-[var(--muted-foreground)]">
                    or {formatCurrency(tier.annual_dues)}/year
                  </div>
                )}
                {tier.benefits.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tier.benefits.map((b, i) => (
                      <span
                        key={i}
                        className="text-xs bg-[var(--muted)] px-2 py-0.5 rounded-full"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    );
  }

  // Admin view: full management
  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Manage membership tiers and club configuration
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-500 hover:text-red-700">
            &times;
          </button>
        </div>
      )}

      {/* Membership Tiers Section */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Membership Tiers</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              {tiers.length} tier{tiers.length !== 1 ? "s" : ""} configured
            </p>
          </div>
          <button
            onClick={() => {
              setEditingTier(null);
              setShowModal(true);
            }}
            className="rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + New Tier
          </button>
        </div>

        {tiers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">🏷️</div>
            <h3 className="font-semibold text-lg mb-1">No tiers yet</h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              Create membership tiers to organize your members and set pricing.
            </p>
            <button
              onClick={() => {
                setEditingTier(null);
                setShowModal(true);
              }}
              className="rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Create First Tier
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {tiers.map((tier) => {
              const count = memberCounts[tier.id] || 0;
              const badge = LEVEL_BADGES[tier.level];

              return (
                <div
                  key={tier.id}
                  className={`flex items-center gap-4 px-6 py-4 ${
                    !tier.is_active ? "opacity-50" : ""
                  }`}
                >
                  {/* Tier info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold truncate">{tier.name}</h3>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                      {!tier.is_active && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 shrink-0">
                          Inactive
                        </span>
                      )}
                    </div>
                    {tier.description && (
                      <p className="text-sm text-[var(--muted-foreground)] truncate">
                        {tier.description}
                      </p>
                    )}
                    {tier.benefits.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {tier.benefits.slice(0, 4).map((b, i) => (
                          <span
                            key={i}
                            className="text-xs bg-[var(--muted)] px-2 py-0.5 rounded-full"
                          >
                            {b}
                          </span>
                        ))}
                        {tier.benefits.length > 4 && (
                          <span className="text-xs text-[var(--muted-foreground)]">
                            +{tier.benefits.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pricing */}
                  <div className="text-right shrink-0">
                    <div className="font-semibold">
                      {formatCurrency(tier.monthly_dues)}
                      <span className="text-xs font-normal text-[var(--muted-foreground)]">
                        /mo
                      </span>
                    </div>
                    {tier.annual_dues != null && tier.annual_dues > 0 && (
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {formatCurrency(tier.annual_dues)}/yr
                      </div>
                    )}
                  </div>

                  {/* Member count */}
                  <div className="text-center shrink-0 w-16">
                    <div className="text-lg font-semibold">{count}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      member{count !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="relative shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMenu(actionMenu === tier.id ? null : tier.id);
                      }}
                      className="rounded-lg p-2 hover:bg-[var(--muted)] transition-colors"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                      >
                        <circle cx="8" cy="3" r="1.5" />
                        <circle cx="8" cy="8" r="1.5" />
                        <circle cx="8" cy="13" r="1.5" />
                      </svg>
                    </button>

                    {actionMenu === tier.id && (
                      <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg z-20 py-1">
                        <button
                          onClick={() => {
                            setEditingTier(tier);
                            setShowModal(true);
                            setActionMenu(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            toggleActive(tier);
                            setActionMenu(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
                        >
                          {tier.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => {
                            deleteTier(tier);
                            setActionMenu(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tier form modal */}
      {showModal && (
        <TierFormModal
          tier={editingTier}
          onClose={() => {
            setShowModal(false);
            setEditingTier(null);
          }}
          onSaved={() => {
            setShowModal(false);
            setEditingTier(null);
            fetchTiers();
          }}
        />
      )}
    </div>
  );
}
