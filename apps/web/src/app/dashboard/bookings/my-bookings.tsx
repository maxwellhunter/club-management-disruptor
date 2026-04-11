"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import type { BookingWithDetails, TeeTimeSlot } from "@club/shared";

type MyBooking = BookingWithDetails & { is_owner?: boolean };

export default function MyBookings() {
  const router = useRouter();
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Edit state
  const [editingBooking, setEditingBooking] =
    useState<BookingWithDetails | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editPartySize, setEditPartySize] = useState(4);
  const [editSlots, setEditSlots] = useState<TeeTimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  function startEdit(booking: BookingWithDetails) {
    setEditingBooking(booking);
    setEditDate(booking.date);
    setEditTime(booking.start_time);
    setEditPartySize(booking.party_size);
    setEditError(null);
    setEditSlots([]);
    // Fetch slots for the current date
    fetchEditSlots(booking.facility_id, booking.date);
  }

  function cancelEdit() {
    setEditingBooking(null);
    setEditDate("");
    setEditTime("");
    setEditSlots([]);
    setEditError(null);
  }

  async function fetchEditSlots(facilityId: string, date: string) {
    setLoadingSlots(true);
    try {
      const res = await fetch(
        `/api/bookings/tee-times?facility_id=${facilityId}&date=${date}`
      );
      if (res.ok) {
        const data = await res.json();
        setEditSlots(data.slots);
      }
    } catch {
      setEditSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function handleEditDateChange(date: string) {
    setEditDate(date);
    setEditTime("");
    if (editingBooking) {
      fetchEditSlots(editingBooking.facility_id, date);
    }
  }

  async function handleSave() {
    if (!editingBooking) return;
    setSaving(true);
    setEditError(null);

    const changes: Record<string, string | number> = {};
    if (editDate !== editingBooking.date) changes.date = editDate;
    if (editTime !== editingBooking.start_time) changes.start_time = editTime;
    if (editPartySize !== editingBooking.party_size)
      changes.party_size = editPartySize;

    if (Object.keys(changes).length === 0) {
      cancelEdit();
      return;
    }

    try {
      const res = await fetch(`/api/bookings/${editingBooking.id}/modify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });

      if (res.ok) {
        cancelEdit();
        setLoading(true);
        fetchBookings();
      } else {
        const data = await res.json();
        setEditError(data.error || "Failed to modify booking");
      }
    } catch {
      setEditError("Failed to modify booking");
    } finally {
      setSaving(false);
    }
  }

  // Check if a booking is eligible for "Start Round" — same day, within 30 min of tee time or after
  function isStartRoundEligible(booking: BookingWithDetails): boolean {
    const today = new Date().toISOString().split("T")[0];
    if (booking.date !== today) return false;
    if (booking.facility_type !== "golf") return false;

    const now = new Date();
    const [h, m] = booking.start_time.split(":").map(Number);
    const teeTime = new Date();
    teeTime.setHours(h, m, 0, 0);
    // Allow starting 30 min before tee time through 4 hours after
    const earliest = new Date(teeTime.getTime() - 30 * 60 * 1000);
    const latest = new Date(teeTime.getTime() + 4 * 60 * 60 * 1000);
    return now >= earliest && now <= latest;
  }

  const [startingRound, setStartingRound] = useState<string | null>(null);

  async function handleStartRound(booking: BookingWithDetails) {
    setStartingRound(booking.id);
    try {
      const res = await fetch("/api/scorecards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: booking.facility_id,
          played_at: booking.date,
          holes_played: 18,
          tee_set: "middle",
          booking_id: booking.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard/scorecards/${data.round.id}`);
      } else {
        const data = await res.json();
        console.error("Start round failed:", data.error);
      }
    } catch (err) {
      console.error("Start round failed:", err);
    } finally {
      setStartingRound(null);
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

  // Generate next 30 days for the date picker
  const editDates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split("T")[0];
  });

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

      {/* Edit modal */}
      {editingBooking && (
        <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Modify Booking — {editingBooking.facility_name}
            </h3>
            <button
              onClick={cancelEdit}
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              Cancel
            </button>
          </div>

          {editError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-600">
              {editError}
            </div>
          )}

          {/* Date picker */}
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)] block mb-1.5">
              Date
            </label>
            <select
              value={editDate}
              onChange={(e) => handleEditDateChange(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              {editDates.map((d) => (
                <option key={d} value={d}>
                  {formatDate(d)}
                </option>
              ))}
            </select>
          </div>

          {/* Time picker */}
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)] block mb-1.5">
              Time
            </label>
            {loadingSlots ? (
              <div className="flex items-center gap-2 py-2 text-xs text-[var(--muted-foreground)]">
                <div className="animate-spin h-3.5 w-3.5 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
                Loading times...
              </div>
            ) : editSlots.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)] py-2">
                No tee times available for this date.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {editSlots.map((slot) => {
                  const isCurrentSlot =
                    editingBooking.start_time === slot.start_time &&
                    editDate === editingBooking.date;
                  const available = slot.is_available || isCurrentSlot;
                  const isSelected = editTime === slot.start_time;
                  return (
                    <button
                      key={slot.start_time}
                      disabled={!available}
                      onClick={() => setEditTime(slot.start_time)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)] ring-2 ring-[var(--primary)]/20"
                          : available
                            ? "border border-[var(--border)] hover:border-[var(--primary)] text-[var(--foreground)] bg-[var(--background)]"
                            : "border border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]/40 line-through cursor-not-allowed"
                      }`}
                    >
                      {formatTime(slot.start_time)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Party size */}
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)] block mb-1.5">
              Party Size
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setEditPartySize(n)}
                  className={`h-8 w-8 rounded-lg text-xs font-medium transition-all ${
                    editPartySize === n
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "border border-[var(--border)] hover:border-[var(--primary)] text-[var(--foreground)] bg-[var(--background)]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Save */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !editTime}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={cancelEdit}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            >
              Discard
            </button>
          </div>
        </div>
      )}

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
            <div className="flex items-center gap-2">
              {isStartRoundEligible(booking) && (
                <button
                  onClick={() => handleStartRound(booking)}
                  disabled={startingRound === booking.id}
                  className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Flag className="h-3.5 w-3.5" />
                  {startingRound === booking.id ? "Starting..." : "Start Round"}
                </button>
              )}
              {booking.is_owner !== false && (
                <>
                  <button
                    onClick={() => startEdit(booking)}
                    disabled={editingBooking?.id === booking.id}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleCancel(booking.id)}
                    disabled={cancellingId === booking.id}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                  >
                    {cancellingId === booking.id ? "Cancelling..." : "Cancel"}
                  </button>
                </>
              )}
              {booking.is_owner === false && (
                <span className="rounded-lg bg-[var(--muted)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                  Invited
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
