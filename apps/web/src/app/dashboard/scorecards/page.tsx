"use client";

import { useState, useEffect, useCallback } from "react";
import type { GolfRoundSummary, MemberRole } from "@club/shared";
import { ScorecardHistory } from "./scorecard-history";
import { NewRoundModal } from "./new-round-modal";

interface Facility {
  id: string;
  name: string;
}

export default function ScorecardsPage() {
  const [rounds, setRounds] = useState<GolfRoundSummary[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [role, setRole] = useState<MemberRole>("member");
  const [loading, setLoading] = useState(true);
  const [showNewRound, setShowNewRound] = useState(false);

  const fetchRounds = useCallback(async () => {
    try {
      const res = await fetch("/api/scorecards");
      if (res.ok) {
        const data = await res.json();
        setRounds(data.rounds ?? []);
        if (data.facilities) setFacilities(data.facilities);
        if (data.role) setRole(data.role);
      }
    } catch (err) {
      console.error("Failed to fetch rounds:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRounds();
  }, [fetchRounds]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Scorecards</h1>
          <p className="text-[var(--muted-foreground)]">
            Track your rounds and view scoring history.
          </p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scorecards</h1>
          <p className="text-[var(--muted-foreground)]">
            Track your rounds and view scoring history.
          </p>
        </div>
        <button
          onClick={() => setShowNewRound(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
        >
          New Round
        </button>
      </div>

      <ScorecardHistory
        rounds={rounds}
        facilities={facilities}
        role={role}
        onRefresh={fetchRounds}
      />

      {showNewRound && (
        <NewRoundModal
          facilities={facilities}
          onClose={() => setShowNewRound(false)}
          onSuccess={fetchRounds}
        />
      )}
    </div>
  );
}
