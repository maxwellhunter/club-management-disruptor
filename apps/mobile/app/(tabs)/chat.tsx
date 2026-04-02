import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";
import type { RsvpStatus } from "@club/shared";
import { ChatMarkdown } from "@/components/markdown";

const SERIF_FONT = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});

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

function formatTeeTime(time: string) {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

const QUICK_ACTIONS = [
  { label: "Book Golf", icon: "golf-outline" as const, prompt: "Book a tee time this weekend" },
  { label: "Dinner Reservation", icon: "restaurant-outline" as const, prompt: "Make a dinner reservation" },
  { label: "Spa Services", icon: "leaf-outline" as const, prompt: "What spa services are available?" },
  { label: "Club Calendar", icon: "calendar-outline" as const, prompt: "What events are coming up?" },
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="close" size={14} color="#a3a3a3" />
              <Text style={cardStyles.cancelledText}>Cancelled</Text>
            </View>
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
          {rsvpLoading ? (
            <Text style={[cardStyles.rsvpText, isAttending ? cardStyles.attendingText : cardStyles.defaultText]}>...</Text>
          ) : isAttending ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="checkmark" size={16} color="#166534" />
              <Text style={[cardStyles.rsvpText, cardStyles.attendingText]}>Attending</Text>
            </View>
          ) : (
            <Text style={[cardStyles.rsvpText, cardStyles.defaultText]}>RSVP</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 18,
    marginTop: 10,
    backgroundColor: Colors.light.surfaceContainerLowest,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: SERIF_FONT,
    color: Colors.light.foreground,
    flex: 1,
  },
  badge: {
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  freeBadge: {
    backgroundColor: Colors.light.accent,
  },
  paidBadge: {
    backgroundColor: Colors.light.tertiaryFixed,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  freeBadgeText: {
    color: Colors.light.primary,
  },
  paidBadgeText: {
    color: Colors.light.tertiary,
  },
  meta: {
    marginTop: 12,
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
  },
  description: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.light.foreground,
    lineHeight: 19,
  },
  rsvpButton: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
  },
  defaultButton: {
    backgroundColor: Colors.light.primary,
  },
  attendingButton: {
    backgroundColor: Colors.light.accent,
  },
  disabledButton: {
    opacity: 0.5,
  },
  rsvpText: {
    fontSize: 14,
    fontWeight: "600",
  },
  defaultText: {
    color: Colors.light.primaryForeground,
  },
  attendingText: {
    color: Colors.light.primary,
  },
  cancelButton: {
    backgroundColor: "#fef2f2",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.destructive,
  },
  cancelledButton: {
    backgroundColor: Colors.light.surfaceContainerLow,
  },
  cancelledText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.light.onSurfaceVariant,
  },
});

// ─── Main Chat Screen ────────────────────────────────────────────────

export default function ChatScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);
  const [cancelledEvents, setCancelledEvents] = useState<Set<string>>(new Set());
  const [bookingLoading, setBookingLoading] = useState<string | null>(null);
  const [hiddenSearches, setHiddenSearches] = useState<Set<string>>(new Set());
  const [cancelledBookings, setCancelledBookings] = useState<Set<string>>(new Set());
  const [selectedPartySize, setSelectedPartySize] = useState(1);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
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

  function handleChatRsvp(
    messageId: string,
    eventId: string,
    currentStatus: RsvpStatus | null
  ) {
    if (currentStatus === "attending") {
      Alert.alert(
        "Cancel RSVP",
        "Are you sure you want to cancel your RSVP?",
        [
          { text: "Keep RSVP", style: "cancel" },
          {
            text: "Cancel RSVP",
            style: "destructive",
            onPress: () => executeChatRsvp(messageId, eventId, "declined"),
          },
        ]
      );
    } else {
      executeChatRsvp(messageId, eventId, "attending");
    }
  }

  async function executeChatRsvp(
    messageId: string,
    eventId: string,
    newStatus: string
  ) {
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

  async function handleBookTeeTime(
    slot: ChatTeeTimeSlot,
    partySize: number,
    messageId: string
  ) {
    const slotKey = `${slot.facility_id}|${slot.date}|${slot.start_time}`;
    setBookingLoading(slotKey);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${API_URL}/api/bookings`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          facility_id: slot.facility_id,
          date: slot.date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          party_size: partySize,
        }),
      });

      if (res.ok) {
        setHiddenSearches((prev) => new Set(prev).add(messageId));
        setSelectedPartySize(1);
        setSelectedCourse(null);
        const playerLabel = partySize === 1 ? "1 player" : `${partySize} players`;
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 2).toString(),
            role: "assistant",
            content: `Your tee time at **${slot.facility_name}** on **${slot.day_label}** at **${formatTeeTime(slot.start_time)}** has been booked for **${playerLabel}**.`,
          },
        ]);
      } else {
        const data = await res.json();
        Alert.alert("Booking Failed", data.error || "Please try again.");
      }
    } catch {
      Alert.alert("Booking Failed", "Please check your connection and try again.");
    } finally {
      setBookingLoading(null);
    }
  }

  async function handleCancelBooking(bookingId: string, description: string) {
    setBookingLoading(bookingId);

    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${API_URL}/api/bookings/${bookingId}/cancel`, {
        method: "PATCH",
        headers,
      });

      if (res.ok) {
        setCancelledBookings((prev) => new Set(prev).add(bookingId));
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 2).toString(),
            role: "assistant",
            content: `Your tee time (${description}) has been cancelled.`,
          },
        ]);
      } else {
        const data = await res.json();
        Alert.alert("Cancel Failed", data.error || "Please try again.");
      }
    } catch {
      Alert.alert("Cancel Failed", "Please check your connection and try again.");
    } finally {
      setBookingLoading(null);
    }
  }

  function renderMessage({ item, index }: { item: Message; index: number }) {
    const isUser = item.role === "user";
    const msgTime = new Date(parseInt(item.id));
    const timeLabel = !isNaN(msgTime.getTime())
      ? msgTime.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : "";

    return (
      <View style={isUser ? styles.userColumn : styles.assistantColumn}>
        {/* Date pill for first message */}
        {index === 0 && (
          <View style={styles.datePillRow}>
            <View style={styles.datePill}>
              <Text style={styles.datePillText}>
                Today, {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}
              </Text>
            </View>
          </View>
        )}

        {/* AI label row */}
        {!isUser && item.content ? (
          <View style={styles.aiLabelRow}>
            <View style={styles.aiAvatarSmall}>
              <Ionicons name="sparkles" size={10} color={Colors.light.primaryForeground} />
            </View>
            <Text style={styles.aiLabelText}>THE RESERVE AI</Text>
          </View>
        ) : null}

        {/* Text bubble */}
        {item.content ? (
          <View
            style={[
              styles.messageBubble,
              isUser ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            {isUser ? (
              <Text style={[styles.messageText, styles.userText]}>
                {item.content}
              </Text>
            ) : (
              <ChatMarkdown>{item.content}</ChatMarkdown>
            )}
          </View>
        ) : null}

        {/* Timestamp */}
        {item.content && timeLabel ? (
          <Text
            style={[
              styles.timestamp,
              isUser ? styles.timestampRight : styles.timestampLeft,
            ]}
          >
            {timeLabel}
          </Text>
        ) : null}

        {/* Event card attachments */}
        {item.attachments?.map((att, attIdx) => {
          if (att.type === "event_list") {
            return (
              <View key={attIdx} style={styles.attachmentContainer}>
                {att.events.map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/event/${event.id}`)}
                  >
                    <EventCard
                      event={event}
                      onRsvp={(eventId, status) =>
                        handleChatRsvp(item.id, eventId, status)
                      }
                      rsvpLoading={rsvpLoading === event.id}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            );
          }
          if (att.type === "event_cancel") {
            return (
              <View key={attIdx} style={styles.attachmentContainer}>
                {att.events.map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/event/${event.id}`)}
                  >
                    <EventCard
                      event={event}
                      mode="cancel"
                      cancelled={cancelledEvents.has(event.id)}
                      onRsvp={() => handleCancelRsvp(event.id, event.title)}
                      rsvpLoading={rsvpLoading === event.id}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            );
          }
          if (att.type === "tee_time_list") {
            // Hide once a booking has been made from this message
            if (hiddenSearches.has(item.id)) return null;

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
              <View key={attIdx} style={styles.attachmentContainer}>
                {/* Party size selector */}
                <View style={teeStyles.partySizeRow}>
                  <Ionicons name="people-outline" size={14} color={Colors.light.mutedForeground} />
                  <Text style={teeStyles.partySizeLabel}>Players:</Text>
                  <View style={teeStyles.partySizePills}>
                    {[1, 2, 3, 4].map((size) => (
                      <TouchableOpacity
                        key={size}
                        style={[
                          teeStyles.partySizePill,
                          selectedPartySize === size && teeStyles.partySizePillActive,
                        ]}
                        onPress={() => setSelectedPartySize(size)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            teeStyles.partySizePillText,
                            selectedPartySize === size && teeStyles.partySizePillTextActive,
                          ]}
                        >
                          {size}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                {/* Course selector */}
                {hasMultipleCourses && (
                  <View style={teeStyles.courseSelectorRow}>
                    <Ionicons name="golf-outline" size={14} color={Colors.light.mutedForeground} />
                    <Text style={teeStyles.partySizeLabel}>Course:</Text>
                    <View style={teeStyles.coursePills}>
                      <TouchableOpacity
                        style={[
                          teeStyles.coursePill,
                          selectedCourse === null && teeStyles.coursePillActive,
                        ]}
                        onPress={() => setSelectedCourse(null)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            teeStyles.coursePillText,
                            selectedCourse === null && teeStyles.coursePillTextActive,
                          ]}
                        >
                          All
                        </Text>
                      </TouchableOpacity>
                      {courses.map((course) => (
                        <TouchableOpacity
                          key={course}
                          style={[
                            teeStyles.coursePill,
                            selectedCourse === course && teeStyles.coursePillActive,
                          ]}
                          onPress={() => setSelectedCourse(course)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              teeStyles.coursePillText,
                              selectedCourse === course && teeStyles.coursePillTextActive,
                            ]}
                          >
                            {course}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
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
                    <View key={date} style={teeStyles.dateGroup}>
                      <Text style={teeStyles.dateHeader}>
                        {slots[0].day_label}
                      </Text>
                      {facilityGroups.map((group) => (
                        <View
                          key={group.name ?? "all"}
                          style={group.name ? { marginBottom: 8 } : undefined}
                        >
                          {group.name && (
                            <Text style={teeStyles.facilitySubLabel}>
                              {group.name}
                            </Text>
                          )}
                          <View style={teeStyles.slotsRow}>
                            {group.slots.map((slot) => {
                              const slotKey = `${slot.facility_id}|${slot.date}|${slot.start_time}`;
                              const isLoading = bookingLoading === slotKey;
                              return (
                                <TouchableOpacity
                                  key={slotKey}
                                  style={teeStyles.slotChip}
                                  onPress={() => {
                                    const ps = selectedPartySize;
                                    const msgId = item.id;
                                    const playerLabel =
                                      ps === 1 ? "1 player" : `${ps} players`;
                                    Alert.alert(
                                      "Confirm Tee Time",
                                      `${playerLabel}\n${slot.day_label} at ${formatTeeTime(slot.start_time)}\n${slot.facility_name}`,
                                      [
                                        { text: "Cancel", style: "cancel" },
                                        {
                                          text: "Confirm",
                                          onPress: () =>
                                            handleBookTeeTime(
                                              slot,
                                              ps,
                                              msgId
                                            ),
                                        },
                                      ]
                                    );
                                  }}
                                  disabled={isLoading}
                                  activeOpacity={0.7}
                                >
                                  <View style={teeStyles.slotChipContent}>
                                    <Ionicons
                                      name="time-outline"
                                      size={14}
                                      color={Colors.light.mutedForeground}
                                    />
                                    <Text style={teeStyles.slotTime}>
                                      {isLoading
                                        ? "..."
                                        : formatTeeTime(slot.start_time)}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            );
          }
          if (att.type === "tee_time_booking_confirm") {
            const b = att.booking;
            return (
              <View key={attIdx} style={[styles.attachmentContainer, teeStyles.confirmCard]}>
                <View style={teeStyles.confirmHeader}>
                  <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                  <Text style={teeStyles.confirmTitle}>Tee Time Confirmed</Text>
                </View>
                <View style={teeStyles.confirmDetails}>
                  <View style={teeStyles.confirmRow}>
                    <Ionicons name="golf-outline" size={14} color="#166534" />
                    <Text style={teeStyles.confirmText}>{b.facility_name}</Text>
                  </View>
                  <View style={teeStyles.confirmRow}>
                    <Ionicons name="time-outline" size={14} color="#166534" />
                    <Text style={teeStyles.confirmText}>
                      {b.day_label} at {formatTeeTime(b.start_time)}
                    </Text>
                  </View>
                  <View style={teeStyles.confirmRow}>
                    <Ionicons name="people-outline" size={14} color="#166534" />
                    <Text style={teeStyles.confirmText}>
                      {b.party_size} {b.party_size === 1 ? "player" : "players"}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }
          if (att.type === "tee_time_my_bookings") {
            return (
              <View key={attIdx} style={styles.attachmentContainer}>
                {att.bookings.map((b) => {
                  const isCancelled =
                    cancelledBookings.has(b.id) || b.status === "cancelled";
                  const isLoading = bookingLoading === b.id;
                  return (
                    <View
                      key={b.id}
                      style={[
                        teeStyles.bookingCard,
                        isCancelled && teeStyles.bookingCardCancelled,
                      ]}
                    >
                      <Text style={teeStyles.bookingFacility}>{b.facility_name}</Text>
                      <View style={teeStyles.bookingMeta}>
                        <View style={teeStyles.confirmRow}>
                          <Ionicons name="time-outline" size={13} color={Colors.light.mutedForeground} />
                          <Text style={teeStyles.bookingMetaText}>
                            {b.day_label} at {formatTeeTime(b.start_time)}
                          </Text>
                        </View>
                        <View style={teeStyles.confirmRow}>
                          <Ionicons name="people-outline" size={13} color={Colors.light.mutedForeground} />
                          <Text style={teeStyles.bookingMetaText}>
                            {b.party_size} {b.party_size === 1 ? "player" : "players"}
                          </Text>
                        </View>
                      </View>
                      {isCancelled ? (
                        <View style={teeStyles.cancelledBadge}>
                          <Ionicons name="close" size={13} color="#a3a3a3" />
                          <Text style={teeStyles.cancelledText}>Cancelled</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[
                            teeStyles.cancelButton,
                            isLoading && { opacity: 0.5 },
                          ]}
                          onPress={() =>
                            handleCancelBooking(b.id, `${b.facility_name} on ${b.day_label}`)
                          }
                          disabled={isLoading}
                          activeOpacity={0.7}
                        >
                          <Text style={teeStyles.cancelButtonText}>
                            {isLoading ? "..." : "Cancel Booking"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          }
          return null;
        })}
      </View>
    );
  }

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={90}
    >
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          {/* Concierge greeting — Stitch style */}
          <View style={styles.greetingContainer}>
            <View style={styles.conciergeIcon}>
              <Ionicons name="sparkles" size={24} color={Colors.light.primaryForeground} />
            </View>
            <Text style={styles.greetingTitle}>ClubOS AI</Text>
            <View style={styles.activeRow}>
              <View style={styles.activeDot} />
              <Text style={styles.activeLabel}>Concierge Active</Text>
            </View>
            <Text style={styles.greetingText}>
              {getGreeting()}. How can I assist{"\n"}you at the club today?
            </Text>
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
          ListFooterComponent={
            loading ? (
              <View style={styles.typingIndicator}>
                <View style={styles.typingDots}>
                  <View style={styles.aiAvatarSmall}>
                    <Ionicons name="sparkles" size={10} color={Colors.light.primaryForeground} />
                  </View>
                  <ActivityIndicator size="small" color={Colors.light.primary} />
                </View>
              </View>
            ) : null
          }
        />
      )}

      {/* Bottom: Quick Chips + Input */}
      <View style={styles.inputBarContainer}>
        {/* Quick action chips — horizontal scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickChipsScroll}
        >
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.quickChip}
              onPress={() => {
                setInput(action.prompt);
                setTimeout(handleSend, 100);
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={action.icon}
                size={16}
                color={Colors.light.primary}
              />
              <Text style={styles.quickChipText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Main input bar — pill shape */}
        <View style={styles.inputPill}>
          <TouchableOpacity style={styles.attachBtn} activeOpacity={0.6}>
            <Ionicons
              name="attach"
              size={22}
              color={Colors.light.onSurfaceVariant}
            />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Type your request here..."
            placeholderTextColor={Colors.light.outline}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
            maxLength={4000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!input.trim() || loading) && styles.sendDisabled,
            ]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
            activeOpacity={0.7}
          >
            <Ionicons
              name="send"
              size={16}
              color={Colors.light.primaryForeground}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },

  // ─── Empty State / Concierge Welcome ────────────────────────────
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  greetingContainer: {
    alignItems: "center",
  },
  conciergeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  greetingTitle: {
    fontSize: 24,
    fontFamily: SERIF_FONT,
    fontStyle: "italic",
    fontWeight: "700",
    color: Colors.light.primary,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  activeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e",
  },
  activeLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.5,
    color: Colors.light.onSurfaceVariant,
    textTransform: "uppercase",
  },
  greetingText: {
    fontSize: 18,
    fontFamily: SERIF_FONT,
    color: Colors.light.primary,
    textAlign: "center",
    lineHeight: 26,
  },

  // ─── Messages ───────────────────────────────────────────────────
  messageList: {
    padding: 24,
    paddingBottom: 8,
    gap: 28,
  },
  assistantColumn: {
    alignItems: "flex-start",
    maxWidth: "85%",
    gap: 4,
  },
  userColumn: {
    alignItems: "flex-end",
    alignSelf: "flex-end",
    maxWidth: "85%",
    gap: 4,
  },

  // Date pill
  datePillRow: {
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
    alignSelf: "center",
  },
  datePill: {
    backgroundColor: Colors.light.surfaceContainerLow,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 20,
  },
  datePillText: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 2,
    color: Colors.light.onSurfaceVariant,
    textTransform: "uppercase",
  },

  // AI label row
  aiLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  aiAvatarSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  aiLabelText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: Colors.light.primary,
  },

  // Bubbles
  messageBubble: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  userBubble: {
    backgroundColor: Colors.light.surfaceContainerHigh + "99",
    borderTopRightRadius: 4,
    borderWidth: 1,
    borderColor: Colors.light.outlineVariant + "26",
  },
  assistantBubble: {
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderTopLeftRadius: 4,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 20,
    elevation: 1,
    borderWidth: 1,
    borderColor: Colors.light.outlineVariant + "18",
  },
  messageText: {
    fontSize: 15,
    color: Colors.light.foreground,
    lineHeight: 22,
  },
  userText: {
    color: Colors.light.foreground,
  },

  // Timestamps
  timestamp: {
    fontSize: 10,
    color: Colors.light.onSurfaceVariant + "66",
    marginTop: 2,
  },
  timestampLeft: {
    marginLeft: 4,
  },
  timestampRight: {
    marginRight: 4,
  },

  attachmentContainer: {
    alignSelf: "flex-start",
    maxWidth: "92%",
    marginLeft: 0,
  },

  // ─── Typing Indicator ──────────────────────────────────────────
  typingIndicator: {
    alignSelf: "flex-start",
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  typingDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  typingAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  // ─── Bottom Input Area ─────────────────────────────────────────
  inputBarContainer: {
    paddingBottom: Platform.OS === "ios" ? 4 : 8,
    paddingTop: 4,
  },
  quickChipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 12,
  },
  quickChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.light.outlineVariant + "33",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.primary,
    letterSpacing: -0.2,
  },
  inputPill: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 28,
    paddingLeft: 4,
    paddingRight: 6,
    paddingVertical: 6,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.light.outlineVariant + "18",
  },
  attachBtn: {
    padding: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.foreground,
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  sendDisabled: {
    backgroundColor: Colors.light.surfaceContainerHigh,
    shadowOpacity: 0,
    elevation: 0,
  },
});

const teeStyles = StyleSheet.create({
  partySizeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  partySizeLabel: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
  },
  partySizePills: {
    flexDirection: "row",
    gap: 6,
  },
  partySizePill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceContainerLow,
    justifyContent: "center",
    alignItems: "center",
  },
  partySizePillActive: {
    backgroundColor: Colors.light.primary,
  },
  partySizePillText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.onSurfaceVariant,
  },
  partySizePillTextActive: {
    color: Colors.light.primaryForeground,
  },
  courseSelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  coursePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  coursePill: {
    borderRadius: 9999,
    backgroundColor: Colors.light.surfaceContainerLow,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  coursePillActive: {
    backgroundColor: Colors.light.primary,
  },
  coursePillText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.light.onSurfaceVariant,
  },
  coursePillTextActive: {
    color: Colors.light.primaryForeground,
  },
  facilitySubLabel: {
    fontSize: 12,
    fontFamily: SERIF_FONT,
    color: Colors.light.onSurfaceVariant,
    marginBottom: 6,
    marginLeft: 2,
  },
  dateGroup: {
    marginTop: 10,
  },
  dateHeader: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: SERIF_FONT,
    color: Colors.light.foreground,
    marginBottom: 8,
  },
  slotsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slotChip: {
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.tertiaryFixed,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  slotChipBooked: {
    backgroundColor: Colors.light.accent,
    borderLeftColor: Colors.light.primary,
  },
  slotChipContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  slotTime: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.light.foreground,
  },
  slotTimeBooked: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.light.primary,
  },
  confirmCard: {
    backgroundColor: Colors.light.accent,
    borderRadius: 24,
    padding: 16,
  },
  confirmHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  confirmTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: SERIF_FONT,
    color: Colors.light.primary,
  },
  confirmDetails: {
    gap: 6,
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  confirmText: {
    fontSize: 14,
    color: Colors.light.primary,
  },
  bookingCard: {
    borderRadius: 24,
    padding: 16,
    marginTop: 10,
    backgroundColor: Colors.light.surfaceContainerLowest,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  bookingCardCancelled: {
    backgroundColor: Colors.light.surfaceContainerLow,
    opacity: 0.7,
  },
  bookingFacility: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: SERIF_FONT,
    color: Colors.light.foreground,
  },
  bookingMeta: {
    marginTop: 8,
    gap: 4,
  },
  bookingMetaText: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
  },
  cancelButton: {
    marginTop: 10,
    backgroundColor: "#fef2f2",
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.destructive,
  },
  cancelledBadge: {
    marginTop: 10,
    backgroundColor: Colors.light.surfaceContainerLow,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cancelledText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.light.onSurfaceVariant,
  },
});
