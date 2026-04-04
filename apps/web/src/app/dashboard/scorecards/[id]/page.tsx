"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Flag,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { GolfRound, GolfScore, CourseHole } from "@club/shared";

type ScoreEntry = {
  hole_number: number;
  strokes: number | null;
  putts: number | null;
  fairway_hit: boolean | null;
  green_in_regulation: boolean | null;
  penalty_strokes: number;
};

export default function ScorecardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [round, setRound] = useState<GolfRound & { facility_name: string; member_first_name: string; member_last_name: string } | null>(null);
  const [scores, setScores] = useState<GolfScore[]>([]);
  const [holes, setHoles] = useState<CourseHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeHole, setActiveHole] = useState(1);
  const [localScores, setLocalScores] = useState<Map<number, ScoreEntry>>(
    new Map()
  );

  const fetchRound = useCallback(async () => {
    try {
      const res = await fetch(`/api/scorecards/${id}`);
      if (!res.ok) {
        router.push("/dashboard/scorecards");
        return;
      }
      const data = await res.json();
      setRound(data.round);
      setScores(data.scores);
      setHoles(data.holes);

      // Initialize local scores from existing data
      const map = new Map<number, ScoreEntry>();
      const holeCount = data.round.holes_played;
      for (let i = 1; i <= holeCount; i++) {
        const existing = data.scores.find(
          (s: GolfScore) => s.hole_number === i
        );
        map.set(i, {
          hole_number: i,
          strokes: existing?.strokes ?? null,
          putts: existing?.putts ?? null,
          fairway_hit: existing?.fairway_hit ?? null,
          green_in_regulation: existing?.green_in_regulation ?? null,
          penalty_strokes: existing?.penalty_strokes ?? 0,
        });
      }
      setLocalScores(map);
    } catch {
      router.push("/dashboard/scorecards");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchRound();
  }, [fetchRound]);

  function updateScore(hole: number, field: keyof ScoreEntry, value: unknown) {
    setLocalScores((prev) => {
      const next = new Map(prev);
      const entry = { ...next.get(hole)! };
      (entry as Record<string, unknown>)[field] = value;
      next.set(hole, entry);
      return next;
    });
  }

  async function saveScores() {
    setSaving(true);
    try {
      const scoresToSave = Array.from(localScores.values()).filter(
        (s) => s.strokes != null
      );
      if (scoresToSave.length === 0) return;

      const res = await fetch(`/api/scorecards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores: scoresToSave }),
      });

      if (res.ok) {
        const data = await res.json();
        setScores(data.scores);
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }

  async function completeRound() {
    if (!confirm("Finalize this round? Scores cannot be changed after."))
      return;
    await saveScores();
    try {
      const res = await fetch(`/api/scorecards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      if (res.ok) {
        router.push("/dashboard/scorecards");
      }
    } catch (err) {
      console.error("Complete failed:", err);
    }
  }

  if (loading || !round) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded bg-[var(--muted)] animate-pulse" />
        <div className="h-64 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse" />
      </div>
    );
  }

  const isEditable = round.status === "in_progress";
  const holeCount = round.holes_played;
  const currentHole = holes.find((h) => h.hole_number === activeHole);
  const currentScore = localScores.get(activeHole);

  // Calculate running totals
  const totalStrokes = Array.from(localScores.values()).reduce(
    (sum, s) => sum + (s.strokes ?? 0),
    0
  );
  const totalPar = holes
    .filter((h) => h.hole_number <= holeCount)
    .reduce((sum, h) => sum + h.par, 0);
  const scoreToPar = totalStrokes - totalPar;
  const holesCompleted = Array.from(localScores.values()).filter(
    (s) => s.strokes != null
  ).length;

  function formatScoreToPar(val: number) {
    if (val === 0) return "E";
    if (val > 0) return `+${val}`;
    return `${val}`;
  }

  function getScoreLabel(strokes: number | null, par: number) {
    if (strokes == null) return "";
    const diff = strokes - par;
    if (diff <= -2) return "Eagle";
    if (diff === -1) return "Birdie";
    if (diff === 0) return "Par";
    if (diff === 1) return "Bogey";
    if (diff === 2) return "Double";
    return `+${diff}`;
  }

  function getScoreStyle(strokes: number | null, par: number) {
    if (strokes == null) return "";
    const diff = strokes - par;
    if (diff <= -2)
      return "bg-amber-100 text-amber-700 ring-2 ring-amber-400";
    if (diff === -1) return "bg-red-100 text-red-700 ring-2 ring-red-400";
    if (diff === 0) return "bg-green-100 text-green-700";
    if (diff === 1) return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-700";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/scorecards")}
            className="rounded-lg p-1.5 hover:bg-[var(--muted)] transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{round.facility_name}</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              {new Date(round.played_at).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}{" "}
              &middot; {round.tee_set} tees &middot; {round.holes_played}{" "}
              holes
              {round.weather &&
                ` · ${round.weather.charAt(0).toUpperCase() + round.weather.slice(1)}`}
            </p>
          </div>
        </div>

        {isEditable && (
          <div className="flex gap-2">
            <button
              onClick={saveScores}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={completeRound}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
            >
              <Check className="h-3.5 w-3.5" />
              Finish Round
            </button>
          </div>
        )}
      </div>

      {/* Score summary bar */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-[var(--border)] p-3 text-center">
          <p className="text-xs text-[var(--muted-foreground)]">Score</p>
          <p className="text-2xl font-bold">
            {totalStrokes > 0 ? totalStrokes : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-3 text-center">
          <p className="text-xs text-[var(--muted-foreground)]">To Par</p>
          <p
            className={`text-2xl font-bold ${
              totalStrokes > 0
                ? scoreToPar < 0
                  ? "text-red-600"
                  : scoreToPar === 0
                    ? "text-green-600"
                    : ""
                : ""
            }`}
          >
            {totalStrokes > 0 ? formatScoreToPar(scoreToPar) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-3 text-center">
          <p className="text-xs text-[var(--muted-foreground)]">Thru</p>
          <p className="text-2xl font-bold">{holesCompleted}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-3 text-center">
          <p className="text-xs text-[var(--muted-foreground)]">Par</p>
          <p className="text-2xl font-bold">{totalPar}</p>
        </div>
      </div>

      {/* Hole navigator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {Array.from({ length: holeCount }, (_, i) => i + 1).map((num) => {
          const holeData = holes.find((h) => h.hole_number === num);
          const score = localScores.get(num);
          const hasScore = score?.strokes != null;

          return (
            <button
              key={num}
              onClick={() => setActiveHole(num)}
              className={`flex flex-col items-center justify-center min-w-[2.75rem] rounded-lg px-2 py-1.5 text-xs transition-colors ${
                activeHole === num
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : hasScore
                    ? "bg-[var(--muted)] text-[var(--foreground)]"
                    : "border border-[var(--border)] text-[var(--muted-foreground)]"
              }`}
            >
              <span className="font-bold">{num}</span>
              <span className="text-[10px] opacity-75">
                {hasScore ? score!.strokes : `P${holeData?.par ?? ""}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active hole scoring */}
      {currentHole && currentScore && (
        <div className="rounded-xl border border-[var(--border)] p-6">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setActiveHole(Math.max(1, activeHole - 1))}
              disabled={activeHole === 1}
              className="rounded-lg p-2 hover:bg-[var(--muted)] transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="text-center">
              <h2 className="text-2xl font-bold">Hole {activeHole}</h2>
              <div className="flex items-center justify-center gap-3 mt-1 text-sm text-[var(--muted-foreground)]">
                <span>Par {currentHole.par}</span>
                <span>&middot;</span>
                <span>
                  {round.tee_set === "back"
                    ? currentHole.yardage_back
                    : round.tee_set === "forward"
                      ? currentHole.yardage_forward
                      : currentHole.yardage_middle ?? currentHole.yardage_back}{" "}
                  yds
                </span>
                <span>&middot;</span>
                <span>HCP {currentHole.handicap_index}</span>
              </div>
            </div>

            <button
              onClick={() =>
                setActiveHole(Math.min(holeCount, activeHole + 1))
              }
              disabled={activeHole === holeCount}
              className="rounded-lg p-2 hover:bg-[var(--muted)] transition-colors disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Strokes */}
          <div className="mb-5">
            <label className="block text-sm font-medium mb-2">Strokes</label>
            <div className="flex items-center gap-2 flex-wrap">
              {Array.from(
                { length: Math.max(8, currentHole.par + 4) },
                (_, i) => i + 1
              ).map((n) => (
                <button
                  key={n}
                  disabled={!isEditable}
                  onClick={() =>
                    updateScore(
                      activeHole,
                      "strokes",
                      currentScore.strokes === n ? null : n
                    )
                  }
                  className={`h-10 w-10 rounded-full text-sm font-bold transition-all ${
                    currentScore.strokes === n
                      ? getScoreStyle(n, currentHole.par)
                      : "border border-[var(--border)] hover:bg-[var(--muted)]"
                  } disabled:cursor-default`}
                >
                  {n}
                </button>
              ))}
            </div>
            {currentScore.strokes != null && (
              <p className="text-sm mt-1.5 font-medium text-[var(--muted-foreground)]">
                {getScoreLabel(currentScore.strokes, currentHole.par)}
              </p>
            )}
          </div>

          {/* Putts */}
          <div className="mb-5">
            <label className="block text-sm font-medium mb-2">Putts</label>
            <div className="flex items-center gap-2">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  disabled={!isEditable}
                  onClick={() =>
                    updateScore(
                      activeHole,
                      "putts",
                      currentScore.putts === n ? null : n
                    )
                  }
                  className={`h-9 w-9 rounded-full text-sm font-medium transition-all ${
                    currentScore.putts === n
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "border border-[var(--border)] hover:bg-[var(--muted)]"
                  } disabled:cursor-default`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Fairway + GIR */}
          <div className="grid grid-cols-2 gap-4">
            {currentHole.par > 3 && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Fairway Hit
                </label>
                <div className="flex gap-2">
                  {[
                    { label: "Yes", value: true },
                    { label: "No", value: false },
                  ].map(({ label, value }) => (
                    <button
                      key={label}
                      disabled={!isEditable}
                      onClick={() =>
                        updateScore(
                          activeHole,
                          "fairway_hit",
                          currentScore.fairway_hit === value ? null : value
                        )
                      }
                      className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                        currentScore.fairway_hit === value
                          ? value
                            ? "bg-green-100 text-green-700 border border-green-300"
                            : "bg-red-100 text-red-600 border border-red-300"
                          : "border border-[var(--border)] hover:bg-[var(--muted)]"
                      } disabled:cursor-default`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">
                Green in Reg
              </label>
              <div className="flex gap-2">
                {[
                  { label: "Yes", value: true },
                  { label: "No", value: false },
                ].map(({ label, value }) => (
                  <button
                    key={label}
                    disabled={!isEditable}
                    onClick={() =>
                      updateScore(
                        activeHole,
                        "green_in_regulation",
                        currentScore.green_in_regulation === value
                          ? null
                          : value
                      )
                    }
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                      currentScore.green_in_regulation === value
                        ? value
                          ? "bg-green-100 text-green-700 border border-green-300"
                          : "bg-red-100 text-red-600 border border-red-300"
                        : "border border-[var(--border)] hover:bg-[var(--muted)]"
                    } disabled:cursor-default`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Nav buttons */}
          {isEditable && (
            <div className="flex justify-between mt-6 pt-4 border-t border-[var(--border)]">
              <button
                onClick={() => setActiveHole(Math.max(1, activeHole - 1))}
                disabled={activeHole === 1}
                className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev Hole
              </button>
              {activeHole < holeCount ? (
                <button
                  onClick={() => {
                    saveScores();
                    setActiveHole(activeHole + 1);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
                >
                  Next Hole
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={completeRound}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
                >
                  <Flag className="h-3.5 w-3.5" />
                  Finish Round
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Full scorecard table */}
      <div className="rounded-xl border border-[var(--border)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
              <th className="px-3 py-2 text-left font-medium">Hole</th>
              {Array.from({ length: holeCount }, (_, i) => i + 1).map(
                (num) => (
                  <th
                    key={num}
                    className={`px-2 py-2 text-center font-medium min-w-[2.5rem] ${
                      num === activeHole ? "bg-[var(--primary)]/10" : ""
                    }`}
                  >
                    {num}
                  </th>
                )
              )}
              <th className="px-3 py-2 text-center font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {/* Par row */}
            <tr className="border-b border-[var(--border)]">
              <td className="px-3 py-1.5 font-medium text-[var(--muted-foreground)]">
                Par
              </td>
              {Array.from({ length: holeCount }, (_, i) => i + 1).map(
                (num) => {
                  const h = holes.find((h) => h.hole_number === num);
                  return (
                    <td key={num} className="px-2 py-1.5 text-center">
                      {h?.par ?? ""}
                    </td>
                  );
                }
              )}
              <td className="px-3 py-1.5 text-center font-bold">
                {totalPar}
              </td>
            </tr>
            {/* Yardage row */}
            <tr className="border-b border-[var(--border)]">
              <td className="px-3 py-1.5 font-medium text-[var(--muted-foreground)]">
                Yds
              </td>
              {Array.from({ length: holeCount }, (_, i) => i + 1).map(
                (num) => {
                  const h = holes.find((h) => h.hole_number === num);
                  const yds =
                    round.tee_set === "back"
                      ? h?.yardage_back
                      : round.tee_set === "forward"
                        ? h?.yardage_forward
                        : h?.yardage_middle ?? h?.yardage_back;
                  return (
                    <td
                      key={num}
                      className="px-2 py-1.5 text-center text-xs text-[var(--muted-foreground)]"
                    >
                      {yds ?? ""}
                    </td>
                  );
                }
              )}
              <td className="px-3 py-1.5 text-center text-xs font-bold text-[var(--muted-foreground)]">
                {holes
                  .filter((h) => h.hole_number <= holeCount)
                  .reduce((sum, h) => {
                    const y =
                      round.tee_set === "back"
                        ? h.yardage_back
                        : round.tee_set === "forward"
                          ? (h.yardage_forward ?? h.yardage_back)
                          : (h.yardage_middle ?? h.yardage_back);
                    return sum + y;
                  }, 0)}
              </td>
            </tr>
            {/* Score row */}
            <tr className="border-b border-[var(--border)]">
              <td className="px-3 py-1.5 font-bold">Score</td>
              {Array.from({ length: holeCount }, (_, i) => i + 1).map(
                (num) => {
                  const s = localScores.get(num);
                  const h = holes.find((h) => h.hole_number === num);
                  return (
                    <td
                      key={num}
                      className={`px-2 py-1.5 text-center font-bold cursor-pointer ${
                        num === activeHole ? "bg-[var(--primary)]/10" : ""
                      }`}
                      onClick={() => setActiveHole(num)}
                    >
                      {s?.strokes != null ? (
                        <span
                          className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-xs ${getScoreStyle(s.strokes, h?.par ?? 4)}`}
                        >
                          {s.strokes}
                        </span>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">
                          –
                        </span>
                      )}
                    </td>
                  );
                }
              )}
              <td className="px-3 py-1.5 text-center font-bold text-lg">
                {totalStrokes > 0 ? totalStrokes : "—"}
              </td>
            </tr>
            {/* Putts row */}
            <tr>
              <td className="px-3 py-1.5 font-medium text-[var(--muted-foreground)]">
                Putts
              </td>
              {Array.from({ length: holeCount }, (_, i) => i + 1).map(
                (num) => {
                  const s = localScores.get(num);
                  return (
                    <td
                      key={num}
                      className="px-2 py-1.5 text-center text-[var(--muted-foreground)]"
                    >
                      {s?.putts ?? "–"}
                    </td>
                  );
                }
              )}
              <td className="px-3 py-1.5 text-center font-bold text-[var(--muted-foreground)]">
                {Array.from(localScores.values()).reduce(
                  (sum, s) => sum + (s.putts ?? 0),
                  0
                ) || "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
