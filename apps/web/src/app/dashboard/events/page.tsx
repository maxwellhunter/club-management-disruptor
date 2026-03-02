"use client";

import { useState, useEffect, useCallback } from "react";
import type { EventWithRsvp } from "@club/shared";
import { PartyPopper } from "lucide-react";
import { EventCard } from "@/components/event-card";

export default function EventsPage() {
  const [events, setEvents] = useState<EventWithRsvp[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
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
      const newStatus = currentStatus === "attending" ? "declined" : "attending";
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
        // Refresh events to get updated counts
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
          Club events, tournaments, and social gatherings.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-12 text-center">
          <PartyPopper className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)]" />
          <p className="font-semibold text-lg">No upcoming events</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Check back soon for club events and social gatherings.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <EventCard
              key={event.id}
              {...event}
              onRsvp={(eventId, status) => handleRsvp(eventId, status)}
              rsvpLoading={rsvpLoading === event.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
