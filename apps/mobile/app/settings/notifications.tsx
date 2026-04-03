import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";
import { registerForPushNotifications } from "@/lib/notifications";

interface NotificationPrefs {
  pushEnabled: boolean;
  bookingReminders: boolean;
  eventReminders: boolean;
  announcements: boolean;
  billingAlerts: boolean;
  diningUpdates: boolean;
  marketingEmails: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  pushEnabled: false,
  bookingReminders: true,
  eventReminders: true,
  announcements: true,
  billingAlerts: true,
  diningUpdates: true,
  marketingEmails: false,
};

export default function NotificationPreferencesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    // Load saved preferences from AsyncStorage or Supabase
    // For now use defaults
  }, []);

  async function togglePush(enabled: boolean) {
    if (enabled && user) {
      const token = await registerForPushNotifications(user.id);
      if (!token) {
        Alert.alert(
          "Permissions Required",
          "Please enable notifications in your device settings.",
        );
        return;
      }
    }
    setPrefs({ ...prefs, pushEnabled: enabled });
  }

  function toggle(key: keyof NotificationPrefs) {
    setPrefs({ ...prefs, [key]: !prefs[key] });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.light.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Push Notifications Master Toggle */}
      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <View style={[styles.iconWrap, { backgroundColor: Colors.light.primary + "20" }]}>
              <Ionicons name="notifications" size={20} color={Colors.light.primary} />
            </View>
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>Push Notifications</Text>
              <Text style={styles.toggleSubtitle}>
                {prefs.pushEnabled ? "Enabled" : "Disabled"}
              </Text>
            </View>
          </View>
          <Switch
            value={prefs.pushEnabled}
            onValueChange={togglePush}
            trackColor={{ false: Colors.light.outlineVariant, true: Colors.light.primary + "60" }}
            thumbColor={prefs.pushEnabled ? Colors.light.primary : Colors.light.surfaceContainerHigh}
          />
        </View>
      </View>

      {/* Category toggles */}
      <Text style={styles.sectionTitle}>Notification Categories</Text>
      <View style={styles.card}>
        <ToggleRow
          icon="golf-outline"
          title="Booking Reminders"
          subtitle="Tee time and reservation reminders"
          value={prefs.bookingReminders}
          onToggle={() => toggle("bookingReminders")}
          disabled={!prefs.pushEnabled}
        />
        <View style={styles.divider} />
        <ToggleRow
          icon="calendar-outline"
          title="Event Reminders"
          subtitle="Upcoming events you've RSVPed to"
          value={prefs.eventReminders}
          onToggle={() => toggle("eventReminders")}
          disabled={!prefs.pushEnabled}
        />
        <View style={styles.divider} />
        <ToggleRow
          icon="megaphone-outline"
          title="Announcements"
          subtitle="Club news and updates"
          value={prefs.announcements}
          onToggle={() => toggle("announcements")}
          disabled={!prefs.pushEnabled}
        />
        <View style={styles.divider} />
        <ToggleRow
          icon="card-outline"
          title="Billing Alerts"
          subtitle="Invoice and payment notifications"
          value={prefs.billingAlerts}
          onToggle={() => toggle("billingAlerts")}
          disabled={!prefs.pushEnabled}
        />
        <View style={styles.divider} />
        <ToggleRow
          icon="restaurant-outline"
          title="Dining Updates"
          subtitle="Order status and dining specials"
          value={prefs.diningUpdates}
          onToggle={() => toggle("diningUpdates")}
          disabled={!prefs.pushEnabled}
        />
      </View>

      {/* Email preferences */}
      <Text style={styles.sectionTitle}>Email</Text>
      <View style={styles.card}>
        <ToggleRow
          icon="mail-outline"
          title="Marketing & Promotions"
          subtitle="Special offers and seasonal updates"
          value={prefs.marketingEmails}
          onToggle={() => toggle("marketingEmails")}
        />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onToggle,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, disabled && styles.toggleRowDisabled]}>
      <View style={styles.toggleInfo}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={18} color={Colors.light.onSurfaceVariant} />
        </View>
        <View style={styles.toggleText}>
          <Text style={[styles.toggleTitle, disabled && styles.disabledText]}>{title}</Text>
          <Text style={styles.toggleSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: Colors.light.outlineVariant, true: Colors.light.primary + "60" }}
        thumbColor={value ? Colors.light.primary : Colors.light.surfaceContainerHigh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 20,
  },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "600", color: Colors.light.foreground },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: Colors.light.onSurfaceVariant,
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 10,
  },
  card: {
    marginHorizontal: 24,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    padding: 4,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  toggleRowDisabled: { opacity: 0.5 },
  toggleInfo: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 14, fontWeight: "600", color: Colors.light.foreground },
  toggleSubtitle: { fontSize: 12, color: Colors.light.onSurfaceVariant },
  disabledText: { color: Colors.light.outline },
  divider: {
    height: 1,
    backgroundColor: Colors.light.surfaceContainerLow,
    marginHorizontal: 14,
  },
});
