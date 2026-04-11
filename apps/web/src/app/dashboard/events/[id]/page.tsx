"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Check,
  Pencil,
  Loader2,
} from "lucide-react";
import type { EventWithRsvp, RsvpStatus, ClubEvent } from "@club/shared";
import { EventFormModal } from "../event-form-modal";
import { AttendeesModal } from "../attendees-modal";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
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

function formatTimeRange(start: string, end: string | null) {
  const startTime = formatTime(start);
  if (!end) return startTime;
  return `${startTime} – ${formatTime(end)}`;
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [event, setEvent] = useState<EventWithRsvp | null>(null);
  const [role, setRole] = useState<string>("member");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rsvpLoading, setRsvpLoading] = useState(false);

  // Admin modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}`);
      if (res.ok) {
        const data = await res.json();
        setEvent(data.event);
        setRole(data.role);
      } else {
        const data = await res.json();
        setError(data.error || "Event not found");
      }
    } catch {
      setError("Failed to load event");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  async function handleRsvp() {
    if (!event) return;
    if (event.user_rsvp_status === "attending") {
      if (!window.confirm("Are you sure you want to cancel your RSVP?")) return;
    }
    setRsvpLoading(true);
    try {
      const newStatus: RsvpStatus =
        event.user_rsvp_status === "attending" ? "declined" : "attending";
      const res = await fetch("/api/events/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: event.id,
          status: newStatus,
          guest_count: 0,
        }),
      });
      if (res.ok) {
        await fetchEvent();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to RSVP");
      }
    } catch {
      alert("Failed to RSVP");
    } finally {
      setRsvpLoading(false);
    }
  }

  const isAdmin = role === "admin";
  const isAttending = event?.user_rsvp_status === "attending";
  const isFree = !event?.price || event.price === 0;

  // Loading skeleton
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[var(--muted)] animate-pulse" />
          <div className="h-6 w-48 rounded bg-[var(--muted)] animate-pulse" />
        </div>
        <div className="rounded-xl border border-[var(--border)] p-6 space-y-4">
          <div className="h-8 w-3/4 rounded bg-[var(--muted)] animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-1/2 rounded bg-[var(--muted)] animate-pulse" />
            <div className="h-4 w-1/3 rounded bg-[var(--muted)] animate-pulse" />
            <div className="h-4 w-1/4 rounded bg-[var(--muted)] animate-pulse" />
          </div>
          <div className="h-20 w-full rounded bg-[var(--muted)] animate-pulse" />
          <div className="h-10 w-28 rounded-lg bg-[var(--muted)] animate-pulse" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push("/dashboard/events")}
          className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to events
        </button>
        <div className="rounded-xl border border-[var(--border)] p-12 text-center">
          <p className="font-semibold text-lg">
            {error || "Event not found"}
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            This event may have been removed or you don&apos;t have access.
          </p>
        </div>
      </div>
    );
  }

  const capacityPercent =
    event.capacity && event.capacity > 0
      ? Math.min((event.rsvp_count / event.capacity) * 100, 100)
      : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back link */}
      <button
        onClick={() => router.push("/dashboard/events")}
        className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to events
      </button>

      {/* Main card */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        {/* Hero image */}
        {event.image_url && (
          <div className="w-full h-56 overflow-hidden">
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-6">
          {/* Title + badges */}
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold">{event.title}</h1>
            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && event.status !== "published" && (
                <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 border-gray-200 capitalize">
                  {event.status}
                </span>
              )}
              {isFree ? (
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  Free
                </span>
              ) : (
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                  ${event.price}
                </span>
              )}
            </div>
          </div>

          {/* Event info */}
          <div className="mt-5 flex flex-col gap-3 text-sm text-[var(--muted-foreground)]">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium text-[var(--foreground)]">
                  {formatDate(event.start_date)}
                </p>
                <p>{formatTimeRange(event.start_date, event.end_date)}</p>
              </div>
            </div>

            {event.location && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 shrink-0" />
                <p>{event.location}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 shrink-0" />
              <div className="flex-1">
                <p>
                  {event.rsvp_count} attending
                  {event.capacity
                    ? ` of ${event.capacity} spots`
                    : ""}
                </p>
                {capacityPercent !== null && (
                  <div className="mt-1.5 h-2 w-full max-w-xs rounded-full bg-[var(--muted)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        capacityPercent >= 90
                          ? "bg-red-500"
                          : capacityPercent >= 70
                            ? "bg-yellow-500"
                            : "bg-[var(--primary)]"
                      }`}
                      style={{ width: `${capacityPercent}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="mt-6 pt-6 border-t border-[var(--border)]">
              <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}

          {/* RSVP button */}
          {event.status === "published" && (
            <div className="mt-6">
              <button
                onClick={handleRsvp}
                disabled={rsvpLoading}
                className={`inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-all ${
                  isAttending
                    ? "bg-green-100 text-green-800 border border-green-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                    : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
                } ${rsvpLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {rsvpLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isAttending ? (
                  <>
                    <Check className="h-4 w-4" /> Attending
                  </>
                ) : (
                  "RSVP"
                )}
              </button>
            </div>
          )}
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--muted)] flex items-center gap-3">
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Event
            </button>
            <button
              onClick={() => setShowAttendeesModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
            >
              <Users className="h-3.5 w-3.5" />
              View Attendees
            </button>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {showEditModal && (
        <EventFormModal
          event={event as ClubEvent}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            fetchEvent();
          }}
        />
      )}

      {/* Attendees modal */}
      {showAttendeesModal && (
        <AttendeesModal
          eventId={event.id}
          eventTitle={event.title}
          onClose={() => setShowAttendeesModal(false)}
        />
      )}
    </div>
  );
}
