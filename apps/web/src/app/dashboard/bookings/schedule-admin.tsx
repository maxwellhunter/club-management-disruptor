"use client";

import { useState, useEffect } from "react";
import { Clock, Trash2, Plus, Loader2 } from "lucide-react";

interface Facility {
  id: string;
  name: string;
  type: string;
}

interface BookingSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_bookings: number;
  is_active: boolean;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const INTERVAL_OPTIONS = [
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
];

export default function ScheduleAdmin() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<string>("");
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("18:00");
  const [interval, setInterval] = useState(10);
  const [maxBookings, setMaxBookings] = useState(1);

  useEffect(() => {
    fetchFacilities();
  }, []);

  useEffect(() => {
    if (selectedFacility) {
      fetchSlots(selectedFacility);
    }
  }, [selectedFacility]);

  async function fetchFacilities() {
    try {
      const res = await fetch("/api/facilities");
      if (res.ok) {
        const data = await res.json();
        setFacilities(data.facilities ?? []);
        if (data.facilities?.length > 0) {
          setSelectedFacility(data.facilities[0].id);
        }
      }
    } catch {
      setError("Failed to load facilities");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSlots(facilityId: string) {
    setLoadingSlots(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/bookings/admin/schedule?facility_id=${facilityId}`
      );
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots ?? []);
      } else if (res.status === 403) {
        setError("You must be a club admin to manage schedules.");
        setSlots([]);
      }
    } catch {
      setError("Failed to load schedule");
    } finally {
      setLoadingSlots(false);
    }
  }

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleGenerate() {
    if (!selectedFacility || selectedDays.length === 0) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/bookings/admin/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: selectedFacility,
          days_of_week: selectedDays,
          start_time: startTime,
          end_time: endTime,
          interval_minutes: interval,
          max_bookings: maxBookings,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message);
        fetchSlots(selectedFacility);
      } else {
        setError(data.error || "Failed to generate schedule");
      }
    } catch {
      setError("Failed to generate schedule");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearDay(day: number) {
    if (!selectedFacility) return;
    if (!confirm(`Clear all slots for ${DAY_NAMES[day]}?`)) return;
    try {
      const res = await fetch(
        `/api/bookings/admin/schedule?facility_id=${selectedFacility}&day_of_week=${day}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setSlots((prev) => prev.filter((s) => s.day_of_week !== day));
        setSuccess(`Cleared ${DAY_NAMES[day]} schedule`);
      }
    } catch {
      setError("Failed to clear schedule");
    }
  }

  async function handleClearAll() {
    if (!selectedFacility) return;
    if (!confirm("Clear ALL slots for this facility? This cannot be undone."))
      return;
    try {
      const res = await fetch(
        `/api/bookings/admin/schedule?facility_id=${selectedFacility}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setSlots([]);
        setSuccess("All slots cleared");
      }
    } catch {
      setError("Failed to clear schedule");
    }
  }

  // Group slots by day
  const slotsByDay = slots.reduce(
    (acc, slot) => {
      const day = slot.day_of_week;
      if (!acc[day]) acc[day] = [];
      acc[day].push(slot);
      return acc;
    },
    {} as Record<number, BookingSlot[]>
  );

  const facilityType =
    facilities.find((f) => f.id === selectedFacility)?.type ?? "";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Facility selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Facility</label>
        <select
          value={selectedFacility}
          onChange={(e) => setSelectedFacility(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        >
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.type})
            </option>
          ))}
        </select>
      </div>

      {/* Alerts */}
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

      {/* Schedule generator form */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Generate Schedule
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Days */}
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-[var(--muted-foreground)] mb-2 block">
              Days of Week
            </label>
            <div className="flex flex-wrap gap-2">
              {DAY_NAMES.map((name, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedDays.includes(i)
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                  }`}
                >
                  {name.substring(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Start time */}
          <div>
            <label className="text-sm font-medium text-[var(--muted-foreground)] mb-1 block">
              Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>

          {/* End time */}
          <div>
            <label className="text-sm font-medium text-[var(--muted-foreground)] mb-1 block">
              End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>

          {/* Interval */}
          <div>
            <label className="text-sm font-medium text-[var(--muted-foreground)] mb-1 block">
              Slot Interval
            </label>
            <select
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              {INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Max bookings per slot */}
          <div>
            <label className="text-sm font-medium text-[var(--muted-foreground)] mb-1 block">
              {facilityType === "golf"
                ? "Groups per Slot"
                : facilityType === "dining"
                  ? "Tables per Slot"
                  : "Max Bookings per Slot"}
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={maxBookings}
              onChange={(e) => setMaxBookings(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={saving || selectedDays.length === 0}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating...
              </span>
            ) : (
              "Generate Slots"
            )}
          </button>
          {slots.length > 0 && (
            <button
              onClick={handleClearAll}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Current schedule view */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Current Schedule
          <span className="text-xs font-normal text-[var(--muted-foreground)]">
            ({slots.length} slot{slots.length !== 1 ? "s" : ""} total)
          </span>
        </h3>

        {loadingSlots ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
          </div>
        ) : slots.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
            No schedule configured. Use the form above to generate time slots.
          </p>
        ) : (
          <div className="space-y-3">
            {DAY_NAMES.map((dayName, dayIndex) => {
              const daySlots = slotsByDay[dayIndex];
              if (!daySlots || daySlots.length === 0) return null;
              const first = daySlots[0].start_time.substring(0, 5);
              const last = daySlots[daySlots.length - 1].end_time.substring(0, 5);
              return (
                <div
                  key={dayIndex}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] px-4 py-3"
                >
                  <div>
                    <span className="text-sm font-medium">{dayName}</span>
                    <span className="ml-3 text-xs text-[var(--muted-foreground)]">
                      {first} - {last} &middot; {daySlots.length} slot
                      {daySlots.length !== 1 ? "s" : ""} &middot; max{" "}
                      {daySlots[0].max_bookings}/slot
                    </span>
                  </div>
                  <button
                    onClick={() => handleClearDay(dayIndex)}
                    className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-red-50 hover:text-red-600 transition-colors"
                    title={`Clear ${dayName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
