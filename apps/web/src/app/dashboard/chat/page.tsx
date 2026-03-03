"use client";

import { useState } from "react";
import { Bot, Clock, MapPin, Users, Check, X } from "lucide-react";
import Markdown from "react-markdown";
import { EventCard } from "@/components/event-card";
import type { RsvpStatus } from "@club/shared";

interface ChatEventData {
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
}

interface ChatTeeTimeSlot {
  facility_id: string;
  facility_name: string;
  date: string;
  day_label: string;
  start_time: string;
  end_time: string;
}

interface ChatBookingData {
  id: string;
  facility_name: string;
  date: string;
  day_label: string;
  start_time: string;
  end_time: string;
  party_size: number;
  status: string;
}

type ChatAttachment =
  | { type: "event_list"; events: ChatEventData[] }
  | { type: "event_cancel"; events: ChatEventData[] }
  | { type: "tee_time_list"; slots: ChatTeeTimeSlot[] }
  | { type: "tee_time_booking_confirm"; booking: ChatBookingData }
  | { type: "tee_time_my_bookings"; bookings: ChatBookingData[] };

interface Message {
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
}

function formatTeeTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);
  const [cancelledEvents, setCancelledEvents] = useState<Set<string>>(new Set());
  const [bookingLoading, setBookingLoading] = useState<string | null>(null);
  const [hiddenSearches, setHiddenSearches] = useState<Set<number>>(new Set());
  const [cancelledBookings, setCancelledBookings] = useState<Set<string>>(new Set());
  const [selectedPartySize, setSelectedPartySize] = useState(1);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [pendingBooking, setPendingBooking] = useState<{
    slot: ChatTeeTimeSlot;
    partySize: number;
    messageIndex: number;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.message,
          attachments: data.attachments,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleChatRsvp(
    messageIndex: number,
    eventId: string,
    currentStatus: RsvpStatus | null
  ) {
    setRsvpLoading(eventId);
    const newStatus = currentStatus === "attending" ? "declined" : "attending";

    try {
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
        setMessages((prev) =>
          prev.map((msg, i) => {
            if (i !== messageIndex || !msg.attachments) return msg;
            return {
              ...msg,
              attachments: msg.attachments.map((att) => {
                if (att.type !== "event_list") return att;
                return {
                  ...att,
                  events: att.events.map((ev) =>
                    ev.id === eventId
                      ? {
                          ...ev,
                          user_rsvp_status: newStatus as RsvpStatus,
                          rsvp_count:
                            newStatus === "attending"
                              ? ev.rsvp_count + 1
                              : Math.max(0, ev.rsvp_count - 1),
                        }
                      : ev
                  ),
                };
              }),
            };
          })
        );
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

  async function handleCancelRsvp(
    eventId: string,
    eventTitle: string
  ) {
    setRsvpLoading(eventId);

    try {
      const res = await fetch("/api/events/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          status: "declined",
          guest_count: 0,
        }),
      });

      if (res.ok) {
        setCancelledEvents((prev) => new Set(prev).add(eventId));
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Your RSVP for **${eventTitle}** has been successfully cancelled.`,
          },
        ]);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to cancel RSVP");
      }
    } catch {
      alert("Failed to cancel RSVP");
    } finally {
      setRsvpLoading(null);
    }
  }

  async function handleBookTeeTime(
    slot: ChatTeeTimeSlot,
    partySize: number,
    messageIndex: number
  ) {
    const slotKey = `${slot.facility_id}|${slot.date}|${slot.start_time}`;
    setBookingLoading(slotKey);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: slot.facility_id,
          date: slot.date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          party_size: partySize,
        }),
      });

      if (res.ok) {
        setHiddenSearches((prev) => new Set(prev).add(messageIndex));
        setSelectedPartySize(1);
        setSelectedCourse(null);
        const playerLabel = partySize === 1 ? "1 player" : `${partySize} players`;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Your tee time at **${slot.facility_name}** on **${slot.day_label}** at **${formatTeeTime(slot.start_time)}** has been booked for **${playerLabel}**.`,
          },
        ]);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to book tee time");
      }
    } catch {
      alert("Failed to book tee time");
    } finally {
      setBookingLoading(null);
    }
  }

  async function handleCancelBooking(bookingId: string, description: string) {
    setBookingLoading(bookingId);

    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "PATCH",
      });

      if (res.ok) {
        setCancelledBookings((prev) => new Set(prev).add(bookingId));
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Your tee time (${description}) has been cancelled.`,
          },
        ]);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to cancel booking");
      }
    } catch {
      alert("Failed to cancel booking");
    } finally {
      setBookingLoading(null);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">AI Assistant</h1>
        <p className="text-[var(--muted-foreground)]">
          Ask about bookings, events, balances, or anything club-related.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-[var(--border)] p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-4">
              <Bot className="h-10 w-10 mx-auto text-[var(--muted-foreground)]" />
              <p className="text-[var(--muted-foreground)]">
                Hi! I&apos;m your club assistant. Try asking me:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "Book a tee time Saturday morning",
                  "What events are this week?",
                  "Show my account balance",
                  "Who are the newest members?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted)] transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message, i) => (
          <div
            key={i}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className="max-w-[80%] space-y-3">
              {/* Text bubble */}
              {message.content && (
                <div
                  className={`rounded-xl px-4 py-2 text-sm ${
                    message.role === "user"
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "bg-[var(--muted)]"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="prose prose-sm prose-green max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <Markdown
                        components={{
                          p: ({ children }) => (
                            <p className="mb-2 last:mb-0">{children}</p>
                          ),
                          ul: ({ children }) => (
                            <ul className="mb-2 ml-4 list-disc last:mb-0">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="mb-2 ml-4 list-decimal last:mb-0">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li className="mb-0.5">{children}</li>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-semibold">{children}</strong>
                          ),
                          h3: ({ children }) => (
                            <h3 className="font-semibold mt-3 mb-1">
                              {children}
                            </h3>
                          ),
                          h4: ({ children }) => (
                            <h4 className="font-semibold mt-2 mb-1">
                              {children}
                            </h4>
                          ),
                        }}
                      >
                        {message.content}
                      </Markdown>
                    </div>
                  ) : (
                    message.content
                  )}
                </div>
              )}

              {/* Event card attachments */}
              {message.attachments?.map((att, attIdx) => {
                if (att.type === "event_list") {
                  return (
                    <div key={attIdx} className="space-y-2">
                      {att.events.map((event) => (
                        <EventCard
                          key={event.id}
                          {...event}
                          onRsvp={(eventId, status) =>
                            handleChatRsvp(i, eventId, status)
                          }
                          rsvpLoading={rsvpLoading === event.id}
                          compact
                        />
                      ))}
                    </div>
                  );
                }
                if (att.type === "event_cancel") {
                  return (
                    <div key={attIdx} className="space-y-2">
                      {att.events.map((event) => (
                        <EventCard
                          key={event.id}
                          {...event}
                          mode="cancel"
                          cancelled={cancelledEvents.has(event.id)}
                          onRsvp={() =>
                            handleCancelRsvp(event.id, event.title)
                          }
                          rsvpLoading={rsvpLoading === event.id}
                          compact
                        />
                      ))}
                    </div>
                  );
                }
                if (att.type === "tee_time_list") {
                  // Hide once a booking has been made from this message
                  if (hiddenSearches.has(i)) return null;

                  // Compute unique courses
                  const courses = [...new Set(att.slots.map((s) => s.facility_name))];
                  const hasMultipleCourses = courses.length > 1;

                  // Filter slots by selected course
                  const filteredSlots = selectedCourse
                    ? att.slots.filter((s) => s.facility_name === selectedCourse)
                    : att.slots;

                  // Group filtered slots by date
                  const grouped = new Map<string, ChatTeeTimeSlot[]>();
                  for (const slot of filteredSlots) {
                    const existing = grouped.get(slot.date) ?? [];
                    existing.push(slot);
                    grouped.set(slot.date, existing);
                  }
                  return (
                    <div key={attIdx} className="space-y-3">
                      {/* Party size selector */}
                      <div className="flex items-center gap-2 pt-2">
                        <Users className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                        <span className="text-xs text-[var(--muted-foreground)]">Players:</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map((size) => (
                            <button
                              key={size}
                              onClick={() => setSelectedPartySize(size)}
                              className={`h-7 w-7 rounded-full text-xs font-medium transition-colors ${
                                selectedPartySize === size
                                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                                  : "border border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--foreground)]"
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Course selector */}
                      {hasMultipleCourses && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                          <span className="text-xs text-[var(--muted-foreground)]">Course:</span>
                          <div className="flex gap-1 flex-wrap">
                            <button
                              onClick={() => setSelectedCourse(null)}
                              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                selectedCourse === null
                                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                                  : "border border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--foreground)]"
                              }`}
                            >
                              All
                            </button>
                            {courses.map((course) => (
                              <button
                                key={course}
                                onClick={() => setSelectedCourse(course)}
                                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                  selectedCourse === course
                                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                                    : "border border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--foreground)]"
                                }`}
                              >
                                {course}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {Array.from(grouped.entries()).map(([date, slots]) => {
                        // Sub-group by facility when showing all courses
                        const facilityGroups =
                          hasMultipleCourses && !selectedCourse
                            ? [...new Set(slots.map((s) => s.facility_name))].map(
                                (name) => ({
                                  name,
                                  slots: slots.filter(
                                    (s) => s.facility_name === name
                                  ),
                                })
                              )
                            : [{ name: null as string | null, slots }];

                        return (
                          <div key={date}>
                            <div className="text-xs font-semibold text-[var(--muted-foreground)] mb-1.5">
                              {slots[0].day_label}
                            </div>
                            {facilityGroups.map((group) => (
                              <div
                                key={group.name ?? "all"}
                                className={group.name ? "mb-2" : ""}
                              >
                                {group.name && (
                                  <div className="text-xs text-[var(--muted-foreground)] mb-1 ml-0.5">
                                    {group.name}
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                  {group.slots.map((slot) => {
                                    const slotKey = `${slot.facility_id}|${slot.date}|${slot.start_time}`;
                                    const isLoading =
                                      bookingLoading === slotKey;
                                    return (
                                      <button
                                        key={slotKey}
                                        onClick={() =>
                                          setPendingBooking({
                                            slot,
                                            partySize: selectedPartySize,
                                            messageIndex: i,
                                          })
                                        }
                                        disabled={isLoading}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--primary)] hover:bg-green-50 px-3 py-2 text-sm transition-colors disabled:opacity-60"
                                      >
                                        <Clock className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                                        <span>
                                          {isLoading
                                            ? "..."
                                            : formatTeeTime(slot.start_time)}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                if (att.type === "tee_time_booking_confirm") {
                  const b = att.booking;
                  return (
                    <div
                      key={attIdx}
                      className="rounded-xl border border-green-300 bg-green-50 p-3 space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-semibold text-green-700">
                          Tee Time Confirmed
                        </span>
                      </div>
                      <div className="text-sm text-green-800">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {b.facility_name}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {b.day_label} at {formatTeeTime(b.start_time)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          {b.party_size} {b.party_size === 1 ? "player" : "players"}
                        </div>
                      </div>
                    </div>
                  );
                }
                if (att.type === "tee_time_my_bookings") {
                  return (
                    <div key={attIdx} className="space-y-2">
                      {att.bookings.map((b) => {
                        const isCancelled =
                          cancelledBookings.has(b.id) || b.status === "cancelled";
                        const isLoading = bookingLoading === b.id;
                        return (
                          <div
                            key={b.id}
                            className={`rounded-xl border p-3 space-y-1 ${
                              isCancelled
                                ? "border-gray-200 bg-gray-50"
                                : "border-[var(--border)]"
                            }`}
                          >
                            <div className="text-sm font-medium">
                              {b.facility_name}
                            </div>
                            <div className="text-xs text-[var(--muted-foreground)] space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                {b.day_label} at {formatTeeTime(b.start_time)}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Users className="h-3 w-3" />
                                {b.party_size} {b.party_size === 1 ? "player" : "players"}
                              </div>
                            </div>
                            {isCancelled ? (
                              <div className="inline-flex items-center gap-1 rounded-md bg-gray-100 border border-gray-200 px-3 py-1 text-xs text-gray-400 mt-1">
                                <X className="h-3 w-3" />
                                Cancelled
                              </div>
                            ) : (
                              <button
                                onClick={() =>
                                  handleCancelBooking(
                                    b.id,
                                    `${b.facility_name} on ${b.day_label}`
                                  )
                                }
                                disabled={isLoading}
                                className="mt-1 rounded-md bg-red-50 border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                              >
                                {isLoading ? "..." : "Cancel Booking"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-[var(--muted)] px-4 py-2 text-sm text-[var(--muted-foreground)]">
              Thinking...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your club..."
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Send
        </button>
      </form>

      {/* Booking confirmation modal */}
      {pendingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--background)] p-5 shadow-lg space-y-4">
            <h3 className="text-base font-semibold">Confirm Tee Time</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[var(--muted-foreground)]" />
                <span>{pendingBooking.slot.facility_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--muted-foreground)]" />
                <span>
                  {pendingBooking.slot.day_label} at{" "}
                  {formatTeeTime(pendingBooking.slot.start_time)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--muted-foreground)]" />
                <span>
                  {pendingBooking.partySize}{" "}
                  {pendingBooking.partySize === 1 ? "player" : "players"}
                </span>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPendingBooking(null)}
                className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const { slot, partySize, messageIndex } = pendingBooking;
                  setPendingBooking(null);
                  handleBookTeeTime(slot, partySize, messageIndex);
                }}
                disabled={bookingLoading !== null}
                className="flex-1 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
