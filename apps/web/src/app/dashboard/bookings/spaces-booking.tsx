"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MapPin, Users, Calendar, ArrowLeft } from "lucide-react";

interface Space {
  id: string;
  name: string;
  type: string;
  description: string | null;
  capacity: number | null;
  max_party_size: number | null;
  image_url: string | null;
}

interface SpaceSlot {
  start_time: string;
  end_time: string;
  max_bookings: number;
  booked_count: number;
  is_available: boolean;
  my_booking_id: string | null;
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function generateDates() {
  const out: { iso: string; label: string; sub: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().split("T")[0];
    const label =
      i === 0
        ? "Today"
        : i === 1
          ? "Tomorrow"
          : d.toLocaleDateString("en-US", { weekday: "short" });
    const sub = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    out.push({ iso, label, sub });
  }
  return out;
}

export default function SpacesBooking() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(true);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [slots, setSlots] = useState<SpaceSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [bookingSlot, setBookingSlot] = useState<SpaceSlot | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const dates = generateDates();

  const fetchSpaces = useCallback(async () => {
    setLoadingSpaces(true);
    try {
      const res = await fetch(
        "/api/facilities?types=tennis,pool,fitness,other"
      );
      if (res.ok) {
        const data = await res.json();
        // Client-side safety net in case the server ignores the `types` filter.
        // Never show golf courses or dining rooms on the Spaces tab.
        const excluded = new Set(["golf", "dining"]);
        const facilities = (data.facilities ?? []) as Array<{ type: string }>;
        setSpaces(
          facilities.filter((f) => !excluded.has(f.type?.toLowerCase())) as typeof data.facilities
        );
      }
    } finally {
      setLoadingSpaces(false);
    }
  }, []);

  const fetchSlots = useCallback(async () => {
    if (!selectedSpace) return;
    setLoadingSlots(true);
    try {
      const res = await fetch(
        `/api/spaces/availability?facility_id=${selectedSpace.id}&date=${selectedDate}`
      );
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots ?? []);
      } else {
        setSlots([]);
      }
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedSpace, selectedDate]);

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  useEffect(() => {
    if (selectedSpace) fetchSlots();
  }, [selectedSpace, selectedDate, fetchSlots]);

  async function submitBooking() {
    if (!bookingSlot || !selectedSpace) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: selectedSpace.id,
          date: selectedDate,
          start_time: bookingSlot.start_time,
          end_time: bookingSlot.end_time,
          party_size: partySize,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Reserved ${selectedSpace.name} at ${formatTime(bookingSlot.start_time)}`);
        setBookingSlot(null);
        setNotes("");
        setPartySize(1);
        fetchSlots();
      } else {
        setError(data.error || "Failed to book");
      }
    } catch {
      setError("Failed to book");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelBooking(bookingId: string) {
    if (!confirm("Cancel this reservation?")) return;
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
      method: "PATCH",
    });
    if (res.ok) fetchSlots();
  }

  // ----- Space picker -----
  if (!selectedSpace) {
    if (loadingSpaces) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
        </div>
      );
    }

    if (spaces.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            No spaces available yet. Check back soon.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Reserve a Space</h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            Courts, cabanas, studios, and more.
          </p>
        </div>

        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSpace(s)}
              className="text-left rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden hover:border-[var(--primary)] transition-colors"
            >
              {s.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.image_url}
                  alt={s.name}
                  className="h-32 w-full object-cover"
                />
              ) : (
                <div className="flex h-32 w-full items-center justify-center bg-[var(--muted)]">
                  <MapPin className="h-6 w-6 text-[var(--muted-foreground)]" />
                </div>
              )}
              <div className="p-4 space-y-1">
                <h4 className="text-sm font-semibold">{s.name}</h4>
                <p className="text-xs text-[var(--muted-foreground)] capitalize">
                  {s.type}
                  {s.capacity ? ` · Capacity ${s.capacity}` : ""}
                </p>
                {s.description && (
                  <p className="text-xs text-[var(--muted-foreground)] line-clamp-2 mt-1">
                    {s.description}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ----- Slot picker -----
  return (
    <div className="space-y-5">
      <button
        onClick={() => {
          setSelectedSpace(null);
          setError(null);
          setSuccess(null);
        }}
        className="flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        All spaces
      </button>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        {selectedSpace.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selectedSpace.image_url}
            alt={selectedSpace.name}
            className="h-40 w-full object-cover"
          />
        )}
        <div className="p-4">
          <h3 className="text-lg font-semibold">{selectedSpace.name}</h3>
          <p className="text-sm text-[var(--muted-foreground)] capitalize">
            {selectedSpace.type}
            {selectedSpace.capacity
              ? ` · Capacity ${selectedSpace.capacity}`
              : ""}
          </p>
          {selectedSpace.description && (
            <p className="text-sm text-[var(--muted-foreground)] mt-2">
              {selectedSpace.description}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4" />
          <span className="text-sm font-medium">Pick a date</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {dates.map((d) => (
            <button
              key={d.iso}
              onClick={() => setSelectedDate(d.iso)}
              className={`min-w-[72px] rounded-lg border px-3 py-2 text-center ${
                selectedDate === d.iso
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)]"
              }`}
            >
              <div className="text-xs font-medium">{d.label}</div>
              <div className="text-[10px] opacity-80">{d.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2">Available times</h4>
        {loadingSlots ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
          </div>
        ) : slots.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] py-6 text-center">
            No times available on this day.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {slots.map((slot) => {
              const key = slot.start_time;
              const mine = !!slot.my_booking_id;
              const full = !slot.is_available && !mine;
              return (
                <button
                  key={key}
                  disabled={full}
                  onClick={() =>
                    mine
                      ? cancelBooking(slot.my_booking_id!)
                      : setBookingSlot(slot)
                  }
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    mine
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                      : full
                        ? "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed"
                        : "border-[var(--border)] hover:border-[var(--primary)]"
                  }`}
                >
                  <div>{formatTime(slot.start_time)}</div>
                  <div className="text-[10px] font-normal opacity-70">
                    {mine
                      ? "Booked — tap to cancel"
                      : full
                        ? "Full"
                        : slot.max_bookings > 1
                          ? `${slot.booked_count}/${slot.max_bookings} booked`
                          : "Available"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {bookingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-[var(--background)] shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold">Confirm Reservation</h3>
            <div className="rounded-lg border border-[var(--border)] p-3 text-sm space-y-1">
              <div className="font-medium">{selectedSpace.name}</div>
              <div className="text-[var(--muted-foreground)]">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString(
                  "en-US",
                  { weekday: "long", month: "long", day: "numeric" }
                )}
              </div>
              <div className="text-[var(--muted-foreground)]">
                {formatTime(bookingSlot.start_time)} –{" "}
                {formatTime(bookingSlot.end_time)}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 flex items-center gap-1">
                <Users className="h-3 w-3" /> Party size
              </label>
              <input
                type="number"
                min={1}
                max={selectedSpace.max_party_size ?? 20}
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBookingSlot(null)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitBooking}
                disabled={submitting}
                className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
              >
                {submitting ? "Reserving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
