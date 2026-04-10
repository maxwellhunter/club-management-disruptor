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
  Platform,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { haptics } from "@/lib/haptics";

const API_URL = process.env.EXPO_PUBLIC_APP_URL || "http://localhost:3000";

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  is_blocked: boolean;
  total_visits: number;
  last_visit_date: string | null;
}

interface GuestVisit {
  id: string;
  visit_date: string;
  facility_type: string | null;
  status: string;
  guest_fee: number | null;
  guest_first_name: string;
  guest_last_name: string;
  host_first_name: string;
  host_last_name: string;
}

interface GuestStats {
  total_guests: number;
  visits_this_month: number;
  guest_fees_this_month: number;
  blocked_guests: number;
  upcoming_visits: number;
}

const serifFont = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });

export default function GuestsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [visits, setVisits] = useState<GuestVisit[]>([]);
  const [stats, setStats] = useState<GuestStats | null>(null);
  const [role, setRole] = useState<string>("member");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [adding, setAdding] = useState(false);

  const getHeaders = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) h["Authorization"] = `Bearer ${session.access_token}`;
    return h;
  }, [session?.access_token]);

  const fetchGuests = useCallback(async () => {
    const headers = getHeaders();
    try {
      const res = await fetch(`${API_URL}/api/guests`, { headers });
      if (res.ok) {
        const data = await res.json();
        setGuests(data.guests || []);
        setVisits(data.recent_visits || []);
        setStats(data.stats || null);
        setRole(data.role || "member");
      }
    } catch (err) {
      console.error("Failed to fetch guests:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchGuests();
  }, [fetchGuests]);

  async function handleAddGuest() {
    if (!addForm.first_name || !addForm.last_name) {
      Alert.alert("Error", "First and last name are required");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`${API_URL}/api/guests`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(addForm),
      });
      if (res.ok) {
        haptics.success();
        Alert.alert("Guest Registered", `${addForm.first_name} ${addForm.last_name} has been added.`);
        setShowAddModal(false);
        setAddForm({ first_name: "", last_name: "", email: "", phone: "" });
        fetchGuests();
      } else {
        haptics.error();
        const data = await res.json();
        Alert.alert("Error", data.error || "Failed to register guest");
      }
    } catch {
      haptics.error();
      Alert.alert("Error", "Failed to register guest");
    } finally {
      setAdding(false);
    }
  }

  const filteredGuests = guests.filter((g) => {
    if (!search) return true;
    const name = `${g.first_name} ${g.last_name}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const isAdmin = role === "admin" || role === "staff";

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchGuests(); }}
            tintColor={Colors.light.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.light.foreground} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Guest Management</Text>
          {isAdmin && (
            <TouchableOpacity
              onPress={() => { haptics.medium(); setShowAddModal(true); }}
              style={styles.addBtn}
            >
              <Ionicons name="add" size={22} color={Colors.light.primary} />
            </TouchableOpacity>
          )}
          {!isAdmin && <View style={{ width: 32 }} />}
        </View>

        {/* Stats Cards */}
        {stats && isAdmin && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsRow}
          >
            <StatCard
              icon="people-outline"
              label="Total Guests"
              value={String(stats.total_guests)}
              color={Colors.light.primary}
            />
            <StatCard
              icon="calendar-outline"
              label="This Month"
              value={String(stats.visits_this_month)}
              color="#6366f1"
            />
            <StatCard
              icon="cash-outline"
              label="Guest Fees"
              value={`$${stats.guest_fees_this_month.toFixed(0)}`}
              color="#d97706"
            />
            <StatCard
              icon="alert-circle-outline"
              label="Upcoming"
              value={String(stats.upcoming_visits)}
              color="#0891b2"
            />
          </ScrollView>
        )}

        {/* Guest Directory (admin only) */}
        {isAdmin && guests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Guest Directory</Text>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={16} color={Colors.light.onSurfaceVariant} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search guests..."
                placeholderTextColor={Colors.light.outline}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <View style={styles.card}>
              {filteredGuests.slice(0, 20).map((guest, i) => (
                <View key={guest.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.guestRow}>
                    <View style={[styles.avatarSmall, guest.is_blocked && styles.avatarBlocked]}>
                      <Text style={styles.avatarSmallText}>
                        {guest.first_name[0]}{guest.last_name[0]}
                      </Text>
                    </View>
                    <View style={styles.guestInfo}>
                      <Text style={styles.guestName}>
                        {guest.first_name} {guest.last_name}
                      </Text>
                      <Text style={styles.guestMeta}>
                        {guest.total_visits} visit{guest.total_visits !== 1 ? "s" : ""}
                        {guest.last_visit_date
                          ? ` · Last: ${new Date(guest.last_visit_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                          : ""}
                      </Text>
                    </View>
                    {guest.is_blocked && (
                      <View style={styles.blockedBadge}>
                        <Text style={styles.blockedText}>Blocked</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
              {filteredGuests.length === 0 && (
                <Text style={styles.emptyText}>No guests found</Text>
              )}
            </View>
          </View>
        )}

        {/* Recent Visits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isAdmin ? "Recent Visits" : "Your Guest Visits"}
          </Text>
          {visits.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={36} color={Colors.light.outlineVariant} />
              <Text style={styles.emptyTitle}>No Guest Visits</Text>
              <Text style={styles.emptySubtitle}>
                {isAdmin
                  ? "Guest visits will appear here once registered."
                  : "Register a guest at the front desk to see their visits here."}
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              {visits.slice(0, 15).map((visit, i) => (
                <View key={visit.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.visitRow}>
                    <View style={styles.visitDateBadge}>
                      <Text style={styles.visitDateMonth}>
                        {new Date(visit.visit_date).toLocaleDateString("en-US", { month: "short" })}
                      </Text>
                      <Text style={styles.visitDateDay}>
                        {new Date(visit.visit_date).getDate()}
                      </Text>
                    </View>
                    <View style={styles.visitInfo}>
                      <Text style={styles.visitGuestName}>
                        {visit.guest_first_name} {visit.guest_last_name}
                      </Text>
                      <Text style={styles.visitMeta}>
                        Hosted by {visit.host_first_name} {visit.host_last_name}
                        {visit.facility_type ? ` · ${visit.facility_type}` : ""}
                      </Text>
                    </View>
                    <View style={styles.visitRight}>
                      {visit.guest_fee != null && visit.guest_fee > 0 && (
                        <Text style={styles.visitFee}>${visit.guest_fee}</Text>
                      )}
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor:
                              visit.status === "checked_in"
                                ? Colors.light.primary
                                : visit.status === "cancelled"
                                ? Colors.light.destructive
                                : "#d97706",
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Guest Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register Guest</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={22} color={Colors.light.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>FIRST NAME *</Text>
              <TextInput
                style={styles.formInput}
                value={addForm.first_name}
                onChangeText={(v) => setAddForm((p) => ({ ...p, first_name: v }))}
                placeholder="First name"
                placeholderTextColor={Colors.light.outline}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>LAST NAME *</Text>
              <TextInput
                style={styles.formInput}
                value={addForm.last_name}
                onChangeText={(v) => setAddForm((p) => ({ ...p, last_name: v }))}
                placeholder="Last name"
                placeholderTextColor={Colors.light.outline}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>EMAIL</Text>
              <TextInput
                style={styles.formInput}
                value={addForm.email}
                onChangeText={(v) => setAddForm((p) => ({ ...p, email: v }))}
                placeholder="guest@example.com"
                placeholderTextColor={Colors.light.outline}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>PHONE</Text>
              <TextInput
                style={styles.formInput}
                value={addForm.phone}
                onChangeText={(v) => setAddForm((p) => ({ ...p, phone: v }))}
                placeholder="(555) 123-4567"
                placeholderTextColor={Colors.light.outline}
                keyboardType="phone-pad"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, adding && { opacity: 0.5 }]}
              onPress={handleAddGuest}
              disabled={adding}
            >
              <Text style={styles.submitBtnText}>
                {adding ? "Registering..." : "Register Guest"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 16,
  },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.foreground,
    fontFamily: serifFont,
  },
  addBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  statsRow: { paddingHorizontal: 20, gap: 10, paddingBottom: 8 },
  statCard: {
    width: 120,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    padding: 14,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: { fontSize: 20, fontWeight: "700", color: Colors.light.foreground, fontFamily: serifFont },
  statLabel: { fontSize: 11, color: Colors.light.onSurfaceVariant, marginTop: 2 },
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.foreground,
    fontFamily: serifFont,
    marginBottom: 12,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.light.surfaceContainerLow,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.light.foreground },
  card: {
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  divider: { height: 1, backgroundColor: Colors.light.surfaceContainerLow, marginVertical: 10 },
  guestRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBlocked: { backgroundColor: Colors.light.destructive + "20" },
  avatarSmallText: { fontSize: 12, fontWeight: "700", color: Colors.light.onSurfaceVariant },
  guestInfo: { flex: 1, gap: 2 },
  guestName: { fontSize: 14, fontWeight: "600", color: Colors.light.foreground },
  guestMeta: { fontSize: 12, color: Colors.light.onSurfaceVariant },
  blockedBadge: {
    backgroundColor: Colors.light.destructive + "15",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  blockedText: { fontSize: 10, fontWeight: "700", color: Colors.light.destructive },
  emptyCard: {
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: Colors.light.foreground },
  emptySubtitle: { fontSize: 13, color: Colors.light.onSurfaceVariant, textAlign: "center" },
  emptyText: { fontSize: 14, color: Colors.light.onSurfaceVariant, textAlign: "center", padding: 16 },
  visitRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  visitDateBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.light.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  visitDateMonth: { fontSize: 10, fontWeight: "600", color: Colors.light.primary },
  visitDateDay: { fontSize: 16, fontWeight: "700", color: Colors.light.foreground },
  visitInfo: { flex: 1, gap: 2 },
  visitGuestName: { fontSize: 14, fontWeight: "600", color: Colors.light.foreground },
  visitMeta: { fontSize: 12, color: Colors.light.onSurfaceVariant },
  visitRight: { alignItems: "flex-end", gap: 4 },
  visitFee: { fontSize: 13, fontWeight: "600", color: Colors.light.foreground },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.light.foreground, fontFamily: serifFont },
  formField: { marginBottom: 16 },
  formLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    color: Colors.light.outline,
    marginBottom: 6,
  },
  formInput: {
    fontSize: 15,
    color: Colors.light.foreground,
    backgroundColor: Colors.light.surfaceContainerLow,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  submitBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: Colors.light.primaryForeground },
});
