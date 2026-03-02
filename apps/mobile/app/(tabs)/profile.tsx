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
} from "react-native";
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

export default function ProfileScreen() {
  const { user, session, signOut } = useAuth();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const fetchBilling = useCallback(async () => {
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
  }, [session?.access_token]);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  }

  async function handleManageBilling() {
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

  function formatDate(dateStr: string) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const sub = billing?.subscription;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchBilling();
          }}
          tintColor={Colors.light.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.user_metadata?.full_name ?? "U").charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>
          {user?.user_metadata?.full_name ?? "Member"}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Membership info */}
      <View style={styles.section}>
        <ProfileRow
          label="Membership"
          value={billing?.tierName || "—"}
        />
        <ProfileRow label="Member Since" value="—" />
        {sub ? (
          <ProfileRow
            label="Subscription"
            value={sub.status === "active" ? "Active" : sub.status.replace("_", " ")}
            valueColor={sub.status === "active" ? "#16a34a" : "#dc2626"}
          />
        ) : (
          <ProfileRow label="Subscription" value="Not set up" />
        )}
      </View>

      {/* Billing section */}
      <View style={styles.section}>
        {billingLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={Colors.light.primary} />
            <Text style={styles.loadingText}>Loading billing...</Text>
          </View>
        ) : sub ? (
          <>
            <ProfileRow
              label="Monthly Dues"
              value={`$${sub.amount}/mo`}
            />
            <ProfileRow
              label="Next Billing"
              value={formatDate(sub.currentPeriodEnd)}
            />
            {sub.cancelAtPeriodEnd && (
              <View style={styles.warningRow}>
                <Text style={styles.warningText}>
                  Cancels at end of billing period
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.actionRow, actionLoading && { opacity: 0.5 }]}
              onPress={handleManageBilling}
              disabled={actionLoading}
              activeOpacity={0.6}
            >
              <Text style={styles.actionText}>Manage Billing</Text>
              <Text style={styles.actionArrow}>→</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.setupRow, actionLoading && { opacity: 0.5 }]}
            onPress={handleSetupBilling}
            disabled={actionLoading}
            activeOpacity={0.6}
          >
            <View>
              <Text style={styles.setupTitle}>Set Up Billing</Text>
              <Text style={styles.setupSubtitle}>
                Start automatic dues payments
              </Text>
            </View>
            <Text style={styles.actionArrow}>→</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Other actions */}
      <View style={styles.section}>
        <ProfileRow label="Notifications" value="→" />
        <ProfileRow label="Family Members" value="→" />
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ProfileRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
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
  header: {
    alignItems: "center",
    marginBottom: 32,
    marginTop: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.light.primaryForeground,
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.light.foreground,
  },
  email: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
    marginTop: 2,
  },
  section: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  rowLabel: {
    fontSize: 14,
    color: Colors.light.foreground,
  },
  rowValue: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
  },
  warningRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fef3c7",
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  warningText: {
    fontSize: 13,
    color: "#92400e",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.primary,
  },
  actionArrow: {
    fontSize: 16,
    color: Colors.light.mutedForeground,
  },
  setupRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  setupTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.primary,
  },
  setupSubtitle: {
    fontSize: 12,
    color: Colors.light.mutedForeground,
    marginTop: 2,
  },
  signOutButton: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.destructive,
    marginTop: 8,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.destructive,
  },
});
