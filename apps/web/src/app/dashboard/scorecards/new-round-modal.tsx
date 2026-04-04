"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { TeeSet, WeatherCondition } from "@club/shared";

interface Facility {
  id: string;
  name: string;
}

interface NewRoundModalProps {
  facilities: Facility[];
  onClose: () => void;
  onSuccess: () => void;
}

export function NewRoundModal({
  facilities,
  onClose,
  onSuccess,
}: NewRoundModalProps) {
  const router = useRouter();
  const [facilityId, setFacilityId] = useState(facilities[0]?.id ?? "");
  const [playedAt, setPlayedAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [teeSet, setTeeSet] = useState<TeeSet>("middle");
  const [holesPlayed, setHolesPlayed] = useState<9 | 18>(18);
  const [weather, setWeather] = useState<WeatherCondition | "">("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/scorecards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: facilityId,
          played_at: playedAt,
          tee_set: teeSet,
          holes_played: holesPlayed,
          weather: weather || undefined,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create round");
        return;
      }

      const data = await res.json();
      onSuccess();
      onClose();
      // Navigate to the scorecard entry page
      router.push(`/dashboard/scorecards/${data.round.id}`);
    } catch {
      setError("Failed to create round");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Start New Round</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-[var(--muted)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Course */}
          <div>
            <label className="block text-sm font-medium mb-1">Course</label>
            <select
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              required
            >
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              required
            />
          </div>

          {/* Tees + Holes row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Tees</label>
              <select
                value={teeSet}
                onChange={(e) => setTeeSet(e.target.value as TeeSet)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="back">Back</option>
                <option value="middle">Middle</option>
                <option value="forward">Forward</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Holes</label>
              <select
                value={holesPlayed}
                onChange={(e) => setHolesPlayed(Number(e.target.value) as 9 | 18)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value={18}>18 Holes</option>
                <option value={9}>9 Holes</option>
              </select>
            </div>
          </div>

          {/* Weather */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Weather{" "}
              <span className="text-[var(--muted-foreground)] font-normal">
                (optional)
              </span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {(
                ["sunny", "cloudy", "windy", "rainy", "cold"] as const
              ).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeather(weather === w ? "" : w)}
                  className={`rounded-full px-3 py-1 text-sm border transition-colors ${
                    weather === w
                      ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "border-[var(--border)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {w.charAt(0).toUpperCase() + w.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Notes{" "}
              <span className="text-[var(--muted-foreground)] font-normal">
                (optional)
              </span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm resize-none"
              placeholder="Playing conditions, course notes..."
            />
          </div>

          <button
            type="submit"
            disabled={loading || !facilityId}
            className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Starting..." : "Start Round"}
          </button>
        </form>
      </div>
    </div>
  );
}
