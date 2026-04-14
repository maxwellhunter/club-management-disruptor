"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarCheck, CircleAlert } from "lucide-react";
import type { MemberRole } from "@club/shared";
import { ImageUpload } from "@/components/image-upload";
import TeeTimeBooking from "./tee-time-booking";
import MyBookings from "./my-bookings";
import ScheduleAdmin from "./schedule-admin";
import GolfRatesAdmin from "./golf-rates-admin";
import PlayerRatesAdmin from "./player-rates-admin";
import CourseSetupAdmin from "./course-setup-admin";
import SpacesBooking from "./spaces-booking";
import SpacesAdmin from "./spaces-admin";

type BookingsTab =
  | "bookings"
  | "spaces"
  | "schedule"
  | "pricing"
  | "player-rates"
  | "course"
  | "spaces-admin";

export default function BookingsPage() {
  const [showBooking, setShowBooking] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isEligible, setIsEligible] = useState<boolean | null>(null);
  const [role, setRole] = useState<MemberRole>("member");
  const [tab, setTab] = useState<BookingsTab>("bookings");
  const [bookingsHeroUrl, setBookingsHeroUrl] = useState("");
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [heroExpanded, setHeroExpanded] = useState(false);

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

  useEffect(() => {
    async function fetchHero() {
      try {
        const res = await fetch("/api/club/bookings-image");
        if (res.ok) {
          const data = await res.json();
          setBookingsHeroUrl(data.bookings_image_url ?? "");
        }
      } catch {
        // ignore
      } finally {
        setHeroLoaded(true);
      }
    }
    fetchHero();
  }, []);

  async function handleHeroChange(url: string) {
    setBookingsHeroUrl(url);
    try {
      await fetch("/api/club/bookings-image", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookings_image_url: url || null }),
      });
    } catch {
      // ignore
    }
  }

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

      {/* Bookings Hero Image — admin only, collapsible */}
      {isAdmin && heroLoaded && (
        <div className="rounded-2xl bg-[var(--surface-lowest)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[var(--outline-variant)]/30 overflow-hidden">
          <button
            type="button"
            onClick={() => setHeroExpanded(!heroExpanded)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted)]/50 transition-colors"
          >
            {bookingsHeroUrl ? (
              <img src={bookingsHeroUrl} alt="" className="h-8 w-14 rounded object-cover" />
            ) : (
              <div className="h-8 w-14 rounded bg-[var(--muted)] flex items-center justify-center">
                <CalendarCheck className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
              </div>
            )}
            <span className="text-xs font-semibold text-[var(--foreground)]">
              Bookings Hero Image
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {bookingsHeroUrl ? "Uploaded" : "Not set"} · shown in iOS app
            </span>
            <svg
              className={`ml-auto h-4 w-4 text-[var(--muted-foreground)] transition-transform ${heroExpanded ? "rotate-180" : ""}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          {heroExpanded && (
            <div className="px-4 pb-4">
              <ImageUpload
                value={bookingsHeroUrl}
                onChange={handleHeroChange}
                bucket="facility-images"
                label=""
                aspect="video"
                placeholder="Upload a hero image for the bookings screen"
              />
            </div>
          )}
        </div>
      )}

      {/* Member tabs (Golf / Spaces) */}
      {!isAdmin && (
        <div className="flex gap-1 border-b border-[var(--border)]">
          {(
            [
              { key: "bookings", label: "Golf" },
              { key: "spaces", label: "Spaces" },
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

      {/* Admin tabs */}
      {isAdmin && (
        <div className="flex gap-1 border-b border-[var(--border)] overflow-x-auto">
          {(
            [
              { key: "bookings", label: "Bookings" },
              { key: "spaces", label: "Spaces" },
              { key: "schedule", label: "Schedule Config" },
              { key: "pricing", label: "Golf Pricing" },
              { key: "player-rates", label: "Player Rates" },
              { key: "course", label: "Course Setup" },
              { key: "spaces-admin", label: "Manage Spaces" },
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

      {tab === "spaces" ? (
        <SpacesBooking />
      ) : tab === "schedule" && isAdmin ? (
        <ScheduleAdmin />
      ) : tab === "pricing" && isAdmin ? (
        <GolfRatesAdmin />
      ) : tab === "player-rates" && isAdmin ? (
        <PlayerRatesAdmin />
      ) : tab === "course" && isAdmin ? (
        <CourseSetupAdmin />
      ) : tab === "spaces-admin" && isAdmin ? (
        <SpacesAdmin />
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
