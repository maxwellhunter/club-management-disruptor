"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  Send,
  Calendar,
  MapPin,
  Users,
} from "lucide-react";
import type { EventWithRsvp, ClubEvent, EventStatus } from "@club/shared";
import { EventFormModal } from "./event-form-modal";
import { AttendeesModal } from "./attendees-modal";

type FilterStatus = "all" | EventStatus;

interface EventsAdminProps {
  events: EventWithRsvp[];
  onRefresh: () => void;
}

const STATUS_BADGE: Record<
  EventStatus,
  { label: string; classes: string }
> = {
  draft: {
    label: "Draft",
    classes: "bg-gray-100 text-gray-700 border-gray-200",
  },
  published: {
    label: "Published",
    classes: "bg-green-50 text-green-700 border-green-200",
  },
  cancelled: {
    label: "Cancelled",
    classes: "bg-red-50 text-red-700 border-red-200",
  },
  completed: {
    label: "Completed",
    classes: "bg-blue-50 text-blue-700 border-blue-200",
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

export function EventsAdmin({ events, onRefresh }: EventsAdminProps) {
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ClubEvent | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [viewingAttendees, setViewingAttendees] = useState<{
    id: string;
    title: string;
  } | null>(null);

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
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === tab.value
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Create Event
        </button>
      </div>

      {/* Events list */}
      {filteredEvents.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-12 text-center">
          <Calendar className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)]" />
          <p className="font-semibold text-lg">No events found</p>
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
                className="rounded-xl border border-[var(--border)] p-4 flex items-start gap-4"
              >
                {/* Event info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={`/dashboard/events/${event.id}`}
                      className="font-semibold truncate hover:text-[var(--primary)] hover:underline transition-colors"
                    >
                      {event.title}
                    </Link>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${badge.classes}`}
                    >
                      {badge.label}
                    </span>
                    {isFree ? (
                      <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        Free
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        ${event.price}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted-foreground)]">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(event.start_date)} ·{" "}
                      {formatTime(event.start_date)}
                    </span>
                    {event.location && (
                      <span className="inline-flex items-center gap-1">
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
                      className="inline-flex items-center gap-1 hover:text-[var(--primary)] hover:underline transition-colors"
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
                      className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 text-green-700 px-3 py-1.5 text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Publish
                    </button>
                  )}
                  <button
                    onClick={() => setEditingEvent(event)}
                    title="Edit"
                    className="rounded-lg border border-[var(--border)] p-1.5 hover:bg-[var(--muted)] transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {isDeleting ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(event.id)}
                        disabled={actionLoading === event.id}
                        className="rounded-lg bg-red-600 text-white px-2.5 py-1.5 text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === event.id
                          ? "..."
                          : "Confirm"}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--muted)] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(event.id)}
                      title="Delete"
                      className="rounded-lg border border-[var(--border)] p-1.5 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
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
