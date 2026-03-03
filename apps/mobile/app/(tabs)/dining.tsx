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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";

const API_URL =
  process.env.EXPO_PUBLIC_APP_URL || "http://localhost:3000";

const TAX_RATE = 0.08;

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
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<DiningSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<DiningSlot | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [bookingInProgress, setBookingInProgress] = useState(false);

  // Menu + ordering flow
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);

  // Cancel state
  const [cancellingBooking, setCancellingBooking] = useState<string | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);

  // Flow mode: "reserve" or "order"
  const [flowMode, setFlowMode] = useState<"reserve" | "order">("reserve");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  // === Data fetching ===

  const fetchHomeData = useCallback(async () => {
    try {
      const [bookingsRes, ordersRes] = await Promise.all([
        fetch(`${API_URL}/api/bookings/my`, { headers }),
        fetch(`${API_URL}/api/dining/orders/my`, { headers }),
      ]);

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
  }, [session?.access_token]);

  useEffect(() => {
    fetchHomeData();
    fetchFacilities();
  }, [fetchHomeData]);

  async function fetchFacilities() {
    try {
      const res = await fetch(`${API_URL}/api/facilities?type=dining`, { headers });
      if (res.ok) {
        const data = await res.json();
        setFacilities(data.facilities ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingFacilities(false);
    }
  }

  async function fetchSlots(facilityId: string, date: string) {
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
        Alert.alert("Reserved!", "Your dining reservation has been confirmed.");
        resetFlow();
        setView("home");
        fetchHomeData();
      } else {
        const data = await res.json();
        Alert.alert("Error", data.error || "Failed to book reservation");
      }
    } catch {
      Alert.alert("Error", "Failed to book reservation");
    } finally {
      setBookingInProgress(false);
    }
  }

  async function handlePlaceOrder() {
    if (!selectedFacility || cart.length === 0) return;
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
        Alert.alert("Order Placed!", "Your order has been submitted and charged to your member account.");
        resetFlow();
        setView("home");
        fetchHomeData();
      } else {
        const data = await res.json();
        Alert.alert("Error", data.error || "Failed to place order");
      }
    } catch {
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
  }

  // === Cart helpers ===

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item_id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menu_item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c
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
          c.menu_item_id === menuItemId ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0)
    );
  }

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  // === Formatters ===

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

  function groupSlots(slots: DiningSlot[]) {
    const groups: Record<string, DiningSlot[]> = {};
    for (const slot of slots) {
      const hour = parseInt(slot.start_time.split(":")[0]);
      const label = hour < 15 ? "Lunch" : "Dinner";
      if (!groups[label]) groups[label] = [];
      groups[label].push(slot);
    }
    return groups;
  }

  const statusColors: Record<string, { bg: string; text: string }> = {
    pending: { bg: "#fef9c3", text: "#a16207" },
    confirmed: { bg: "#dbeafe", text: "#1d4ed8" },
    preparing: { bg: "#fed7aa", text: "#c2410c" },
    ready: { bg: "#dcfce7", text: "#15803d" },
  };

  // ========= VENUE SELECTION =========
  if (view === "venue") {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => { resetFlow(); setView("home"); }}
            style={s.backBtn}
          >
            <Ionicons name="chevron-back" size={16} color={Colors.light.primary} />
            <Text style={s.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>
            {flowMode === "reserve" ? "Select Venue" : "Select Restaurant"}
          </Text>
        </View>
        {loadingFacilities ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
          </View>
        ) : facilities.length === 0 ? (
          <View style={s.centered}>
            <Text style={s.emptyText}>No dining venues available.</Text>
          </View>
        ) : (
          <View style={s.courseGrid}>
            {facilities.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={s.courseCard}
                onPress={() => {
                  setSelectedFacility(f);
                  if (flowMode === "reserve") {
                    setView("date");
                  } else {
                    fetchMenu(f.id);
                    setView("menu");
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="restaurant-outline" size={32} color={Colors.light.primary} />
                <Text style={s.courseName}>{f.name}</Text>
                <Text style={s.courseDesc}>{f.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }

  // ========= DATE SELECTION =========
  if (view === "date") {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setView("venue")} style={s.backBtn}>
            <Ionicons name="chevron-back" size={16} color={Colors.light.primary} />
            <Text style={s.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>{selectedFacility?.name}</Text>
        </View>
        <Text style={s.sectionLabel}>Select a Date</Text>
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
                <Text style={[s.dateDayName, isSelected && s.dateTextSelected]}>
                  {d.dayName}
                </Text>
                <Text style={[s.dateDayNum, isSelected && s.dateTextSelected]}>
                  {d.dayNum}
                </Text>
                <Text style={[s.dateMonth, isSelected && s.dateTextSelected]}>
                  {d.month}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // ========= TIME SELECTION + BOOK =========
  if (view === "time") {
    const grouped = groupSlots(slots);
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => { setView("date"); setSelectedTime(null); setSlots([]); }}
            style={s.backBtn}
          >
            <Ionicons name="chevron-back" size={16} color={Colors.light.primary} />
            <Text style={s.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>
            {selectedFacility?.name} — {formatDate(selectedDate)}
          </Text>
        </View>

        {loadingSlots ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.timeContent}>
            {Object.entries(grouped).map(([period, periodSlots]) => (
              <View key={period}>
                <Text style={s.sectionLabel}>{period}</Text>
                <View style={s.timeGrid}>
                  {periodSlots.map((slot) => {
                    const isSelected = selectedTime?.start_time === slot.start_time;
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
                          {formatTime(slot.start_time)}
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

            {selectedTime && (
              <View style={s.confirmSection}>
                <Text style={s.sectionLabel}>Party Size</Text>
                <View style={s.partySizeRow}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
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
                        {n}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[s.confirmBtn, bookingInProgress && { opacity: 0.5 }]}
                  onPress={handleBookReservation}
                  disabled={bookingInProgress}
                  activeOpacity={0.8}
                >
                  <Text style={s.confirmBtnText}>
                    {bookingInProgress
                      ? "Reserving..."
                      : `Confirm — ${formatTime(selectedTime.start_time)} · ${partySize} ${partySize === 1 ? "guest" : "guests"}`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    );
  }

  // ========= MENU BROWSING =========
  if (view === "menu") {
    const activeCategory = categories.find((c) => c.id === selectedCategoryId);
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => { setView("venue"); setCategories([]); setCart([]); }}
            style={s.backBtn}
          >
            <Ionicons name="chevron-back" size={16} color={Colors.light.primary} />
            <Text style={s.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={[s.headerTitle, { flex: 1 }]}>{selectedFacility?.name}</Text>
          {cartCount > 0 && (
            <TouchableOpacity
              onPress={() => setView("cart")}
              style={s.cartBadge}
            >
              <Ionicons name="cart-outline" size={16} color={Colors.light.primaryForeground} />
              <Text style={s.cartBadgeText}>{cartCount}</Text>
            </TouchableOpacity>
          )}
        </View>

        {loadingMenu ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
          </View>
        ) : categories.length === 0 ? (
          <View style={s.centered}>
            <Text style={s.emptyText}>No menu items available.</Text>
          </View>
        ) : (
          <>
            {/* Category tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.categoryStrip}
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
                      selectedCategoryId === cat.id && s.categoryChipTextSelected,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Items */}
            <ScrollView contentContainerStyle={{ paddingBottom: cartCount > 0 ? 80 : 16 }}>
              {activeCategory?.items.map((item) => {
                const inCart = cart.find((c) => c.menu_item_id === item.id);
                return (
                  <View key={item.id} style={s.menuItem}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={s.menuItemName}>{item.name}</Text>
                      {item.description && (
                        <Text style={s.menuItemDesc} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}
                      <Text style={s.menuItemPrice}>{formatPrice(item.price)}</Text>
                    </View>
                    {inCart ? (
                      <View style={s.qtyRow}>
                        <TouchableOpacity
                          onPress={() => updateQuantity(item.id, -1)}
                          style={s.qtyBtn}
                        >
                          <Text style={s.qtyBtnText}>-</Text>
                        </TouchableOpacity>
                        <Text style={s.qtyText}>{inCart.quantity}</Text>
                        <TouchableOpacity
                          onPress={() => updateQuantity(item.id, 1)}
                          style={s.qtyBtn}
                        >
                          <Text style={s.qtyBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => addToCart(item)}
                        style={s.addBtn}
                      >
                        <Text style={s.addBtnText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {/* Floating cart bar */}
            {cartCount > 0 && (
              <TouchableOpacity
                style={s.fab}
                onPress={() => setView("cart")}
                activeOpacity={0.8}
              >
                <Text style={s.fabText}>
                  View Cart ({cartCount}) — {formatPrice(subtotal)}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    );
  }

  // ========= CART / CHECKOUT =========
  if (view === "cart") {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setView("menu")} style={s.backBtn}>
            <Ionicons name="chevron-back" size={16} color={Colors.light.primary} />
            <Text style={s.backText}>Back to menu</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Your Order</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {cart.map((item) => (
            <View key={item.menu_item_id} style={s.cartItem}>
              <View style={{ flex: 1 }}>
                <Text style={s.cartItemName}>{item.name}</Text>
                <Text style={s.cartItemPrice}>
                  {formatPrice(item.price)} each
                </Text>
              </View>
              <View style={s.qtyRow}>
                <TouchableOpacity
                  onPress={() => updateQuantity(item.menu_item_id, -1)}
                  style={s.qtyBtn}
                >
                  <Text style={s.qtyBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={s.qtyText}>{item.quantity}</Text>
                <TouchableOpacity
                  onPress={() => updateQuantity(item.menu_item_id, 1)}
                  style={s.qtyBtn}
                >
                  <Text style={s.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.cartItemTotal}>
                {formatPrice(item.price * item.quantity)}
              </Text>
            </View>
          ))}

          <View style={s.cartInputs}>
            <TextInput
              style={s.input}
              value={tableNumber}
              onChangeText={setTableNumber}
              placeholder="Table number (optional)"
              placeholderTextColor={Colors.light.mutedForeground}
            />
            <TextInput
              style={s.input}
              value={orderNotes}
              onChangeText={setOrderNotes}
              placeholder="Notes (optional)"
              placeholderTextColor={Colors.light.mutedForeground}
            />
          </View>

          <View style={s.totals}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>{formatPrice(subtotal)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Tax (8%)</Text>
              <Text style={s.totalValue}>{formatPrice(tax)}</Text>
            </View>
            <View style={[s.totalRow, s.totalRowFinal]}>
              <Text style={s.totalFinalLabel}>Total</Text>
              <Text style={s.totalFinalValue}>{formatPrice(total)}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={s.cartFooter}>
          <TouchableOpacity
            style={[s.confirmBtn, placingOrder && { opacity: 0.5 }]}
            onPress={handlePlaceOrder}
            disabled={placingOrder || cart.length === 0}
            activeOpacity={0.8}
          >
            <Text style={s.confirmBtnText}>
              {placingOrder ? "Placing Order..." : `Place Order — ${formatPrice(total)}`}
            </Text>
          </TouchableOpacity>
          <Text style={s.chargeNote}>Charged to your member account</Text>
        </View>
      </View>
    );
  }

  // ========= HOME VIEW =========
  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={s.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchHomeData(); }}
            tintColor={Colors.light.primary}
          />
        }
      >
        {loadingHome ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
          </View>
        ) : (
          <>
            {/* Action buttons */}
            <View style={s.actionRow}>
              <TouchableOpacity
                style={s.actionCard}
                onPress={() => { setFlowMode("reserve"); setView("venue"); }}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={28} color={Colors.light.primary} />
                <Text style={s.actionTitle}>Reserve a Table</Text>
                <Text style={s.actionDesc}>Book a dining reservation</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.actionCard}
                onPress={() => { setFlowMode("order"); setView("venue"); }}
                activeOpacity={0.7}
              >
                <Ionicons name="fast-food-outline" size={28} color={Colors.light.primary} />
                <Text style={s.actionTitle}>Order Food</Text>
                <Text style={s.actionDesc}>Browse menu & order</Text>
              </TouchableOpacity>
            </View>

            {/* Reservations */}
            {bookings.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Upcoming Reservations</Text>
                {bookings.map((b) => (
                  <View key={b.id} style={s.bookingCard}>
                    <View style={s.bookingCardLeft}>
                      <View style={s.diningIcon}>
                        <Ionicons name="restaurant-outline" size={16} color="#ea580c" />
                      </View>
                      <View>
                        <Text style={s.bookingFacility}>{b.facility_name}</Text>
                        <Text style={s.bookingMeta}>
                          {formatDate(b.date)} · {formatTime(b.start_time)} ·{" "}
                          {b.party_size} {b.party_size === 1 ? "guest" : "guests"}
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

            {/* Active orders */}
            {orders.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Active Orders</Text>
                {orders.map((order) => {
                  const color = statusColors[order.status] ?? { bg: "#f3f4f6", text: "#6b7280" };
                  return (
                    <View key={order.id} style={s.orderCard}>
                      <View style={s.orderHeader}>
                        <View>
                          <Text style={s.bookingFacility}>{order.facility_name}</Text>
                          <Text style={s.bookingMeta}>
                            {order.items.length} item{order.items.length !== 1 ? "s" : ""} ·{" "}
                            {formatPrice(order.total)}
                          </Text>
                        </View>
                        <View style={s.orderActions}>
                          <View style={[s.statusBadge, { backgroundColor: color.bg }]}>
                            <Text style={[s.statusText, { color: color.text }]}>
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
                                {cancellingOrder === order.id ? "..." : "Cancel"}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      <Text style={s.orderItems}>
                        {order.items.map((i) => `${i.quantity}x ${i.name}`).join("  ")}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Empty state */}
            {bookings.length === 0 && orders.length === 0 && (
              <View style={s.emptyState}>
                <Ionicons name="restaurant-outline" size={48} color={Colors.light.mutedForeground} />
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  backText: { fontSize: 14, color: Colors.light.primary, fontWeight: "500" },
  headerTitle: { fontSize: 15, fontWeight: "600", color: Colors.light.foreground },
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
  centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
  listContent: { flexGrow: 1, padding: 16, paddingBottom: 32 },

  // Action cards
  actionRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  actionCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
    marginTop: 8,
    textAlign: "center",
  },
  actionDesc: {
    fontSize: 11,
    color: Colors.light.mutedForeground,
    marginTop: 2,
    textAlign: "center",
  },

  // Venue
  courseGrid: { flexDirection: "row", gap: 12, padding: 16 },
  courseCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  courseName: { fontSize: 14, fontWeight: "600", color: Colors.light.foreground, textAlign: "center" },
  courseDesc: { fontSize: 11, color: Colors.light.mutedForeground, marginTop: 2, textAlign: "center" },

  // Date strip
  dateStrip: { paddingHorizontal: 16, gap: 8, paddingBottom: 16 },
  dateCard: {
    width: 60,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: "center",
  },
  dateCardSelected: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  dateDayName: { fontSize: 11, fontWeight: "500", color: Colors.light.mutedForeground },
  dateDayNum: { fontSize: 18, fontWeight: "700", color: Colors.light.foreground, marginVertical: 2 },
  dateMonth: { fontSize: 10, color: Colors.light.mutedForeground },
  dateTextSelected: { color: Colors.light.primaryForeground },

  // Time grid
  timeContent: { paddingBottom: 32 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16 },
  timeChip: { borderWidth: 1, borderColor: Colors.light.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center" },
  timeChipSelected: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  timeChipDisabled: { backgroundColor: Colors.light.muted, borderColor: Colors.light.border },
  timeChipText: { fontSize: 12, fontWeight: "500", color: Colors.light.foreground },
  timeChipTextSelected: { color: Colors.light.primaryForeground },
  timeChipTextDisabled: { color: Colors.light.mutedForeground, textDecorationLine: "line-through" },
  timeChipSub: { fontSize: 9, color: Colors.light.mutedForeground, marginTop: 1 },

  // Confirm
  confirmSection: { borderTopWidth: 1, borderTopColor: Colors.light.border, marginTop: 16 },
  partySizeRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 16, flexWrap: "wrap" },
  partySizeBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    justifyContent: "center",
    alignItems: "center",
  },
  partySizeBtnSelected: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  partySizeText: { fontSize: 14, fontWeight: "600", color: Colors.light.foreground },
  partySizeTextSelected: { color: Colors.light.primaryForeground },
  confirmBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginHorizontal: 16,
    alignItems: "center",
  },
  confirmBtnText: { color: Colors.light.primaryForeground, fontSize: 14, fontWeight: "600" },

  // Menu
  categoryStrip: { paddingHorizontal: 16, gap: 8, paddingVertical: 12 },
  categoryChip: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  categoryChipSelected: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  categoryChipText: { fontSize: 12, fontWeight: "500", color: Colors.light.foreground },
  categoryChipTextSelected: { color: Colors.light.primaryForeground },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  menuItemName: { fontSize: 14, fontWeight: "600", color: Colors.light.foreground },
  menuItemDesc: { fontSize: 11, color: Colors.light.mutedForeground, marginTop: 2 },
  menuItemPrice: { fontSize: 14, fontWeight: "700", color: Colors.light.primary, marginTop: 4 },

  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyBtnText: { fontSize: 14, fontWeight: "600", color: Colors.light.foreground },
  qtyText: { fontSize: 14, fontWeight: "600", color: Colors.light.foreground, minWidth: 20, textAlign: "center" },

  addBtn: {
    borderWidth: 1,
    borderColor: Colors.light.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  addBtnText: { fontSize: 12, fontWeight: "600", color: Colors.light.primary },

  cartBadge: {
    backgroundColor: Colors.light.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cartBadgeText: { fontSize: 12, fontWeight: "700", color: Colors.light.primaryForeground },

  // Cart
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  cartItemName: { fontSize: 14, fontWeight: "600", color: Colors.light.foreground },
  cartItemPrice: { fontSize: 11, color: Colors.light.mutedForeground, marginTop: 2 },
  cartItemTotal: { fontSize: 14, fontWeight: "700", color: Colors.light.foreground, marginLeft: 12, minWidth: 60, textAlign: "right" },

  cartInputs: { gap: 10, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.light.foreground,
  },

  totals: { marginTop: 16 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalLabel: { fontSize: 13, color: Colors.light.mutedForeground },
  totalValue: { fontSize: 13, color: Colors.light.mutedForeground },
  totalRowFinal: { borderTopWidth: 1, borderTopColor: Colors.light.border, paddingTop: 8, marginTop: 4 },
  totalFinalLabel: { fontSize: 15, fontWeight: "700", color: Colors.light.foreground },
  totalFinalValue: { fontSize: 15, fontWeight: "700", color: Colors.light.foreground },

  cartFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    padding: 16,
    backgroundColor: Colors.light.background,
  },
  chargeNote: { fontSize: 11, color: Colors.light.mutedForeground, textAlign: "center", marginTop: 8 },

  // Bookings / Orders cards
  section: { marginBottom: 24 },
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
  bookingCardLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  diningIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fed7aa",
    justifyContent: "center",
    alignItems: "center",
  },
  bookingFacility: { fontSize: 14, fontWeight: "600", color: Colors.light.foreground },
  bookingMeta: { fontSize: 11, color: Colors.light.mutedForeground, marginTop: 1 },
  cancelBtn: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cancelBtnText: { fontSize: 11, fontWeight: "600", color: "#b91c1c" },

  orderCard: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orderActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  orderItems: { fontSize: 11, color: Colors.light.mutedForeground, marginTop: 6 },

  // Empty
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: Colors.light.foreground, marginTop: 12, marginBottom: 4 },
  emptyText: { fontSize: 14, color: Colors.light.mutedForeground, textAlign: "center" },

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
  fabText: { color: Colors.light.primaryForeground, fontSize: 15, fontWeight: "600" },
});
