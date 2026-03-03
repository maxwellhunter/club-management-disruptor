"use client";

import { useState, useEffect, useCallback } from "react";
import type { EventWithRsvp, MemberRole } from "@club/shared";
import { EventsMember } from "./events-member";
import { EventsAdmin } from "./events-admin";

export default function EventsPage() {
  const [events, setEvents] = useState<EventWithRsvp[]>([]);
  const [role, setRole] = useState<MemberRole>("member");
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
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
    fetchEvents();
  }, [fetchEvents]);

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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-[var(--muted-foreground)]">
            Club events, tournaments, and social gatherings.
          </p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Events</h1>
        <p className="text-[var(--muted-foreground)]">
          {isAdmin
            ? "Create, manage, and publish club events."
            : "Club events, tournaments, and social gatherings."}
        </p>
      </div>

      {isAdmin ? (
        <EventsAdmin events={events} onRefresh={fetchEvents} />
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
