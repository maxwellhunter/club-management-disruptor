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

  const isAdmin = role === "admin";

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div>
          <div className="h-8 w-48 rounded-lg bg-[var(--muted)] animate-pulse mb-2" />
          <div className="h-4 w-72 rounded-md bg-[var(--muted)] animate-pulse" />
        </div>
        {/* Tab bar skeleton */}
        <div className="h-10 w-64 rounded-xl bg-[var(--muted)] animate-pulse" />
        {/* Content skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-[var(--muted)] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isAdmin ? <DiningAdmin /> : <DiningMember />}
    </div>
  );
}
