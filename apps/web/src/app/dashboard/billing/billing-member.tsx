"use client";

import { useState } from "react";
import type { BillingStatus } from "@club/shared";

interface Props {
  billingStatus: BillingStatus | null;
}

export function BillingMember({ billingStatus }: Props) {
  const [setupLoading, setSetupLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const sub = billingStatus?.subscription;
  const hasSubscription = !!sub;

  async function handleSetup() {
    setSetupLoading(true);
    try {
      const res = await fetch("/api/billing/setup", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error || "Failed to start billing setup");
      }
    } catch {
      alert("Failed to start billing setup");
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleManage() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.portalUrl) {
        window.location.href = data.portalUrl;
      } else {
        alert(data.error || "Failed to open billing portal");
      }
    } catch {
      alert("Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }

  function statusBadge(status: string) {
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      past_due: "bg-yellow-100 text-yellow-800",
      canceled: "bg-red-100 text-red-800",
      unpaid: "bg-red-100 text-red-800",
      trialing: "bg-blue-100 text-blue-800",
      incomplete: "bg-gray-100 text-gray-800",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          colors[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {status.replace("_", " ")}
      </span>
    );
  }

  function invoiceStatusBadge(status: string) {
    const colors: Record<string, string> = {
      paid: "bg-green-100 text-green-800",
      sent: "bg-blue-100 text-blue-800",
      overdue: "bg-red-100 text-red-800",
      draft: "bg-gray-100 text-gray-800",
      cancelled: "bg-gray-100 text-gray-800",
      void: "bg-gray-100 text-gray-800",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          colors[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {status}
      </span>
    );
  }

  return (
    <>
      {/* Subscription card */}
      <div className="rounded-xl border border-[var(--border)] p-6">
        {hasSubscription ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-lg">
                  {sub.tierName} Membership
                </h2>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                  {formatCurrency(sub.amount)}/month
                </p>
              </div>
              {statusBadge(sub.status)}
            </div>

            <div className="flex flex-col gap-1 text-sm text-[var(--muted-foreground)]">
              <p>
                Next billing date:{" "}
                <span className="text-[var(--foreground)]">
                  {formatDate(sub.currentPeriodEnd)}
                </span>
              </p>
              {sub.cancelAtPeriodEnd && (
                <p className="text-amber-600">
                  ⚠ Subscription will cancel at end of period
                </p>
              )}
            </div>

            <button
              onClick={handleManage}
              disabled={portalLoading}
              className={`rounded-lg px-5 py-2 text-sm font-medium border border-[var(--border)] hover:bg-[var(--muted)] transition-colors ${
                portalLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {portalLoading ? "Opening..." : "Manage Subscription"}
            </button>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">💳</div>
            <h2 className="font-semibold text-lg">Set Up Billing</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-1 mb-5 max-w-sm mx-auto">
              {billingStatus?.tierName
                ? `Subscribe to your ${billingStatus.tierName} membership to get started with automatic billing.`
                : "Set up your membership subscription to enable automatic billing for your dues."}
            </p>
            <button
              onClick={handleSetup}
              disabled={setupLoading}
              className={`rounded-lg px-6 py-2.5 text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity ${
                setupLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {setupLoading ? "Setting up..." : "Set Up Billing"}
            </button>
          </div>
        )}
      </div>

      {/* Recent invoices */}
      <div className="rounded-xl border border-[var(--border)]">
        <div className="p-5 border-b border-[var(--border)]">
          <h2 className="font-semibold">Recent Invoices</h2>
        </div>

        {billingStatus?.recentInvoices &&
        billingStatus.recentInvoices.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {billingStatus.recentInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between px-5 py-3.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {invoice.description}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    Due {formatDate(invoice.due_date)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {invoiceStatusBadge(invoice.status)}
                  <span className="text-sm font-medium w-20 text-right">
                    {formatCurrency(invoice.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">
              No invoices yet.
              {!hasSubscription &&
                " Set up billing to start receiving invoices."}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
