"use client";

import Link from "next/link";
import { Calendar, MapPin, Users, Check, X, Clock } from "lucide-react";
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
  featured?: boolean;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
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
  return `${startTime} \u2013 ${formatTime(end)}`;
}

function getRelativeDate(dateStr: string) {
  const now = new Date();
  const event = new Date(dateStr);
  const diffMs = event.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
  return null;
}

/* ─── Featured Hero Card ──────────────────────────────── */

function FeaturedEventCard({
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
}: EventCardProps) {
  const isAttending = user_rsvp_status === "attending";
  const isFree = !price || price === 0;
  const relative = getRelativeDate(start_date);
  const spotsLeft = capacity ? capacity - rsvp_count : null;

  return (
    <div className="relative rounded-2xl overflow-hidden bg-[var(--primary-container)] text-white shadow-lg">
      {/* Gradient overlay for depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(1,45,29,0.95) 0%, rgba(27,67,50,0.85) 100%)",
        }}
      />
      <div className="relative z-10 p-8 md:p-10">
        {/* Top badges */}
        <div className="flex items-center gap-2 mb-4">
          {relative && (
            <span className="rounded-full bg-[var(--tertiary-fixed)] text-[var(--tertiary)] px-3 py-1 text-xs font-bold tracking-wide uppercase">
              {relative}
            </span>
          )}
          {isFree ? (
            <span className="rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              Free Event
            </span>
          ) : (
            <span className="rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              ${price}
            </span>
          )}
        </div>

        {/* Title & description */}
        <Link href={`/dashboard/events/${id}`} className="block group">
          <h2 className="font-[family-name:var(--font-headline)] text-3xl md:text-4xl font-bold leading-tight mb-3 group-hover:underline decoration-white/40 underline-offset-4">
            {title}
          </h2>
        </Link>
        {description && (
          <p className="text-white/75 text-base leading-relaxed max-w-2xl mb-6 italic">
            {description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/80 mb-6">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {formatDate(start_date)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {formatTimeRange(start_date, end_date)}
          </span>
          {location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {location}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {rsvp_count} attending{spotsLeft !== null ? ` \u00b7 ${spotsLeft} spots left` : ""}
          </span>
        </div>

        {/* Capacity bar */}
        {capacity && (
          <div className="mb-6 max-w-sm">
            <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                style={{
                  width: `${Math.min((rsvp_count / capacity) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* CTA button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            if (isAttending && !window.confirm("Cancel your RSVP?")) return;
            onRsvp(id, user_rsvp_status);
          }}
          disabled={rsvpLoading}
          className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold tracking-wide uppercase transition-all ${
            isAttending
              ? "bg-[var(--accent)] text-[var(--primary)] hover:bg-red-100 hover:text-red-700"
              : "bg-white text-[var(--primary)] hover:bg-white/90"
          } ${rsvpLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {rsvpLoading ? (
            <span className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isAttending ? (
            <>
              <Check className="h-4 w-4" /> Attending
            </>
          ) : (
            "RSVP Now"
          )}
        </button>
      </div>
    </div>
  );
}

/* ─── Standard Card ───────────────────────────────────── */

export function EventCard(props: EventCardProps) {
  const {
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
    featured = false,
  } = props;

  if (featured) return <FeaturedEventCard {...props} />;

  const isAttending = user_rsvp_status === "attending";
  const isFree = !price || price === 0;
  const relative = getRelativeDate(start_date);
  const spotsLeft = capacity ? capacity - rsvp_count : null;

  return (
    <Link
      href={`/dashboard/events/${id}`}
      className="block rounded-2xl bg-[var(--surface-lowest)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[var(--outline-variant)]/30 transition-all duration-200 overflow-hidden group"
    >
      <div className={compact ? "p-5" : "p-6"}>
        {/* Top row: badges */}
        <div className="flex items-center gap-2 mb-3">
          {relative && (
            <span className="rounded-md bg-[var(--tertiary-fixed)] text-[var(--tertiary)] px-2.5 py-0.5 text-[10px] font-bold tracking-widest uppercase">
              {relative}
            </span>
          )}
          {isFree ? (
            <span className="rounded-md bg-[var(--accent)] text-[var(--primary)] px-2.5 py-0.5 text-[10px] font-bold tracking-widest uppercase">
              Free
            </span>
          ) : (
            <span className="rounded-md bg-blue-50 text-blue-700 px-2.5 py-0.5 text-[10px] font-bold tracking-widest uppercase">
              ${price}
            </span>
          )}
          {isAttending && (
            <span className="rounded-md bg-[var(--accent)] text-[var(--primary)] px-2.5 py-0.5 text-[10px] font-bold tracking-widest uppercase inline-flex items-center gap-1">
              <Check className="h-3 w-3" /> Going
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="font-[family-name:var(--font-headline)] font-bold text-lg leading-snug text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
          {title}
        </h2>

        {/* Meta info */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(start_date)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {formatTimeRange(start_date, end_date)}
          </span>
          {location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {location}
            </span>
          )}
        </div>

        {/* Attendance + capacity */}
        <div className="mt-3 flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
            <Users className="h-3.5 w-3.5" />
            {rsvp_count} attending
          </span>
          {capacity && (
            <div className="flex items-center gap-2 flex-1 max-w-[180px]">
              <div className="h-1.5 flex-1 rounded-full bg-[var(--muted)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
                  style={{
                    width: `${Math.min((rsvp_count / capacity) * 100, 100)}%`,
                  }}
                />
              </div>
              <span className="text-xs text-[var(--muted-foreground)]">
                {spotsLeft} left
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        {description && !compact && (
          <p className="mt-3 text-sm text-[var(--muted-foreground)] leading-relaxed line-clamp-2">
            {description}
          </p>
        )}

        {/* Action button */}
        <div className="mt-4 pt-4 border-t border-[var(--border)]/50">
          {mode === "cancel" ? (
            cancelled ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold tracking-wide uppercase bg-[var(--muted)] text-[var(--muted-foreground)]">
                <X className="h-3.5 w-3.5" /> Cancelled
              </span>
            ) : (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRsvp(id, user_rsvp_status);
                }}
                disabled={rsvpLoading}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold tracking-wide uppercase bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors ${
                  rsvpLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {rsvpLoading ? (
                  <span className="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Cancel RSVP"
                )}
              </button>
            )
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isAttending && !window.confirm("Cancel your RSVP?")) return;
                onRsvp(id, user_rsvp_status);
              }}
              disabled={rsvpLoading}
              className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold tracking-wide uppercase transition-all ${
                isAttending
                  ? "bg-[var(--accent)] text-[var(--primary)] hover:bg-red-50 hover:text-red-700"
                  : "bg-[var(--primary-container)] text-white hover:opacity-90"
              } ${rsvpLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {rsvpLoading ? (
                <span className="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isAttending ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Attending
                </>
              ) : (
                "RSVP"
              )}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
