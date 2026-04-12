"use client";

import { useState, useEffect, useCallback } from "react";
import type { EventWithRsvp, MemberRole } from "@club/shared";
import { EventsMember } from "./events-member";
import { EventsAdmin } from "./events-admin";

export type TimeFilter = "upcoming" | "past" | "all";

export default function EventsPage() {
  const [events, setEvents] = useState<EventWithRsvp[]>([]);
  const [role, setRole] = useState<MemberRole>("member");
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("upcoming");

  const fetchEvents = useCallback(async (time?: TimeFilter) => {
    try {
      const params = new URLSearchParams();
      if (time) params.set("time", time);
      const res = await fetch(`/api/events?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
        if (data.role) setRole(data.role);
      }
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(timeFilter);
  }, [fetchEvents, timeFilter]);

  async function handleRsvp(eventId: string, currentStatus: string | null) {
    setRsvpLoading(eventId);
    try {
      const newStatus =
        currentStatus === "attending" ? "declined" : "attending";
      const res = await fetch("/api/events/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          status: newStatus,
          guest_count: 0,
        }),
      });

      if (res.ok) {
        await fetchEvents();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to RSVP");
      }
    } catch {
      alert("Failed to RSVP");
    } finally {
      setRsvpLoading(null);
    }
  }

  const isAdmin = role === "admin";

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div>
          <div className="h-8 w-48 rounded-lg bg-[var(--muted)] animate-pulse mb-2" />
          <div className="h-4 w-72 rounded-md bg-[var(--muted)] animate-pulse" />
        </div>
        {/* Featured card skeleton */}
        <div className="h-64 rounded-2xl bg-[var(--muted)] animate-pulse" />
        {/* Grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-52 rounded-2xl bg-[var(--muted)] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--foreground)]">
          Events
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          {isAdmin
            ? "Create, manage, and publish club events."
            : "Tournaments, socials, and everything happening at the club."}
        </p>
      </div>

      {isAdmin ? (
        <EventsAdmin
          events={events}
          onRefresh={() => fetchEvents(timeFilter)}
          timeFilter={timeFilter}
          onTimeFilterChange={setTimeFilter}
        />
      ) : (
        <EventsMember
          events={events}
          onRsvp={handleRsvp}
          rsvpLoading={rsvpLoading}
        />
      )}
    </div>
  );
}
