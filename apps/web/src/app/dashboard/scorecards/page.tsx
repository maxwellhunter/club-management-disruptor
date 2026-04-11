"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Flag, Clock, Plus } from "lucide-react";
import type { GolfRoundSummary, MemberRole } from "@club/shared";
import { ScorecardHistory } from "./scorecard-history";
import { NewRoundModal } from "./new-round-modal";

interface Facility {
  id: string;
  name: string;
}

interface UpcomingBooking {
  id: string;
  facility_id: string;
  facility_name: string;
  facility_type: string;
  date: string;
  start_time: string;
  party_size: number;
}

export default function ScorecardsPage() {
  const [rounds, setRounds] = useState<GolfRoundSummary[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [role, setRole] = useState<MemberRole>("member");
  const [loading, setLoading] = useState(true);
  const [showNewRound, setShowNewRound] = useState(false);
  const [todayBookings, setTodayBookings] = useState<UpcomingBooking[]>([]);
  const [startingFromBooking, setStartingFromBooking] =
    useState<UpcomingBooking | null>(null);

  const fetchRounds = useCallback(async () => {
    try {
      const res = await fetch("/api/scorecards");
      if (res.ok) {
        const data = await res.json();
        setRounds(data.rounds ?? []);
        if (data.facilities) setFacilities(data.facilities);
        if (data.role) setRole(data.role);
      }
    } catch (err) {
      console.error("Failed to fetch rounds:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch today's golf bookings to show "Start Round" prompts
  const fetchTodayBookings = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings/my");
      if (res.ok) {
        const data = await res.json();
        const today = new Date().toISOString().split("T")[0];
        const golfToday = (data.bookings ?? []).filter(
          (b: UpcomingBooking) =>
            b.date === today && b.facility_type === "golf"
        );
        setTodayBookings(golfToday);
      }
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchRounds();
    fetchTodayBookings();
  }, [fetchRounds, fetchTodayBookings]);

  // Separate active (in_progress) from completed/past rounds
  const activeRounds = rounds.filter((r) => r.status === "in_progress");
  const pastRounds = rounds.filter((r) => r.status !== "in_progress");

  // Filter out bookings that already have a round started
  const bookingsWithoutRounds = todayBookings.filter(
    (b) => !rounds.some((r) => r.booking_id === b.id)
  );

  function formatTime(timeStr: string) {
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${display}:${m} ${ampm}`;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Scorecards</h1>
          <p className="text-[var(--muted-foreground)]">
            Track your rounds and view scoring history.
          </p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scorecards</h1>
          <p className="text-[var(--muted-foreground)]">
            Track your rounds and view scoring history.
          </p>
        </div>
        <button
          onClick={() => setShowNewRound(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Log Practice Round
        </button>
      </div>

      {/* Today's bookings — ready to start */}
      {bookingsWithoutRounds.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Ready to Play
          </h2>
          {bookingsWithoutRounds.map((booking) => (
            <div
              key={booking.id}
              className="flex items-center justify-between rounded-xl border-2 border-[var(--primary)]/30 bg-[var(--primary)]/5 px-5 py-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]">
                  <Flag className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--foreground)]">
                    {booking.facility_name}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Today at {formatTime(booking.start_time)} &middot;{" "}
                    {booking.party_size}{" "}
                    {booking.party_size === 1 ? "player" : "players"}
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setStartingFromBooking(booking)
                }
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
              >
                <Flag className="h-4 w-4" />
                Start Round
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Active rounds — in progress */}
      {activeRounds.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            In Progress
          </h2>
          {activeRounds.map((round) => (
            <Link
              key={round.id}
              href={`/dashboard/scorecards/${round.id}`}
              className="flex items-center justify-between rounded-xl border-2 border-amber-300/50 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700/30 px-5 py-4 transition-colors hover:bg-amber-100/50 dark:hover:bg-amber-900/20"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--foreground)]">
                    {round.facility_name}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {round.holes_played} holes &middot; {round.tee_set} tees
                    &middot;{" "}
                    {new Date(round.played_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-3 py-1 text-xs font-semibold">
                  In Progress
                </span>
                <span className="text-sm font-medium text-[var(--primary)]">
                  Continue &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Past rounds / history */}
      <ScorecardHistory
        rounds={pastRounds}
        facilities={facilities}
        role={role}
        onRefresh={fetchRounds}
      />

      {/* Standalone practice round modal */}
      {showNewRound && (
        <NewRoundModal
          facilities={facilities}
          onClose={() => setShowNewRound(false)}
          onSuccess={fetchRounds}
        />
      )}

      {/* Start round from booking modal */}
      {startingFromBooking && (
        <NewRoundModal
          facilities={facilities}
          booking={{
            booking_id: startingFromBooking.id,
            facility_id: startingFromBooking.facility_id,
            facility_name: startingFromBooking.facility_name,
            date: startingFromBooking.date,
            start_time: startingFromBooking.start_time,
            party_size: startingFromBooking.party_size,
          }}
          onClose={() => setStartingFromBooking(null)}
          onSuccess={() => {
            fetchRounds();
            fetchTodayBookings();
          }}
        />
      )}
    </div>
  );
}
