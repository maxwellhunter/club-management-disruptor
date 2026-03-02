"use client";

import { Calendar, MapPin, Users, Check, X } from "lucide-react";
import type { RsvpStatus } from "@club/shared";

export interface EventCardProps {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
  capacity: number | null;
  price: number | null;
  rsvp_count: number;
  user_rsvp_status: RsvpStatus | null;
  onRsvp: (eventId: string, currentStatus: RsvpStatus | null) => void;
  rsvpLoading: boolean;
  compact?: boolean;
  mode?: "default" | "cancel";
  cancelled?: boolean;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
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

export function EventCard({
  id,
  title,
  description,
  location,
  start_date,
  end_date,
  capacity,
  price,
  rsvp_count,
  user_rsvp_status,
  onRsvp,
  rsvpLoading,
  compact = false,
  mode = "default",
  cancelled = false,
}: EventCardProps) {
  const isAttending = user_rsvp_status === "attending";
  const isFree = !price || price === 0;

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className={compact ? "p-4" : "p-5"}>
        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          <h2 className={`font-semibold ${compact ? "text-base" : "text-lg"}`}>
            {title}
          </h2>
          {isFree ? (
            <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              Free
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
              ${price}
            </span>
          )}
        </div>

        {/* Meta info */}
        <div className="mt-3 flex flex-col gap-1.5 text-sm text-[var(--muted-foreground)]">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>
              {formatDate(start_date)} ·{" "}
              {formatTimeRange(start_date, end_date)}
            </span>
          </div>
          {location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{location}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0" />
            <span>
              {rsvp_count} attending
              {capacity
                ? ` · ${capacity - rsvp_count} spots left`
                : ""}
            </span>
          </div>
        </div>

        {/* Description */}
        {description && (
          <p
            className={`mt-3 text-sm text-[var(--foreground)] leading-relaxed ${
              compact ? "line-clamp-2" : ""
            }`}
          >
            {description}
          </p>
        )}

        {/* Action button */}
        <div className="mt-4">
          {mode === "cancel" ? (
            cancelled ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-medium bg-gray-100 text-gray-400 border border-gray-200 cursor-default">
                <X className="h-4 w-4" /> Cancelled
              </span>
            ) : (
              <button
                onClick={() => onRsvp(id, user_rsvp_status)}
                disabled={rsvpLoading}
                className={`inline-flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-medium transition-all bg-red-50 text-red-700 border border-red-300 hover:bg-red-100 ${
                  rsvpLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {rsvpLoading ? "..." : "Cancel RSVP"}
              </button>
            )
          ) : (
            <button
              onClick={() => onRsvp(id, user_rsvp_status)}
              disabled={rsvpLoading}
              className={`inline-flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-medium transition-all ${
                isAttending
                  ? "bg-green-100 text-green-800 border border-green-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                  : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
              } ${rsvpLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {rsvpLoading ? (
                "..."
              ) : isAttending ? (
                <>
                  <Check className="h-4 w-4" /> Attending
                </>
              ) : (
                "RSVP"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
