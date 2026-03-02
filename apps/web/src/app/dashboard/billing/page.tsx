"use client";

import { useState, useEffect } from "react";
import { BillingMember } from "./billing-member";
import { BillingAdmin } from "./billing-admin";
import type { BillingStatus } from "@club/shared";

export default function BillingPage() {
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/billing/status");
        if (res.ok) {
          const data: BillingStatus = await res.json();
          setBillingStatus(data);
        }
      } catch (err) {
        console.error("Failed to fetch billing status:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-[var(--muted-foreground)]">
            Manage dues, invoices, and payment processing.
          </p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const isAdmin = billingStatus?.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-[var(--muted-foreground)]">
          {isAdmin
            ? "Manage club billing, invoices, and payment processing."
            : "Manage your subscription and view invoices."}
        </p>
      </div>

      {isAdmin ? (
        <BillingAdmin />
      ) : (
        <BillingMember billingStatus={billingStatus} />
      )}
    </div>
  );
}
