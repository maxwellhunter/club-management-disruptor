import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { EventFormModal } from "@/components/event-form-modal";
import { AttendeesModal } from "@/components/attendees-modal";
import type { RsvpStatus } from "@club/shared";

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
  user_rsvp_status: RsvpStatus | null;
}

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

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const [event, setEvent] = useState<EventWithRsvp | null>(null);
  const [role, setRole] = useState<string>("member");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rsvpLoading, setRsvpLoading] = useState(false);

  // Admin modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/events/${id}`, { headers });
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
  }, [id, session?.access_token]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  function handleRsvp() {
    if (!event) return;
    if (event.user_rsvp_status === "attending") {
      Alert.alert(
        "Cancel RSVP",
        "Are you sure you want to cancel your RSVP?",
        [
          { text: "Keep RSVP", style: "cancel" },
          {
            text: "Cancel RSVP",
            style: "destructive",
            onPress: () => executeRsvp(),
          },
        ]
      );
    } else {
      executeRsvp();
    }
  }

  async function executeRsvp() {
    if (!event) return;
    setRsvpLoading(true);
    try {
      const newStatus: RsvpStatus =
        event.user_rsvp_status === "attending" ? "declined" : "attending";
      const res = await fetch(`${API_URL}/api/events/rsvp`, {
        method: "POST",
        headers,
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
        Alert.alert("Error", data.error || "Failed to RSVP");
      }
    } catch {
      Alert.alert("Error", "Failed to RSVP");
    } finally {
      setRsvpLoading(false);
    }
  }

  const isAdmin = role === "admin";
  const isAttending = event?.user_rsvp_status === "attending";
  const isFree = !event?.price || event.price === 0;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.light.mutedForeground} />
        <Text style={styles.errorTitle}>{error || "Event not found"}</Text>
        <Text style={styles.errorText}>
          This event may have been removed or you don&apos;t have access.
        </Text>
      </View>
    );
  }

  const capacityPercent =
    event.capacity && event.capacity > 0
      ? Math.min((event.rsvp_count / event.capacity) * 100, 100)
      : null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Title + badges */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>{event.title}</Text>
          <View style={styles.badgeRow}>
            {isAdmin && event.status !== "published" && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{event.status}</Text>
              </View>
            )}
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
          </View>
        </View>

        {/* Event info */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={Colors.light.mutedForeground} style={{ marginTop: 1 }} />
            <View>
              <Text style={styles.infoLabel}>
                {formatDate(event.start_date)}
              </Text>
              <Text style={styles.infoDetail}>
                {formatTimeRange(event.start_date, event.end_date)}
              </Text>
            </View>
          </View>

          {event.location && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color={Colors.light.mutedForeground} style={{ marginTop: 1 }} />
              <Text style={styles.infoDetail}>{event.location}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={18} color={Colors.light.mutedForeground} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoDetail}>
                {event.rsvp_count} attending
                {event.capacity ? ` of ${event.capacity} spots` : ""}
              </Text>
              {capacityPercent !== null && (
                <View style={styles.capacityBarBg}>
                  <View
                    style={[
                      styles.capacityBarFill,
                      {
                        width: `${capacityPercent}%`,
                        backgroundColor:
                          capacityPercent >= 90
                            ? "#ef4444"
                            : capacityPercent >= 70
                              ? "#eab308"
                              : Colors.light.primary,
                      },
                    ]}
                  />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Description */}
        {event.description && (
          <View style={styles.descriptionSection}>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        )}

        {/* RSVP button */}
        {event.status === "published" && (
          <TouchableOpacity
            style={[
              styles.rsvpBtn,
              isAttending ? styles.rsvpBtnAttending : styles.rsvpBtnDefault,
              rsvpLoading && { opacity: 0.5 },
            ]}
            onPress={handleRsvp}
            disabled={rsvpLoading}
            activeOpacity={0.7}
          >
            {rsvpLoading ? (
              <ActivityIndicator
                size="small"
                color={
                  isAttending
                    ? "#166534"
                    : Colors.light.primaryForeground
                }
              />
            ) : isAttending ? (
              <View style={styles.rsvpBtnRow}>
                <Ionicons name="checkmark" size={18} color="#166534" />
                <Text style={[styles.rsvpBtnText, styles.rsvpBtnTextAttending]}>Attending</Text>
              </View>
            ) : (
              <Text style={[styles.rsvpBtnText, styles.rsvpBtnTextDefault]}>RSVP</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Admin actions */}
        {isAdmin && (
          <View style={styles.adminSection}>
            <TouchableOpacity
              style={styles.adminBtn}
              onPress={() => setShowEditModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.adminBtnText}>Edit Event</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.adminBtn}
              onPress={() => setShowAttendeesModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.adminBtnText}>View Attendees</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Edit modal */}
      <EventFormModal
        visible={showEditModal}
        event={event as EventWithRsvp}
        apiUrl={API_URL}
        headers={headers}
        onClose={() => setShowEditModal(false)}
        onSaved={() => {
          setShowEditModal(false);
          fetchEvent();
        }}
      />

      {/* Attendees modal */}
      <AttendeesModal
        visible={showAttendeesModal}
        eventId={event.id}
        eventTitle={event.title}
        apiUrl={API_URL}
        headers={headers}
        onClose={() => setShowAttendeesModal(false)}
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
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.background,
    padding: 24,
  },
  // Error
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
    color: Colors.light.mutedForeground,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.foreground,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
    textAlign: "center",
  },
  // Title
  titleRow: {
    gap: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.foreground,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  statusBadge: {
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    textTransform: "capitalize",
  },
  priceBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  priceFree: {
    backgroundColor: "#dcfce7",
  },
  pricePaid: {
    backgroundColor: "#dbeafe",
  },
  priceText: {
    fontSize: 12,
    fontWeight: "600",
  },
  priceTextFree: {
    color: "#166534",
  },
  priceTextPaid: {
    color: "#1e40af",
  },
  // Info
  infoSection: {
    gap: 14,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoIcon: {
    fontSize: 18,
    marginTop: 1,
  },
  infoLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  infoDetail: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
    marginTop: 1,
  },
  capacityBarBg: {
    marginTop: 8,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.muted,
    overflow: "hidden",
  },
  capacityBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  // Description
  descriptionSection: {
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  description: {
    fontSize: 15,
    color: Colors.light.foreground,
    lineHeight: 22,
  },
  // RSVP
  rsvpBtn: {
    marginTop: 20,
    borderRadius: 12,
    paddingVertical: 14,
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
    fontSize: 16,
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
    gap: 6,
  },
  // Admin
  adminSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    flexDirection: "row",
    gap: 12,
  },
  adminBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: Colors.light.muted,
  },
  adminBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.light.foreground,
  },
});
