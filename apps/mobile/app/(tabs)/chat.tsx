import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useAuth } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";
import type { RsvpStatus } from "@club/shared";

const API_URL =
  process.env.EXPO_PUBLIC_APP_URL || "http://localhost:3000";

// ─── Types ───────────────────────────────────────────────────────────

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
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
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
  return `${startTime} – ${formatTime(end)}`;
}

const SUGGESTIONS = [
  "Book a tee time Saturday",
  "What events this week?",
  "Show my balance",
  "Newest members?",
];

// ─── EventCard Component ─────────────────────────────────────────────

function EventCard({
  event,
  onRsvp,
  rsvpLoading,
  mode = "default",
  cancelled = false,
}: {
  event: ChatEventData;
  onRsvp: (eventId: string, currentStatus: RsvpStatus | null) => void;
  rsvpLoading: boolean;
  mode?: "default" | "cancel";
  cancelled?: boolean;
}) {
  const isAttending = event.user_rsvp_status === "attending";
  const isFree = !event.price || event.price === 0;

  return (
    <View style={cardStyles.card}>
      {/* Title row */}
      <View style={cardStyles.titleRow}>
        <Text style={cardStyles.title} numberOfLines={2}>
          {event.title}
        </Text>
        <View
          style={[cardStyles.badge, isFree ? cardStyles.freeBadge : cardStyles.paidBadge]}
        >
          <Text
            style={[
              cardStyles.badgeText,
              isFree ? cardStyles.freeBadgeText : cardStyles.paidBadgeText,
            ]}
          >
            {isFree ? "Free" : `$${event.price}`}
          </Text>
        </View>
      </View>

      {/* Meta info */}
      <View style={cardStyles.meta}>
        <Text style={cardStyles.metaText}>
          {formatDate(event.start_date)} · {formatTimeRange(event.start_date, event.end_date)}
        </Text>
        {event.location && (
          <Text style={cardStyles.metaText}>{event.location}</Text>
        )}
        <Text style={cardStyles.metaText}>
          {event.rsvp_count} attending
          {event.capacity
            ? ` · ${event.capacity - event.rsvp_count} spots left`
            : ""}
        </Text>
      </View>

      {/* Description */}
      {event.description && (
        <Text style={cardStyles.description} numberOfLines={2}>
          {event.description}
        </Text>
      )}

      {/* Action button */}
      {mode === "cancel" ? (
        cancelled ? (
          <View style={[cardStyles.rsvpButton, cardStyles.cancelledButton]}>
            <Text style={cardStyles.cancelledText}>✕ Cancelled</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              cardStyles.rsvpButton,
              cardStyles.cancelButton,
              rsvpLoading && cardStyles.disabledButton,
            ]}
            onPress={() => onRsvp(event.id, event.user_rsvp_status)}
            disabled={rsvpLoading}
            activeOpacity={0.7}
          >
            <Text style={cardStyles.cancelText}>
              {rsvpLoading ? "..." : "Cancel RSVP"}
            </Text>
          </TouchableOpacity>
        )
      ) : (
        <TouchableOpacity
          style={[
            cardStyles.rsvpButton,
            isAttending ? cardStyles.attendingButton : cardStyles.defaultButton,
            rsvpLoading && cardStyles.disabledButton,
          ]}
          onPress={() => onRsvp(event.id, event.user_rsvp_status)}
          disabled={rsvpLoading}
          activeOpacity={0.7}
        >
          <Text
            style={[
              cardStyles.rsvpText,
              isAttending ? cardStyles.attendingText : cardStyles.defaultText,
            ]}
          >
            {rsvpLoading ? "..." : isAttending ? "✓ Attending" : "RSVP"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    backgroundColor: Colors.light.background,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.foreground,
    flex: 1,
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  freeBadge: {
    backgroundColor: "#dcfce7",
  },
  paidBadge: {
    backgroundColor: "#dbeafe",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  freeBadgeText: {
    color: "#166534",
  },
  paidBadgeText: {
    color: "#1e40af",
  },
  meta: {
    marginTop: 10,
    gap: 3,
  },
  metaText: {
    fontSize: 13,
    color: Colors.light.mutedForeground,
  },
  description: {
    marginTop: 10,
    fontSize: 13,
    color: Colors.light.foreground,
    lineHeight: 18,
  },
  rsvpButton: {
    marginTop: 12,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignSelf: "flex-start",
  },
  defaultButton: {
    backgroundColor: Colors.light.primary,
  },
  attendingButton: {
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#86efac",
  },
  disabledButton: {
    opacity: 0.5,
  },
  rsvpText: {
    fontSize: 14,
    fontWeight: "500",
  },
  defaultText: {
    color: Colors.light.primaryForeground,
  },
  attendingText: {
    color: "#166534",
  },
  cancelButton: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fca5a5",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#b91c1c",
  },
  cancelledButton: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  cancelledText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#a3a3a3",
  },
});

// ─── Main Chat Screen ────────────────────────────────────────────────

export default function ChatScreen() {
  const { session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);
  const [cancelledEvents, setCancelledEvents] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList>(null);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.message,
          attachments: data.attachments,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, I couldn't connect. Please check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleChatRsvp(
    messageId: string,
    eventId: string,
    currentStatus: RsvpStatus | null
  ) {
    setRsvpLoading(eventId);
    const newStatus = currentStatus === "attending" ? "declined" : "attending";

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${API_URL}/api/events/rsvp`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          event_id: eventId,
          status: newStatus,
          guest_count: 0,
        }),
      });

      if (res.ok) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== messageId || !msg.attachments) return msg;
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
        Alert.alert("RSVP Failed", data.error || "Please try again.");
      }
    } catch {
      Alert.alert("RSVP Failed", "Please check your connection and try again.");
    } finally {
      setRsvpLoading(null);
    }
  }

  async function handleCancelRsvp(eventId: string, eventTitle: string) {
    setRsvpLoading(eventId);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${API_URL}/api/events/rsvp`, {
        method: "POST",
        headers,
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
            id: (Date.now() + 2).toString(),
            role: "assistant",
            content: `Your RSVP for **${eventTitle}** has been successfully cancelled.`,
          },
        ]);
      } else {
        const data = await res.json();
        Alert.alert("Cancel Failed", data.error || "Please try again.");
      }
    } catch {
      Alert.alert("Cancel Failed", "Please check your connection and try again.");
    } finally {
      setRsvpLoading(null);
    }
  }

  function renderMessage({ item }: { item: Message }) {
    const isUser = item.role === "user";

    return (
      <View>
        {/* Text bubble */}
        {item.content ? (
          <View
            style={[
              styles.messageBubble,
              isUser ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <Text style={[styles.messageText, isUser && styles.userText]}>
              {item.content}
            </Text>
          </View>
        ) : null}

        {/* Event card attachments */}
        {item.attachments?.map((att, attIdx) => {
          if (att.type === "event_list") {
            return (
              <View key={attIdx} style={styles.attachmentContainer}>
                {att.events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onRsvp={(eventId, status) =>
                      handleChatRsvp(item.id, eventId, status)
                    }
                    rsvpLoading={rsvpLoading === event.id}
                  />
                ))}
              </View>
            );
          }
          if (att.type === "event_cancel") {
            return (
              <View key={attIdx} style={styles.attachmentContainer}>
                {att.events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    mode="cancel"
                    cancelled={cancelledEvents.has(event.id)}
                    onRsvp={() => handleCancelRsvp(event.id, event.title)}
                    rsvpLoading={rsvpLoading === event.id}
                  />
                ))}
              </View>
            );
          }
          return null;
        })}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={90}
    >
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🤖</Text>
          <Text style={styles.emptyText}>
            Hi! I'm your club assistant. Try asking:
          </Text>
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <TouchableOpacity
                key={s}
                style={styles.suggestion}
                onPress={() => setInput(s)}
              >
                <Text style={styles.suggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          renderItem={renderMessage}
        />
      )}

      {loading && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>Thinking...</Text>
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Ask anything about your club..."
          placeholderTextColor={Colors.light.mutedForeground}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          multiline
          maxLength={4000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || loading) && styles.sendDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
    marginBottom: 16,
  },
  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  suggestion: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  suggestionText: {
    fontSize: 13,
    color: Colors.light.foreground,
  },
  messageList: {
    padding: 16,
    gap: 8,
  },
  messageBubble: {
    maxWidth: "80%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: Colors.light.primary,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: Colors.light.muted,
  },
  messageText: {
    fontSize: 14,
    color: Colors.light.foreground,
    lineHeight: 20,
  },
  userText: {
    color: Colors.light.primaryForeground,
  },
  attachmentContainer: {
    alignSelf: "flex-start",
    maxWidth: "90%",
  },
  typingIndicator: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  typingText: {
    fontSize: 13,
    color: Colors.light.mutedForeground,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    color: Colors.light.foreground,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendDisabled: {
    opacity: 0.4,
  },
  sendText: {
    color: Colors.light.primaryForeground,
    fontSize: 18,
    fontWeight: "bold",
  },
});
