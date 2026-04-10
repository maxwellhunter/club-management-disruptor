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
  TextInput,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { haptics } from "@/lib/haptics";
import { addDiningToCalendar } from "@/lib/calendar";
import { trackPositiveAction } from "@/lib/store-review";

const API_URL =
  process.env.EXPO_PUBLIC_APP_URL || "http://localhost:3000";

const TAX_RATE = 0.08;
const SERVICE_CHARGE_RATE = 0.18;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Placeholder venue data matching Stitch designs ───
const VENUE_IMAGERY: Record<string, { tagline: string; cuisine: string; hours: string; icon: keyof typeof Ionicons.glyphMap }> = {
  "The Conservatory": {
    tagline: "Modern European, farm-to-table",
    cuisine: "Fine Dining",
    hours: "Dinner 18:00–22:30",
    icon: "leaf-outline",
  },
  "The Terrace": {
    tagline: "Al fresco dining with panoramic views",
    cuisine: "Mediterranean",
    hours: "Lunch & Cocktails until 21:00",
    icon: "sunny-outline",
  },
  "Clubhouse Grill": {
    tagline: "Artisanal burgers, premium steaks",
    cuisine: "Casual Elite",
    hours: "Open Now",
    icon: "flame-outline",
  },
  "The Vintner's Cellar": {
    tagline: "Exclusive tastings & private sessions",
    cuisine: "Wine Bar",
    hours: "Members Only",
    icon: "wine-outline",
  },
  "The Blue Lounge": {
    tagline: "Signature cocktails & live music",
    cuisine: "Cocktail Lounge",
    hours: "Live Jazz Tonight",
    icon: "musical-notes-outline",
  },
};

function getVenueInfo(name: string) {
  return (
    VENUE_IMAGERY[name] ?? {
      tagline: "Fine dining experience",
      cuisine: "Restaurant",
      hours: "Open Today",
      icon: "restaurant-outline" as keyof typeof Ionicons.glyphMap,
    }
  );
}

interface Facility {
  id: string;
  name: string;
  type: string;
  description: string | null;
}

interface DiningSlot {
  start_time: string;
  end_time: string;
  is_available: boolean;
  bookings_remaining: number;
}

interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  items: MenuItem[];
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
}

interface CartItem {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  special_instructions: string;
}

interface BookingWithDetails {
  id: string;
  facility_name: string;
  facility_type: string;
  date: string;
  start_time: string;
  party_size: number;
  status: string;
}

interface OrderWithItems {
  id: string;
  facility_name: string;
  status: string;
  total: number;
  items: { id: string; name: string; quantity: number; price: number }[];
}

type ScreenView = "home" | "venue" | "date" | "time" | "menu" | "cart";

export default function DiningScreen() {
  const { session } = useAuth();
  const [view, setView] = useState<ScreenView>("home");
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loadingHome, setLoadingHome] = useState(true);

  // Booking flow
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loadingFacilities, setLoadingFacilities] = useState(true);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<DiningSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<DiningSlot | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [specialRequests, setSpecialRequests] = useState("");
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [seatingPreference, setSeatingPreference] = useState<string>("any");

  // Menu + ordering flow
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [serviceMode, setServiceMode] = useState<"table" | "pickup">("table");

  // Cancel state
  const [cancellingBooking, setCancellingBooking] = useState<string | null>(
    null
  );
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);

  // Flow mode: "reserve" or "order"
  const [flowMode, setFlowMode] = useState<"reserve" | "order">("reserve");

  const getHeaders = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      h["Authorization"] = `Bearer ${session.access_token}`;
    }
    return h;
  }, [session?.access_token]);

  // === Data fetching ===

  const fetchHomeData = useCallback(async () => {
    const headers = getHeaders();
    console.log("[Dining] fetchHomeData called, token?", !!headers.Authorization, "API_URL:", API_URL);
    try {
      const [bookingsRes, ordersRes] = await Promise.all([
        fetch(`${API_URL}/api/bookings/my`, { headers }),
        fetch(`${API_URL}/api/dining/orders/my`, { headers }),
      ]);
      console.log("[Dining] bookingsRes:", bookingsRes.status, "ordersRes:", ordersRes.status);

      if (bookingsRes.ok) {
        const data = await bookingsRes.json();
        setBookings(
          (data.bookings ?? []).filter(
            (b: BookingWithDetails) => b.facility_type === "dining"
          )
        );
      }

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.orders ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch dining data:", err);
    } finally {
      setLoadingHome(false);
      setRefreshing(false);
    }
  }, [getHeaders]);

  const fetchFacilities = useCallback(async () => {
    const headers = getHeaders();
    console.log("[Dining] fetchFacilities called, token?", !!headers.Authorization);
    try {
      const res = await fetch(`${API_URL}/api/facilities?type=dining`, {
        headers,
      });
      console.log("[Dining] facilities status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("[Dining] facilities count:", data.facilities?.length);
        setFacilities(data.facilities ?? []);
      }
    } catch (err) {
      console.error("[Dining] fetchFacilities error:", err);
    } finally {
      setLoadingFacilities(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchHomeData();
    fetchFacilities();
  }, [fetchHomeData, fetchFacilities]);

  async function fetchSlots(facilityId: string, date: string) {
    const headers = getHeaders();
    setLoadingSlots(true);
    setSelectedTime(null);
    try {
      const res = await fetch(
        `${API_URL}/api/dining/availability?facility_id=${facilityId}&date=${date}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSlots(false);
    }
  }

  async function fetchMenu(facilityId: string) {
    const headers = getHeaders();
    setLoadingMenu(true);
    try {
      const res = await fetch(
        `${API_URL}/api/dining/menu?facility_id=${facilityId}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories ?? []);
        if (data.categories?.length > 0) {
          setSelectedCategoryId(data.categories[0].id);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingMenu(false);
    }
  }

  // === Actions ===

  async function handleBookReservation() {
    if (!selectedFacility || !selectedDate || !selectedTime) return;
    const headers = getHeaders();
    setBookingInProgress(true);
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
        trackPositiveAction();
        Alert.alert("Reserved!", "Your dining reservation has been confirmed.", [
          {
            text: "Add to Calendar",
            onPress: () =>
              addDiningToCalendar({
                venueName: selectedFacility.name,
                date: selectedDate,
                time: selectedTime.start_time,
                partySize,
              }),
          },
          { text: "Done" },
        ]);
        resetFlow();
        setView("home");
        fetchHomeData();
      } else {
        haptics.error();
        const data = await res.json();
        Alert.alert("Error", data.error || "Failed to book reservation");
      }
    } catch {
      haptics.error();
      Alert.alert("Error", "Failed to book reservation");
    } finally {
      setBookingInProgress(false);
    }
  }

  async function handlePlaceOrder() {
    if (!selectedFacility || cart.length === 0) return;
    const headers = getHeaders();
    setPlacingOrder(true);
    try {
      const res = await fetch(`${API_URL}/api/dining/orders`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          facility_id: selectedFacility.id,
          table_number: tableNumber || undefined,
          notes: orderNotes || undefined,
          items: cart.map((c) => ({
            menu_item_id: c.menu_item_id,
            quantity: c.quantity,
            special_instructions: c.special_instructions || undefined,
          })),
        }),
      });

      if (res.ok) {
        haptics.success();
        trackPositiveAction();
        Alert.alert(
          "Order Placed!",
          "Your order has been submitted and charged to your member account."
        );
        resetFlow();
        setView("home");
        fetchHomeData();
      } else {
        haptics.error();
        const data = await res.json();
        Alert.alert("Error", data.error || "Failed to place order");
      }
    } catch {
      haptics.error();
      Alert.alert("Error", "Failed to place order");
    } finally {
      setPlacingOrder(false);
    }
  }

  function handleCancelBooking(bookingId: string) {
    Alert.alert("Cancel Reservation", "Are you sure?", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel Reservation",
        style: "destructive",
        onPress: async () => {
          const headers = getHeaders();
          setCancellingBooking(bookingId);
          try {
            const res = await fetch(
              `${API_URL}/api/bookings/${bookingId}/cancel`,
              { method: "PATCH", headers }
            );
            if (res.ok) {
              setBookings((prev) => prev.filter((b) => b.id !== bookingId));
            }
          } catch {
            // ignore
          } finally {
            setCancellingBooking(null);
          }
        },
      },
    ]);
  }

  function handleCancelOrder(orderId: string) {
    Alert.alert("Cancel Order", "Are you sure?", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel Order",
        style: "destructive",
        onPress: async () => {
          const headers = getHeaders();
          setCancellingOrder(orderId);
          try {
            const res = await fetch(
              `${API_URL}/api/dining/orders/${orderId}/cancel`,
              { method: "PATCH", headers }
            );
            if (res.ok) {
              setOrders((prev) => prev.filter((o) => o.id !== orderId));
            }
          } catch {
            // ignore
          } finally {
            setCancellingOrder(null);
          }
        },
      },
    ]);
  }

  function resetFlow() {
    setSelectedFacility(null);
    setSelectedDate("");
    setSelectedTime(null);
    setSlots([]);
    setPartySize(2);
    setCategories([]);
    setSelectedCategoryId(null);
    setCart([]);
    setTableNumber("");
    setOrderNotes("");
    setSpecialRequests("");
    setDietaryNotes("");
    setSeatingPreference("any");
    setServiceMode("table");
  }

  // === Cart helpers ===

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item_id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menu_item_id === item.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          special_instructions: "",
        },
      ];
    });
  }

  function updateQuantity(menuItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menu_item_id === menuItemId
            ? { ...c, quantity: c.quantity + delta }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  }

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const serviceCharge = Math.round(subtotal * SERVICE_CHARGE_RATE * 100) / 100;
  const total = Math.round((subtotal + tax + serviceCharge) * 100) / 100;
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  // === Formatters ===

  function formatTime(timeStr: string) {
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${display}:${m} ${ampm}`;
  }

  function formatTime24(timeStr: string) {
    return timeStr.substring(0, 5);
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function formatDateLong(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatPrice(price: number) {
    return `$${Number(price).toFixed(2)}`;
  }

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

  function groupSlots(slotsArr: DiningSlot[]) {
    const groups: Record<string, DiningSlot[]> = {};
    for (const slot of slotsArr) {
      const hour = parseInt(slot.start_time.split(":")[0]);
      const label = hour < 15 ? "Lunch" : "Dinner";
      if (!groups[label]) groups[label] = [];
      groups[label].push(slot);
    }
    return groups;
  }

  const statusColors: Record<string, { bg: string; text: string }> = {
    pending: { bg: "#fef9c3", text: "#a16207" },
    confirmed: { bg: Colors.light.accent, text: Colors.light.primary },
    preparing: { bg: Colors.light.tertiaryFixed, text: Colors.light.tertiary },
    ready: { bg: "#dcfce7", text: "#15803d" },
  };

  const seatingOptions = [
    { key: "any", label: "No Preference" },
    { key: "terrace", label: "Private Terrace" },
    { key: "window", label: "Window Seat" },
    { key: "bar", label: "Bar Seating" },
  ];

  // ═════════════════════════════════════════════════════
  // VENUE SELECTION — Restaurant Selection (Stitch)
  // ═════════════════════════════════════════════════════
  if (view === "venue") {
    return (
      <View style={s.container}>
        {/* Header */}
        <View style={s.luxHeader}>
          <TouchableOpacity
            onPress={() => {
              resetFlow();
              setView("home");
            }}
            style={s.backBtn}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={Colors.light.primary}
            />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.luxHeaderSerif}>The Lakes</Text>
            <Text style={s.luxHeaderSub}>
              {flowMode === "reserve"
                ? "Select a venue to reserve"
                : "Select a restaurant to order"}
            </Text>
          </View>
        </View>

        {loadingFacilities ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
          </View>
        ) : facilities.length === 0 ? (
          <View style={s.centered}>
            <Ionicons
              name="restaurant-outline"
              size={48}
              color={Colors.light.mutedForeground}
            />
            <Text style={s.emptyTitle}>No dining venues available</Text>
            <Text style={s.emptyText}>
              Check back soon for new dining experiences.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.venueList}
            showsVerticalScrollIndicator={false}
          >
            {facilities.map((f) => {
              const info = getVenueInfo(f.name);
              return (
                <TouchableOpacity
                  key={f.id}
                  style={s.venueCard}
                  onPress={() => {
                    setSelectedFacility(f);
                    if (flowMode === "reserve") {
                      setView("date");
                    } else {
                      fetchMenu(f.id);
                      setView("menu");
                    }
                  }}
                  activeOpacity={0.85}
                >
                  {/* Venue image placeholder with gradient */}
                  <View style={s.venueImageWrap}>
                    <LinearGradient
                      colors={["#1b4332", "#012d1d"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.venueImagePlaceholder}
                    >
                      <Ionicons
                        name={info.icon}
                        size={40}
                        color="rgba(255,255,255,0.3)"
                      />
                    </LinearGradient>
                    {/* Cuisine badge */}
                    <View style={s.cuisineBadge}>
                      <Text style={s.cuisineBadgeText}>{info.cuisine}</Text>
                    </View>
                  </View>

                  <View style={s.venueCardBody}>
                    <Text style={s.venueCardName}>{f.name}</Text>
                    <Text style={s.venueCardTagline}>
                      {f.description || info.tagline}
                    </Text>

                    <View style={s.venueMetaRow}>
                      <View style={s.venueMetaItem}>
                        <Ionicons
                          name="time-outline"
                          size={13}
                          color={Colors.light.onSurfaceVariant}
                        />
                        <Text style={s.venueMetaText}>{info.hours}</Text>
                      </View>
                    </View>

                    <View style={s.venueActions}>
                      {flowMode === "reserve" ? (
                        <View style={s.venueCtaBtn}>
                          <Ionicons
                            name="calendar-outline"
                            size={14}
                            color={Colors.light.primaryForeground}
                          />
                          <Text style={s.venueCtaText}>Reserve a Table</Text>
                        </View>
                      ) : (
                        <View style={s.venueCtaBtn}>
                          <Ionicons
                            name="restaurant-outline"
                            size={14}
                            color={Colors.light.primaryForeground}
                          />
                          <Text style={s.venueCtaText}>View Menu</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  }

  // ═════════════════════════════════════════════════════
  // DATE SELECTION — Part of Reserve a Table (Stitch)
  // ═════════════════════════════════════════════════════
  if (view === "date") {
    return (
      <View style={s.container}>
        <View style={s.luxHeader}>
          <TouchableOpacity onPress={() => setView("venue")} style={s.backBtn}>
            <Ionicons
              name="chevron-back"
              size={20}
              color={Colors.light.primary}
            />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.luxHeaderSerif}>{selectedFacility?.name}</Text>
            <Text style={s.luxHeaderSub}>Select your preferred date</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.sectionBlock}>
            <View style={s.sectionLabelRow}>
              <Ionicons
                name="calendar-outline"
                size={16}
                color={Colors.light.onSurfaceVariant}
              />
              <Text style={s.sectionLabel}>Date</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.dateStrip}
            >
              {dates.map((d) => {
                const isSelected = d.value === selectedDate;
                return (
                  <TouchableOpacity
                    key={d.value}
                    style={[s.dateCard, isSelected && s.dateCardSelected]}
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
                        s.dateDayName,
                        isSelected && s.dateTextSelected,
                      ]}
                    >
                      {d.dayName}
                    </Text>
                    <Text
                      style={[
                        s.dateDayNum,
                        isSelected && s.dateTextSelected,
                      ]}
                    >
                      {d.dayNum}
                    </Text>
                    <Text
                      style={[
                        s.dateMonth,
                        isSelected && s.dateTextSelected,
                      ]}
                    >
                      {d.month}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ═════════════════════════════════════════════════════
  // TIME + PARTY SIZE + CONFIRM — Reserve a Table (Stitch)
  // ═════════════════════════════════════════════════════
  if (view === "time") {
    const grouped = groupSlots(slots);
    return (
      <View style={s.container}>
        <View style={s.luxHeader}>
          <TouchableOpacity
            onPress={() => {
              setView("date");
              setSelectedTime(null);
              setSlots([]);
            }}
            style={s.backBtn}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={Colors.light.primary}
            />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.luxHeaderSerif}>{selectedFacility?.name}</Text>
            <Text style={s.luxHeaderSub}>{formatDateLong(selectedDate)}</Text>
          </View>
        </View>

        {loadingSlots ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 140 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Party Size */}
            <View style={s.sectionBlock}>
              <View style={s.sectionLabelRow}>
                <Ionicons
                  name="people-outline"
                  size={16}
                  color={Colors.light.onSurfaceVariant}
                />
                <Text style={s.sectionLabel}>Number of Guests</Text>
              </View>
              <View style={s.partySizeRow}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setPartySize(n)}
                    style={[
                      s.partySizeBtn,
                      partySize === n && s.partySizeBtnSelected,
                    ]}
                  >
                    <Text
                      style={[
                        s.partySizeText,
                        partySize === n && s.partySizeTextSelected,
                      ]}
                    >
                      {n === 6 ? "6+" : n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Time slots */}
            {Object.entries(grouped).map(([period, periodSlots]) => (
              <View key={period} style={s.sectionBlock}>
                <View style={s.sectionLabelRow}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={Colors.light.onSurfaceVariant}
                  />
                  <Text style={s.sectionLabel}>{period} Service</Text>
                </View>
                <View style={s.timeGrid}>
                  {periodSlots.map((slot) => {
                    const isSelected =
                      selectedTime?.start_time === slot.start_time;
                    return (
                      <TouchableOpacity
                        key={slot.start_time}
                        disabled={!slot.is_available}
                        onPress={() => setSelectedTime(slot)}
                        style={[
                          s.timeChip,
                          isSelected && s.timeChipSelected,
                          !slot.is_available && s.timeChipDisabled,
                        ]}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            s.timeChipText,
                            isSelected && s.timeChipTextSelected,
                            !slot.is_available && s.timeChipTextDisabled,
                          ]}
                        >
                          {formatTime24(slot.start_time)}
                        </Text>
                        {slot.is_available && (
                          <Text
                            style={[
                              s.timeChipSub,
                              isSelected && s.timeChipTextSelected,
                            ]}
                          >
                            {slot.bookings_remaining} left
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* Seating Preference */}
            <View style={s.sectionBlock}>
              <View style={s.sectionLabelRow}>
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={Colors.light.onSurfaceVariant}
                />
                <Text style={s.sectionLabel}>Seating Preference</Text>
              </View>
              <View style={s.seatingRow}>
                {seatingOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setSeatingPreference(opt.key)}
                    style={[
                      s.seatingChip,
                      seatingPreference === opt.key && s.seatingChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        s.seatingChipText,
                        seatingPreference === opt.key &&
                          s.seatingChipTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Special Requests */}
            <View style={s.sectionBlock}>
              <View style={s.sectionLabelRow}>
                <Ionicons
                  name="chatbubble-outline"
                  size={16}
                  color={Colors.light.onSurfaceVariant}
                />
                <Text style={s.sectionLabel}>Special Requests</Text>
              </View>
              <TextInput
                style={s.luxInput}
                value={specialRequests}
                onChangeText={setSpecialRequests}
                placeholder="Window seat, Anniversary, Birthday..."
                placeholderTextColor={Colors.light.mutedForeground}
                multiline
              />
              <TextInput
                style={[s.luxInput, { marginTop: 10 }]}
                value={dietaryNotes}
                onChangeText={setDietaryNotes}
                placeholder="Dietary Requirements & Allergy Info"
                placeholderTextColor={Colors.light.mutedForeground}
                multiline
              />
            </View>
          </ScrollView>
        )}

        {/* Sticky confirm footer */}
        {selectedTime && (
          <View style={s.stickyFooter}>
            <TouchableOpacity
              style={[s.primaryBtn, bookingInProgress && { opacity: 0.5 }]}
              onPress={handleBookReservation}
              disabled={bookingInProgress}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[Colors.light.primary, Colors.light.primaryContainer]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.primaryBtnGradient}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={Colors.light.primaryForeground}
                />
                <Text style={s.primaryBtnText}>
                  {bookingInProgress
                    ? "Reserving..."
                    : "Confirm Reservation"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={s.policyNote}>
              By confirming, you agree to our 24-hour cancellation policy
            </Text>
          </View>
        )}
      </View>
    );
  }

  // ═════════════════════════════════════════════════════
  // MENU BROWSING — Menu & Ordering (Stitch)
  // ═════════════════════════════════════════════════════
  if (view === "menu") {
    const activeCategory = categories.find((c) => c.id === selectedCategoryId);
    return (
      <View style={s.container}>
        {/* Header with venue name */}
        <View style={s.luxHeader}>
          <TouchableOpacity
            onPress={() => {
              setView("venue");
              setCategories([]);
              setCart([]);
            }}
            style={s.backBtn}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={Colors.light.primary}
            />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.luxHeaderSerif}>{selectedFacility?.name}</Text>
            <Text style={s.luxHeaderSub}>
              {getVenueInfo(selectedFacility?.name ?? "").tagline}
            </Text>
          </View>
          {cartCount > 0 && (
            <TouchableOpacity
              onPress={() => setView("cart")}
              style={s.cartBadge}
            >
              <Ionicons
                name="basket-outline"
                size={16}
                color={Colors.light.primaryForeground}
              />
              <Text style={s.cartBadgeText}>{cartCount}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Service mode toggle */}
        <View style={s.serviceToggleWrap}>
          <TouchableOpacity
            style={[
              s.serviceToggleBtn,
              serviceMode === "table" && s.serviceToggleBtnActive,
            ]}
            onPress={() => setServiceMode("table")}
          >
            <Text
              style={[
                s.serviceToggleText,
                serviceMode === "table" && s.serviceToggleTextActive,
              ]}
            >
              Table Service
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              s.serviceToggleBtn,
              serviceMode === "pickup" && s.serviceToggleBtnActive,
            ]}
            onPress={() => setServiceMode("pickup")}
          >
            <Text
              style={[
                s.serviceToggleText,
                serviceMode === "pickup" && s.serviceToggleTextActive,
              ]}
            >
              Pickup
            </Text>
          </TouchableOpacity>
        </View>

        {loadingMenu ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
          </View>
        ) : categories.length === 0 ? (
          <View style={s.centered}>
            <Ionicons
              name="book-outline"
              size={48}
              color={Colors.light.mutedForeground}
            />
            <Text style={s.emptyTitle}>No menu items available</Text>
          </View>
        ) : (
          <>
            {/* Menu heading above category pills */}
            <Text style={s.menuHeading}>Browse the Menu</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.categoryStrip}
              style={{ flexShrink: 0, flexGrow: 0 }}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategoryId(cat.id)}
                  style={[
                    s.categoryChip,
                    selectedCategoryId === cat.id && s.categoryChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      s.categoryChipText,
                      selectedCategoryId === cat.id &&
                        s.categoryChipTextSelected,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Menu items */}
            <ScrollView
              contentContainerStyle={{
                paddingBottom: cartCount > 0 ? 100 : 16,
              }}
              showsVerticalScrollIndicator={false}
            >
              {activeCategory?.items.map((item) => {
                const inCart = cart.find((c) => c.menu_item_id === item.id);
                return (
                  <View key={item.id} style={s.menuCard}>
                    {/* Food image placeholder */}
                    <View style={s.menuCardImageWrap}>
                      <LinearGradient
                        colors={["#2e3131", "#191c1c"]}
                        style={s.menuCardImage}
                      >
                        <Ionicons
                          name="restaurant-outline"
                          size={20}
                          color="rgba(255,255,255,0.2)"
                        />
                      </LinearGradient>
                    </View>

                    <View style={s.menuCardBody}>
                      <View style={s.menuCardHeader}>
                        <Text style={s.menuCardName}>{item.name}</Text>
                        <Text style={s.menuCardPrice}>
                          {formatPrice(item.price)}
                        </Text>
                      </View>
                      {item.description && (
                        <Text style={s.menuCardDesc} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}

                      <View style={s.menuCardFooter}>
                        {inCart ? (
                          <View style={s.qtyRow}>
                            <TouchableOpacity
                              onPress={() => updateQuantity(item.id, -1)}
                              style={s.qtyBtn}
                            >
                              <Ionicons
                                name="remove"
                                size={14}
                                color={Colors.light.primary}
                              />
                            </TouchableOpacity>
                            <Text style={s.qtyText}>{inCart.quantity}</Text>
                            <TouchableOpacity
                              onPress={() => updateQuantity(item.id, 1)}
                              style={s.qtyBtn}
                            >
                              <Ionicons
                                name="add"
                                size={14}
                                color={Colors.light.primary}
                              />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => addToCart(item)}
                            style={s.addBtn}
                          >
                            <Ionicons
                              name="add"
                              size={16}
                              color={Colors.light.primaryForeground}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Floating cart bar */}
            {cartCount > 0 && (
              <TouchableOpacity
                style={s.floatingCartBar}
                onPress={() => setView("cart")}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[Colors.light.primary, Colors.light.primaryContainer]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.floatingCartBarInner}
                >
                  <View style={s.floatingCartLeft}>
                    <Ionicons
                      name="basket"
                      size={18}
                      color={Colors.light.primaryForeground}
                    />
                    <Text style={s.floatingCartCount}>
                      {cartCount} {cartCount === 1 ? "Item" : "Items"}
                    </Text>
                  </View>
                  <Text style={s.floatingCartPrice}>
                    {formatPrice(subtotal)}
                  </Text>
                  <Text style={s.floatingCartCta}>View Order</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    );
  }

  // ═════════════════════════════════════════════════════
  // CART / CHECKOUT — Dining Checkout (Stitch)
  // ═════════════════════════════════════════════════════
  if (view === "cart") {
    return (
      <View style={s.container}>
        <View style={s.luxHeader}>
          <TouchableOpacity onPress={() => setView("menu")} style={s.backBtn}>
            <Ionicons
              name="chevron-back"
              size={20}
              color={Colors.light.primary}
            />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.luxHeaderSerif}>Your Order</Text>
            <Text style={s.luxHeaderSub}>{selectedFacility?.name}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 180 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Order items */}
          {cart.map((item) => (
            <View key={item.menu_item_id} style={s.checkoutItem}>
              <View style={s.checkoutItemLeft}>
                <View style={s.checkoutItemIcon}>
                  <Ionicons
                    name="restaurant-outline"
                    size={14}
                    color={Colors.light.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.checkoutItemName}>{item.name}</Text>
                  <Text style={s.checkoutItemMeta}>
                    {formatPrice(item.price)} each
                  </Text>
                </View>
              </View>
              <View style={s.checkoutItemRight}>
                <View style={s.qtyRow}>
                  <TouchableOpacity
                    onPress={() => updateQuantity(item.menu_item_id, -1)}
                    style={s.qtyBtnSmall}
                  >
                    <Ionicons
                      name="remove"
                      size={12}
                      color={Colors.light.primary}
                    />
                  </TouchableOpacity>
                  <Text style={s.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity
                    onPress={() => updateQuantity(item.menu_item_id, 1)}
                    style={s.qtyBtnSmall}
                  >
                    <Ionicons
                      name="add"
                      size={12}
                      color={Colors.light.primary}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={s.checkoutItemTotal}>
                  {formatPrice(item.price * item.quantity)}
                </Text>
              </View>
            </View>
          ))}

          {/* Notes fields */}
          <View style={s.checkoutInputs}>
            {serviceMode === "table" && (
              <TextInput
                style={s.luxInput}
                value={tableNumber}
                onChangeText={setTableNumber}
                placeholder="Table number (optional)"
                placeholderTextColor={Colors.light.mutedForeground}
              />
            )}
            <TextInput
              style={s.luxInput}
              value={orderNotes}
              onChangeText={setOrderNotes}
              placeholder="Dietary notes or special requests"
              placeholderTextColor={Colors.light.mutedForeground}
              multiline
            />
          </View>

          {/* Totals */}
          <View style={s.totalsSurface}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>{formatPrice(subtotal)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Tax (8%)</Text>
              <Text style={s.totalValue}>{formatPrice(tax)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Service Charge (18%)</Text>
              <Text style={s.totalValue}>{formatPrice(serviceCharge)}</Text>
            </View>
            <View style={s.totalDivider} />
            <View style={s.totalRow}>
              <Text style={s.totalFinalLabel}>Total</Text>
              <Text style={s.totalFinalValue}>{formatPrice(total)}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Sticky checkout footer */}
        <View style={s.stickyFooter}>
          <TouchableOpacity
            style={[s.primaryBtn, placingOrder && { opacity: 0.5 }]}
            onPress={handlePlaceOrder}
            disabled={placingOrder || cart.length === 0}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[Colors.light.primary, Colors.light.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.primaryBtnGradient}
            >
              <Ionicons
                name="restaurant-outline"
                size={18}
                color={Colors.light.primaryForeground}
              />
              <Text style={s.primaryBtnText}>
                {placingOrder ? "Placing Order..." : "Place Order"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={s.policyNote}>
            By placing this order, you authorize the charge to your Member
            Account
          </Text>
        </View>
      </View>
    );
  }

  // ═════════════════════════════════════════════════════
  // HOME VIEW — Dining hub with luxury aesthetics
  // ═════════════════════════════════════════════════════
  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={s.homeContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              haptics.light();
              setRefreshing(true);
              fetchHomeData();
            }}
            tintColor={Colors.light.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loadingHome ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
          </View>
        ) : (
          <>
            {/* Hero header */}
            <View style={s.homeHero}>
              <Text style={s.homeHeroSerif}>The Lakes</Text>
              <Text style={s.homeHeroSub}>
                Curated dining experiences at the club
              </Text>
            </View>

            {/* Action cards */}
            <View style={s.homeActionRow}>
              <TouchableOpacity
                style={s.homeActionCard}
                onPress={() => {
                  setFlowMode("reserve");
                  setView("venue");
                }}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[Colors.light.primary, Colors.light.primaryContainer]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.homeActionGradient}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={28}
                    color="rgba(255,255,255,0.9)"
                  />
                  <Text style={s.homeActionTitle}>Reserve{"\n"}a Table</Text>
                  <Text style={s.homeActionDesc}>
                    Book dining reservations
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.homeActionCard}
                onPress={() => {
                  setFlowMode("order");
                  setView("venue");
                }}
                activeOpacity={0.85}
              >
                <View style={s.homeActionSurface}>
                  <Ionicons
                    name="restaurant-outline"
                    size={28}
                    color={Colors.light.primary}
                  />
                  <Text style={s.homeActionTitleDark}>
                    Order{"\n"}Food
                  </Text>
                  <Text style={s.homeActionDescDark}>
                    Browse menu & order
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Upcoming Reservations */}
            {bookings.length > 0 && (
              <View style={s.homeSection}>
                <Text style={s.homeSectionTitle}>Upcoming Reservations</Text>
                {bookings.map((b) => (
                  <View key={b.id} style={s.reservationCard}>
                    <View style={s.reservationLeft}>
                      <View style={s.reservationIcon}>
                        <Ionicons
                          name="calendar"
                          size={16}
                          color={Colors.light.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.reservationVenue}>
                          {b.facility_name}
                        </Text>
                        <Text style={s.reservationMeta}>
                          {formatDate(b.date)} · {formatTime(b.start_time)} ·{" "}
                          {b.party_size}{" "}
                          {b.party_size === 1 ? "guest" : "guests"}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={s.cancelBtn}
                      onPress={() => handleCancelBooking(b.id)}
                      disabled={cancellingBooking === b.id}
                    >
                      <Text style={s.cancelBtnText}>
                        {cancellingBooking === b.id ? "..." : "Cancel"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Active Orders */}
            {orders.length > 0 && (
              <View style={s.homeSection}>
                <Text style={s.homeSectionTitle}>Active Orders</Text>
                {orders.map((order) => {
                  const color = statusColors[order.status] ?? {
                    bg: "#f3f4f6",
                    text: "#6b7280",
                  };
                  return (
                    <View key={order.id} style={s.orderCard}>
                      <View style={s.orderCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.reservationVenue}>
                            {order.facility_name}
                          </Text>
                          <Text style={s.reservationMeta}>
                            {order.items.length}{" "}
                            {order.items.length !== 1 ? "items" : "item"} ·{" "}
                            {formatPrice(order.total)}
                          </Text>
                        </View>
                        <View style={s.orderCardActions}>
                          <View
                            style={[
                              s.statusBadge,
                              { backgroundColor: color.bg },
                            ]}
                          >
                            <Text
                              style={[s.statusText, { color: color.text }]}
                            >
                              {order.status}
                            </Text>
                          </View>
                          {order.status === "pending" && (
                            <TouchableOpacity
                              style={s.cancelBtn}
                              onPress={() => handleCancelOrder(order.id)}
                              disabled={cancellingOrder === order.id}
                            >
                              <Text style={s.cancelBtnText}>
                                {cancellingOrder === order.id
                                  ? "..."
                                  : "Cancel"}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      <Text style={s.orderItemsList}>
                        {order.items
                          .map((i) => `${i.quantity}x ${i.name}`)
                          .join("  ·  ")}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Empty state */}
            {bookings.length === 0 && orders.length === 0 && (
              <View style={s.emptyState}>
                <View style={s.emptyIconCircle}>
                  <Ionicons
                    name="restaurant-outline"
                    size={36}
                    color={Colors.light.onSurfaceVariant}
                  />
                </View>
                <Text style={s.emptyTitle}>No dining activity</Text>
                <Text style={s.emptyText}>
                  Reserve a table or place an order to get started.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// STYLES — Luxury design system matching Stitch
// ═══════════════════════════════════════════════════════
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },

  // ── Luxury Header ──
  luxHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: Colors.light.surfaceContainerLowest,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceContainerLow,
    justifyContent: "center",
    alignItems: "center",
  },
  luxHeaderSerif: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.foreground,
    fontFamily: "System",
    letterSpacing: -0.3,
  },
  luxHeaderSub: {
    fontSize: 12,
    color: Colors.light.onSurfaceVariant,
    marginTop: 1,
  },

  // ── Home ──
  homeContent: { flexGrow: 1, paddingBottom: 32 },
  homeHero: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  homeHeroSerif: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.light.foreground,
    letterSpacing: -0.5,
  },
  homeHeroSub: {
    fontSize: 14,
    color: Colors.light.onSurfaceVariant,
    marginTop: 4,
    lineHeight: 20,
  },

  homeActionRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  homeActionCard: { flex: 1, borderRadius: 20, overflow: "hidden" },
  homeActionGradient: {
    padding: 20,
    minHeight: 150,
    justifyContent: "space-between",
  },
  homeActionSurface: {
    padding: 20,
    minHeight: 150,
    justifyContent: "space-between",
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 20,
  },
  homeActionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
    letterSpacing: -0.3,
    marginTop: 8,
  },
  homeActionTitleDark: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.foreground,
    letterSpacing: -0.3,
    marginTop: 8,
  },
  homeActionDesc: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
  },
  homeActionDescDark: {
    fontSize: 11,
    color: Colors.light.onSurfaceVariant,
    marginTop: 4,
  },

  homeSection: { paddingHorizontal: 20, marginBottom: 24 },
  homeSectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.light.foreground,
    marginBottom: 12,
    letterSpacing: -0.2,
  },

  // ── Reservation card ──
  reservationCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  reservationLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  reservationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  reservationVenue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  reservationMeta: {
    fontSize: 11,
    color: Colors.light.onSurfaceVariant,
    marginTop: 2,
  },

  cancelBtn: {
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.light.destructive,
  },

  // ── Order card ──
  orderCard: {
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  orderCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  orderItemsList: {
    fontSize: 11,
    color: Colors.light.onSurfaceVariant,
    marginTop: 8,
    lineHeight: 16,
  },

  // ── Empty state ──
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: Colors.light.surfaceContainerHigh,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.light.foreground,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 18,
  },

  // ── Venue Selection ──
  venueList: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  venueCard: {
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 20,
    overflow: "hidden",
  },
  venueImageWrap: { height: 140, position: "relative" },
  venueImagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cuisineBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cuisineBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  venueCardBody: { padding: 16 },
  venueCardName: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.foreground,
    letterSpacing: -0.3,
  },
  venueCardTagline: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
    marginTop: 3,
    lineHeight: 18,
  },
  venueMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  venueMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  venueMetaText: { fontSize: 12, color: Colors.light.onSurfaceVariant },
  venueActions: { marginTop: 14 },
  venueCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    paddingVertical: 11,
  },
  venueCtaText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.primaryForeground,
  },

  // ── Date Selection ──
  sectionBlock: { paddingTop: 20 },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dateStrip: { paddingHorizontal: 20, gap: 8, paddingBottom: 8 },
  dateCard: {
    width: 64,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceContainerLowest,
    alignItems: "center",
  },
  dateCardSelected: {
    backgroundColor: Colors.light.primary,
  },
  dateDayName: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.light.onSurfaceVariant,
  },
  dateDayNum: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.foreground,
    marginVertical: 2,
  },
  dateMonth: { fontSize: 10, color: Colors.light.onSurfaceVariant },
  dateTextSelected: { color: Colors.light.primaryForeground },

  // ── Time Grid ──
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 20,
  },
  timeChip: {
    minWidth: 72,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: Colors.light.surfaceContainerLowest,
  },
  timeChipSelected: {
    backgroundColor: Colors.light.primary,
  },
  timeChipDisabled: {
    backgroundColor: Colors.light.surfaceContainerHigh,
    opacity: 0.5,
  },
  timeChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  timeChipTextSelected: { color: Colors.light.primaryForeground },
  timeChipTextDisabled: {
    color: Colors.light.mutedForeground,
    textDecorationLine: "line-through",
  },
  timeChipSub: {
    fontSize: 9,
    color: Colors.light.onSurfaceVariant,
    marginTop: 2,
  },

  // ── Party Size ──
  partySizeRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
  },
  partySizeBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.light.surfaceContainerLowest,
    justifyContent: "center",
    alignItems: "center",
  },
  partySizeBtnSelected: {
    backgroundColor: Colors.light.primary,
  },
  partySizeText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  partySizeTextSelected: { color: Colors.light.primaryForeground },

  // ── Seating Preference ──
  seatingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
  },
  seatingChip: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.light.surfaceContainerLowest,
  },
  seatingChipSelected: {
    backgroundColor: Colors.light.primary,
  },
  seatingChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.light.foreground,
  },
  seatingChipTextSelected: { color: Colors.light.primaryForeground },

  // ── Inputs ──
  luxInput: {
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: Colors.light.foreground,
    marginHorizontal: 20,
  },

  // ── Sticky Footer ──
  stickyFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    backgroundColor: Colors.light.background,
  },
  primaryBtn: { borderRadius: 16, overflow: "hidden" },
  primaryBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.primaryForeground,
  },
  policyNote: {
    fontSize: 11,
    color: Colors.light.onSurfaceVariant,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 15,
  },

  // ── Service Toggle ──
  serviceToggleWrap: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginVertical: 8,
    backgroundColor: Colors.light.surfaceContainer,
    borderRadius: 12,
    padding: 3,
  },
  serviceToggleBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  serviceToggleBtnActive: {
    backgroundColor: Colors.light.surfaceContainerLowest,
  },
  serviceToggleText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.light.onSurfaceVariant,
  },
  serviceToggleTextActive: {
    color: Colors.light.foreground,
    fontWeight: "600",
  },

  // ── Menu Heading ──
  menuHeading: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.foreground,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
    letterSpacing: -0.3,
  },

  // ── Category Chips ──
  categoryStrip: {
    paddingHorizontal: 20,
    gap: 8,
    paddingTop: 10,
    paddingBottom: 14,
    alignItems: "center" as const,
  },
  categoryChip: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.light.surfaceContainerLowest,
    minHeight: 48,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  categoryChipSelected: {
    backgroundColor: Colors.light.primary,
  },
  categoryChipText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.light.foreground,
    lineHeight: 20,
  },
  categoryChipTextSelected: { color: Colors.light.primaryForeground },

  // ── Menu Card ──
  menuCard: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    overflow: "hidden",
  },
  menuCardImageWrap: { width: 90 },
  menuCardImage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 90,
  },
  menuCardBody: { flex: 1, padding: 12 },
  menuCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  menuCardName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
    flex: 1,
    marginRight: 8,
  },
  menuCardPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.primary,
  },
  menuCardDesc: {
    fontSize: 11,
    color: Colors.light.onSurfaceVariant,
    marginTop: 4,
    lineHeight: 15,
  },
  menuCardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },

  // ── Quantity Controls ──
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceContainerLow,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyBtnSmall: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.light.surfaceContainerLow,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
    minWidth: 20,
    textAlign: "center",
  },

  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Cart Badge ──
  cartBadge: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cartBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.light.primaryForeground,
  },

  // ── Floating Cart Bar ──
  floatingCartBar: {
    position: "absolute",
    bottom: 16,
    left: 20,
    right: 20,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  floatingCartBarInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  floatingCartLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  floatingCartCount: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.primaryForeground,
  },
  floatingCartPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.primaryForeground,
    marginRight: 12,
  },
  floatingCartCta: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },

  // ── Checkout ──
  checkoutItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.outlineVariant,
  },
  checkoutItemLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  checkoutItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  checkoutItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  checkoutItemMeta: {
    fontSize: 11,
    color: Colors.light.onSurfaceVariant,
    marginTop: 1,
  },
  checkoutItemRight: { alignItems: "flex-end", gap: 6 },
  checkoutItemTotal: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.foreground,
  },

  checkoutInputs: { gap: 10, marginTop: 20 },

  // ── Totals Surface ──
  totalsSurface: {
    marginTop: 24,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  totalLabel: { fontSize: 13, color: Colors.light.onSurfaceVariant },
  totalValue: { fontSize: 13, color: Colors.light.onSurfaceVariant },
  totalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.outlineVariant,
    marginVertical: 8,
  },
  totalFinalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.foreground,
  },
  totalFinalValue: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.foreground,
  },
});
