"use client";

import { useState, useEffect } from "react";
import type { BillingOverview } from "@club/shared";

export function BillingAdmin() {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOverview() {
      try {
        const res = await fetch("/api/billing/admin/overview");
        if (res.ok) {
          const data: BillingOverview = await res.json();
          setOverview(data);
        }
      } catch (err) {
        console.error("Failed to fetch billing overview:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchOverview();
  }, []);

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse" />
      </div>
    );
  }

  return (
    <>
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] p-6">
          <p className="text-sm text-[var(--muted-foreground)]">
            Outstanding Balance
          </p>
          <p className="text-3xl font-bold mt-1">
            {formatCurrency(overview?.outstandingBalance ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-6">
          <p className="text-sm text-[var(--muted-foreground)]">
            Collected (MTD)
          </p>
          <p className="text-3xl font-bold mt-1">
            {formatCurrency(overview?.collectedMtd ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-6">
          <p className="text-sm text-[var(--muted-foreground)]">
            Overdue Invoices
          </p>
          <p className="text-3xl font-bold mt-1 text-red-600">
            {overview?.overdueCount ?? 0}
          </p>
        </div>
      </div>

      {/* Recent invoices table */}
      <div className="rounded-xl border border-[var(--border)]">
        <div className="p-5 border-b border-[var(--border)]">
          <h2 className="font-semibold">Recent Invoices</h2>
        </div>

        {overview?.recentInvoices && overview.recentInvoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">
                    Member
                  </th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">
                    Description
                  </th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">
                    Due Date
                  </th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)]">
                    Status
                  </th>
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)] text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {overview.recentInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-[var(--muted)]/50">
                    <td className="px-5 py-3 font-medium">
                      {invoice.member_name}
                    </td>
                    <td className="px-5 py-3 text-[var(--muted-foreground)]">
                      {invoice.description}
                    </td>
                    <td className="px-5 py-3 text-[var(--muted-foreground)]">
                      {formatDate(invoice.due_date)}
                    </td>
                    <td className="px-5 py-3">
                      {invoiceStatusBadge(invoice.status)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium">
                      {formatCurrency(invoice.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">
              No invoices yet. Invoices will appear here once members set up
              billing and Stripe starts generating them.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
