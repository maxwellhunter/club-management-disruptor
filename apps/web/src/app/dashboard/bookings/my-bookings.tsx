"use client";

import { useState, useEffect } from "react";
import type { BookingWithDetails } from "@club/shared";

export default function MyBookings() {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function fetchBookings() {
    try {
      const res = await fetch("/api/bookings/my");
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings);
      }
    } catch (err) {
      console.error("Failed to fetch bookings:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBookings();
  }, []);

  async function handleCancel(bookingId: string) {
    setCancellingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "PATCH",
      });
      if (res.ok) {
        setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      }
    } catch (err) {
      console.error("Failed to cancel booking:", err);
    } finally {
      setCancellingId(null);
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function formatTime(timeStr: string) {
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${display}:${m} ${ampm}`;
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-48 rounded bg-[var(--muted)]" />
          <div className="h-16 rounded bg-[var(--muted)]" />
          <div className="h-16 rounded bg-[var(--muted)]" />
        </div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-8 text-center">
        <p className="text-3xl mb-2">📅</p>
        <p className="font-medium text-[var(--foreground)]">
          No upcoming bookings
        </p>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Book your next tee time to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">My Upcoming Tee Times</h2>
      <div className="space-y-2">
        {bookings.map((booking) => (
          <div
            key={booking.id}
            className="flex items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3 transition-colors hover:bg-[var(--muted)]/30"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-lg">
                ⛳
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {booking.facility_name}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {formatDate(booking.date)} &middot;{" "}
                  {formatTime(booking.start_time)} &middot;{" "}
                  {booking.party_size}{" "}
                  {booking.party_size === 1 ? "player" : "players"}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCancel(booking.id)}
              disabled={cancellingId === booking.id}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              {cancellingId === booking.id ? "Cancelling..." : "Cancel"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
