"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Flag,
  Save,
  Loader2,
  Plus,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";

interface Facility {
  id: string;
  name: string;
}

interface CourseHole {
  hole_number: number;
  par: number;
  yardage_back: number;
  yardage_middle: number | null;
  yardage_forward: number | null;
  handicap_index: number;
}

interface EditableHole {
  holeNumber: number;
  par: number;
  yardageBack: number;
  yardageMiddle: number;
  yardageForward: number;
  handicapIndex: number;
}

function defaultHoles(count: number): EditableHole[] {
  return Array.from({ length: count }, (_, i) => ({
    holeNumber: i + 1,
    par: 4,
    yardageBack: 350,
    yardageMiddle: 325,
    yardageForward: 290,
    handicapIndex: i + 1,
  }));
}

export default function CourseSetupAdmin() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  const [holes, setHoles] = useState<EditableHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch golf facilities
  const fetchFacilities = useCallback(async () => {
    try {
      const res = await fetch("/api/facilities?type=golf");
      if (res.ok) {
        const data = await res.json();
        const golfFacilities = data.facilities ?? [];
        setFacilities(golfFacilities);
        if (golfFacilities.length > 0 && !selectedFacilityId) {
          setSelectedFacilityId(golfFacilities[0].id);
        }
      }
    } catch {
      setError("Failed to load golf courses");
    } finally {
      setLoading(false);
    }
  }, [selectedFacilityId]);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  // Load course holes when facility changes
  useEffect(() => {
    if (selectedFacilityId) {
      loadCourse(selectedFacilityId);
    }
  }, [selectedFacilityId]);

  async function loadCourse(facilityId: string) {
    setLoadingCourse(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `/api/scorecards/course?facility_id=${facilityId}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.holes && data.holes.length > 0) {
          setHoles(
            data.holes.map((h: CourseHole) => ({
              holeNumber: h.hole_number,
              par: h.par,
              yardageBack: h.yardage_back,
              yardageMiddle: h.yardage_middle ?? 0,
              yardageForward: h.yardage_forward ?? 0,
              handicapIndex: h.handicap_index,
            }))
          );
        } else {
          // No holes yet — seed 9 defaults
          setHoles(defaultHoles(9));
        }
      } else {
        setHoles(defaultHoles(9));
      }
    } catch {
      setHoles(defaultHoles(9));
    } finally {
      setLoadingCourse(false);
    }
  }

  async function saveCourse() {
    if (!selectedFacilityId || holes.length === 0) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/scorecards/course", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: selectedFacilityId,
          holes: holes.map((h) => ({
            hole_number: h.holeNumber,
            par: h.par,
            yardage_back: h.yardageBack,
            yardage_middle: h.yardageMiddle > 0 ? h.yardageMiddle : null,
            yardage_forward: h.yardageForward > 0 ? h.yardageForward : null,
            handicap_index: h.handicapIndex,
          })),
        }),
      });

      if (res.ok) {
        setSuccess("Course layout saved successfully!");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to save course layout");
      }
    } catch {
      setError("Failed to save course layout");
    } finally {
      setSaving(false);
    }
  }

  function updateHole(index: number, field: keyof EditableHole, value: number) {
    setHoles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addHole() {
    if (holes.length >= 18) return;
    setHoles((prev) => [
      ...prev,
      {
        holeNumber: prev.length + 1,
        par: 4,
        yardageBack: 350,
        yardageMiddle: 325,
        yardageForward: 290,
        handicapIndex: prev.length + 1,
      },
    ]);
  }

  function removeHole(index: number) {
    if (holes.length <= 1) return;
    setHoles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Re-number holes
      return next.map((h, i) => ({ ...h, holeNumber: i + 1 }));
    });
  }

  // Totals
  const totalPar = holes.reduce((sum, h) => sum + h.par, 0);
  const totalBack = holes.reduce((sum, h) => sum + h.yardageBack, 0);
  const totalMiddle = holes.reduce((sum, h) => sum + h.yardageMiddle, 0);
  const totalForward = holes.reduce((sum, h) => sum + h.yardageForward, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-white">
            <Flag className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Course Setup</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Configure pars, yardage, and handicap indexes for each hole.
            </p>
          </div>
        </div>

        <button
          onClick={saveCourse}
          disabled={saving || holes.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Course
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Facility picker */}
      {facilities.length > 1 && (
        <div className="relative inline-block">
          <select
            value={selectedFacilityId}
            onChange={(e) => setSelectedFacilityId(e.target.value)}
            className="appearance-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        </div>
      )}

      {loadingCourse ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : (
        <>
          {/* Course table */}
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                  <th className="px-4 py-3 text-left font-semibold text-[var(--muted-foreground)] w-16">
                    Hole
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-[var(--muted-foreground)] w-20">
                    Par
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-[var(--muted-foreground)]">
                    Back (yds)
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-[var(--muted-foreground)]">
                    Middle (yds)
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-[var(--muted-foreground)]">
                    Forward (yds)
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-[var(--muted-foreground)] w-20">
                    HCP
                  </th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                {holes.map((hole, index) => (
                  <tr
                    key={hole.holeNumber}
                    className={`border-b border-[var(--border)] ${
                      index === 8
                        ? "border-b-2 border-b-[var(--primary)]"
                        : ""
                    } ${index % 2 === 0 ? "" : "bg-[var(--muted)]/30"}`}
                  >
                    <td className="px-4 py-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-white">
                        {hole.holeNumber}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={hole.par}
                        onChange={(e) =>
                          updateHole(index, "par", parseInt(e.target.value))
                        }
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      >
                        {[3, 4, 5, 6].map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={hole.yardageBack}
                        onChange={(e) =>
                          updateHole(
                            index,
                            "yardageBack",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        min={1}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={hole.yardageMiddle}
                        onChange={(e) =>
                          updateHole(
                            index,
                            "yardageMiddle",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        min={0}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={hole.yardageForward}
                        onChange={(e) =>
                          updateHole(
                            index,
                            "yardageForward",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        min={0}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={hole.handicapIndex}
                        onChange={(e) =>
                          updateHole(
                            index,
                            "handicapIndex",
                            parseInt(e.target.value)
                          )
                        }
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      >
                        {Array.from({ length: 18 }, (_, i) => i + 1).map(
                          (h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          )
                        )}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-center">
                      {holes.length > 1 && (
                        <button
                          onClick={() => removeHole(index)}
                          className="text-[var(--muted-foreground)] hover:text-red-500 transition-colors"
                          title="Remove hole"
                        >
                          &times;
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {/* Totals */}
                <tr className="bg-[var(--muted)] font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-center">{totalPar}</td>
                  <td className="px-4 py-3 text-center">
                    {totalBack.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {totalMiddle.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {totalForward.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center" />
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Add hole */}
          {holes.length < 18 && (
            <button
              onClick={addHole}
              className="inline-flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Hole {holes.length + 1}
            </button>
          )}

          {/* Quick presets */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">
              Quick setup:
            </span>
            <button
              onClick={() => setHoles(defaultHoles(9))}
              className="rounded-md border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
            >
              9-Hole Template
            </button>
            <button
              onClick={() => setHoles(defaultHoles(18))}
              className="rounded-md border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
            >
              18-Hole Template
            </button>
          </div>
        </>
      )}
    </div>
  );
}
