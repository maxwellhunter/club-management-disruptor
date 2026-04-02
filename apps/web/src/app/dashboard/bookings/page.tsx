"use client";

import { useState, useEffect, useCallback } from "react";
import { CircleAlert } from "lucide-react";
import type { MemberRole } from "@club/shared";
import TeeTimeBooking from "./tee-time-booking";
import MyBookings from "./my-bookings";
import ScheduleAdmin from "./schedule-admin";
import GolfRatesAdmin from "./golf-rates-admin";

type BookingsTab = "bookings" | "schedule" | "pricing";

export default function BookingsPage() {
  const [showBooking, setShowBooking] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isEligible, setIsEligible] = useState<boolean | null>(null);
  const [role, setRole] = useState<MemberRole>("member");
  const [tab, setTab] = useState<BookingsTab>("bookings");

  const fetchRole = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        if (data.role) setRole(data.role);
      }
    } catch {
      // default to member
    }
  }, []);

  useEffect(() => {
    checkEligibility();
    fetchRole();
  }, [fetchRole]);

  async function checkEligibility() {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split("T")[0];

      const res = await fetch(
        `/api/bookings/tee-times?facility_id=00000000-0000-0000-0000-000000000101&date=${dateStr}`
      );

      if (res.status === 403) {
        setIsEligible(false);
      } else {
        setIsEligible(true);
      }
    } catch {
      setIsEligible(true);
    }
  }

  function handleBooked() {
    setShowBooking(false);
    setRefreshKey((k) => k + 1);
  }

  const isAdmin = role === "admin";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-[var(--muted-foreground)]">
            {isAdmin
              ? "Manage schedules, tee times, and facility bookings."
              : "Tee times, dining reservations, and court bookings."}
          </p>
        </div>
        {tab === "bookings" && isEligible !== false && (
          <button
            onClick={() => setShowBooking(true)}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
          >
            Book a Tee Time
          </button>
        )}
      </div>

      {/* Admin tabs */}
      {isAdmin && (
        <div className="flex gap-1 border-b border-[var(--border)]">
          {(
            [
              { key: "bookings", label: "Bookings" },
              { key: "schedule", label: "Schedule Config" },
              { key: "pricing", label: "Golf Pricing" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === "schedule" && isAdmin ? (
        <ScheduleAdmin />
      ) : tab === "pricing" && isAdmin ? (
        <GolfRatesAdmin />
      ) : (
        <>
          {/* Non-eligible upgrade prompt */}
          {isEligible === false && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
              <CircleAlert className="h-8 w-8 mx-auto mb-3 text-amber-600" />
              <h2 className="text-lg font-semibold text-amber-900">
                Golf Booking Requires an Upgrade
              </h2>
              <p className="text-sm text-amber-700 mt-1 max-w-md mx-auto">
                Your current membership doesn&apos;t include golf privileges.
                Upgrade to Golf, Platinum, or Legacy to book tee times.
              </p>
              <button className="mt-4 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 transition-colors">
                Contact Us to Upgrade
              </button>
            </div>
          )}

          {/* Booking flow */}
          {showBooking && isEligible && (
            <TeeTimeBooking
              onBooked={handleBooked}
              onClose={() => setShowBooking(false)}
            />
          )}

          {/* My bookings list */}
          {isEligible !== false && <MyBookings key={refreshKey} />}
        </>
      )}
    </div>
  );
}
