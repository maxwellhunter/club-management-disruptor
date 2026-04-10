import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";
import { haptics } from "@/lib/haptics";

const API_URL = process.env.EXPO_PUBLIC_APP_URL || "http://localhost:3000";

interface ReportData {
  membership: {
    total: number;
    active: number;
    inactive: number;
    byTier: { tier_name: string; count: number }[];
    trend: { month: string; count: number }[];
  };
  revenue: {
    mtd: number;
    collected: number;
    outstanding: number;
    trend: { month: string; revenue: number; collected: number }[];
  };
  bookings: {
    total: number;
    upcoming: number;
    cancelled: number;
    utilization: number;
    trend: { month: string; count: number }[];
  };
  events: {
    total: number;
    upcoming: number;
    totalAttendees: number;
    avgAttendance: number;
  };
}

type Tab = "overview" | "membership" | "revenue";

export default function ReportsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/reports`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
      });
      if (res.status === 403) {
        setError("admin");
        return;
      }
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError("Failed to load reports");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (error === "admin") {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="lock-closed-outline" size={48} color={Colors.light.outline} />
        <Text style={styles.errorTitle}>Admin Only</Text>
        <Text style={styles.errorSubtitle}>Reports are available to administrators.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>{error}</Text>
      </View>
    );
  }

  const fmt = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "membership", label: "Members" },
    { key: "revenue", label: "Revenue" },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { haptics.light(); setRefreshing(true); fetchData(); }} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.light.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports</Text>
        <View style={{ width: 32 }} />
      </View>

      <Text style={styles.pageTitle}>Club Analytics</Text>
      <Text style={styles.pageSubtitle}>Performance overview and trends</Text>

      {/* Tab pills */}
      <View style={styles.tabRow}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabPill, tab === t.key && styles.tabPillActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabPillText, tab === t.key && styles.tabPillTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "overview" && (
        <>
          {/* KPI Cards */}
          <View style={styles.kpiGrid}>
            <KPICard label="Active Members" value={String(data.membership.active)} icon="people" />
            <KPICard label="Revenue MTD" value={fmt(data.revenue.mtd)} icon="trending-up" accent />
            <KPICard label="Bookings" value={String(data.bookings.total)} icon="golf" />
            <KPICard label="Events" value={String(data.events.upcoming)} icon="calendar" subtitle="upcoming" />
          </View>

          {/* Quick stats */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Financial Summary</Text>
            <StatRow label="Collected" value={fmt(data.revenue.collected)} color="#16a34a" />
            <StatRow label="Outstanding" value={fmt(data.revenue.outstanding)} color="#f59e0b" />
            <StatRow label="Booking Utilization" value={`${data.bookings.utilization}%`} />
            <StatRow label="Avg Event Attendance" value={String(data.events.avgAttendance)} />
          </View>
        </>
      )}

      {tab === "membership" && (
        <>
          <View style={styles.kpiGrid}>
            <KPICard label="Total" value={String(data.membership.total)} icon="people" />
            <KPICard label="Active" value={String(data.membership.active)} icon="checkmark-circle" accent />
            <KPICard label="Inactive" value={String(data.membership.inactive)} icon="remove-circle" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Members by Tier</Text>
            {data.membership.byTier.map((t) => (
              <View key={t.tier_name} style={styles.tierRow}>
                <Text style={styles.tierName}>{t.tier_name}</Text>
                <View style={styles.tierBar}>
                  <View
                    style={[
                      styles.tierBarFill,
                      {
                        width: `${Math.min(100, (t.count / Math.max(1, data.membership.total)) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.tierCount}>{t.count}</Text>
              </View>
            ))}
          </View>

          {/* Trend */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>6-Month Trend</Text>
            {data.membership.trend.slice(-6).map((m) => (
              <View key={m.month} style={styles.trendRow}>
                <Text style={styles.trendMonth}>{m.month}</Text>
                <View style={styles.trendBar}>
                  <View
                    style={[
                      styles.trendBarFill,
                      {
                        width: `${Math.min(100, (m.count / Math.max(1, ...data.membership.trend.map((t) => t.count))) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.trendValue}>{m.count}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {tab === "revenue" && (
        <>
          <View style={styles.kpiGrid}>
            <KPICard label="MTD Revenue" value={fmt(data.revenue.mtd)} icon="trending-up" accent />
            <KPICard label="Collected" value={fmt(data.revenue.collected)} icon="checkmark-circle" />
            <KPICard label="Outstanding" value={fmt(data.revenue.outstanding)} icon="alert-circle" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>6-Month Revenue</Text>
            {data.revenue.trend.slice(-6).map((m) => (
              <View key={m.month} style={styles.trendRow}>
                <Text style={styles.trendMonth}>{m.month}</Text>
                <View style={styles.trendBar}>
                  <View
                    style={[
                      styles.trendBarFill,
                      {
                        width: `${Math.min(100, (m.revenue / Math.max(1, ...data.revenue.trend.map((t) => t.revenue))) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.trendValue}>{fmt(m.revenue)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function KPICard({
  label,
  value,
  icon,
  subtitle,
  accent,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  subtitle?: string;
  accent?: boolean;
}) {
  return (
    <View style={[styles.kpiCard, accent && styles.kpiCardAccent]}>
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={20}
        color={accent ? Colors.light.primaryForeground : Colors.light.primary}
      />
      <Text style={[styles.kpiValue, accent && styles.kpiValueAccent]}>{value}</Text>
      <Text style={[styles.kpiLabel, accent && styles.kpiLabelAccent]}>{label}</Text>
      {subtitle && (
        <Text style={[styles.kpiLabel, accent && styles.kpiLabelAccent]}>{subtitle}</Text>
      )}
    </View>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : undefined]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.background,
    gap: 12,
  },
  errorTitle: { fontSize: 16, fontWeight: "600", color: Colors.light.foreground },
  errorSubtitle: { fontSize: 13, color: Colors.light.onSurfaceVariant },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
  },
  backButtonText: { color: Colors.light.primaryForeground, fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 8,
  },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 13, fontWeight: "600", letterSpacing: 1, color: Colors.light.onSurfaceVariant },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.light.foreground,
    paddingHorizontal: 24,
    marginTop: 12,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.light.onSurfaceVariant,
    paddingHorizontal: 24,
    marginTop: 4,
    marginBottom: 20,
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 8,
    marginBottom: 20,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceContainerLow,
  },
  tabPillActive: { backgroundColor: Colors.light.primary },
  tabPillText: { fontSize: 13, fontWeight: "600", color: Colors.light.onSurfaceVariant },
  tabPillTextActive: { color: Colors.light.primaryForeground },

  // KPI Grid
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    gap: 4,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  kpiCardAccent: { backgroundColor: Colors.light.primary },
  kpiValue: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.light.foreground,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  kpiValueAccent: { color: Colors.light.primaryForeground },
  kpiLabel: { fontSize: 11, color: Colors.light.onSurfaceVariant },
  kpiLabelAccent: { color: Colors.light.accent },

  // Card
  card: {
    marginHorizontal: 24,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.foreground,
    marginBottom: 14,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },

  // Stats
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.surfaceContainerLow,
  },
  statLabel: { fontSize: 13, color: Colors.light.onSurfaceVariant },
  statValue: { fontSize: 14, fontWeight: "600", color: Colors.light.foreground },

  // Tier breakdown
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  tierName: { fontSize: 13, fontWeight: "500", color: Colors.light.foreground, width: 80 },
  tierBar: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.light.surfaceContainerLow,
    borderRadius: 4,
    overflow: "hidden",
  },
  tierBarFill: {
    height: "100%",
    backgroundColor: Colors.light.primary,
    borderRadius: 4,
  },
  tierCount: { fontSize: 13, fontWeight: "600", color: Colors.light.foreground, width: 30, textAlign: "right" },

  // Trend rows
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  trendMonth: { fontSize: 12, color: Colors.light.onSurfaceVariant, width: 60 },
  trendBar: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.light.surfaceContainerLow,
    borderRadius: 4,
    overflow: "hidden",
  },
  trendBarFill: {
    height: "100%",
    backgroundColor: Colors.light.primary,
    borderRadius: 4,
  },
  trendValue: { fontSize: 12, fontWeight: "600", color: Colors.light.foreground, width: 50, textAlign: "right" },
});
