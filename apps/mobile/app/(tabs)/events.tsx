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
import { Colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";

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

export default function EventsScreen() {
  const { session } = useAuth();
  const [events, setEvents] = useState<EventWithRsvp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);

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

  async function handleRsvp(eventId: string, currentStatus: string | null) {
    setRsvpLoading(eventId);
    try {
      const newStatus =
        currentStatus === "attending" ? "declined" : "attending";
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

  if (events.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>🎉</Text>
        <Text style={styles.emptyTitle}>No upcoming events</Text>
        <Text style={styles.emptyText}>
          Check back soon for club events and social gatherings.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
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
      {events.map((event) => {
        const isAttending = event.user_rsvp_status === "attending";
        const isLoadingThis = rsvpLoading === event.id;
        const isFree = !event.price || event.price === 0;

        return (
          <View key={event.id} style={styles.card}>
            {/* Title + price */}
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>
                {event.title}
              </Text>
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

            {/* Meta */}
            <View style={styles.meta}>
              <Text style={styles.metaText}>
                📅 {formatDate(event.start_date)} · {formatTime(event.start_date)}
              </Text>
              {event.location && (
                <Text style={styles.metaText}>📍 {event.location}</Text>
              )}
              <Text style={styles.metaText}>
                👥 {event.rsvp_count} attending
                {event.capacity
                  ? ` · ${event.capacity - event.rsvp_count} spots left`
                  : ""}
              </Text>
            </View>

            {/* Description */}
            {event.description && (
              <Text style={styles.description} numberOfLines={3}>
                {event.description}
              </Text>
            )}

            {/* RSVP button */}
            <TouchableOpacity
              style={[
                styles.rsvpBtn,
                isAttending ? styles.rsvpBtnAttending : styles.rsvpBtnDefault,
                isLoadingThis && { opacity: 0.5 },
              ]}
              onPress={() => handleRsvp(event.id, event.user_rsvp_status)}
              disabled={isLoadingThis}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.rsvpBtnText,
                  isAttending
                    ? styles.rsvpBtnTextAttending
                    : styles.rsvpBtnTextDefault,
                ]}
              >
                {isLoadingThis
                  ? "..."
                  : isAttending
                    ? "✓ Attending"
                    : "RSVP"}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
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
    paddingBottom: 32,
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
  // Card
  card: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 16,
    padding: 16,
    backgroundColor: Colors.light.card,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.foreground,
    flex: 1,
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
  // Meta
  meta: {
    marginTop: 10,
    gap: 4,
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
});
