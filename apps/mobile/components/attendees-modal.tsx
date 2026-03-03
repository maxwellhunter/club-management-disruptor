import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";

interface EventAttendee {
  rsvp_id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  guest_count: number;
  rsvp_created_at: string;
}

interface AttendeesModalProps {
  visible: boolean;
  eventId: string;
  eventTitle: string;
  apiUrl: string;
  headers: Record<string, string>;
  onClose: () => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: keyof typeof Ionicons.glyphMap; bg: string; text: string }
> = {
  attending: { label: "Attending", icon: "checkmark", bg: "#dcfce7", text: "#166534" },
  maybe: { label: "Maybe", icon: "help", bg: "#fef9c3", text: "#854d0e" },
  waitlisted: { label: "Waitlisted", icon: "hourglass-outline", bg: "#dbeafe", text: "#1e40af" },
  declined: { label: "Declined", icon: "close", bg: "#fee2e2", text: "#991b1b" },
};

const STATUS_ORDER = ["attending", "maybe", "waitlisted", "declined"];

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function AttendeesModal({
  visible,
  eventId,
  eventTitle,
  apiUrl,
  headers,
  onClose,
}: AttendeesModalProps) {
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [totalGuests, setTotalGuests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !eventId) return;
    setLoading(true);
    setError("");

    fetch(`${apiUrl}/api/events/admin/${eventId}/attendees`, { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.attendees) {
          setAttendees(data.attendees);
          setTotalGuests(data.total_guests);
        } else {
          setError(data.error || "Failed to load");
        }
      })
      .catch(() => setError("Failed to load attendees"))
      .finally(() => setLoading(false));
  }, [visible, eventId]);

  function confirmRemove(attendee: EventAttendee) {
    Alert.alert(
      "Remove Attendee",
      `Remove ${attendee.first_name} ${attendee.last_name} from this event?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => handleRemove(attendee.rsvp_id),
        },
      ]
    );
  }

  async function handleRemove(rsvpId: string) {
    setRemovingId(rsvpId);
    try {
      const res = await fetch(
        `${apiUrl}/api/events/admin/${eventId}/attendees`,
        {
          method: "DELETE",
          headers: { ...headers, "Content-Type": "application/json" },
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
        Alert.alert("Error", data.error || "Failed to remove attendee");
      }
    } catch {
      Alert.alert("Error", "Failed to remove attendee");
    } finally {
      setRemovingId(null);
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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Attendees</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {eventTitle}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Summary bar */}
        {!loading && !error && attendees.length > 0 && (
          <View style={styles.summaryBar}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="people-outline" size={16} color={Colors.light.foreground} />
              <Text style={styles.summaryText}>
                {totalGuests} total headcount
              </Text>
            </View>
            <Text style={styles.summaryDetail}>
              {attendingCount} member{attendingCount !== 1 ? "s" : ""}
              {guestsCount > 0 &&
                ` + ${guestsCount} guest${guestsCount !== 1 ? "s" : ""}`}
            </Text>
          </View>
        )}

        {/* Content */}
        <ScrollView contentContainerStyle={styles.content}>
          {loading && (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
          )}

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!loading && !error && attendees.length === 0 && (
            <View style={styles.centered}>
              <Ionicons name="people-outline" size={48} color={Colors.light.mutedForeground} />
              <Text style={styles.emptyTitle}>No RSVPs yet</Text>
              <Text style={styles.emptyText}>
                Attendees will appear here once members respond.
              </Text>
            </View>
          )}

          {!loading &&
            !error &&
            attendees.length > 0 &&
            STATUS_ORDER.filter((s) => grouped[s]?.length).map((status) => {
              const config = STATUS_CONFIG[status];
              const group = grouped[status];

              return (
                <View key={status} style={styles.section}>
                  {/* Status header */}
                  <View style={styles.sectionHeader}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: config.bg },
                      ]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name={config.icon} size={12} color={config.text} />
                        <Text
                          style={[styles.statusBadgeText, { color: config.text }]}
                        >
                          {config.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.sectionCount}>{group.length}</Text>
                  </View>

                  {/* Member rows */}
                  {group.map((attendee) => (
                    <TouchableOpacity
                      key={attendee.rsvp_id}
                      style={styles.row}
                      activeOpacity={0.6}
                      onLongPress={() => confirmRemove(attendee)}
                    >
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {getInitials(
                            attendee.first_name,
                            attendee.last_name
                          )}
                        </Text>
                      </View>
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowName}>
                          {attendee.first_name} {attendee.last_name}
                        </Text>
                        <Text style={styles.rowEmail}>{attendee.email}</Text>
                      </View>
                      {attendee.guest_count > 0 && (
                        <View style={styles.guestBadge}>
                          <Text style={styles.guestBadgeText}>
                            +{attendee.guest_count}
                          </Text>
                        </View>
                      )}
                      {removingId === attendee.rsvp_id ? (
                        <ActivityIndicator
                          size="small"
                          color={Colors.light.destructive}
                          style={{ marginLeft: 8 }}
                        />
                      ) : (
                        <TouchableOpacity
                          onPress={() => confirmRemove(attendee)}
                          style={styles.removeBtn}
                          activeOpacity={0.6}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close" size={14} color="#991b1b" />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.foreground,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.light.mutedForeground,
    marginTop: 2,
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.primary,
  },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.light.muted,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  summaryDetail: {
    fontSize: 13,
    color: Colors.light.mutedForeground,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    alignItems: "center",
    paddingVertical: 60,
  },
  errorBox: {
    borderRadius: 12,
    backgroundColor: "#fee2e2",
    padding: 14,
  },
  errorText: {
    fontSize: 14,
    color: "#991b1b",
  },
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
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sectionCount: {
    fontSize: 12,
    color: Colors.light.mutedForeground,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.muted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.mutedForeground,
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.light.foreground,
  },
  rowEmail: {
    fontSize: 12,
    color: Colors.light.mutedForeground,
    marginTop: 1,
  },
  guestBadge: {
    borderRadius: 10,
    backgroundColor: Colors.light.muted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  guestBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.mutedForeground,
  },
  removeBtn: {
    marginLeft: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fee2e2",
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#991b1b",
  },
});
