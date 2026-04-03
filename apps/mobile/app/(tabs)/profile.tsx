import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Linking,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";

const API_URL =
  process.env.EXPO_PUBLIC_APP_URL || "http://localhost:3000";

interface BillingStatus {
  role: string;
  tierName: string | null;
  hasStripeCustomer: boolean;
  subscription: {
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    amount: number;
    tierName: string;
  } | null;
}

interface Invoice {
  id: string;
  amount: number;
  status: "draft" | "sent" | "paid" | "overdue" | "void";
  description: string;
  due_date: string;
  created_at: string;
}

type Transaction = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  date: string;
  amount: string;
  type: "charge" | "payment" | "credit";
  status?: "paid" | "sent" | "overdue" | "void" | "draft";
};

// Fallback activity for demo mode or when API is unavailable
const MOCK_ACTIVITY: Transaction[] = [
  {
    id: "1",
    icon: "restaurant-outline",
    title: "The Conservatory Dining",
    date: "Mar 15, 2026 • 7:30 PM",
    amount: "-$362.50",
    type: "charge",
  },
  {
    id: "2",
    icon: "golf-outline",
    title: "Golf Pro Shop Purchase",
    date: "Mar 12, 2026 • 11:15 AM",
    amount: "-$1,280.00",
    type: "charge",
  },
  {
    id: "3",
    icon: "card-outline",
    title: "Annual Membership Fee",
    date: "Mar 1, 2026",
    amount: "-$2,500.00",
    type: "charge",
  },
];

function getInvoiceIcon(description: string): keyof typeof Ionicons.glyphMap {
  const lower = description.toLowerCase();
  if (lower.includes("dining") || lower.includes("restaurant") || lower.includes("food") || lower.includes("f&b")) {
    return "restaurant-outline";
  }
  if (lower.includes("golf") || lower.includes("pro shop") || lower.includes("green fee")) {
    return "golf-outline";
  }
  if (lower.includes("membership") || lower.includes("dues") || lower.includes("fee")) {
    return "card-outline";
  }
  return "receipt-outline";
}

function formatInvoiceDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function mapInvoiceType(status: Invoice["status"]): Transaction["type"] {
  if (status === "paid") return "payment";
  if (status === "void") return "credit";
  return "charge";
}

function mapInvoiceToTransaction(invoice: Invoice): Transaction {
  const formattedAmount = `-$${invoice.amount.toFixed(2)}`;
  return {
    id: invoice.id,
    icon: getInvoiceIcon(invoice.description),
    title: invoice.description,
    date: formatInvoiceDate(invoice.due_date || invoice.created_at),
    amount: formattedAmount,
    type: mapInvoiceType(invoice.status),
    status: invoice.status,
  };
}

const STATUS_COLORS: Record<string, string> = {
  paid: "#16a34a",
  overdue: "#dc2626",
  sent: "#d97706",
  draft: "#6b7280",
  void: "#9ca3af",
};

export default function ProfileScreen() {
  const { user, session, signOut } = useAuth();
  const router = useRouter();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_ACTIVITY);

  const getHeaders = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      h["Authorization"] = `Bearer ${session.access_token}`;
    }
    return h;
  }, [session?.access_token]);

  const fetchInvoices = useCallback(async () => {
    const headers = getHeaders();
    try {
      const res = await fetch(`${API_URL}/api/billing/invoices`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.invoices && data.invoices.length > 0) {
          const mapped = data.invoices
            .slice(0, 10)
            .map((inv: Invoice) => mapInvoiceToTransaction(inv));
          setTransactions(mapped);
        }
        // If invoices array is empty, keep MOCK_ACTIVITY as fallback
      }
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
      // Keep MOCK_ACTIVITY as fallback on error
    }
  }, [getHeaders]);

  const fetchBilling = useCallback(async () => {
    const headers = getHeaders();
    try {
      const res = await fetch(`${API_URL}/api/billing/status`, { headers });
      if (res.ok) {
        const data = await res.json();
        setBilling(data);
      }
    } catch (err) {
      console.error("Failed to fetch billing:", err);
    } finally {
      setBillingLoading(false);
      setRefreshing(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchBilling();
    fetchInvoices();
  }, [fetchBilling, fetchInvoices]);

  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  }

  async function handleManageBilling() {
    const headers = getHeaders();
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/billing/portal`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (res.ok && data.portalUrl) {
        await Linking.openURL(data.portalUrl);
      } else {
        Alert.alert("Error", data.error || "Failed to open billing portal");
      }
    } catch {
      Alert.alert("Error", "Failed to open billing portal");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSetupBilling() {
    const headers = getHeaders();
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/billing/setup`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        await Linking.openURL(data.checkoutUrl);
      } else {
        Alert.alert("Error", data.error || "Failed to start billing setup");
      }
    } catch {
      Alert.alert("Error", "Failed to start billing setup");
    } finally {
      setActionLoading(false);
    }
  }

  const fullName = user?.user_metadata?.full_name ?? "Member";
  const initials = fullName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const sub = billing?.subscription;
  const tierName = billing?.tierName || sub?.tierName || "Member";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchBilling();
            fetchInvoices();
          }}
          tintColor={Colors.light.primary}
        />
      }
    >
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.profileName}>{fullName}</Text>
        <View style={styles.tierBadge}>
          <Text style={styles.tierBadgeText}>
            {tierName.toUpperCase()} MEMBER
          </Text>
        </View>
      </View>

      {/* Account Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>CURRENT STATEMENT BALANCE</Text>
        {billingLoading ? (
          <ActivityIndicator
            size="small"
            color={Colors.light.primaryForeground}
            style={{ marginVertical: 12 }}
          />
        ) : (
          <Text style={styles.balanceAmount}>
            ${sub ? sub.amount.toFixed(2) : "0.00"}
          </Text>
        )}
        <View style={styles.balanceActions}>
          <TouchableOpacity
            style={styles.payButton}
            onPress={sub ? handleManageBilling : handleSetupBilling}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.payButtonText}>
              {sub ? "Pay Statement" : "Set Up Billing"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.detailsButton}
            onPress={handleManageBilling}
            disabled={actionLoading}
            activeOpacity={0.7}
          >
            <Text style={styles.detailsButtonText}>Details</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Account Details */}
      {sub && (
        <View style={styles.accountDetails}>
          <View style={styles.accountDetailRow}>
            <Text style={styles.accountDetailLabel}>UNBILLED CHARGES</Text>
            <View style={styles.accountDetailValueRow}>
              <Text style={styles.accountDetailValue}>
                ${sub.amount.toFixed(2)}
              </Text>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={Colors.light.onSurfaceVariant}
              />
            </View>
          </View>
          <View style={styles.accountDetailDivider} />
          <View style={styles.accountDetailRow}>
            <Text style={styles.accountDetailLabel}>NEXT BILLING</Text>
            <Text style={styles.accountDetailValue}>
              {sub.currentPeriodEnd
                ? new Date(sub.currentPeriodEnd).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </Text>
          </View>
          {sub.cancelAtPeriodEnd && (
            <>
              <View style={styles.accountDetailDivider} />
              <View style={styles.cancelWarning}>
                <Ionicons name="warning-outline" size={14} color="#92400e" />
                <Text style={styles.cancelWarningText}>
                  Cancels at end of billing period
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* Membership Card Link */}
      <TouchableOpacity
        style={styles.membershipCardButton}
        onPress={() => router.push("/membership-card")}
        activeOpacity={0.7}
      >
        <View style={styles.membershipCardIcon}>
          <Ionicons
            name="diamond"
            size={16}
            color={Colors.light.primaryForeground}
          />
        </View>
        <View style={styles.membershipCardContent}>
          <Text style={styles.membershipCardTitle}>Membership Card</Text>
          <Text style={styles.membershipCardSubtitle}>
            View your digital member ID & QR code
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={Colors.light.onSurfaceVariant}
        />
      </TouchableOpacity>

      {/* Recent Activity */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.viewAllText}>VIEW ALL</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.activityCard}>
          {transactions.map((tx, index) => (
            <View key={tx.id}>
              {index > 0 && <View style={styles.activityDivider} />}
              <View style={styles.activityRow}>
                <View style={styles.activityIconWrap}>
                  <Ionicons
                    name={tx.icon}
                    size={20}
                    color={Colors.light.primary}
                  />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>{tx.title}</Text>
                  <View style={styles.activityDateRow}>
                    <Text style={styles.activityDate}>{tx.date}</Text>
                    {tx.status && (
                      <View style={styles.statusBadge}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: STATUS_COLORS[tx.status] || "#6b7280" },
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusText,
                            { color: STATUS_COLORS[tx.status] || "#6b7280" },
                          ]}
                        >
                          {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text
                  style={[
                    styles.activityAmount,
                    tx.type === "payment" && styles.activityAmountPaid,
                    tx.type === "credit" && styles.activityAmountCredit,
                  ]}
                >
                  {tx.amount}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Account Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Settings</Text>
        <View style={styles.settingsCard}>
          <SettingsRow
            icon="person-outline"
            title="Personal Information"
            subtitle="Name, email, phone number"
            onPress={() => router.push("/settings/personal-info" as never)}
          />
          <View style={styles.settingsDivider} />
          <SettingsRow
            icon="notifications-outline"
            title="Notification Preferences"
            subtitle="Push notifications, emails and alerts"
            onPress={() => router.push("/settings/notifications" as never)}
          />
          <View style={styles.settingsDivider} />
          <SettingsRow
            icon="shield-checkmark-outline"
            title="Security & Privacy"
            subtitle="Password, 2FA, data preferences"
            onPress={() => router.push("/settings/security" as never)}
          />
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
        activeOpacity={0.7}
      >
        <Text style={styles.signOutText}>Sign Out of ClubOS</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.settingsRow} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.settingsIconWrap}>
        <Ionicons name={icon} size={20} color={Colors.light.onSurfaceVariant} />
      </View>
      <View style={styles.settingsContent}>
        <Text style={styles.settingsTitle}>{title}</Text>
        <Text style={styles.settingsSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={Colors.light.outlineVariant}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    paddingBottom: 20,
  },

  // Profile Header
  profileHeader: {
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 70 : 50,
    paddingBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.surfaceContainerHigh,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 3,
    borderColor: Colors.light.outlineVariant,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.light.onSurfaceVariant,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.light.foreground,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    marginBottom: 6,
  },
  tierBadge: {
    backgroundColor: Colors.light.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: Colors.light.primaryForeground,
  },

  // Balance Card
  balanceCard: {
    marginHorizontal: 24,
    backgroundColor: Colors.light.primary,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 6,
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.5,
    color: Colors.light.accent,
    marginBottom: 6,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "700",
    color: Colors.light.primaryForeground,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    marginBottom: 20,
  },
  balanceActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  payButton: {
    flex: 1,
    backgroundColor: Colors.light.primaryForeground,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  payButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.primary,
  },
  detailsButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.accent + "60",
    alignItems: "center",
    justifyContent: "center",
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.primaryForeground,
  },

  // Account Details
  accountDetails: {
    marginHorizontal: 24,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  accountDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  accountDetailLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    color: Colors.light.outline,
  },
  accountDetailValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  accountDetailValue: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  accountDetailDivider: {
    height: 1,
    backgroundColor: Colors.light.surfaceContainerLow,
    marginVertical: 12,
  },
  cancelWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fffbeb",
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  cancelWarningText: {
    fontSize: 12,
    color: "#92400e",
    fontWeight: "500",
  },

  // Membership Card Button
  membershipCardButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 24,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  membershipCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  membershipCardContent: {
    flex: 1,
    gap: 2,
  },
  membershipCardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  membershipCardSubtitle: {
    fontSize: 12,
    color: Colors.light.onSurfaceVariant,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.foreground,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: Colors.light.onSurfaceVariant,
  },

  // Activity
  activityCard: {
    marginHorizontal: 24,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  activityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  activityContent: {
    flex: 1,
    gap: 2,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  activityDate: {
    fontSize: 11,
    color: Colors.light.onSurfaceVariant,
  },
  activityDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  activityAmountPaid: {
    color: "#16a34a",
  },
  activityAmountCredit: {
    color: "#6b7280",
  },
  activityDivider: {
    height: 1,
    backgroundColor: Colors.light.surfaceContainerLow,
    marginVertical: 10,
  },

  // Settings
  settingsCard: {
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
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
  },
  settingsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsContent: {
    flex: 1,
    gap: 2,
  },
  settingsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  settingsSubtitle: {
    fontSize: 12,
    color: Colors.light.onSurfaceVariant,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: Colors.light.surfaceContainerLow,
    marginHorizontal: 14,
  },

  // Sign Out
  signOutButton: {
    alignItems: "center",
    marginHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.destructive + "40",
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.destructive,
  },
});
