import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
  Platform,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { haptics } from "@/lib/haptics";
import { addTeeTimeToCalendar } from "@/lib/calendar";

const API_URL =
  process.env.EXPO_PUBLIC_APP_URL || "http://localhost:3000";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Course imagery placeholders — keyed by facility name pattern
const COURSE_IMAGES: Record<string, string> = {
  championship:
    "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=800&q=80",
  valley:
    "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800&q=80",
  executive:
    "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800&q=80",
  reserve:
    "https://images.unsplash.com/photo-1592919505780-303950717480?w=800&q=80",
  default:
    "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=800&q=80",
};

function getCourseImage(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, url] of Object.entries(COURSE_IMAGES)) {
    if (key !== "default" && lower.includes(key)) return url;
  }
  return COURSE_IMAGES.default;
}

// Transport modes — matching Stitch (Golf Cart + Walking)
const TRANSPORT_MODES = [
  { id: "cart", label: "Golf Cart", icon: "car-outline" as const },
  { id: "walk", label: "Walking", icon: "walk-outline" as const },
];

// Rate category + pricing per slot
function getRateCategory(time: string): {
  label: string;
  price: number;
  labelColor: string;
} {
  const hour = parseInt(time.split(":")[0]);
  if (hour < 8)
    return { label: "Standard Rate", price: 185, labelColor: Colors.light.onSurfaceVariant };
  if (hour < 10)
    return { label: "Prime Time", price: 195, labelColor: Colors.light.onSurfaceVariant };
  if (hour < 12)
    return { label: "Member Exclusive", price: 165, labelColor: "#5d4201" };
  if (hour < 15)
    return { label: "Standard Rate", price: 185, labelColor: Colors.light.onSurfaceVariant };
  return { label: "Twilight", price: 145, labelColor: Colors.light.onSurfaceVariant };
}

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
  waitlist_count?: number;
  on_waitlist?: boolean;
}

interface BookingWithDetails {
  id: string;
  facility_id: string;
  facility_name: string;
  facility_type: string;
  date: string;
  start_time: string;
  end_time: string;
  party_size: number;
  status: string;
}

type ScreenView = "list" | "course" | "book" | "edit";

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
  const [selectedFacility, setSelectedFacility] =
    useState<GolfFacility | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<TeeTimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<TeeTimeSlot | null>(null);
  const [partySize, setPartySize] = useState(4);
  const [transportMode, setTransportMode] = useState("cart");
  const [booking, setBooking] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [joiningWaitlist, setJoiningWaitlist] = useState<string | null>(null);
  const [leavingWaitlist, setLeavingWaitlist] = useState<string | null>(null);

  // Edit flow state
  const [editingBooking, setEditingBooking] =
    useState<BookingWithDetails | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editPartySize, setEditPartySize] = useState(4);
  const [editSlots, setEditSlots] = useState<TeeTimeSlot[]>([]);
  const [loadingEditSlots, setLoadingEditSlots] = useState(false);
  const [saving, setSaving] = useState(false);

  // Generate 14 bookable dates (tomorrow + 13 days)
  const bookableDates = useMemo(() => {
    const dates: { dateString: string; dayName: string; dayNum: number }[] = [];
    for (let i = 1; i <= 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push({
        dateString: d.toISOString().split("T")[0],
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        dayNum: d.getDate(),
      });
    }
    return dates;
  }, []);

  const handleDateSelect = useCallback(
    (dateString: string) => {
      setSelectedDate(dateString);
      setSelectedTime(null);
      if (selectedFacility) {
        fetchSlots(selectedFacility.id, dateString);
      }
    },
    [selectedFacility]
  );

  const handleEditDateSelect = useCallback(
    (dateString: string) => {
      setEditDate(dateString);
      setEditTime("");
      if (editingBooking) {
        fetchEditSlots(editingBooking.facility_id, dateString);
      }
    },
    [editingBooking]
  );

  // Auto-fetch edit slots when entering edit mode with existing date
  useEffect(() => {
    if (view === "edit" && editingBooking && editDate && editSlots.length === 0 && !loadingEditSlots) {
      fetchEditSlots(editingBooking.facility_id, editDate);
    }
  }, [view, editingBooking, editDate]);

  const getHeaders = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      h["Authorization"] = `Bearer ${session.access_token}`;
    }
    return h;
  }, [session?.access_token]);

  const fetchBookings = useCallback(async () => {
    const headers = getHeaders();
    try {
      const res = await fetch(`${API_URL}/api/bookings/my`, { headers });
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings);
        setIsEligible(true);
      } else if (res.status === 404) {
        setBookings([]);
      }
    } catch (err) {
      console.error("Failed to fetch bookings:", err);
    } finally {
      setLoadingBookings(false);
      setRefreshing(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchFacilities();
    fetchBookings();
  }, [fetchBookings]);

  async function fetchFacilities() {
    const headers = getHeaders();
    try {
      const res = await fetch(`${API_URL}/api/facilities?type=golf`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setFacilities(data.facilities);

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
    const headers = getHeaders();
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
    const headers = getHeaders();
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
        haptics.success();
        Alert.alert("Booked!", "Your tee time has been confirmed.", [
          {
            text: "Add to Calendar",
            onPress: () =>
              addTeeTimeToCalendar({
                facilityName: selectedFacility.name,
                date: selectedDate,
                startTime: selectedTime.start_time,
                partySize,
                holes: 18,
              }),
          },
          { text: "Done" },
        ]);
        resetBookingFlow();
        setView("list");
        fetchBookings();
      } else {
        haptics.error();
        const data = await res.json();
        Alert.alert("Error", data.error || "Failed to book tee time");
      }
    } catch {
      haptics.error();
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
            const headers = getHeaders();
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

  async function handleJoinWaitlist(slot: TeeTimeSlot) {
    if (!selectedFacility || !selectedDate) return;
    const headers = getHeaders();
    setJoiningWaitlist(slot.start_time);
    try {
      const res = await fetch(`${API_URL}/api/bookings/waitlist`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          facility_id: selectedFacility.id,
          date: selectedDate,
          start_time: slot.start_time,
          end_time: slot.end_time,
          party_size: partySize,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert(
          "On the Waitlist!",
          `You're #${data.position} in line. We'll auto-book you if this slot opens up.`
        );
        fetchSlots(selectedFacility.id, selectedDate);
      } else {
        Alert.alert("Error", data.error || "Failed to join waitlist");
      }
    } catch {
      Alert.alert("Error", "Failed to join waitlist");
    } finally {
      setJoiningWaitlist(null);
    }
  }

  async function handleLeaveWaitlist(slot: TeeTimeSlot) {
    if (!selectedFacility || !selectedDate) return;
    const headers = getHeaders();
    setLeavingWaitlist(slot.start_time);
    try {
      const infoRes = await fetch(
        `${API_URL}/api/bookings/waitlist?facility_id=${selectedFacility.id}&date=${selectedDate}&start_time=${slot.start_time}`,
        { headers }
      );
      const info = await infoRes.json();
      if (!info.my_entry_id) {
        Alert.alert("Error", "Waitlist entry not found");
        return;
      }

      const res = await fetch(
        `${API_URL}/api/bookings/waitlist?id=${info.my_entry_id}`,
        { method: "DELETE", headers }
      );
      if (res.ok) {
        Alert.alert("Removed", "You've been removed from the waitlist.");
        fetchSlots(selectedFacility.id, selectedDate);
      } else {
        const data = await res.json();
        Alert.alert("Error", data.error || "Failed to leave waitlist");
      }
    } catch {
      Alert.alert("Error", "Failed to leave waitlist");
    } finally {
      setLeavingWaitlist(null);
    }
  }

  function resetBookingFlow() {
    setSelectedFacility(null);
    setSelectedDate("");
    setSelectedTime(null);
    setSlots([]);
    setPartySize(4);
    setTransportMode("cart");
  }

  function startEdit(b: BookingWithDetails) {
    setEditingBooking(b);
    setEditDate(b.date);
    setEditTime(b.start_time);
    setEditPartySize(b.party_size);
    setEditSlots([]);
    setView("edit");
  }

  function cancelEdit() {
    setEditingBooking(null);
    setEditDate("");
    setEditTime("");
    setEditSlots([]);
    setView("list");
  }

  async function fetchEditSlots(facilityId: string, date: string) {
    const headers = getHeaders();
    setLoadingEditSlots(true);
    try {
      const res = await fetch(
        `${API_URL}/api/bookings/tee-times?facility_id=${facilityId}&date=${date}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        setEditSlots(data.slots);
      }
    } catch {
      setEditSlots([]);
    } finally {
      setLoadingEditSlots(false);
    }
  }

  async function handleSaveEdit() {
    if (!editingBooking || !editTime) return;
    const headers = getHeaders();
    setSaving(true);

    const changes: Record<string, string | number> = {};
    if (editDate !== editingBooking.date) changes.date = editDate;
    if (editTime !== editingBooking.start_time) changes.start_time = editTime;
    if (editPartySize !== editingBooking.party_size)
      changes.party_size = editPartySize;

    if (Object.keys(changes).length === 0) {
      cancelEdit();
      return;
    }

    try {
      const res = await fetch(
        `${API_URL}/api/bookings/${editingBooking.id}/modify`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify(changes),
        }
      );

      if (res.ok) {
        Alert.alert("Updated!", "Your tee time has been modified.");
        cancelEdit();
        setLoadingBookings(true);
        fetchBookings();
      } else {
        const data = await res.json();
        Alert.alert("Error", data.error || "Failed to modify booking");
      }
    } catch {
      Alert.alert("Error", "Failed to modify booking");
    } finally {
      setSaving(false);
    }
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

  // ═══════════════════════════════════════════
  // Non-eligible view
  // ═══════════════════════════════════════════
  if (isEligible === false) {
    return (
      <View style={s.container}>
        <View style={s.upgradeContainer}>
          <View style={s.upgradeIconWrap}>
            <Ionicons name="golf-outline" size={32} color={Colors.light.tertiary} />
          </View>
          <Text style={s.upgradeTitle}>Golf Privileges Required</Text>
          <Text style={s.upgradeText}>
            Your current membership doesn't include golf access. Upgrade to
            Golf, Platinum, or Legacy tier to book tee times.
          </Text>
          <TouchableOpacity style={s.upgradeButton} activeOpacity={0.8}>
            <Text style={s.upgradeButtonText}>Contact Membership Services</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════
  // Course Selection — Editorial Design
  // ═══════════════════════════════════════════
  if (view === "course") {
    return (
      <View style={s.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.courseScrollContent}
        >
          {/* Hero */}
          <View style={s.courseHero}>
            <TouchableOpacity
              onPress={() => {
                resetBookingFlow();
                setView("list");
              }}
              style={s.heroBackBtn}
              activeOpacity={0.7}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={Colors.light.onSurfaceVariant}
              />
            </TouchableOpacity>
            <Text style={s.courseHeroLabel}>SELECT YOUR COURSE</Text>
            <Text style={s.courseHeroTitle}>The Lakes</Text>
            <Text style={s.courseHeroDesc}>
              Designed by masters, preserved for legends. Select your canvas for
              the day from our world-renowned championship greens.
            </Text>
          </View>

          {/* Course Cards */}
          {loadingFacilities ? (
            <View style={s.centered}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
          ) : facilities.length === 0 ? (
            <View style={s.centered}>
              <Text style={s.emptyText}>No golf courses available.</Text>
            </View>
          ) : (
            <View style={s.courseCards}>
              {facilities.map((f, index) => (
                <TouchableOpacity
                  key={f.id}
                  style={s.courseCard}
                  onPress={() => {
                    setSelectedFacility(f);
                    setView("book");
                  }}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: getCourseImage(f.name) }}
                    style={s.courseCardImage}
                    resizeMode="cover"
                  />

                  {/* Featured badge on first course */}
                  {index === 0 && (
                    <View style={s.featuredBadge}>
                      <Text style={s.featuredBadgeText}>PREMIER</Text>
                    </View>
                  )}

                  <View style={s.courseCardContent}>
                    <Text style={s.courseCardName}>{f.name}</Text>

                    {/* Stats row */}
                    <View style={s.courseStatsRow}>
                      <View style={s.courseStat}>
                        <Ionicons
                          name="flag-outline"
                          size={13}
                          color={Colors.light.onSurfaceVariant}
                        />
                        <Text style={s.courseStatText}>18 Holes</Text>
                      </View>
                      <View style={s.courseStat}>
                        <Ionicons
                          name="resize-outline"
                          size={13}
                          color={Colors.light.onSurfaceVariant}
                        />
                        <Text style={s.courseStatText}>Par 72</Text>
                      </View>
                      <View style={s.courseStat}>
                        <Ionicons
                          name="analytics-outline"
                          size={13}
                          color={Colors.light.onSurfaceVariant}
                        />
                        <Text style={s.courseStatText}>7,100 yds</Text>
                      </View>
                    </View>

                    {f.description && (
                      <Text style={s.courseCardDesc} numberOfLines={2}>
                        {f.description}
                      </Text>
                    )}

                    <View style={s.courseCardActions}>
                      <View style={s.courseBookBtn}>
                        <Text style={s.courseBookBtnText}>Book Tee Time</Text>
                        <Ionicons
                          name="arrow-forward"
                          size={14}
                          color={Colors.light.primaryForeground}
                        />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}

              {/* Private Reserve Experience Card */}
              <View style={s.premiumCard}>
                <View style={s.premiumCardInner}>
                  <View style={s.premiumIconRow}>
                    <View style={s.premiumIconWrap}>
                      <Ionicons
                        name="diamond-outline"
                        size={18}
                        color={Colors.light.tertiaryFixed}
                      />
                    </View>
                    <Text style={s.premiumLabel}>EXCLUSIVE</Text>
                  </View>
                  <Text style={s.premiumTitle}>Private Reserve Experience</Text>
                  <Text style={s.premiumDesc}>
                    Priority 48-hour booking window, digital concierge, and
                    equipment valet service.
                  </Text>
                  <View style={s.premiumPerks}>
                    {[
                      "Digital Concierge",
                      "Equipment Valet",
                      "Priority Booking",
                    ].map((perk) => (
                      <View key={perk} style={s.premiumPerkRow}>
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={Colors.light.primary}
                        />
                        <Text style={s.premiumPerkText}>{perk}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ═══════════════════════════════════════════
  // Single-Page Booking — Calendar + Options + Slots
  // ═══════════════════════════════════════════
  if (view === "book") {
    return (
      <View style={s.container}>
        {/* Header */}
        <View style={s.flowHeader}>
          <TouchableOpacity
            onPress={() => {
              resetBookingFlow();
              setView("course");
            }}
            style={s.flowBackBtn}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={Colors.light.onSurfaceVariant}
            />
          </TouchableOpacity>
          <View style={s.flowHeaderText}>
            <Text style={s.flowHeaderLabel}>BOOK TEE TIME</Text>
            <Text style={s.flowHeaderTitle}>{selectedFacility?.name}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={s.timeScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Date Strip ── */}
          <View style={s.dateStripSection}>
            <Text style={s.serifSectionTitle}>Select Date</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.dateStripScroll}
            >
              {bookableDates.map((d) => {
                const isActive = selectedDate === d.dateString;
                return (
                  <TouchableOpacity
                    key={d.dateString}
                    onPress={() => handleDateSelect(d.dateString)}
                    style={[s.dateChip, isActive && s.dateChipActive]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[s.dateChipDay, isActive && s.dateChipDayActive]}
                    >
                      {d.dayName}
                    </Text>
                    <Text
                      style={[s.dateChipNum, isActive && s.dateChipNumActive]}
                    >
                      {d.dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ── Number of Players ── */}
          <View style={s.timeSection}>
            <Text style={s.serifSectionTitle}>Number of Players</Text>
            <View style={s.playerRow}>
              {[1, 2, 3, 4].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setPartySize(n)}
                  style={[
                    s.playerBtn,
                    partySize === n && s.playerBtnSelected,
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      s.playerBtnText,
                      partySize === n && s.playerBtnTextSelected,
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Transport ── */}
          <View style={s.timeSection}>
            <Text style={s.serifSectionTitle}>Transport</Text>
            <View style={s.transportRow}>
              {TRANSPORT_MODES.map((mode) => (
                <TouchableOpacity
                  key={mode.id}
                  onPress={() => setTransportMode(mode.id)}
                  style={[
                    s.transportBtn,
                    transportMode === mode.id && s.transportBtnSelected,
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={mode.icon}
                    size={22}
                    color={
                      transportMode === mode.id
                        ? Colors.light.primary
                        : Colors.light.onSurfaceVariant
                    }
                  />
                  <Text
                    style={[
                      s.transportLabel,
                      transportMode === mode.id && s.transportLabelSelected,
                    ]}
                  >
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Available Tee Times ── */}
          {selectedDate ? (
            <View style={s.timeSection}>
              <View style={s.timeSectionHeader}>
                <Text style={s.serifSectionTitle}>Available Times</Text>
                <Text style={s.slotCountLabel}>
                  {slots.length > 0
                    ? `${slots.filter((sl) => sl.is_available).length} Slots`
                    : ""}
                </Text>
              </View>

              {loadingSlots ? (
                <View style={s.slotLoading}>
                  <ActivityIndicator size="small" color={Colors.light.primary} />
                  <Text style={s.slotLoadingText}>Finding tee times...</Text>
                </View>
              ) : slots.length === 0 ? (
                <View style={s.slotEmpty}>
                  <Ionicons
                    name="time-outline"
                    size={24}
                    color={Colors.light.outlineVariant}
                  />
                  <Text style={s.slotEmptyText}>
                    No available times on this date
                  </Text>
                </View>
              ) : (
                <View style={s.slotList}>
                  {slots.map((slot) => {
                    const isSelected =
                      selectedTime?.start_time === slot.start_time;
                    const isJoining = joiningWaitlist === slot.start_time;
                    const isLeaving = leavingWaitlist === slot.start_time;
                    const category = getRateCategory(slot.start_time);

                    return (
                      <View key={slot.start_time}>
                        <TouchableOpacity
                          disabled={!slot.is_available}
                          onPress={() => setSelectedTime(slot)}
                          style={[
                            s.slotCard,
                            isSelected && s.slotCardSelected,
                            !slot.is_available && s.slotCardBooked,
                          ]}
                          activeOpacity={0.7}
                        >
                          {/* Brass accent bar (left edge) */}
                          {isSelected && <View style={s.slotAccentBar} />}

                          <View style={s.slotLeft}>
                            <Text
                              style={[
                                s.slotTime,
                                isSelected && s.slotTimeSelected,
                                !slot.is_available && s.slotTimeBooked,
                              ]}
                            >
                              {formatTime(slot.start_time)}
                            </Text>
                            <View style={s.slotMeta}>
                              <Text
                                style={[
                                  s.slotCategoryText,
                                  { color: category.labelColor },
                                ]}
                              >
                                {category.label}
                              </Text>
                              <View style={s.slotCapacity}>
                                <Ionicons
                                  name="people-outline"
                                  size={12}
                                  color={Colors.light.onSurfaceVariant}
                                />
                                <Text style={s.slotCapacityText}>
                                  {slot.is_available
                                    ? "Up to 4 players"
                                    : "Booked"}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Price (right side) */}
                          {slot.is_available && (
                            <View style={s.slotRight}>
                              <Text
                                style={[
                                  s.slotPrice,
                                  isSelected && s.slotPriceSelected,
                                ]}
                              >
                                ${category.price}
                              </Text>
                              <Text
                                style={[
                                  s.slotPriceLabel,
                                  isSelected && s.slotPriceLabelSelected,
                                ]}
                              >
                                per player
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>

                        {!slot.is_available && !slot.on_waitlist && (
                          <TouchableOpacity
                            style={s.waitlistBtn}
                            onPress={() => handleJoinWaitlist(slot)}
                            disabled={isJoining}
                            activeOpacity={0.7}
                          >
                            {isJoining ? (
                              <ActivityIndicator
                                size="small"
                                color={Colors.light.primary}
                              />
                            ) : (
                              <Text style={s.waitlistBtnText}>
                                Join Waitlist
                                {slot.waitlist_count
                                  ? ` (${slot.waitlist_count} ahead)`
                                  : ""}
                              </Text>
                            )}
                          </TouchableOpacity>
                        )}

                        {!slot.is_available && slot.on_waitlist && (
                          <TouchableOpacity
                            style={s.onWaitlistBtn}
                            onPress={() => handleLeaveWaitlist(slot)}
                            disabled={isLeaving}
                            activeOpacity={0.7}
                          >
                            {isLeaving ? (
                              <ActivityIndicator
                                size="small"
                                color="#92400e"
                              />
                            ) : (
                              <Text style={s.onWaitlistBtnText}>
                                On Waitlist
                                {slot.waitlist_count
                                  ? ` (#${slot.waitlist_count})`
                                  : ""}{" "}
                                — Tap to Leave
                              </Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ) : (
            <View style={s.timeSection}>
              <View style={s.selectDatePrompt}>
                <Ionicons
                  name="calendar-outline"
                  size={24}
                  color={Colors.light.outlineVariant}
                />
                <Text style={s.selectDatePromptText}>
                  Select a date above to see available tee times
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Sticky Confirm Bar — Total Estimate */}
        {selectedTime && (
          <View style={s.confirmBar}>
            <View style={s.confirmBarInfo}>
              <Text style={s.confirmBarLabel}>Total Estimate</Text>
              <View style={s.confirmBarPriceRow}>
                <Text style={s.confirmBarPrice}>
                  ${getRateCategory(selectedTime.start_time).price * partySize}.00
                </Text>
                <Text style={s.confirmBarPriceMeta}>
                  {" "}for {partySize} {partySize === 1 ? "player" : "players"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[s.confirmBtn, booking && { opacity: 0.5 }]}
              onPress={handleBook}
              disabled={booking}
              activeOpacity={0.8}
            >
              <Text style={s.confirmBtnText}>
                {booking ? "Booking..." : "Confirm Booking"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ═══════════════════════════════════════════
  // Edit Booking — Single Page with Date Strip
  // ═══════════════════════════════════════════
  if (view === "edit" && editingBooking) {
    return (
      <View style={s.container}>
        <View style={s.flowHeader}>
          <TouchableOpacity
            onPress={cancelEdit}
            style={s.flowBackBtn}
            activeOpacity={0.7}
          >
            <Ionicons
              name="close"
              size={20}
              color={Colors.light.onSurfaceVariant}
            />
          </TouchableOpacity>
          <View style={s.flowHeaderText}>
            <Text style={s.flowHeaderLabel}>MODIFY BOOKING</Text>
            <Text style={s.flowHeaderTitle}>
              {editingBooking.facility_name}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={s.timeScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Date Strip */}
          <View style={s.dateStripSection}>
            <Text style={s.timeSectionLabel}>Date</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.dateStripScroll}
            >
              {bookableDates.map((d) => {
                const isActive = editDate === d.dateString;
                return (
                  <TouchableOpacity
                    key={d.dateString}
                    onPress={() => handleEditDateSelect(d.dateString)}
                    style={[s.dateChip, isActive && s.dateChipActive]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[s.dateChipDay, isActive && s.dateChipDayActive]}
                    >
                      {d.dayName}
                    </Text>
                    <Text
                      style={[s.dateChipNum, isActive && s.dateChipNumActive]}
                    >
                      {d.dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Time Slots */}
          <View style={s.timeSection}>
            <Text style={s.serifSectionTitle}>Select New Time</Text>
            {loadingEditSlots ? (
              <View style={s.slotLoading}>
                <ActivityIndicator size="small" color={Colors.light.primary} />
                <Text style={s.slotLoadingText}>Loading times...</Text>
              </View>
            ) : editSlots.length === 0 ? (
              <View style={s.slotEmpty}>
                <Ionicons
                  name="time-outline"
                  size={24}
                  color={Colors.light.outlineVariant}
                />
                <Text style={s.slotEmptyText}>No times available</Text>
              </View>
            ) : (
              <View style={s.slotList}>
                {editSlots.map((slot) => {
                  const isCurrentSlot =
                    editingBooking.start_time === slot.start_time &&
                    editDate === editingBooking.date;
                  const available = slot.is_available || isCurrentSlot;
                  const isSelected = editTime === slot.start_time;
                  const category = getRateCategory(slot.start_time);

                  return (
                    <TouchableOpacity
                      key={slot.start_time}
                      disabled={!available}
                      onPress={() => setEditTime(slot.start_time)}
                      style={[
                        s.slotCard,
                        isSelected && s.slotCardSelected,
                        !available && s.slotCardBooked,
                      ]}
                      activeOpacity={0.7}
                    >
                      {isSelected && <View style={s.slotAccentBar} />}
                      <View style={s.slotLeft}>
                        <Text
                          style={[
                            s.slotTime,
                            isSelected && s.slotTimeSelected,
                            !available && s.slotTimeBooked,
                          ]}
                        >
                          {formatTime(slot.start_time)}
                        </Text>
                        <View style={s.slotMeta}>
                          <Text
                            style={[
                              s.slotCategoryText,
                              { color: category.labelColor },
                            ]}
                          >
                            {category.label}
                          </Text>
                          <View style={s.slotCapacity}>
                            <Ionicons
                              name="people-outline"
                              size={12}
                              color={Colors.light.onSurfaceVariant}
                            />
                            <Text style={s.slotCapacityText}>
                              {available ? "Up to 4 players" : "Booked"}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {available && (
                        <View style={s.slotRight}>
                          <Text style={[s.slotPrice, isSelected && s.slotPriceSelected]}>
                            ${category.price}
                          </Text>
                          <Text style={[s.slotPriceLabel, isSelected && s.slotPriceLabelSelected]}>
                            per player
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Party Size */}
          {editTime ? (
            <View style={s.timeSection}>
              <Text style={s.serifSectionTitle}>Party Size</Text>
              <View style={s.playerRow}>
                {[1, 2, 3, 4].map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setEditPartySize(n)}
                    style={[
                      s.playerBtn,
                      editPartySize === n && s.playerBtnSelected,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="person"
                      size={14}
                      color={
                        editPartySize === n
                          ? Colors.light.primaryForeground
                          : Colors.light.onSurfaceVariant
                      }
                    />
                    <Text
                      style={[
                        s.playerBtnText,
                        editPartySize === n && s.playerBtnTextSelected,
                      ]}
                    >
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>

        {/* Sticky Save Bar */}
        {editTime && (
          <View style={s.confirmBar}>
            <View style={s.confirmBarInfo}>
              <Text style={s.confirmBarLabel}>Total Estimate</Text>
              <View style={s.confirmBarPriceRow}>
                <Text style={s.confirmBarPrice}>
                  ${getRateCategory(editTime).price * editPartySize}.00
                </Text>
                <Text style={s.confirmBarPriceMeta}>
                  {" "}for {editPartySize} {editPartySize === 1 ? "player" : "players"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[s.confirmBtn, saving && { opacity: 0.5 }]}
              onPress={handleSaveEdit}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={s.confirmBtnText}>
                {saving ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ═══════════════════════════════════════════
  // Main List View — My Tee Times (Stitch design)
  // ═══════════════════════════════════════════
  const nextBooking = bookings.length > 0 ? bookings[0] : null;
  const upcomingBookings = bookings;

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
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
        {/* ── Hero Section ── */}
        <View style={s.heroSection}>
          <View style={s.heroLeft}>
            <Text style={s.heroLabel}>YOUR SCHEDULE</Text>
            <Text style={s.heroTitle}>
              Prepare for{"\n"}the Green.
            </Text>
          </View>
          {nextBooking && (
            <View style={s.heroNextCard}>
              <Text style={s.heroNextLabel}>Next Appearance</Text>
              <Text style={s.heroNextDate}>
                {formatDate(nextBooking.date)},{" "}
                {formatTime(nextBooking.start_time)}
              </Text>
              <View style={s.heroWeatherRow}>
                <Ionicons
                  name="sunny-outline"
                  size={14}
                  color={Colors.light.tertiary}
                />
                <Text style={s.heroWeatherText}>Clear Skies Expected</Text>
              </View>
            </View>
          )}
        </View>

        {loadingBookings ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
          </View>
        ) : bookings.length === 0 ? (
          <View style={s.emptyState}>
            <View style={s.emptyIconWrap}>
              <Ionicons
                name="golf-outline"
                size={32}
                color={Colors.light.outlineVariant}
              />
            </View>
            <Text style={s.emptyTitle}>No upcoming tee times</Text>
            <Text style={s.emptyDesc}>
              Book your next round to see it here.
            </Text>
          </View>
        ) : (
          <>
            {/* ── Upcoming Section ── */}
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Upcoming</Text>
              <Text style={s.sectionCount}>
                {upcomingBookings.length} Booking
                {upcomingBookings.length !== 1 ? "s" : ""} Found
              </Text>
            </View>

            <View style={s.bookingsList}>
              {upcomingBookings.map((b) => (
                <View key={b.id} style={s.bookingCard}>
                  {/* Course Image */}
                  <Image
                    source={{
                      uri: "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=600&h=300&fit=crop",
                    }}
                    style={s.bookingImage}
                  />
                  <View style={s.bookingBadge}>
                    <Text style={s.bookingBadgeText}>
                      {b.facility_name}
                    </Text>
                  </View>

                  {/* Card Body */}
                  <View style={s.bookingBody}>
                    <View style={s.bookingTopRow}>
                      <View>
                        <Text style={s.bookingDate}>
                          {formatDate(b.date)}
                        </Text>
                        <Text style={s.bookingMeta}>
                          {formatTime(b.start_time)} ·{" "}
                          {b.party_size}{" "}
                          {b.party_size === 1 ? "Player" : "Players"}
                        </Text>
                      </View>
                      <View style={s.bookingGroupIcon}>
                        <Ionicons
                          name={
                            b.party_size > 2
                              ? "people"
                              : "person"
                          }
                          size={20}
                          color={Colors.light.primary}
                        />
                      </View>
                    </View>

                    <View style={s.bookingActions}>
                      <TouchableOpacity
                        style={s.manageBtn}
                        onPress={() => startEdit(b)}
                        activeOpacity={0.8}
                      >
                        <Text style={s.manageBtnText}>Manage</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.calendarBtn}
                        onPress={() => handleCancel(b.id)}
                        disabled={cancellingId === b.id}
                        activeOpacity={0.7}
                      >
                        {cancellingId === b.id ? (
                          <ActivityIndicator
                            size="small"
                            color={Colors.light.destructive}
                          />
                        ) : (
                          <Ionicons
                            name="close-circle-outline"
                            size={18}
                            color={Colors.light.onSurfaceVariant}
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* ── History Section ── */}
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>History</Text>
              <Text style={s.sectionCount}>Your Legacy</Text>
            </View>

            <View style={s.historyList}>
              {/* Placeholder history items */}
              {[
                {
                  month: "Mar",
                  day: "15",
                  course: "The Championship Course",
                  detail: "18 Holes · Par 72",
                  score: "74",
                },
                {
                  month: "Mar",
                  day: "08",
                  course: "The Lakes North",
                  detail: "9 Holes · Sunset Round",
                  score: "38",
                },
                {
                  month: "Feb",
                  day: "28",
                  course: "The Championship Course",
                  detail: "18 Holes · Club Invitational",
                  score: "79",
                },
              ].map((h, i) => (
                <View key={i} style={s.historyItem}>
                  <View style={s.historyDateCircle}>
                    <Text style={s.historyMonth}>{h.month}</Text>
                    <Text style={s.historyDay}>{h.day}</Text>
                  </View>
                  <View style={s.historyInfo}>
                    <Text style={s.historyCourse}>{h.course}</Text>
                    <Text style={s.historyDetail}>{h.detail}</Text>
                  </View>
                  <View style={s.historyScoreWrap}>
                    <Text style={s.historyScoreLabel}>SCORE</Text>
                    <Text style={s.historyScore}>{h.score}</Text>
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={s.archiveLink}
              activeOpacity={0.7}
            >
              <Text style={s.archiveLinkText}>
                View Full Scoring Archive
              </Text>
              <Ionicons
                name="arrow-forward"
                size={12}
                color={Colors.light.primary}
              />
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Circular FAB — bottom right */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => setView("course")}
        activeOpacity={0.85}
      >
        <Ionicons
          name="add"
          size={28}
          color={Colors.light.primaryForeground}
        />
      </TouchableOpacity>
    </View>
  );
}

// ═══════════════════════════════════════════
// Styles — Tonal surface layering, no 1px borders
// ═══════════════════════════════════════════
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },

  // ── Shared ──
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.onSurfaceVariant,
  },

  // ── Course Selection Hero ──
  courseScrollContent: {
    paddingBottom: 32,
  },
  courseHero: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 16 : 12,
    paddingBottom: 28,
  },
  heroBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  courseHeroLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    color: Colors.light.onSurfaceVariant,
    marginBottom: 4,
  },
  courseHeroTitle: {
    fontSize: 34,
    fontWeight: "700",
    color: Colors.light.foreground,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    marginBottom: 8,
  },
  courseHeroDesc: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.light.onSurfaceVariant,
    maxWidth: 320,
  },

  // ── Course Cards ──
  courseCards: {
    paddingHorizontal: 24,
    gap: 16,
  },
  courseCard: {
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  courseCardImage: {
    width: "100%",
    height: 180,
    backgroundColor: Colors.light.surfaceContainerHigh,
  },
  featuredBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: Colors.light.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: Colors.light.primaryForeground,
  },
  courseCardContent: {
    padding: 20,
    gap: 10,
  },
  courseCardName: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.light.foreground,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  courseStatsRow: {
    flexDirection: "row",
    gap: 16,
  },
  courseStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  courseStatText: {
    fontSize: 12,
    color: Colors.light.onSurfaceVariant,
    fontWeight: "500",
  },
  courseCardDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.light.onSurfaceVariant,
  },
  courseCardActions: {
    marginTop: 4,
  },
  courseBookBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.light.primary,
    paddingVertical: 12,
    borderRadius: 14,
  },
  courseBookBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.primaryForeground,
  },

  // ── Premium Card ──
  premiumCard: {
    backgroundColor: Colors.light.primaryContainer,
    borderRadius: 24,
    overflow: "hidden",
  },
  premiumCardInner: {
    padding: 24,
    gap: 10,
  },
  premiumIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  premiumIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,222,165,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: Colors.light.tertiaryFixed,
  },
  premiumTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.primaryForeground,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  premiumDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.75)",
  },
  premiumPerks: {
    marginTop: 4,
    gap: 8,
  },
  premiumPerkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  premiumPerkText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.light.primaryForeground,
  },

  // ── Flow Header ──
  flowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 16 : 12,
    paddingBottom: 16,
  },
  flowBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  flowHeaderText: {
    flex: 1,
    gap: 2,
  },
  flowHeaderLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.5,
    color: Colors.light.onSurfaceVariant,
  },
  flowHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.foreground,
  },

  // ── Date Strip ──
  dateStripSection: {
    marginBottom: 24,
  },
  dateStripScroll: {
    paddingHorizontal: 24,
    gap: 8,
  },
  dateChip: {
    width: 64,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceContainerLowest,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  dateChipActive: {
    backgroundColor: Colors.light.primary,
    shadowColor: Colors.light.primary,
    shadowOpacity: 0.3,
    elevation: 4,
  },
  dateChipDay: {
    fontSize: 10,
    fontWeight: "500",
    color: Colors.light.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  dateChipDayActive: {
    color: "rgba(255,255,255,0.8)",
  },
  dateChipNum: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.foreground,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  dateChipNumActive: {
    color: Colors.light.primaryForeground,
  },
  serifSectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.light.primary,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  timeSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  slotCountLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    color: Colors.light.onSurfaceVariant,
    textTransform: "uppercase",
    paddingRight: 24,
  },
  timeSectionDate: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.primary,
  },
  slotLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 32,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  slotLoadingText: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
  },
  slotEmpty: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 32,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  slotEmptyText: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
  },
  selectDatePrompt: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 32,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  selectDatePromptText: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
    textAlign: "center",
    maxWidth: 200,
  },

  // ── Time Selection ──
  timeScrollContent: {
    paddingBottom: 120,
  },
  timeSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  timeSectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    color: Colors.light.onSurfaceVariant,
    marginBottom: 12,
    textTransform: "uppercase",
  },

  // Player buttons
  playerRow: {
    flexDirection: "row",
    gap: 10,
  },
  playerBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: "transparent",
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  playerBtnSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
    shadowColor: Colors.light.primary,
    shadowOpacity: 0.2,
    elevation: 3,
  },
  playerBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.foreground,
  },
  playerBtnTextSelected: {
    color: Colors.light.primaryForeground,
  },

  // Transport buttons
  transportRow: {
    flexDirection: "row",
    gap: 8,
  },
  transportBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: "transparent",
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  transportBtnSelected: {
    borderWidth: 2,
    borderColor: Colors.light.primary,
  },
  transportLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.onSurfaceVariant,
  },
  transportLabelSelected: {
    color: Colors.light.primary,
  },

  // Slot cards
  slotList: {
    gap: 8,
  },
  slotCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 1,
    overflow: "hidden",
  },
  slotCardSelected: {
    backgroundColor: Colors.light.secondaryContainer,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  slotCardBooked: {
    backgroundColor: Colors.light.surfaceContainerLow,
    opacity: 0.6,
  },
  slotAccentBar: {
    position: "absolute",
    left: 0,
    top: "25%",
    bottom: "25%",
    width: 3,
    backgroundColor: Colors.light.tertiary,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  slotLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },
  slotTime: {
    fontSize: 26,
    fontWeight: "700",
    color: Colors.light.primary,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    minWidth: 85,
  },
  slotTimeSelected: {
    color: Colors.light.primary,
  },
  slotTimeBooked: {
    color: Colors.light.onSurfaceVariant,
    opacity: 0.5,
  },
  slotMeta: {
    gap: 4,
  },
  slotCategoryText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  slotCapacity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  slotCapacityText: {
    fontSize: 12,
    color: Colors.light.onSurfaceVariant,
  },
  slotRight: {
    alignItems: "flex-end",
  },
  slotPrice: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.light.primary,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  slotPriceSelected: {
    color: Colors.light.primary,
  },
  slotPriceLabel: {
    fontSize: 10,
    color: Colors.light.onSurfaceVariant,
  },
  slotPriceLabelSelected: {
    color: Colors.light.onSurfaceVariant,
  },
  slotBookedText: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.light.onSurfaceVariant,
  },

  // Waitlist
  waitlistBtn: {
    marginTop: 4,
    marginLeft: 16,
    marginRight: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceContainerHigh,
    alignItems: "center",
  },
  waitlistBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.light.primary,
  },
  onWaitlistBtn: {
    marginTop: 4,
    marginLeft: 16,
    marginRight: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#fffbeb",
    alignItems: "center",
  },
  onWaitlistBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400e",
  },

  // ── Sticky Confirm Bar ──
  confirmBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.light.surfaceContainerLowest,
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 8,
  },
  confirmBarInfo: {
    gap: 2,
  },
  confirmBarLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: Colors.light.onSurfaceVariant,
  },
  confirmBarPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  confirmBarPrice: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.light.primary,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  confirmBarPriceMeta: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
  },
  confirmBtn: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.primaryForeground,
  },

  // ── Save Edit ──
  saveEditBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 16,
    alignItems: "center",
  },
  saveEditBtnText: {
    color: Colors.light.primaryForeground,
    fontSize: 14,
    fontWeight: "700",
  },

  // ── List View ──
  listContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },

  // ── Hero Section ──
  heroSection: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 8 : 4,
    paddingBottom: 32,
    gap: 20,
  },
  heroLeft: {},
  heroLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
    color: Colors.light.onSurfaceVariant,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 38,
    fontWeight: "700",
    color: Colors.light.primary,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    lineHeight: 46,
  },
  heroNextCard: {
    backgroundColor: Colors.light.surfaceContainerLowest,
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.tertiary,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 2,
  },
  heroNextLabel: {
    fontSize: 12,
    color: Colors.light.onSurfaceVariant,
    marginBottom: 4,
  },
  heroNextDate: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.primary,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    marginBottom: 12,
  },
  heroWeatherRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroWeatherText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: Colors.light.tertiary,
    textTransform: "uppercase",
  },

  // ── Section Headers ──
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 24,
    marginBottom: 20,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.light.primary,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  sectionCount: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.5,
    color: Colors.light.onSurfaceVariant,
    textTransform: "uppercase",
  },

  // ── Upcoming Booking Cards ──
  bookingsList: {
    paddingHorizontal: 24,
    gap: 20,
    marginBottom: 40,
  },
  bookingCard: {
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 2,
  },
  bookingImage: {
    width: "100%",
    height: 160,
  },
  bookingBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  bookingBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: Colors.light.primaryForeground,
    textTransform: "uppercase",
  },
  bookingBody: {
    padding: 20,
    gap: 16,
  },
  bookingTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  bookingDate: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.light.primary,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    marginBottom: 4,
  },
  bookingMeta: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
  },
  bookingGroupIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  bookingActions: {
    flexDirection: "row",
    gap: 10,
  },
  manageBtn: {
    flex: 1,
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  manageBtnText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: Colors.light.primaryForeground,
    textTransform: "uppercase",
  },
  calendarBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── History Section ──
  historyList: {
    paddingHorizontal: 24,
    gap: 10,
    marginBottom: 24,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    backgroundColor: Colors.light.surfaceContainerLow,
    borderRadius: 16,
  },
  historyDateCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.light.outlineVariant + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  historyMonth: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: Colors.light.onSurfaceVariant,
    textTransform: "uppercase",
  },
  historyDay: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.primary,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  historyInfo: {
    flex: 1,
    gap: 2,
  },
  historyCourse: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.primary,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  historyDetail: {
    fontSize: 12,
    color: Colors.light.onSurfaceVariant,
  },
  historyScoreWrap: {
    alignItems: "flex-end",
  },
  historyScoreLabel: {
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 1.5,
    color: Colors.light.onSurfaceVariant,
  },
  historyScore: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.tertiary,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  archiveLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16,
  },
  archiveLinkText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.5,
    color: Colors.light.primary,
    textTransform: "uppercase",
  },

  // ── Empty state ──
  emptyState: {
    alignItems: "center",
    paddingTop: 40,
    gap: 8,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
  },

  // ── Circular FAB ──
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },

  // ── Upgrade Prompt ──
  upgradeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  upgradeIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#fffbeb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  upgradeTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.foreground,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  upgradeText: {
    fontSize: 14,
    color: Colors.light.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 280,
  },
  upgradeButton: {
    marginTop: 8,
    backgroundColor: Colors.light.primaryContainer,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.primaryForeground,
  },
});
