"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
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

type ChatAttachment =
  | { type: "event_list"; events: ChatEventData[] }
  | { type: "event_cancel"; events: ChatEventData[] };

interface Message {
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);
  const [cancelledEvents, setCancelledEvents] = useState<Set<string>>(new Set());

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
    </div>
  );
}
