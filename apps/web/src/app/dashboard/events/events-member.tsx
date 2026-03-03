"use client";

import type { EventWithRsvp, RsvpStatus } from "@club/shared";
import { PartyPopper } from "lucide-react";
import { EventCard } from "@/components/event-card";

interface EventsMemberProps {
  events: EventWithRsvp[];
  onRsvp: (eventId: string, currentStatus: RsvpStatus | null) => void;
  rsvpLoading: string | null;
}

export function EventsMember({
  events,
  onRsvp,
  rsvpLoading,
}: EventsMemberProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-12 text-center">
        <PartyPopper className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)]" />
        <p className="font-semibold text-lg">No upcoming events</p>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Check back soon for club events and social gatherings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <EventCard
          key={event.id}
          {...event}
          onRsvp={(eventId, status) => onRsvp(eventId, status)}
          rsvpLoading={rsvpLoading === event.id}
        />
      ))}
    </div>
  );
}
