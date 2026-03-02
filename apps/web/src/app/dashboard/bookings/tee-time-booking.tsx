"use client";

import { useState, useEffect } from "react";
import type { TeeTimeSlot } from "@club/shared";

interface Facility {
  id: string;
  name: string;
  type: string;
  description: string | null;
}

interface TeeTimeBookingProps {
  onBooked: () => void;
  onClose: () => void;
}

const GOLF_FACILITIES: Facility[] = [
  {
    id: "00000000-0000-0000-0000-000000000101",
    name: "Championship Course",
    type: "golf",
    description: "18-hole championship course",
  },
  {
    id: "00000000-0000-0000-0000-000000000102",
    name: "Executive 9",
    type: "golf",
    description: "9-hole executive course",
  },
];

type Step = "course" | "date" | "time";

export default function TeeTimeBooking({
  onBooked,
  onClose,
}: TeeTimeBookingProps) {
  const [step, setStep] = useState<Step>("course");
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<TeeTimeSlot | null>(null);
  const [partySize, setPartySize] = useState(4);
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState<TeeTimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate next 14 days for date picking
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split("T")[0];
  });

  // Current month/year for the calendar display
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    if (selectedFacility && selectedDate) {
      fetchSlots();
    }
  }, [selectedFacility, selectedDate]);

  async function fetchSlots() {
    if (!selectedFacility) return;
    setLoadingSlots(true);
    setError(null);
    setSelectedTime(null);
    try {
      const res = await fetch(
        `/api/bookings/tee-times?facility_id=${selectedFacility.id}&date=${selectedDate}`
      );
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to load tee times");
      }
    } catch {
      setError("Failed to load tee times");
    } finally {
      setLoadingSlots(false);
    }
  }

  async function handleBook() {
    if (!selectedFacility || !selectedDate || !selectedTime) return;
    setBooking(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: selectedFacility.id,
          date: selectedDate,
          start_time: selectedTime.start_time,
          end_time: selectedTime.end_time,
          party_size: partySize,
          notes: notes || undefined,
        }),
      });

      if (res.ok) {
        onBooked();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to book tee time");
      }
    } catch {
      setError("Failed to book tee time");
    } finally {
      setBooking(false);
    }
  }

  function formatTime(timeStr: string) {
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${display}:${m} ${ampm}`;
  }

  function formatDateDisplay(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  // Calendar helpers
  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
  }

  function isDateSelectable(dateStr: string) {
    const today = new Date().toISOString().split("T")[0];
    const maxDate = dates[dates.length - 1];
    return dateStr > today && dateStr <= maxDate;
  }

  function renderCalendar() {
    const { year, month } = calendarMonth;
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const monthName = new Date(year, month).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    const cells: React.ReactNode[] = [];

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} />);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const selectable = isDateSelectable(dateStr);
      const isSelected = dateStr === selectedDate;

      cells.push(
        <button
          key={day}
          type="button"
          disabled={!selectable}
          onClick={() => {
            setSelectedDate(dateStr);
            setStep("time");
          }}
          className={`h-9 w-9 rounded-lg text-sm font-medium transition-colors ${
            isSelected
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : selectable
                ? "hover:bg-[var(--muted)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)]/40 cursor-not-allowed"
          }`}
        >
          {day}
        </button>
      );
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() =>
              setCalendarMonth((prev) => {
                const d = new Date(prev.year, prev.month - 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })
            }
            className="rounded-lg p-1.5 hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
          >
            &#9664;
          </button>
          <p className="text-sm font-semibold">{monthName}</p>
          <button
            type="button"
            onClick={() =>
              setCalendarMonth((prev) => {
                const d = new Date(prev.year, prev.month + 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })
            }
            className="rounded-lg p-1.5 hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
          >
            &#9654;
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div
              key={d}
              className="text-xs font-medium text-[var(--muted-foreground)] h-8 flex items-center justify-center"
            >
              {d}
            </div>
          ))}
          {cells.map((cell, i) => (
            <div key={i} className="flex items-center justify-center">
              {cell}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Group slots by hour for display
  function groupSlotsByHour(slots: TeeTimeSlot[]) {
    const groups: Record<string, TeeTimeSlot[]> = {};
    for (const slot of slots) {
      const hour = slot.start_time.split(":")[0];
      const label =
        parseInt(hour) < 12
          ? `${parseInt(hour)} AM`
          : parseInt(hour) === 12
            ? "12 PM"
            : `${parseInt(hour) - 12} PM`;
      if (!groups[label]) groups[label] = [];
      groups[label].push(slot);
    }
    return groups;
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Book a Tee Time</h2>
          {step !== "course" && (
            <span className="text-xs text-[var(--muted-foreground)]">
              {step === "date" && selectedFacility
                ? `— ${selectedFacility.name}`
                : step === "time" && selectedFacility
                  ? `— ${selectedFacility.name} — ${formatDateDisplay(selectedDate)}`
                  : ""}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 hover:bg-[var(--muted)] text-[var(--muted-foreground)] text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-5 mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Step 1: Select Course */}
      {step === "course" && (
        <div className="p-5 space-y-3">
          <p className="text-sm text-[var(--muted-foreground)]">
            Select a golf course
          </p>
          <div className="grid grid-cols-2 gap-3">
            {GOLF_FACILITIES.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setSelectedFacility(f);
                  setStep("date");
                }}
                className="rounded-xl border border-[var(--border)] p-4 text-left transition-all hover:border-[var(--primary)] hover:shadow-sm"
              >
                <p className="text-2xl mb-2">⛳</p>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {f.name}
                </p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {f.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Select Date */}
      {step === "date" && (
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setStep("course");
                setSelectedFacility(null);
                setSelectedDate("");
              }}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              &larr; Back
            </button>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            Select a date (next 14 days)
          </p>
          <div className="max-w-xs">{renderCalendar()}</div>
        </div>
      )}

      {/* Step 3: Select Time + Book */}
      {step === "time" && (
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setStep("date");
                setSelectedDate("");
                setSelectedTime(null);
                setSlots([]);
              }}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              &larr; Back
            </button>
          </div>

          {loadingSlots ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium mb-2">Available Tee Times</p>
                {slots.length === 0 ? (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    No tee times available for this date.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(groupSlotsByHour(slots)).map(
                      ([hour, hourSlots]) => (
                        <div key={hour}>
                          <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                            {hour}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {hourSlots.map((slot) => {
                              const isSelected =
                                selectedTime?.start_time === slot.start_time;
                              return (
                                <button
                                  key={slot.start_time}
                                  disabled={!slot.is_available}
                                  onClick={() => setSelectedTime(slot)}
                                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                                    isSelected
                                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] ring-2 ring-[var(--primary)]/20"
                                      : slot.is_available
                                        ? "border border-[var(--border)] hover:border-[var(--primary)] text-[var(--foreground)]"
                                        : "border border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]/40 line-through cursor-not-allowed"
                                  }`}
                                >
                                  {formatTime(slot.start_time)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {selectedTime && (
                <div className="border-t border-[var(--border)] pt-4 space-y-3">
                  {/* Party Size */}
                  <div>
                    <p className="text-sm font-medium mb-1.5">Party Size</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map((n) => (
                        <button
                          key={n}
                          onClick={() => setPartySize(n)}
                          className={`h-9 w-9 rounded-lg text-sm font-medium transition-all ${
                            partySize === n
                              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                              : "border border-[var(--border)] hover:border-[var(--primary)] text-[var(--foreground)]"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <p className="text-sm font-medium mb-1.5">
                      Notes{" "}
                      <span className="font-normal text-[var(--muted-foreground)]">
                        (optional)
                      </span>
                    </p>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g., Cart needed, playing with guests"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                  </div>

                  {/* Confirm */}
                  <button
                    onClick={handleBook}
                    disabled={booking}
                    className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {booking
                      ? "Booking..."
                      : `Confirm — ${formatTime(selectedTime.start_time)} · ${partySize} ${partySize === 1 ? "player" : "players"}`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
