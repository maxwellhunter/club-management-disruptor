"use client";

import { useState, useEffect, useCallback } from "react";
import type { MemberRole } from "@club/shared";
import DiningMember from "./dining-member";
import DiningAdmin from "./dining-admin";

export default function DiningPage() {
  const [role, setRole] = useState<MemberRole>("member");
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        if (data.role) setRole(data.role);
      }
    } catch (err) {
      console.error("Failed to fetch role:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-[var(--muted)]" />
          <div className="h-64 rounded-xl bg-[var(--muted)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Dining</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          {role === "admin"
            ? "Manage reservations, orders, and menus"
            : "Reserve a table or order food"}
        </p>
      </div>

      {role === "admin" ? <DiningAdmin /> : <DiningMember />}
    </div>
  );
}
