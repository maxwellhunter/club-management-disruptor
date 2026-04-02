import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";

interface MemberInfo {
  full_name: string;
  tier_name: string;
  member_number: string;
  member_since: string;
  role: string;
}

export default function MembershipCardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMember = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("members")
        .select("first_name, last_name, member_number, created_at, role, membership_tiers(name)")
        .eq("user_id", user?.id)
        .single();

      if (data) {
        const tier = (data as any).membership_tiers;
        setMember({
          full_name: `${data.first_name} ${data.last_name}`,
          tier_name: tier?.name || "Standard",
          member_number: data.member_number || generateMemberNumber(),
          member_since: new Date(data.created_at).getFullYear().toString(),
          role: data.role || "member",
        });
      }
    } catch {
      // Use fallback from user metadata
      setMember({
        full_name: user?.user_metadata?.full_name || "Member",
        tier_name: "Standard",
        member_number: generateMemberNumber(),
        member_since: new Date().getFullYear().toString(),
        role: "member",
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  const initials = (member?.full_name || "M")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={Colors.light.foreground}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Membership</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Welcome */}
      <Text style={styles.pageTitle}>Membership</Text>
      <Text style={styles.pageSubtitle}>
        Welcome back, {member?.full_name?.split(" ")[0]}
      </Text>

      {/* Digital Member Card */}
      <View style={styles.cardOuter}>
        <View style={styles.card}>
          {/* Card Header */}
          <View style={styles.cardHeader}>
            <Text style={styles.cardBadge}>
              {member?.tier_name?.toUpperCase() || "MEMBER"}
            </Text>
          </View>

          {/* Club Branding */}
          <View style={styles.cardBranding}>
            <View style={styles.cardLogoMark}>
              <Ionicons
                name="diamond"
                size={16}
                color={Colors.light.primaryForeground}
              />
            </View>
            <Text style={styles.cardClubName}>The Lakes</Text>
          </View>

          {/* Avatar */}
          <View style={styles.cardAvatarRow}>
            <View style={styles.cardAvatar}>
              <Text style={styles.cardAvatarText}>{initials}</Text>
            </View>
          </View>

          {/* Member Info */}
          <View style={styles.cardInfoRow}>
            <View style={styles.cardInfoBlock}>
              <Text style={styles.cardInfoLabel}>MEMBER NAME</Text>
              <Text style={styles.cardInfoValue}>{member?.full_name}</Text>
            </View>
            <View style={styles.cardInfoBlock}>
              <Text style={styles.cardInfoLabel}>TIER</Text>
              <Text style={styles.cardInfoValue}>{member?.tier_name}</Text>
            </View>
          </View>

          {/* QR Code Area */}
          <View style={styles.qrSection}>
            <View style={styles.qrCode}>
              {/* Stylized QR placeholder */}
              <View style={styles.qrGrid}>
                {Array.from({ length: 25 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.qrDot,
                      {
                        backgroundColor:
                          (i + Math.floor(i / 5)) % 3 === 0
                            ? Colors.light.primary
                            : (i + Math.floor(i / 5)) % 2 === 0
                            ? Colors.light.primaryContainer
                            : Colors.light.surfaceContainerHigh,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
            <Text style={styles.qrHint}>
              Scan for quick entry & member-only payments
            </Text>
          </View>

          {/* Scan to Pay Button */}
          <TouchableOpacity style={styles.scanButton} activeOpacity={0.8}>
            <Ionicons
              name="scan-outline"
              size={18}
              color={Colors.light.primaryForeground}
            />
            <Text style={styles.scanButtonText}>SCAN TO PAY</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Nearby Services */}
      <View style={styles.servicesSection}>
        <View style={styles.servicesSectionHeader}>
          <Text style={styles.servicesSectionTitle}>Nearby Services</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.viewAllText}>VIEW ALL</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.servicesGrid}>
          <TouchableOpacity
            style={styles.serviceCard}
            activeOpacity={0.7}
            onPress={() => router.push("/(tabs)/dining")}
          >
            <Ionicons
              name="restaurant-outline"
              size={24}
              color={Colors.light.primary}
            />
            <Text style={styles.serviceCardTitle}>Private Dining</Text>
            <Text style={styles.serviceCardSubtitle}>Available Now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            activeOpacity={0.7}
            onPress={() => router.push("/(tabs)/bookings")}
          >
            <Ionicons
              name="golf-outline"
              size={24}
              color={Colors.light.primary}
            />
            <Text style={styles.serviceCardTitle}>Pro Shop</Text>
            <Text style={styles.serviceCardSubtitle}>Book Tee Time</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.serviceCard, styles.serviceCardWide]}
            activeOpacity={0.7}
            onPress={() => router.push("/(tabs)/events")}
          >
            <Ionicons
              name="sparkles-outline"
              size={24}
              color={Colors.light.tertiary}
            />
            <View style={styles.serviceCardWideContent}>
              <Text style={styles.serviceCardTitle}>Spa & Wellness</Text>
              <Text style={styles.serviceCardSubtitle}>
                Exclusive availability for {member?.tier_name} members
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function generateMemberNumber(): string {
  return `M-${String(Math.floor(Math.random() * 900000) + 100000)}`;
}

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
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
    color: Colors.light.onSurfaceVariant,
  },

  // Page title
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
    marginBottom: 24,
  },

  // Card outer (shadow container)
  cardOuter: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },

  // Digital Member Card
  card: {
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 24,
    padding: 24,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 4,
    // Subtle border for glass effect
    borderWidth: 1,
    borderColor: Colors.light.outlineVariant + "30",
  },
  cardHeader: {
    alignItems: "flex-start",
    marginBottom: 16,
  },
  cardBadge: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: Colors.light.primaryForeground,
    backgroundColor: Colors.light.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },

  // Card branding
  cardBranding: {
    alignItems: "center",
    marginBottom: 20,
  },
  cardLogoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  cardClubName: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 3,
    color: Colors.light.foreground,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },

  // Avatar
  cardAvatarRow: {
    alignItems: "center",
    marginBottom: 16,
  },
  cardAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.light.outlineVariant,
  },
  cardAvatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.onSurfaceVariant,
  },

  // Card info
  cardInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  cardInfoBlock: {
    gap: 2,
  },
  cardInfoLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1,
    color: Colors.light.outline,
  },
  cardInfoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
  },

  // QR Code
  qrSection: {
    alignItems: "center",
    marginBottom: 20,
    gap: 10,
  },
  qrCode: {
    width: 120,
    height: 120,
    backgroundColor: Colors.light.surfaceContainerLow,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  qrGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 90,
    height: 90,
    gap: 2,
  },
  qrDot: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  qrHint: {
    fontSize: 11,
    color: Colors.light.onSurfaceVariant,
    textAlign: "center",
    maxWidth: 220,
    lineHeight: 15,
  },

  // Scan button
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primaryContainer,
    borderRadius: 16,
    paddingVertical: 14,
  },
  scanButtonText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    color: Colors.light.primaryForeground,
  },

  // Nearby Services
  servicesSection: {
    paddingHorizontal: 24,
  },
  servicesSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  servicesSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.foreground,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  viewAllText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: Colors.light.onSurfaceVariant,
  },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  serviceCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  serviceCardWide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minWidth: "100%",
    backgroundColor: Colors.light.tertiaryFixed + "40",
  },
  serviceCardWideContent: {
    flex: 1,
    gap: 2,
  },
  serviceCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  serviceCardSubtitle: {
    fontSize: 12,
    color: Colors.light.onSurfaceVariant,
  },
});
