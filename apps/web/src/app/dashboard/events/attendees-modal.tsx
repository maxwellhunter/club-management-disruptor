"use client";

import { useState, useEffect } from "react";
import { X, Users, UserCheck, UserX, Clock, Trash2 } from "lucide-react";
import type { EventAttendee, RsvpStatus } from "@club/shared";

interface AttendeesModalProps {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}

const STATUS_CONFIG: Record<
  RsvpStatus,
  { label: string; icon: typeof UserCheck; classes: string }
> = {
  attending: {
    label: "Attending",
    icon: UserCheck,
    classes: "bg-green-50 text-green-700 border-green-200",
  },
  waitlisted: {
    label: "Waitlisted",
    icon: Clock,
    classes: "bg-blue-50 text-blue-700 border-blue-200",
  },
  declined: {
    label: "Declined",
    icon: UserX,
    classes: "bg-red-50 text-red-700 border-red-200",
  },
};

const STATUS_ORDER: RsvpStatus[] = [
  "attending",
  "waitlisted",
  "declined",
];

export function AttendeesModal({
  eventId,
  eventTitle,
  onClose,
}: AttendeesModalProps) {
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [totalGuests, setTotalGuests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAttendees() {
      try {
        const res = await fetch(
          `/api/events/admin/${eventId}/attendees`
        );
        if (res.ok) {
          const data = await res.json();
          setAttendees(data.attendees);
          setTotalGuests(data.total_guests);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load attendees");
        }
      } catch {
        setError("Failed to load attendees");
      } finally {
        setLoading(false);
      }
    }
    fetchAttendees();
  }, [eventId]);

  async function handleRemove(rsvpId: string) {
    setRemovingId(rsvpId);
    try {
      const res = await fetch(
        `/api/events/admin/${eventId}/attendees`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rsvp_id: rsvpId }),
        }
      );
      if (res.ok) {
        const updated = attendees.filter((a) => a.rsvp_id !== rsvpId);
        setAttendees(updated);
        // Recompute total guests
        const newTotal = updated
          .filter((a) => a.status === "attending")
          .reduce((sum, a) => sum + 1 + a.guest_count, 0);
        setTotalGuests(newTotal);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to remove attendee");
      }
    } catch {
      alert("Failed to remove attendee");
    } finally {
      setRemovingId(null);
      setConfirmRemoveId(null);
    }
  }

  // Group attendees by status
  const grouped = attendees.reduce(
    (acc, a) => {
      if (!acc[a.status]) acc[a.status] = [];
      acc[a.status].push(a);
      return acc;
    },
    {} as Record<string, EventAttendee[]>
  );

  const attendingCount = attendees.filter(
    (a) => a.status === "attending"
  ).length;
  const guestsCount = attendees
    .filter((a) => a.status === "attending")
    .reduce((s, a) => s + a.guest_count, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--background)] rounded-xl border border-[var(--border)] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Attendees</h2>
            <p className="text-sm text-[var(--muted-foreground)] truncate">
              {eventTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 hover:bg-[var(--muted)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary bar */}
        {!loading && !error && attendees.length > 0 && (
          <div className="px-6 py-3 border-b border-[var(--border)] bg-[var(--muted)]">
            <div className="flex items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Users className="h-4 w-4" />
                {totalGuests} total headcount
              </span>
              <span className="text-[var(--muted-foreground)]">
                {attendingCount} member{attendingCount !== 1 ? "s" : ""}
                {guestsCount > 0 && ` + ${guestsCount} guest${guestsCount !== 1 ? "s" : ""}`}
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && attendees.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)]" />
              <p className="font-semibold text-lg">No RSVPs yet</p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                Attendees will appear here once members respond.
              </p>
            </div>
          )}

          {!loading && !error && attendees.length > 0 && (
            <div className="space-y-5">
              {STATUS_ORDER.filter((s) => grouped[s]?.length).map(
                (status) => {
                  const config = STATUS_CONFIG[status];
                  const Icon = config.icon;
                  const group = grouped[status];

                  return (
                    <div key={status}>
                      {/* Status header */}
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.classes}`}
                        >
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </span>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {group.length}
                        </span>
                      </div>

                      {/* Member rows */}
                      <div className="space-y-1">
                        {group.map((attendee) => (
                          <div
                            key={attendee.rsvp_id}
                            className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-[var(--muted)] transition-colors group"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">
                                {attendee.first_name} {attendee.last_name}
                              </p>
                              <p className="text-xs text-[var(--muted-foreground)] truncate">
                                {attendee.email}
                              </p>
                            </div>
                            {attendee.guest_count > 0 && (
                              <span className="shrink-0 ml-3 rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs font-medium text-[var(--muted-foreground)]">
                                +{attendee.guest_count} guest
                                {attendee.guest_count !== 1 ? "s" : ""}
                              </span>
                            )}
                            {/* Remove button */}
                            {confirmRemoveId === attendee.rsvp_id ? (
                              <div className="flex items-center gap-1 ml-2 shrink-0">
                                <button
                                  onClick={() => handleRemove(attendee.rsvp_id)}
                                  disabled={removingId === attendee.rsvp_id}
                                  className="rounded-md bg-red-600 text-white px-2 py-1 text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                                >
                                  {removingId === attendee.rsvp_id
                                    ? "..."
                                    : "Remove"}
                                </button>
                                <button
                                  onClick={() => setConfirmRemoveId(null)}
                                  className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium hover:bg-[var(--muted)] transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() =>
                                  setConfirmRemoveId(attendee.rsvp_id)
                                }
                                title="Remove attendee"
                                className="shrink-0 ml-2 rounded-md p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
