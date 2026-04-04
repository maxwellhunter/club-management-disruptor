"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag, Trophy, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { GolfRoundSummary, MemberRole } from "@club/shared";

interface Facility {
  id: string;
  name: string;
}

interface ScorecardHistoryProps {
  rounds: GolfRoundSummary[];
  facilities: Facility[];
  role: MemberRole;
  onRefresh: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  verified: "bg-blue-100 text-blue-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export function ScorecardHistory({
  rounds,
  facilities,
  role,
  onRefresh,
}: ScorecardHistoryProps) {
  const [filterFacility, setFilterFacility] = useState<string>("all");

  const filtered = rounds.filter((r) => {
    if (filterFacility !== "all" && r.facility_id !== filterFacility)
      return false;
    return true;
  });

  // Stats
  const completedRounds = rounds.filter((r) => r.status === "completed");
  const bestScore = completedRounds.length
    ? Math.min(
        ...completedRounds
          .filter((r) => r.total_score != null)
          .map((r) => r.total_score!)
      )
    : null;
  const avgScore = completedRounds.length
    ? Math.round(
        completedRounds
          .filter((r) => r.total_score != null)
          .reduce((sum, r) => sum + r.total_score!, 0) /
          completedRounds.filter((r) => r.total_score != null).length
      )
    : null;

  function formatScoreToPar(scoreToPar: number | null) {
    if (scoreToPar == null) return "—";
    if (scoreToPar === 0) return "E";
    if (scoreToPar > 0) return `+${scoreToPar}`;
    return `${scoreToPar}`;
  }

  function scoreToParColor(scoreToPar: number | null) {
    if (scoreToPar == null) return "text-[var(--muted-foreground)]";
    if (scoreToPar < 0) return "text-red-600";
    if (scoreToPar === 0) return "text-green-600";
    return "text-[var(--foreground)]";
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {completedRounds.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-[var(--border)] p-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              Rounds Played
            </p>
            <p className="text-2xl font-bold mt-1">{completedRounds.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4">
            <p className="text-sm text-[var(--muted-foreground)]">Best Score</p>
            <p className="text-2xl font-bold mt-1">
              {bestScore ?? "—"}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              Average Score
            </p>
            <p className="text-2xl font-bold mt-1">
              {avgScore ?? "—"}
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      {facilities.length > 1 && (
        <div className="flex gap-2">
          <select
            value={filterFacility}
            onChange={(e) => setFilterFacility(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
          >
            <option value="all">All Courses</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Round list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center">
          <Flag className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)]" />
          <p className="font-medium text-[var(--foreground)]">
            No rounds recorded yet
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Start a new round to track your scores on the course.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((round) => (
            <Link
              key={round.id}
              href={`/dashboard/scorecards/${round.id}`}
              className="block rounded-xl border border-[var(--border)] p-5 transition-colors hover:bg-[var(--muted)]/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-[var(--foreground)]">
                      {round.facility_name}
                    </h3>
                    <span className="text-sm text-[var(--muted-foreground)]">
                      {round.holes_played} holes &middot;{" "}
                      {round.tee_set} tees
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[round.status]}`}
                    >
                      {round.status === "in_progress"
                        ? "In Progress"
                        : round.status.charAt(0).toUpperCase() +
                          round.status.slice(1)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="text-[var(--muted-foreground)]">
                      {new Date(round.played_at).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {round.weather && (
                      <span className="text-[var(--muted-foreground)]">
                        {round.weather.charAt(0).toUpperCase() +
                          round.weather.slice(1)}
                      </span>
                    )}
                    {round.total_putts != null && (
                      <span className="text-[var(--muted-foreground)]">
                        {round.total_putts} putts
                      </span>
                    )}
                    {round.total_greens_in_regulation != null && (
                      <span className="text-[var(--muted-foreground)]">
                        {round.total_greens_in_regulation} GIR
                      </span>
                    )}
                  </div>

                  {role === "admin" && (
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">
                      {round.member_first_name} {round.member_last_name}
                    </p>
                  )}
                </div>

                {/* Score display */}
                <div className="text-right shrink-0 ml-4">
                  {round.total_score != null ? (
                    <>
                      <p className="text-3xl font-bold">{round.total_score}</p>
                      <p
                        className={`text-sm font-medium ${scoreToParColor(round.score_to_par)}`}
                      >
                        {formatScoreToPar(round.score_to_par)}
                        {round.course_par != null && (
                          <span className="text-[var(--muted-foreground)] font-normal">
                            {" "}
                            (par {round.course_par})
                          </span>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="text-lg text-[var(--muted-foreground)]">—</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
