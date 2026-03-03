import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { EventFormModal } from "@/components/event-form-modal";
import { AttendeesModal } from "@/components/attendees-modal";

const API_URL =
  process.env.EXPO_PUBLIC_APP_URL || "http://localhost:3000";

interface EventWithRsvp {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
  capacity: number | null;
  price: number | null;
  status: string;
  rsvp_count: number;
  user_rsvp_status: string | null;
}

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "#f3f4f6", text: "#374151" },
  published: { label: "Published", bg: "#dcfce7", text: "#166534" },
  cancelled: { label: "Cancelled", bg: "#fee2e2", text: "#991b1b" },
  completed: { label: "Completed", bg: "#dbeafe", text: "#1e40af" },
};

export default function EventsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<EventWithRsvp[]>([]);
  const [role, setRole] = useState<string>("member");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Admin form state
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithRsvp | null>(null);
  const [viewingAttendees, setViewingAttendees] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/events`, { headers });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
        if (data.role) setRole(data.role);
      }
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const isAdmin = role === "admin";

  function handleRsvp(eventId: string, currentStatus: string | null) {
    if (currentStatus === "attending") {
      Alert.alert(
        "Cancel RSVP",
        "Are you sure you want to cancel your RSVP?",
        [
          { text: "Keep RSVP", style: "cancel" },
          {
            text: "Cancel RSVP",
            style: "destructive",
            onPress: () => executeRsvp(eventId, "declined"),
          },
        ]
      );
    } else {
      executeRsvp(eventId, "attending");
    }
  }

  async function executeRsvp(eventId: string, newStatus: string) {
    setRsvpLoading(eventId);
    try {
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
        await fetchEvents();
      } else {
        const data = await res.json();
        Alert.alert("Error", data.error || "Failed to RSVP");
      }
    } catch {
      Alert.alert("Error", "Failed to RSVP");
    } finally {
      setRsvpLoading(null);
    }
  }

  async function handlePublish(eventId: string) {
    setActionLoading(eventId);
    try {
      const res = await fetch(`${API_URL}/api/events/admin/${eventId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status: "published" }),
      });
      if (res.ok) {
        await fetchEvents();
      } else {
        const data = await res.json();
        Alert.alert("Error", data.error || "Failed to publish");
      }
    } catch {
      Alert.alert("Error", "Failed to publish event");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(eventId: string) {
    Alert.alert(
      "Delete Event",
      "Are you sure you want to delete this event? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setActionLoading(eventId);
            try {
              const res = await fetch(
                `${API_URL}/api/events/admin/${eventId}`,
                { method: "DELETE", headers }
              );
              if (res.ok) {
                await fetchEvents();
              } else {
                const data = await res.json();
                Alert.alert("Error", data.error || "Failed to delete");
              }
            } catch {
              Alert.alert("Error", "Failed to delete event");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  }

  function showAdminMenu(event: EventWithRsvp) {
    const actions: { text: string; onPress: () => void; style?: "destructive" | "cancel" }[] = [];

    if (event.status === "draft") {
      actions.push({
        text: "Publish",
        onPress: () => handlePublish(event.id),
      });
    }

    actions.push({
      text: "View Attendees",
      onPress: () =>
        setViewingAttendees({ id: event.id, title: event.title }),
    });

    actions.push({
      text: "Edit",
      onPress: () => {
        setEditingEvent(event);
        setShowForm(true);
      },
    });

    actions.push({
      text: "Delete",
      style: "destructive",
      onPress: () => handleDelete(event.id),
    });

    actions.push({ text: "Cancel", onPress: () => {}, style: "cancel" });

    Alert.alert("Event Actions", event.title, actions);
  }

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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (events.length === 0 && !isAdmin) {
    return (
      <View style={styles.centered}>
        <Ionicons name="sparkles-outline" size={48} color={Colors.light.mutedForeground} />
        <Text style={styles.emptyTitle}>No upcoming events</Text>
        <Text style={styles.emptyText}>
          Check back soon for club events and social gatherings.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchEvents();
            }}
            tintColor={Colors.light.primary}
          />
        }
      >
        {events.length === 0 && isAdmin ? (
          <View style={styles.emptyAdmin}>
            <Ionicons name="calendar-outline" size={48} color={Colors.light.mutedForeground} />
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptyText}>
              Tap the + button to create your first event.
            </Text>
          </View>
        ) : (
          events.map((event) => {
            const isAttending = event.user_rsvp_status === "attending";
            const isLoadingThis = rsvpLoading === event.id;
            const isFree = !event.price || event.price === 0;
            const badge = STATUS_BADGE[event.status];
            const isActionLoading = actionLoading === event.id;

            return (
              <TouchableOpacity
                key={event.id}
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => router.push(`/event/${event.id}`)}
              >
                {/* Title + badges */}
                <View style={styles.titleRow}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.badgeRow}>
                      <Text style={styles.title} numberOfLines={2}>
                        {event.title}
                      </Text>
                      {isAdmin && badge && (
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: badge.bg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              { color: badge.text },
                            ]}
                          >
                            {badge.label}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.rightBadges}>
                    <View
                      style={[
                        styles.priceBadge,
                        isFree ? styles.priceFree : styles.pricePaid,
                      ]}
                    >
                      <Text
                        style={[
                          styles.priceText,
                          isFree ? styles.priceTextFree : styles.priceTextPaid,
                        ]}
                      >
                        {isFree ? "Free" : `$${event.price}`}
                      </Text>
                    </View>
                    {isAdmin && (
                      <TouchableOpacity
                        onPress={() => showAdminMenu(event)}
                        disabled={isActionLoading}
                        style={styles.menuBtn}
                        activeOpacity={0.6}
                      >
                        {isActionLoading ? (
                          <ActivityIndicator
                            size="small"
                            color={Colors.light.mutedForeground}
                          />
                        ) : (
                          <Ionicons name="ellipsis-horizontal" size={18} color={Colors.light.mutedForeground} />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Meta */}
                <View style={styles.meta}>
                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={14} color={Colors.light.mutedForeground} />
                    <Text style={styles.metaText}>
                      {formatDate(event.start_date)} ·{" "}
                      {formatTime(event.start_date)}
                    </Text>
                  </View>
                  {event.location && (
                    <View style={styles.metaRow}>
                      <Ionicons name="location-outline" size={14} color={Colors.light.mutedForeground} />
                      <Text style={styles.metaText}>
                        {event.location}
                      </Text>
                    </View>
                  )}
                  <View style={styles.metaRow}>
                    <Ionicons name="people-outline" size={14} color={Colors.light.mutedForeground} />
                    <Text style={styles.metaText}>
                      {event.rsvp_count} attending
                      {event.capacity
                        ? ` · ${event.capacity - event.rsvp_count} spots left`
                        : ""}
                    </Text>
                  </View>
                </View>

                {/* Description */}
                {event.description && (
                  <Text style={styles.description} numberOfLines={3}>
                    {event.description}
                  </Text>
                )}

                {/* RSVP button (shown for published events) */}
                {event.status === "published" && (
                  <TouchableOpacity
                    style={[
                      styles.rsvpBtn,
                      isAttending
                        ? styles.rsvpBtnAttending
                        : styles.rsvpBtnDefault,
                      isLoadingThis && { opacity: 0.5 },
                    ]}
                    onPress={() =>
                      handleRsvp(event.id, event.user_rsvp_status)
                    }
                    disabled={isLoadingThis}
                    activeOpacity={0.7}
                  >
                    {isLoadingThis ? (
                      <Text style={[styles.rsvpBtnText, isAttending ? styles.rsvpBtnTextAttending : styles.rsvpBtnTextDefault]}>...</Text>
                    ) : isAttending ? (
                      <View style={styles.rsvpBtnRow}>
                        <Ionicons name="checkmark" size={16} color="#166534" />
                        <Text style={[styles.rsvpBtnText, styles.rsvpBtnTextAttending]}>Attending</Text>
                      </View>
                    ) : (
                      <Text style={[styles.rsvpBtnText, styles.rsvpBtnTextDefault]}>RSVP</Text>
                    )}
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Admin FAB */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            setEditingEvent(null);
            setShowForm(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Event form modal */}
      <EventFormModal
        visible={showForm}
        event={editingEvent}
        apiUrl={API_URL}
        headers={headers}
        onClose={() => {
          setShowForm(false);
          setEditingEvent(null);
        }}
        onSaved={() => {
          setShowForm(false);
          setEditingEvent(null);
          fetchEvents();
        }}
      />

      {/* Attendees modal */}
      <AttendeesModal
        visible={!!viewingAttendees}
        eventId={viewingAttendees?.id ?? ""}
        eventTitle={viewingAttendees?.title ?? ""}
        apiUrl={API_URL}
        headers={headers}
        onClose={() => setViewingAttendees(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.background,
    padding: 24,
  },
  // Empty state
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.foreground,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
    textAlign: "center",
  },
  emptyAdmin: {
    alignItems: "center",
    paddingVertical: 60,
  },
  // Card
  card: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 16,
    padding: 16,
    backgroundColor: Colors.light.background,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  rightBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.foreground,
    flexShrink: 1,
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  priceBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priceFree: {
    backgroundColor: "#dcfce7",
  },
  pricePaid: {
    backgroundColor: "#dbeafe",
  },
  priceText: {
    fontSize: 11,
    fontWeight: "600",
  },
  priceTextFree: {
    color: "#166534",
  },
  priceTextPaid: {
    color: "#1e40af",
  },
  menuBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  menuBtnText: {
    fontSize: 18,
    color: Colors.light.mutedForeground,
    fontWeight: "700",
  },
  // Meta
  meta: {
    marginTop: 10,
    gap: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: Colors.light.mutedForeground,
  },
  // Description
  description: {
    fontSize: 13,
    color: Colors.light.foreground,
    lineHeight: 19,
    marginTop: 10,
  },
  // RSVP button
  rsvpBtn: {
    marginTop: 14,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  rsvpBtnDefault: {
    backgroundColor: Colors.light.primary,
  },
  rsvpBtnAttending: {
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#86efac",
  },
  rsvpBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  rsvpBtnTextDefault: {
    color: Colors.light.primaryForeground,
  },
  rsvpBtnTextAttending: {
    color: "#166534",
  },
  rsvpBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    fontWeight: "400",
    color: Colors.light.primaryForeground,
    lineHeight: 30,
  },
});
