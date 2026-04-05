"use client";

import { useState } from "react";
import type { EventWithRsvp, RsvpStatus } from "@club/shared";
import { PartyPopper, Search, Filter } from "lucide-react";
import { EventCard } from "@/components/event-card";

interface EventsMemberProps {
  events: EventWithRsvp[];
  onRsvp: (eventId: string, currentStatus: RsvpStatus | null) => void;
  rsvpLoading: string | null;
}

type EventFilter = "all" | "upcoming" | "attending" | "free";

const FILTERS: { value: EventFilter; label: string }[] = [
  { value: "all", label: "All Events" },
  { value: "upcoming", label: "This Week" },
  { value: "attending", label: "My RSVPs" },
  { value: "free", label: "Free" },
];

export function EventsMember({
  events,
  onRsvp,
  rsvpLoading,
}: EventsMemberProps) {
  const [filter, setFilter] = useState<EventFilter>("all");
  const [search, setSearch] = useState("");

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const filtered = events.filter((event) => {
    // Search filter
    if (search) {
      const q = search.toLowerCase();
      const matchesSearch =
        event.title.toLowerCase().includes(q) ||
        event.location?.toLowerCase().includes(q) ||
        event.description?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }

    // Category filter
    switch (filter) {
      case "upcoming": {
        const eventDate = new Date(event.start_date);
        return eventDate >= now && eventDate <= weekFromNow;
      }
      case "attending":
        return event.user_rsvp_status === "attending";
      case "free":
        return !event.price || event.price === 0;
      default:
        return true;
    }
  });

  // First event is featured (only in "all" view with no search)
  const showFeatured = filter === "all" && !search && filtered.length > 0;
  const featuredEvent = showFeatured ? filtered[0] : null;
  const remainingEvents = showFeatured ? filtered.slice(1) : filtered;

  if (events.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--surface-lowest)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[var(--outline-variant)]/30 p-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent)] mb-4">
          <PartyPopper className="h-7 w-7 text-[var(--primary)]" />
        </div>
        <p className="font-[family-name:var(--font-headline)] font-bold text-xl mb-1">
          No upcoming events
        </p>
        <p className="text-sm text-[var(--muted-foreground)] max-w-sm mx-auto">
          Check back soon for club events, tournaments, and social gatherings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search & filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-lowest)] pl-9 pr-4 py-2.5 text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--muted)]">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition-all ${
                filter === f.value
                  ? "bg-[var(--surface-lowest)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Featured event hero */}
      {featuredEvent && (
        <EventCard
          key={featuredEvent.id}
          {...featuredEvent}
          featured
          onRsvp={(eventId, status) => onRsvp(eventId, status)}
          rsvpLoading={rsvpLoading === featuredEvent.id}
        />
      )}

      {/* Event grid */}
      {remainingEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {remainingEvents.map((event) => (
            <EventCard
              key={event.id}
              {...event}
              onRsvp={(eventId, status) => onRsvp(eventId, status)}
              rsvpLoading={rsvpLoading === event.id}
            />
          ))}
        </div>
      ) : (
        !featuredEvent && (
          <div className="rounded-2xl bg-[var(--surface-lowest)] border border-[var(--outline-variant)]/30 p-12 text-center">
            <Filter className="h-8 w-8 mx-auto mb-3 text-[var(--muted-foreground)]" />
            <p className="font-[family-name:var(--font-headline)] font-bold text-lg">
              No matching events
            </p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Try a different filter or search term.
            </p>
          </div>
        )
      )}
    </div>
  );
}
