"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  DollarSign,
  Send,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  AlertTriangle,
  Zap,
  Download,
} from "lucide-react";
import type { BillingOverview } from "@club/shared";
import { CreateInvoiceModal } from "./create-invoice-modal";
import { RecordPaymentModal } from "./record-payment-modal";

interface InvoiceActionState {
  invoiceId: string;
  action: "send" | "markPaid" | "void";
  loading: boolean;
}

export function BillingAdmin() {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [paymentPrefill, setPaymentPrefill] = useState<{
    memberId: string;
    invoiceId: string;
    amount: number;
    description: string;
  } | null>(null);
  const [actionState, setActionState] = useState<InvoiceActionState | null>(
    null
  );
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [stripeConnected, setStripeConnected] = useState<boolean | null>(null);

  const fetchOverview = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Check Stripe connection status
  useEffect(() => {
    async function checkStripe() {
      try {
        const res = await fetch("/api/billing/stripe-status");
        if (res.ok) {
          const data = await res.json();
          setStripeConnected(data.connected);
        } else {
          setStripeConnected(false);
        }
      } catch {
        setStripeConnected(false);
      }
    }
    checkStripe();
  }, []);

  async function handleInvoiceAction(
    invoiceId: string,
    action: "send" | "markPaid" | "void"
  ) {
    setOpenMenuId(null);
    setActionState({ invoiceId, action, loading: true });

    const statusMap = { send: "sent", markPaid: "paid", void: "void" } as const;

    try {
      const res = await fetch(`/api/billing/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusMap[action] }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || `Failed to ${action} invoice`);
      } else {
        await fetchOverview();
      }
    } catch {
      alert(`Failed to ${action} invoice`);
    } finally {
      setActionState(null);
    }
  }

  function handleMarkPaidWithPayment(invoice: BillingOverview["recentInvoices"][0]) {
    setOpenMenuId(null);
    setPaymentPrefill({
      memberId: invoice.member_id,
      invoiceId: invoice.id,
      amount: invoice.amount,
      description: `Payment for: ${invoice.description}`,
    });
    setShowRecordPayment(true);
  }

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

  /** Which actions are available given an invoice's current status */
  function getAvailableActions(status: string) {
    const actions: { key: string; label: string; icon: React.ReactNode }[] = [];
    if (status === "draft") {
      actions.push({
        key: "send",
        label: "Send to Member",
        icon: <Send className="h-3.5 w-3.5" />,
      });
    }
    if (status === "sent" || status === "overdue") {
      actions.push({
        key: "markPaidWithPayment",
        label: "Record Payment",
        icon: <CheckCircle className="h-3.5 w-3.5" />,
      });
      actions.push({
        key: "void",
        label: "Void Invoice",
        icon: <XCircle className="h-3.5 w-3.5" />,
      });
    }
    // PDF download available for all invoices
    actions.push({
      key: "downloadPdf",
      label: "Download PDF",
      icon: <Download className="h-3.5 w-3.5" />,
    });
    return actions;
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
      {/* Stripe connection status banner */}
      {stripeConnected === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              Stripe is not connected
            </p>
            <p className="text-sm text-amber-700 mt-0.5">
              Online payments and automatic subscription billing are disabled.
              You can still create invoices and record manual payments (check,
              cash, ACH). To enable Stripe, add your{" "}
              <code className="bg-amber-100 px-1 rounded text-xs">
                STRIPE_SECRET_KEY
              </code>{" "}
              and{" "}
              <code className="bg-amber-100 px-1 rounded text-xs">
                NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
              </code>{" "}
              to your environment variables.
            </p>
          </div>
        </div>
      )}

      {stripeConnected === true && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
          <Zap className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">
            <span className="font-medium">Stripe connected</span> — Online
            payments and subscription billing are active.
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowCreateInvoice(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
        >
          <FileText className="h-4 w-4" />
          Create Invoice
        </button>
        <button
          onClick={() => {
            setPaymentPrefill(null);
            setShowRecordPayment(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
        >
          <DollarSign className="h-4 w-4" />
          Record Payment
        </button>
      </div>

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
                  <th className="px-5 py-3 font-medium text-[var(--muted-foreground)] w-12">
                    {/* Actions column */}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {overview.recentInvoices.map((invoice) => {
                  const actions = getAvailableActions(invoice.status);
                  const isProcessing =
                    actionState?.invoiceId === invoice.id &&
                    actionState?.loading;

                  return (
                    <tr
                      key={invoice.id}
                      className="hover:bg-[var(--muted)]/50"
                    >
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
                      <td className="px-5 py-3">
                        {actions.length > 0 && (
                          <div className="relative">
                            <button
                              onClick={() =>
                                setOpenMenuId(
                                  openMenuId === invoice.id
                                    ? null
                                    : invoice.id
                                )
                              }
                              disabled={isProcessing}
                              className="rounded-lg p-1.5 hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
                            >
                              {isProcessing ? (
                                <div className="h-4 w-4 border-2 border-[var(--muted-foreground)] border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </button>

                            {openMenuId === invoice.id && (
                              <>
                                {/* Click-away overlay */}
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={() => setOpenMenuId(null)}
                                />
                                <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg py-1">
                                  {actions.map((action) => (
                                    <button
                                      key={action.key}
                                      onClick={() => {
                                        if (
                                          action.key ===
                                          "markPaidWithPayment"
                                        ) {
                                          handleMarkPaidWithPayment(invoice);
                                        } else if (
                                          action.key === "downloadPdf"
                                        ) {
                                          setOpenMenuId(null);
                                          window.open(
                                            `/api/billing/invoices/${invoice.id}/pdf`,
                                            "_blank"
                                          );
                                        } else {
                                          handleInvoiceAction(
                                            invoice.id,
                                            action.key as
                                              | "send"
                                              | "markPaid"
                                              | "void"
                                          );
                                        }
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors text-left"
                                    >
                                      {action.icon}
                                      {action.label}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">
              No invoices yet. Click &quot;Create Invoice&quot; to get started, or
              invoices will appear here automatically once Stripe is connected
              and members subscribe.
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateInvoice && (
        <CreateInvoiceModal
          onClose={() => setShowCreateInvoice(false)}
          onSuccess={() => fetchOverview()}
        />
      )}

      {showRecordPayment && (
        <RecordPaymentModal
          onClose={() => {
            setShowRecordPayment(false);
            setPaymentPrefill(null);
          }}
          onSuccess={() => fetchOverview()}
          prefill={paymentPrefill ?? undefined}
        />
      )}
    </>
  );
}
