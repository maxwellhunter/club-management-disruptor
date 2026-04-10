import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Linking,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";
import { haptics } from "@/lib/haptics";

const API_URL =
  process.env.EXPO_PUBLIC_APP_URL || "http://localhost:3000";

/* ─── Types ────────────────────────────────────────────────────── */

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
  paid_at: string | null;
  created_at: string;
}

type FilterStatus = "all" | "paid" | "outstanding";

/* ─── Helpers ──────────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  paid: "#16a34a",
  overdue: "#dc2626",
  sent: "#d97706",
  draft: "#6b7280",
  void: "#9ca3af",
};

const STATUS_BG: Record<string, string> = {
  paid: "#f0fdf4",
  overdue: "#fef2f2",
  sent: "#fffbeb",
  draft: "#f9fafb",
  void: "#f9fafb",
};

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
  if (lower.includes("spa") || lower.includes("wellness")) {
    return "leaf-outline";
  }
  if (lower.includes("event") || lower.includes("party")) {
    return "calendar-outline";
  }
  return "receipt-outline";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function getSubStatusLabel(status: string): string {
  const map: Record<string, string> = {
    active: "Active",
    trialing: "Trial",
    past_due: "Past Due",
    canceled: "Canceled",
    incomplete: "Incomplete",
  };
  return map[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

function getSubStatusColor(status: string): string {
  const map: Record<string, string> = {
    active: "#16a34a",
    trialing: "#2563eb",
    past_due: "#dc2626",
    canceled: "#6b7280",
    incomplete: "#d97706",
  };
  return map[status] || "#6b7280";
}

/* ─── Component ────────────────────────────────────────────────── */

export default function BillingScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getHeaders = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      h["Authorization"] = `Bearer ${session.access_token}`;
    }
    return h;
  }, [session?.access_token]);

  const fetchData = useCallback(async () => {
    const headers = getHeaders();
    try {
      const [billingRes, invoicesRes] = await Promise.all([
        fetch(`${API_URL}/api/billing/status`, { headers }),
        fetch(`${API_URL}/api/billing/invoices`, { headers }),
      ]);

      if (billingRes.ok) {
        setBilling(await billingRes.json());
      }
      if (invoicesRes.ok) {
        const data = await invoicesRes.json();
        if (data.invoices) {
          setInvoices(data.invoices);
        }
      }
    } catch (err) {
      console.error("Failed to fetch billing data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleManageBilling() {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/billing/portal`, {
        method: "POST",
        headers: getHeaders(),
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
        headers: getHeaders(),
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

  // Filter invoices
  const filteredInvoices = invoices.filter((inv) => {
    if (filter === "all") return true;
    if (filter === "paid") return inv.status === "paid";
    // outstanding = sent + overdue + draft
    return inv.status === "sent" || inv.status === "overdue" || inv.status === "draft";
  });

  // Summary stats
  const totalOutstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue" || i.status === "draft")
    .reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);
  const overdueCount = invoices.filter((i) => i.status === "overdue").length;

  const sub = billing?.subscription;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <Text style={styles.loadingText}>Loading billing...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            haptics.light();
            setRefreshing(true);
            fetchData();
          }}
          tintColor={Colors.light.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.light.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Billing & Payments</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Subscription Card */}
      <View style={styles.subscriptionCard}>
        {sub ? (
          <>
            <View style={styles.subHeader}>
              <View>
                <Text style={styles.subTierName}>{sub.tierName}</Text>
                <Text style={styles.subLabel}>Membership Plan</Text>
              </View>
              <View
                style={[
                  styles.subStatusBadge,
                  { backgroundColor: getSubStatusColor(sub.status) + "18" },
                ]}
              >
                <View
                  style={[
                    styles.subStatusDot,
                    { backgroundColor: getSubStatusColor(sub.status) },
                  ]}
                />
                <Text
                  style={[
                    styles.subStatusText,
                    { color: getSubStatusColor(sub.status) },
                  ]}
                >
                  {getSubStatusLabel(sub.status)}
                </Text>
              </View>
            </View>

            <View style={styles.subDivider} />

            <View style={styles.subDetailsGrid}>
              <View style={styles.subDetailItem}>
                <Text style={styles.subDetailLabel}>AMOUNT</Text>
                <Text style={styles.subDetailValue}>
                  {formatCurrency(sub.amount)}/mo
                </Text>
              </View>
              <View style={styles.subDetailItem}>
                <Text style={styles.subDetailLabel}>NEXT BILLING</Text>
                <Text style={styles.subDetailValue}>
                  {sub.currentPeriodEnd
                    ? formatDate(sub.currentPeriodEnd)
                    : "—"}
                </Text>
              </View>
            </View>

            {sub.cancelAtPeriodEnd && (
              <View style={styles.cancelWarning}>
                <Ionicons name="warning-outline" size={14} color="#92400e" />
                <Text style={styles.cancelWarningText}>
                  Cancels at end of billing period
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.manageButton}
              onPress={handleManageBilling}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={Colors.light.primaryForeground} />
              ) : (
                <>
                  <Ionicons
                    name="settings-outline"
                    size={16}
                    color={Colors.light.primaryForeground}
                  />
                  <Text style={styles.manageButtonText}>
                    Manage Subscription
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.noSubContainer}>
            <View style={styles.noSubIcon}>
              <Ionicons name="card-outline" size={32} color={Colors.light.onSurfaceVariant} />
            </View>
            <Text style={styles.noSubTitle}>No Active Subscription</Text>
            <Text style={styles.noSubDescription}>
              Set up billing to activate your membership and start enjoying club
              benefits.
            </Text>
            <TouchableOpacity
              style={styles.setupButton}
              onPress={handleSetupBilling}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={Colors.light.primaryForeground} />
              ) : (
                <Text style={styles.setupButtonText}>Set Up Billing</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Summary Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Outstanding</Text>
          <Text style={[styles.statValue, totalOutstanding > 0 && styles.statValueWarning]}>
            {formatCurrency(totalOutstanding)}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Paid</Text>
          <Text style={[styles.statValue, styles.statValueSuccess]}>
            {formatCurrency(totalPaid)}
          </Text>
        </View>
        {overdueCount > 0 && (
          <View style={[styles.statCard, styles.statCardOverdue]}>
            <Text style={styles.statLabel}>Overdue</Text>
            <Text style={[styles.statValue, styles.statValueDanger]}>
              {overdueCount}
            </Text>
          </View>
        )}
      </View>

      {/* Invoice List */}
      <View style={styles.invoiceSection}>
        <Text style={styles.sectionTitle}>Invoice History</Text>

        {/* Filters */}
        <View style={styles.filterRow}>
          {(["all", "outstanding", "paid"] as FilterStatus[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === f && styles.filterChipTextActive,
                ]}
              >
                {f === "all"
                  ? `All (${invoices.length})`
                  : f === "outstanding"
                    ? `Outstanding (${invoices.filter((i) => i.status === "sent" || i.status === "overdue" || i.status === "draft").length})`
                    : `Paid (${invoices.filter((i) => i.status === "paid").length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Invoice Cards */}
        {filteredInvoices.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="receipt-outline"
              size={40}
              color={Colors.light.outlineVariant}
            />
            <Text style={styles.emptyTitle}>No invoices</Text>
            <Text style={styles.emptySubtitle}>
              {filter === "all"
                ? "Your invoice history will appear here"
                : `No ${filter} invoices found`}
            </Text>
          </View>
        ) : (
          <View style={styles.invoiceList}>
            {filteredInvoices.map((invoice) => {
              const isExpanded = expandedId === invoice.id;
              return (
                <TouchableOpacity
                  key={invoice.id}
                  style={styles.invoiceCard}
                  onPress={() =>
                    setExpandedId(isExpanded ? null : invoice.id)
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.invoiceRow}>
                    <View style={styles.invoiceIconWrap}>
                      <Ionicons
                        name={getInvoiceIcon(invoice.description)}
                        size={20}
                        color={Colors.light.primary}
                      />
                    </View>
                    <View style={styles.invoiceContent}>
                      <Text style={styles.invoiceTitle} numberOfLines={1}>
                        {invoice.description}
                      </Text>
                      <View style={styles.invoiceMeta}>
                        <Text style={styles.invoiceDate}>
                          {formatDate(invoice.due_date || invoice.created_at)}
                        </Text>
                        <View
                          style={[
                            styles.invoiceStatusBadge,
                            {
                              backgroundColor:
                                STATUS_BG[invoice.status] || "#f9fafb",
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.invoiceStatusDot,
                              {
                                backgroundColor:
                                  STATUS_COLORS[invoice.status] || "#6b7280",
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.invoiceStatusText,
                              {
                                color:
                                  STATUS_COLORS[invoice.status] || "#6b7280",
                              },
                            ]}
                          >
                            {invoice.status.charAt(0).toUpperCase() +
                              invoice.status.slice(1)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.invoiceAmountCol}>
                      <Text style={styles.invoiceAmount}>
                        {formatCurrency(invoice.amount)}
                      </Text>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={14}
                        color={Colors.light.onSurfaceVariant}
                      />
                    </View>
                  </View>

                  {isExpanded && (
                    <View style={styles.invoiceExpanded}>
                      <View style={styles.invoiceExpandedDivider} />
                      <View style={styles.invoiceDetailRow}>
                        <Text style={styles.invoiceDetailLabel}>Invoice ID</Text>
                        <Text style={styles.invoiceDetailValue}>
                          {invoice.id.slice(0, 8)}...
                        </Text>
                      </View>
                      <View style={styles.invoiceDetailRow}>
                        <Text style={styles.invoiceDetailLabel}>Created</Text>
                        <Text style={styles.invoiceDetailValue}>
                          {formatDate(invoice.created_at)}
                        </Text>
                      </View>
                      {invoice.due_date && (
                        <View style={styles.invoiceDetailRow}>
                          <Text style={styles.invoiceDetailLabel}>Due Date</Text>
                          <Text style={styles.invoiceDetailValue}>
                            {formatDate(invoice.due_date)}
                          </Text>
                        </View>
                      )}
                      {invoice.paid_at && (
                        <View style={styles.invoiceDetailRow}>
                          <Text style={styles.invoiceDetailLabel}>Paid On</Text>
                          <Text
                            style={[
                              styles.invoiceDetailValue,
                              { color: "#16a34a" },
                            ]}
                          >
                            {formatDate(invoice.paid_at)}
                          </Text>
                        </View>
                      )}
                      {(invoice.status === "sent" ||
                        invoice.status === "overdue") &&
                        sub && (
                          <TouchableOpacity
                            style={styles.payInvoiceButton}
                            onPress={handleManageBilling}
                            activeOpacity={0.8}
                          >
                            <Ionicons
                              name="card-outline"
                              size={14}
                              color={Colors.light.primaryForeground}
                            />
                            <Text style={styles.payInvoiceText}>
                              Pay Now
                            </Text>
                          </TouchableOpacity>
                        )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsCard}>
          <QuickAction
            icon="download-outline"
            title="Download Statements"
            subtitle="Export monthly billing statements"
            onPress={handleManageBilling}
          />
          <View style={styles.actionDivider} />
          <QuickAction
            icon="card-outline"
            title="Payment Methods"
            subtitle="Update your card on file"
            onPress={handleManageBilling}
          />
          <View style={styles.actionDivider} />
          <QuickAction
            icon="help-circle-outline"
            title="Billing Support"
            subtitle="Contact us about billing questions"
            onPress={() =>
              Alert.alert(
                "Billing Support",
                "Please contact the front desk or email billing@thelakes.club for billing inquiries."
              )
            }
          />
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon} size={20} color={Colors.light.onSurfaceVariant} />
      </View>
      <View style={styles.actionContent}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={Colors.light.outlineVariant}
      />
    </TouchableOpacity>
  );
}

/* ─── Styles ───────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.background,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.light.onSurfaceVariant,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.foreground,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },

  // Subscription Card
  subscriptionCard: {
    marginHorizontal: 24,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  subHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  subTierName: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.foreground,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  subLabel: {
    fontSize: 12,
    color: Colors.light.onSurfaceVariant,
    marginTop: 2,
  },
  subStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  subStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  subStatusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  subDivider: {
    height: 1,
    backgroundColor: Colors.light.surfaceContainerLow,
    marginVertical: 16,
  },
  subDetailsGrid: {
    flexDirection: "row",
    gap: 20,
  },
  subDetailItem: {
    flex: 1,
    gap: 4,
  },
  subDetailLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    color: Colors.light.outline,
  },
  subDetailValue: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  cancelWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fffbeb",
    padding: 10,
    borderRadius: 10,
    marginTop: 16,
  },
  cancelWarningText: {
    fontSize: 12,
    color: "#92400e",
    fontWeight: "500",
  },
  manageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 16,
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.primaryForeground,
  },

  // No Sub
  noSubContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  noSubIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  noSubTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.foreground,
    marginBottom: 6,
  },
  noSubDescription: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  setupButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  setupButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.primaryForeground,
  },

  // Stats Row
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 24,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 14,
    padding: 14,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  statCardOverdue: {
    backgroundColor: "#fef2f2",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: Colors.light.outline,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.foreground,
  },
  statValueWarning: {
    color: "#d97706",
  },
  statValueSuccess: {
    color: "#16a34a",
  },
  statValueDanger: {
    color: "#dc2626",
  },

  // Invoice Section
  invoiceSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.foreground,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    paddingHorizontal: 24,
    marginBottom: 12,
  },

  // Filters
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceContainerLow,
  },
  filterChipActive: {
    backgroundColor: Colors.light.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.onSurfaceVariant,
  },
  filterChipTextActive: {
    color: Colors.light.primaryForeground,
  },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.foreground,
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
  },

  // Invoice List
  invoiceList: {
    paddingHorizontal: 24,
    gap: 10,
  },
  invoiceCard: {
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    padding: 14,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  invoiceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  invoiceContent: {
    flex: 1,
    gap: 3,
  },
  invoiceTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  invoiceMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  invoiceDate: {
    fontSize: 11,
    color: Colors.light.onSurfaceVariant,
  },
  invoiceStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  invoiceStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  invoiceStatusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  invoiceAmountCol: {
    alignItems: "flex-end",
    gap: 4,
  },
  invoiceAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.foreground,
  },

  // Expanded Invoice
  invoiceExpanded: {
    paddingTop: 4,
  },
  invoiceExpandedDivider: {
    height: 1,
    backgroundColor: Colors.light.surfaceContainerLow,
    marginVertical: 12,
  },
  invoiceDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  invoiceDetailLabel: {
    fontSize: 12,
    color: Colors.light.onSurfaceVariant,
  },
  invoiceDetailValue: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  payInvoiceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.light.primary,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
  },
  payInvoiceText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.primaryForeground,
  },

  // Quick Actions
  quickActions: {
    marginBottom: 8,
  },
  actionsCard: {
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
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  actionContent: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  actionSubtitle: {
    fontSize: 12,
    color: Colors.light.onSurfaceVariant,
  },
  actionDivider: {
    height: 1,
    backgroundColor: Colors.light.surfaceContainerLow,
    marginHorizontal: 14,
  },
});
