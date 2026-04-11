"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface OpenTab {
  member_id: string;
  member_name?: string;
  first_name: string;
  last_name: string;
  member_number: string | null;
  charge_count?: number;
  tx_count?: number;
  total?: number;
  tab_total?: number;
}

interface ChargeItem {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface ChargeDetail {
  id: string;
  created_at: string;
  location_name: string;
  location_type: string;
  description: string | null;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  items: ChargeItem[];
}

interface MemberTabDetail {
  total: number;
  charges: ChargeDetail[];
}

const LOCATION_BADGES: Record<string, string> = {
  dining: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  bar: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
  pro_shop:
    "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  snack_bar:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
};

export default function MemberTabsTab() {
  const now = new Date();
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [tabDetail, setTabDetail] = useState<MemberTabDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [consolidating, setConsolidating] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const fetchOpenTabs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pos/charges/open-tabs?period=${period}`
      );
      if (res.ok) {
        const data = await res.json();
        setOpenTabs(data.tabs ?? data ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchOpenTabs();
    setExpandedMember(null);
    setTabDetail(null);
  }, [fetchOpenTabs]);

  async function fetchTabDetail(memberId: string) {
    setLoadingDetail(true);
    try {
      const res = await fetch(
        `/api/pos/charges/tab?member_id=${memberId}&period=${period}`
      );
      if (res.ok) {
        const data = await res.json();
        setTabDetail(data);
      }
    } catch {
      // silent
    } finally {
      setLoadingDetail(false);
    }
  }

  function toggleMember(memberId: string) {
    if (expandedMember === memberId) {
      setExpandedMember(null);
      setTabDetail(null);
    } else {
      setExpandedMember(memberId);
      fetchTabDetail(memberId);
    }
  }

  async function handleConsolidate(memberId: string) {
    setConsolidating(memberId);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/pos/charges/consolidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, period }),
      });

      if (res.ok) {
        const data = await res.json();
        setStatusMessage({
          type: "success",
          text: `Invoice created (ID: ${data.invoice_id ?? "created"}). Charges consolidated successfully.`,
        });
        fetchOpenTabs();
        setExpandedMember(null);
        setTabDetail(null);
      } else if (res.status === 409) {
        setStatusMessage({
          type: "info",
          text: "Already invoiced for this period.",
        });
      } else {
        const data = await res.json();
        setStatusMessage({
          type: "error",
          text: data.error || "Failed to consolidate charges.",
        });
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: "Failed to consolidate. Please try again.",
      });
    } finally {
      setConsolidating(null);
      setTimeout(() => setStatusMessage(null), 6000);
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatLocationLabel(type: string) {
    return type
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  // Generate month options (past 12 months)
  const monthOptions: { label: string; value: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push({
      label: d.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    });
  }

  const totalOutstanding = openTabs.reduce((sum, tab) => sum + (tab.total ?? tab.tab_total ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Status message */}
      {statusMessage && (
        <div
          className={`rounded-lg border p-3 text-sm flex items-center gap-2 ${
            statusMessage.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
              : statusMessage.type === "info"
                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : statusMessage.type === "info" ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {statusMessage.text}
        </div>
      )}

      {/* Period picker + summary */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-[var(--muted-foreground)]">
            Period
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {!loading && openTabs.length > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-[var(--muted-foreground)]">
              {openTabs.length} open tab{openTabs.length !== 1 ? "s" : ""}
            </span>
            <span className="font-semibold tabular-nums">
              ${totalOutstanding.toFixed(2)} outstanding
            </span>
          </div>
        )}
      </div>

      {/* Open tabs list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse"
            />
          ))}
        </div>
      ) : openTabs.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
          <DollarSign className="h-8 w-8 text-[var(--muted-foreground)]/30 mx-auto mb-2" />
          <p className="text-sm text-[var(--muted-foreground)]">
            No open tabs for this period.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {openTabs.map((tab) => {
            const isExpanded = expandedMember === tab.member_id;
            const displayName =
              tab.member_name ??
              `${tab.first_name ?? ""} ${tab.last_name ?? ""}`.trim() ??
              "Unknown Member";
            const chargeCount = tab.charge_count ?? tab.tx_count ?? 0;
            const tabTotal = tab.total ?? tab.tab_total ?? 0;

            return (
              <div
                key={tab.member_id}
                className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
              >
                {/* Tab row */}
                <button
                  onClick={() => toggleMember(tab.member_id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--muted)]/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold">
                      {displayName
                        .split(" ")
                        .map((w: string) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{displayName}</p>
                        {tab.member_number && (
                          <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded">
                            #{tab.member_number}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {chargeCount} charge
                        {chargeCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold tabular-nums">
                      ${tabTotal.toFixed(2)}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-[var(--muted-foreground)]" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-4 space-y-3">
                    {loadingDetail ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="animate-spin h-5 w-5 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
                      </div>
                    ) : tabDetail && tabDetail.charges?.length > 0 ? (
                      <>
                        <div className="space-y-2">
                          {tabDetail.charges.map((charge) => (
                            <div
                              key={charge.id}
                              className="rounded-lg border border-zinc-100 dark:border-zinc-800 bg-[var(--muted)]/30 p-3"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                                  <span className="text-xs text-[var(--muted-foreground)]">
                                    {formatDate(charge.created_at)}
                                  </span>
                                  <span
                                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                      LOCATION_BADGES[charge.location_type] ??
                                      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                    }`}
                                  >
                                    {charge.location_name ??
                                      formatLocationLabel(
                                        charge.location_type ?? "unknown"
                                      )}
                                  </span>
                                </div>
                                <span className="text-sm font-semibold tabular-nums">
                                  ${charge.total.toFixed(2)}
                                </span>
                              </div>

                              {charge.description && (
                                <p className="text-xs text-[var(--muted-foreground)] mb-1.5">
                                  {charge.description}
                                </p>
                              )}

                              {charge.items && charge.items.length > 0 && (
                                <div className="space-y-0.5">
                                  {charge.items.map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="flex justify-between text-xs"
                                    >
                                      <span className="text-[var(--muted-foreground)]">
                                        {item.quantity}x {item.name}
                                      </span>
                                      <span className="text-[var(--muted-foreground)] tabular-nums">
                                        ${(item.quantity * item.unit_price).toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {(charge.tax > 0 || charge.tip > 0) && (
                                <div className="mt-1 pt-1 border-t border-zinc-100 dark:border-zinc-800 space-y-0.5">
                                  {charge.tax > 0 && (
                                    <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
                                      <span>Tax</span>
                                      <span className="tabular-nums">
                                        ${charge.tax.toFixed(2)}
                                      </span>
                                    </div>
                                  )}
                                  {charge.tip > 0 && (
                                    <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
                                      <span>Tip</span>
                                      <span className="tabular-nums">
                                        ${charge.tip.toFixed(2)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Consolidate button */}
                        <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700">
                          <div className="text-sm">
                            <span className="text-[var(--muted-foreground)]">
                              Tab total:{" "}
                            </span>
                            <span className="font-bold tabular-nums">
                              ${tabDetail.total.toFixed(2)}
                            </span>
                          </div>
                          <button
                            onClick={() => handleConsolidate(tab.member_id)}
                            disabled={consolidating === tab.member_id}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors"
                          >
                            <FileText className="h-4 w-4" />
                            {consolidating === tab.member_id
                              ? "Consolidating..."
                              : "Consolidate to Invoice"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
                        No charge details available.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
