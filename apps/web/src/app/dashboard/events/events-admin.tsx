"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ImageUpload } from "@/components/image-upload";
import {
  Plus,
  Pencil,
  Trash2,
  Send,
  Calendar,
  MapPin,
  Users,
  Clock,
} from "lucide-react";
import type { EventWithRsvp, ClubEvent, EventStatus } from "@club/shared";
import type { TimeFilter } from "./page";
import { EventFormModal } from "./event-form-modal";
import { AttendeesModal } from "./attendees-modal";

type FilterStatus = "all" | EventStatus;

interface EventsAdminProps {
  events: EventWithRsvp[];
  onRefresh: () => void;
  timeFilter: TimeFilter;
  onTimeFilterChange: (t: TimeFilter) => void;
}

const TIME_TABS: { value: TimeFilter; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
];

const STATUS_BADGE: Record<
  EventStatus,
  { label: string; dot: string; bg: string; text: string }
> = {
  draft: {
    label: "Draft",
    dot: "bg-gray-400",
    bg: "bg-gray-100",
    text: "text-gray-700",
  },
  published: {
    label: "Published",
    dot: "bg-emerald-500",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-red-500",
    bg: "bg-red-50",
    text: "text-red-700",
  },
  completed: {
    label: "Completed",
    dot: "bg-blue-500",
    bg: "bg-blue-50",
    text: "text-blue-700",
  },
};

const FILTER_TABS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "published", label: "Published" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function EventsAdmin({ events, onRefresh, timeFilter, onTimeFilterChange }: EventsAdminProps) {
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ClubEvent | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [viewingAttendees, setViewingAttendees] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Events hero image
  const [eventsHeroUrl, setEventsHeroUrl] = useState("");
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [heroExpanded, setHeroExpanded] = useState(false);

  useEffect(() => {
    async function fetchHero() {
      try {
        const res = await fetch("/api/club/events-image");
        if (res.ok) {
          const data = await res.json();
          setEventsHeroUrl(data.events_image_url ?? "");
        }
      } catch {
        // ignore
      } finally {
        setHeroLoaded(true);
      }
    }
    fetchHero();
  }, []);

  async function handleHeroChange(url: string) {
    setEventsHeroUrl(url);
    try {
      await fetch("/api/club/events-image", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events_image_url: url || null }),
      });
    } catch {
      // ignore
    }
  }

  const filteredEvents =
    filter === "all"
      ? events
      : events.filter((e) => e.status === filter);

  async function handlePublish(eventId: string) {
    setActionLoading(eventId);
    try {
      const res = await fetch(`/api/events/admin/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      if (res.ok) {
        onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to publish event");
      }
    } catch {
      alert("Failed to publish event");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(eventId: string) {
    setActionLoading(eventId);
    try {
      const res = await fetch(`/api/events/admin/${eventId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteConfirm(null);
        onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete event");
      }
    } catch {
      alert("Failed to delete event");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <>
      {/* Events Hero Image — collapsible */}
      {heroLoaded && (
        <div className="rounded-2xl bg-[var(--surface-lowest)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[var(--outline-variant)]/30 overflow-hidden">
          <button
            type="button"
            onClick={() => setHeroExpanded(!heroExpanded)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted)]/50 transition-colors"
          >
            {eventsHeroUrl ? (
              <img src={eventsHeroUrl} alt="" className="h-8 w-14 rounded object-cover" />
            ) : (
              <div className="h-8 w-14 rounded bg-[var(--muted)] flex items-center justify-center">
                <Calendar className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
              </div>
            )}
            <span className="text-xs font-semibold text-[var(--foreground)]">
              Events Hero Image
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {eventsHeroUrl ? "Uploaded" : "Not set"} · shown in iOS app
            </span>
            <svg className={`ml-auto h-4 w-4 text-[var(--muted-foreground)] transition-transform ${heroExpanded ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
          {heroExpanded && (
            <div className="px-4 pb-4">
              <ImageUpload
                value={eventsHeroUrl}
                onChange={handleHeroChange}
                bucket="event-images"
                label=""
                aspect="video"
                placeholder="Upload a hero image for the events experience"
              />
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {/* Time filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--muted)]">
            {TIME_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => onTimeFilterChange(tab.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition-all ${
                  timeFilter === tab.value
                    ? "bg-[var(--surface-lowest)] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Status filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--muted)]">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition-all ${
                  filter === tab.value
                    ? "bg-[var(--surface-lowest)] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary-container)] text-white px-5 py-2.5 text-xs font-bold tracking-wide uppercase hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Create Event
        </button>
      </div>

      {/* Events list */}
      {filteredEvents.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface-lowest)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[var(--outline-variant)]/30 p-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--muted)] mb-4">
            <Calendar className="h-7 w-7 text-[var(--muted-foreground)]" />
          </div>
          <p className="font-[family-name:var(--font-headline)] font-bold text-xl">
            No events found
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {filter === "all"
              ? "Create your first event to get started."
              : `No ${filter} events.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event) => {
            const badge = STATUS_BADGE[event.status];
            const isDraft = event.status === "draft";
            const isDeleting = deleteConfirm === event.id;
            const isFree = !event.price || event.price === 0;

            return (
              <div
                key={event.id}
                className="rounded-2xl bg-[var(--surface-lowest)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[var(--outline-variant)]/30 p-5 flex items-start gap-4 transition-all hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
              >
                {/* Thumbnail */}
                {event.image_url && (
                  <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden">
                    <img
                      src={event.image_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Event info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Link
                      href={`/dashboard/events/${event.id}`}
                      className="font-[family-name:var(--font-headline)] font-bold text-base truncate hover:text-[var(--primary)] transition-colors"
                    >
                      {event.title}
                    </Link>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase ${badge.bg} ${badge.text}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                      {badge.label}
                    </span>
                    {isFree ? (
                      <span className="shrink-0 rounded-md bg-[var(--accent)] text-[var(--primary)] px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase">
                        Free
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-md bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase">
                        ${event.price}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted-foreground)]">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(event.start_date)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime(event.start_date)}
                    </span>
                    {event.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {event.location}
                      </span>
                    )}
                    <button
                      onClick={() =>
                        setViewingAttendees({
                          id: event.id,
                          title: event.title,
                        })
                      }
                      className="inline-flex items-center gap-1.5 hover:text-[var(--primary)] transition-colors"
                    >
                      <Users className="h-3.5 w-3.5" />
                      {event.rsvp_count} attending
                      {event.capacity ? ` / ${event.capacity}` : ""}
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isDraft && (
                    <button
                      onClick={() => handlePublish(event.id)}
                      disabled={actionLoading === event.id}
                      title="Publish"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 text-emerald-700 px-3 py-1.5 text-xs font-bold tracking-wide uppercase hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Publish
                    </button>
                  )}
                  <button
                    onClick={() => setEditingEvent(event)}
                    title="Edit"
                    className="rounded-xl border border-[var(--border)] p-2 hover:bg-[var(--muted)] transition-colors"
                  >
                    <Pencil className="h-4 w-4 text-[var(--muted-foreground)]" />
                  </button>
                  {isDeleting ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(event.id)}
                        disabled={actionLoading === event.id}
                        className="rounded-xl bg-red-600 text-white px-3 py-1.5 text-xs font-bold tracking-wide uppercase hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === event.id ? "..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--muted)] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(event.id)}
                      title="Delete"
                      className="rounded-xl border border-[var(--border)] p-2 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-[var(--muted-foreground)]" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <EventFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={() => {
            setShowCreateModal(false);
            onRefresh();
          }}
        />
      )}

      {/* Edit modal */}
      {editingEvent && (
        <EventFormModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSaved={() => {
            setEditingEvent(null);
            onRefresh();
          }}
        />
      )}

      {/* Attendees modal */}
      {viewingAttendees && (
        <AttendeesModal
          eventId={viewingAttendees.id}
          eventTitle={viewingAttendees.title}
          onClose={() => setViewingAttendees(null)}
        />
      )}
    </>
  );
}
