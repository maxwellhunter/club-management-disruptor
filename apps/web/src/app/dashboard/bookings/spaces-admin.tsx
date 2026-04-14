"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Clock, ImagePlus } from "lucide-react";

type FacilityType = "tennis" | "pool" | "fitness" | "other";

interface Space {
  id: string;
  name: string;
  type: string;
  description: string | null;
  capacity: number | null;
  max_party_size: number | null;
  image_url: string | null;
  is_active: boolean;
}

interface SlotRow {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_bookings: number;
  is_active: boolean;
}

const SPACE_TYPES: { value: FacilityType; label: string }[] = [
  { value: "tennis", label: "Tennis / Court" },
  { value: "pool", label: "Pool / Cabana" },
  { value: "fitness", label: "Fitness / Studio" },
  { value: "other", label: "Other" },
];

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
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
];

export default function SpacesAdmin() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Space | null>(null);
  const [adding, setAdding] = useState(false);
  const [managingSchedule, setManagingSchedule] = useState<Space | null>(null);

  const fetchSpaces = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "/api/facilities?types=tennis,pool,fitness,other&include_inactive=true"
      );
      if (res.ok) {
        const data = await res.json();
        setSpaces(data.facilities ?? []);
      } else {
        setError("Failed to load spaces");
      }
    } catch {
      setError("Failed to load spaces");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Spaces & Courts</h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            Manage bookable spaces like tennis courts, pool cabanas, studios,
            and meeting rooms.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Space
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {spaces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            No spaces yet. Create your first one to let members reserve it.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((s) => (
            <div
              key={s.id}
              className={`rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden ${!s.is_active ? "opacity-60" : ""}`}
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
                  <ImagePlus className="h-6 w-6 text-[var(--muted-foreground)]" />
                </div>
              )}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold">{s.name}</h4>
                    <p className="text-xs text-[var(--muted-foreground)] capitalize">
                      {s.type}
                      {!s.is_active && " · inactive"}
                    </p>
                  </div>
                </div>
                {s.description && (
                  <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">
                    {s.description}
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setManagingSchedule(s)}
                    className="flex-1 rounded border border-[var(--border)] px-2 py-1.5 text-xs font-medium hover:bg-[var(--accent)] flex items-center justify-center gap-1"
                  >
                    <Clock className="h-3 w-3" />
                    Slots
                  </button>
                  <button
                    onClick={() => setEditing(s)}
                    className="rounded border border-[var(--border)] p-1.5 hover:bg-[var(--accent)]"
                    title="Edit"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Deactivate "${s.name}"?`)) return;
                      const res = await fetch(`/api/facilities/${s.id}`, {
                        method: "DELETE",
                      });
                      if (res.ok) fetchSpaces();
                    }}
                    className="rounded border border-[var(--border)] p-1.5 hover:bg-red-50 hover:text-red-600"
                    title="Deactivate"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(adding || editing) && (
        <SpaceFormModal
          space={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            fetchSpaces();
          }}
        />
      )}

      {managingSchedule && (
        <SpaceScheduleModal
          space={managingSchedule}
          onClose={() => setManagingSchedule(null)}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Add / Edit modal
// ------------------------------------------------------------------
function SpaceFormModal({
  space,
  onClose,
  onSaved,
}: {
  space: Space | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(space?.name ?? "");
  const [type, setType] = useState<FacilityType>(
    (space?.type as FacilityType) ?? "tennis"
  );
  const [description, setDescription] = useState(space?.description ?? "");
  const [capacity, setCapacity] = useState<string>(
    space?.capacity?.toString() ?? ""
  );
  const [maxPartySize, setMaxPartySize] = useState<string>(
    space?.max_party_size?.toString() ?? ""
  );
  const [imageUrl, setImageUrl] = useState(space?.image_url ?? "");
  const [isActive, setIsActive] = useState(space?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      type,
      description: description.trim() || null,
      capacity: capacity ? Number(capacity) : null,
      max_party_size: maxPartySize ? Number(maxPartySize) : null,
      image_url: imageUrl.trim() || null,
    };

    try {
      const res = space
        ? await fetch(`/api/facilities/${space.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, is_active: isActive }),
          })
        : await fetch("/api/facilities", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        onSaved();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-[var(--background)] shadow-xl">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">
            {space ? "Edit Space" : "New Space"}
          </h3>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
              Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Tennis Court 1"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
                Type *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as FacilityType)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                {SPACE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
                Capacity
              </label>
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="optional"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Amenities, equipment, rules..."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
                Max Party Size
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={maxPartySize}
                onChange={(e) => setMaxPartySize(e.target.value)}
                placeholder="optional"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
                Image URL
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          {space && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active (visible to members)
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : space ? "Save Changes" : "Create Space"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Schedule (time slots) modal for one space
// ------------------------------------------------------------------
function SpaceScheduleModal({
  space,
  onClose,
}: {
  space: Space;
  onClose: () => void;
}) {
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("20:00");
  const [interval, setInterval] = useState(60);
  const [maxBookings, setMaxBookings] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/bookings/admin/schedule?facility_id=${space.id}`
      );
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots ?? []);
      }
    } catch {
      setError("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, [space.id]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleDay(d: number) {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  async function generate() {
    if (days.length === 0) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/bookings/admin/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: space.id,
          days_of_week: days,
          start_time: startTime,
          end_time: endTime,
          interval_minutes: interval,
          max_bookings: maxBookings,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message);
        load();
      } else {
        setError(data.error || "Failed to generate");
      }
    } catch {
      setError("Failed to generate");
    } finally {
      setSaving(false);
    }
  }

  async function clearDay(day: number) {
    if (!confirm(`Clear all slots for ${DAY_NAMES[day]}?`)) return;
    const res = await fetch(
      `/api/bookings/admin/schedule?facility_id=${space.id}&day_of_week=${day}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setSlots((prev) => prev.filter((s) => s.day_of_week !== day));
    }
  }

  async function clearAll() {
    if (!confirm(`Clear ALL slots for ${space.name}?`)) return;
    const res = await fetch(
      `/api/bookings/admin/schedule?facility_id=${space.id}`,
      { method: "DELETE" }
    );
    if (res.ok) setSlots([]);
  }

  const slotsByDay = slots.reduce(
    (acc, s) => {
      (acc[s.day_of_week] ||= []).push(s);
      return acc;
    },
    {} as Record<number, SlotRow[]>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl bg-[var(--background)] shadow-xl my-8">
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">Time Slots</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                {space.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {success}
            </div>
          )}

          <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-[var(--muted-foreground)] mb-2 block">
                Available Days
              </label>
              <div className="flex flex-wrap gap-2">
                {DAY_NAMES.map((n, i) => (
                  <button
                    key={i}
                    onClick={() => toggleDay(i)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      days.includes(i)
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    {n.substring(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
                  Start
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
                  End
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
                  Slot Length
                </label>
                <select
                  value={interval}
                  onChange={(e) => setInterval(Number(e.target.value))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                >
                  {INTERVAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">
                  Max bookings per slot
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

            <div className="flex gap-2 pt-1">
              <button
                onClick={generate}
                disabled={saving || days.length === 0}
                className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
              >
                {saving ? "Generating..." : "Generate Slots"}
              </button>
              {slots.length > 0 && (
                <button
                  onClick={clearAll}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Current Schedule</span>
              <span className="text-xs text-[var(--muted-foreground)]">
                ({slots.length} slot{slots.length !== 1 ? "s" : ""})
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
                No slots yet. Generate some above.
              </p>
            ) : (
              <div className="space-y-2">
                {DAY_NAMES.map((name, i) => {
                  const daySlots = slotsByDay[i];
                  if (!daySlots?.length) return null;
                  const first = daySlots[0].start_time.substring(0, 5);
                  const last = daySlots[daySlots.length - 1].end_time.substring(
                    0,
                    5
                  );
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
                    >
                      <div>
                        <span className="text-sm font-medium">{name}</span>
                        <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                          {first}–{last} · {daySlots.length} slot
                          {daySlots.length !== 1 ? "s" : ""} · max{" "}
                          {daySlots[0].max_bookings}/slot
                        </span>
                      </div>
                      <button
                        onClick={() => clearDay(i)}
                        className="rounded p-1 text-[var(--muted-foreground)] hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
