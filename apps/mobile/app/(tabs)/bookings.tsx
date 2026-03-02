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

interface GolfFacility {
  id: string;
  name: string;
  type: string;
  description: string | null;
}

interface TeeTimeSlot {
  start_time: string;
  end_time: string;
  is_available: boolean;
  booking_id?: string;
}

interface BookingWithDetails {
  id: string;
  facility_name: string;
  facility_type: string;
  date: string;
  start_time: string;
  end_time: string;
  party_size: number;
  status: string;
}

type ScreenView = "list" | "course" | "date" | "time";

export default function BookingsScreen() {
  const { session } = useAuth();
  const [view, setView] = useState<ScreenView>("list");
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isEligible, setIsEligible] = useState<boolean | null>(null);
  const [facilities, setFacilities] = useState<GolfFacility[]>([]);
  const [loadingFacilities, setLoadingFacilities] = useState(true);

  // Booking flow state
  const [selectedFacility, setSelectedFacility] = useState<GolfFacility | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<TeeTimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<TeeTimeSlot | null>(null);
  const [partySize, setPartySize] = useState(4);
  const [booking, setBooking] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/bookings/my`, { headers });
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings);
        setIsEligible(true);
      } else if (res.status === 404) {
        // Member not found — maybe not linked yet
        setBookings([]);
      }
    } catch (err) {
      console.error("Failed to fetch bookings:", err);
    } finally {
      setLoadingBookings(false);
      setRefreshing(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchFacilities();
    fetchBookings();
  }, [fetchBookings]);

  async function fetchFacilities() {
    try {
      const res = await fetch(`${API_URL}/api/facilities?type=golf`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setFacilities(data.facilities);

        // Check golf eligibility using the first facility
        if (data.facilities.length > 0) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dateStr = tomorrow.toISOString().split("T")[0];
          const eligRes = await fetch(
            `${API_URL}/api/bookings/tee-times?facility_id=${data.facilities[0].id}&date=${dateStr}`,
            { headers }
          );
          setIsEligible(eligRes.status !== 403);
        } else {
          setIsEligible(true);
        }
      }
    } catch {
      setIsEligible(true);
    } finally {
      setLoadingFacilities(false);
    }
  }

  async function fetchSlots(facilityId: string, date: string) {
    setLoadingSlots(true);
    setSelectedTime(null);
    try {
      const res = await fetch(
        `${API_URL}/api/bookings/tee-times?facility_id=${facilityId}&date=${date}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots);
      }
    } catch (err) {
      console.error("Failed to fetch slots:", err);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function handleBook() {
    if (!selectedFacility || !selectedDate || !selectedTime) return;
    setBooking(true);
    try {
      const res = await fetch(`${API_URL}/api/bookings`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          facility_id: selectedFacility.id,
          date: selectedDate,
          start_time: selectedTime.start_time,
          end_time: selectedTime.end_time,
          party_size: partySize,
        }),
      });

      if (res.ok) {
        Alert.alert("Booked!", "Your tee time has been confirmed.");
        resetBookingFlow();
        setView("list");
        fetchBookings();
      } else {
        const data = await res.json();
        Alert.alert("Error", data.error || "Failed to book tee time");
      }
    } catch {
      Alert.alert("Error", "Failed to book tee time");
    } finally {
      setBooking(false);
    }
  }

  async function handleCancel(bookingId: string) {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this tee time?",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel Booking",
          style: "destructive",
          onPress: async () => {
            setCancellingId(bookingId);
            try {
              const res = await fetch(
                `${API_URL}/api/bookings/${bookingId}/cancel`,
                { method: "PATCH", headers }
              );
              if (res.ok) {
                setBookings((prev) =>
                  prev.filter((b) => b.id !== bookingId)
                );
              }
            } catch (err) {
              console.error("Failed to cancel:", err);
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  }

  function resetBookingFlow() {
    setSelectedFacility(null);
    setSelectedDate("");
    setSelectedTime(null);
    setSlots([]);
    setPartySize(4);
  }

  function formatTime(timeStr: string) {
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${display}:${m} ${ampm}`;
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  // Generate next 14 days
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return {
      value: d.toISOString().split("T")[0],
      dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
      dayNum: d.getDate(),
      month: d.toLocaleDateString("en-US", { month: "short" }),
    };
  });

  // === Non-eligible view ===
  if (isEligible === false) {
    return (
      <View style={styles.container}>
        <View style={styles.upgradeContainer}>
          <Text style={styles.upgradeIcon}>🏌️</Text>
          <Text style={styles.upgradeTitle}>
            Golf Booking Requires an Upgrade
          </Text>
          <Text style={styles.upgradeText}>
            Your current membership doesn't include golf privileges. Upgrade to
            Golf, Platinum, or Legacy to book tee times.
          </Text>
          <TouchableOpacity style={styles.upgradeButton}>
            <Text style={styles.upgradeButtonText}>Contact Us to Upgrade</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // === Course selection ===
  if (view === "course") {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              resetBookingFlow();
              setView("list");
            }}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Course</Text>
        </View>
        {loadingFacilities ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
          </View>
        ) : facilities.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No golf courses available.</Text>
          </View>
        ) : (
          <View style={styles.courseGrid}>
            {facilities.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={styles.courseCard}
                onPress={() => {
                  setSelectedFacility(f);
                  setView("date");
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.courseIcon}>⛳</Text>
                <Text style={styles.courseName}>{f.name}</Text>
                <Text style={styles.courseDesc}>{f.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }

  // === Date selection ===
  if (view === "date") {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView("course")}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {selectedFacility?.name}
          </Text>
        </View>
        <Text style={styles.sectionLabel}>Select a Date</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateStrip}
        >
          {dates.map((d) => {
            const isSelected = d.value === selectedDate;
            return (
              <TouchableOpacity
                key={d.value}
                style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                onPress={() => {
                  setSelectedDate(d.value);
                  if (selectedFacility) {
                    fetchSlots(selectedFacility.id, d.value);
                  }
                  setView("time");
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dateDayName,
                    isSelected && styles.dateTextSelected,
                  ]}
                >
                  {d.dayName}
                </Text>
                <Text
                  style={[
                    styles.dateDayNum,
                    isSelected && styles.dateTextSelected,
                  ]}
                >
                  {d.dayNum}
                </Text>
                <Text
                  style={[
                    styles.dateMonth,
                    isSelected && styles.dateTextSelected,
                  ]}
                >
                  {d.month}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // === Time selection + booking ===
  if (view === "time") {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              setView("date");
              setSelectedTime(null);
              setSlots([]);
            }}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {selectedFacility?.name} — {formatDate(selectedDate)}
          </Text>
        </View>

        {loadingSlots ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.timeContent}>
            <Text style={styles.sectionLabel}>Available Tee Times</Text>
            <View style={styles.timeGrid}>
              {slots.map((slot) => {
                const isSelected =
                  selectedTime?.start_time === slot.start_time;
                return (
                  <TouchableOpacity
                    key={slot.start_time}
                    disabled={!slot.is_available}
                    onPress={() => setSelectedTime(slot)}
                    style={[
                      styles.timeChip,
                      isSelected && styles.timeChipSelected,
                      !slot.is_available && styles.timeChipDisabled,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.timeChipText,
                        isSelected && styles.timeChipTextSelected,
                        !slot.is_available && styles.timeChipTextDisabled,
                      ]}
                    >
                      {formatTime(slot.start_time)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedTime && (
              <View style={styles.confirmSection}>
                <Text style={styles.sectionLabel}>Party Size</Text>
                <View style={styles.partySizeRow}>
                  {[1, 2, 3, 4].map((n) => (
                    <TouchableOpacity
                      key={n}
                      onPress={() => setPartySize(n)}
                      style={[
                        styles.partySizeBtn,
                        partySize === n && styles.partySizeBtnSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.partySizeText,
                          partySize === n && styles.partySizeTextSelected,
                        ]}
                      >
                        {n}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.confirmBtn, booking && { opacity: 0.5 }]}
                  onPress={handleBook}
                  disabled={booking}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmBtnText}>
                    {booking
                      ? "Booking..."
                      : `Confirm — ${formatTime(selectedTime.start_time)} · ${partySize} ${partySize === 1 ? "player" : "players"}`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    );
  }

  // === Main list view ===
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchBookings();
            }}
            tintColor={Colors.light.primary}
          />
        }
      >
        {loadingBookings ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
          </View>
        ) : bookings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>No upcoming bookings</Text>
            <Text style={styles.emptyText}>
              Book your next tee time to get started.
            </Text>
          </View>
        ) : (
          <View style={styles.bookingsList}>
            <Text style={styles.sectionTitle}>My Upcoming Tee Times</Text>
            {bookings.map((b) => (
              <View key={b.id} style={styles.bookingCard}>
                <View style={styles.bookingCardLeft}>
                  <View style={styles.bookingIcon}>
                    <Text>⛳</Text>
                  </View>
                  <View>
                    <Text style={styles.bookingFacility}>
                      {b.facility_name}
                    </Text>
                    <Text style={styles.bookingMeta}>
                      {formatDate(b.date)} · {formatTime(b.start_time)} ·{" "}
                      {b.party_size} {b.party_size === 1 ? "player" : "players"}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => handleCancel(b.id)}
                  disabled={cancellingId === b.id}
                >
                  <Text style={styles.cancelBtnText}>
                    {cancellingId === b.id ? "..." : "Cancel"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setView("course")}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+ Book Tee Time</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.foreground,
    flex: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.mutedForeground,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.foreground,
    marginBottom: 12,
  },
  // Course selection
  courseGrid: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  courseCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  courseIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  courseName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
    textAlign: "center",
  },
  courseDesc: {
    fontSize: 11,
    color: Colors.light.mutedForeground,
    marginTop: 2,
    textAlign: "center",
  },
  // Date strip
  dateStrip: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 16,
  },
  dateCard: {
    width: 60,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: "center",
  },
  dateCardSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  dateDayName: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.light.mutedForeground,
  },
  dateDayNum: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.foreground,
    marginVertical: 2,
  },
  dateMonth: {
    fontSize: 10,
    color: Colors.light.mutedForeground,
  },
  dateTextSelected: {
    color: Colors.light.primaryForeground,
  },
  // Time grid
  timeContent: {
    paddingBottom: 32,
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
  },
  timeChip: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  timeChipSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  timeChipDisabled: {
    backgroundColor: Colors.light.muted,
    borderColor: Colors.light.border,
  },
  timeChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.light.foreground,
  },
  timeChipTextSelected: {
    color: Colors.light.primaryForeground,
  },
  timeChipTextDisabled: {
    color: Colors.light.mutedForeground,
    textDecorationLine: "line-through",
  },
  // Confirm section
  confirmSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    marginTop: 16,
    paddingTop: 0,
  },
  partySizeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  partySizeBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    justifyContent: "center",
    alignItems: "center",
  },
  partySizeBtnSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  partySizeText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  partySizeTextSelected: {
    color: Colors.light.primaryForeground,
  },
  confirmBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginHorizontal: 16,
    alignItems: "center",
  },
  confirmBtnText: {
    color: Colors.light.primaryForeground,
    fontSize: 14,
    fontWeight: "600",
  },
  // List view
  listContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 80,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  bookingsList: {
    gap: 0,
  },
  bookingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  bookingCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  bookingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#dcfce7",
    justifyContent: "center",
    alignItems: "center",
  },
  bookingFacility: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  bookingMeta: {
    fontSize: 11,
    color: Colors.light.mutedForeground,
    marginTop: 1,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#b91c1c",
  },
  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
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
  // FAB
  fab: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  fabText: {
    color: Colors.light.primaryForeground,
    fontSize: 15,
    fontWeight: "600",
  },
  // Upgrade prompt
  upgradeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  upgradeIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#92400e",
    marginBottom: 8,
    textAlign: "center",
  },
  upgradeText: {
    fontSize: 14,
    color: "#a16207",
    textAlign: "center",
    marginBottom: 20,
    maxWidth: 280,
  },
  upgradeButton: {
    borderWidth: 1,
    borderColor: "#fbbf24",
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400e",
  },
});
