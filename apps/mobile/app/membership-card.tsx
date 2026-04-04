import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
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

interface DigitalPass {
  id: string;
  platform: "apple" | "google";
  status: string;
  barcode_payload: string;
  installed_at: string | null;
  created_at: string;
}

interface NfcTap {
  id: string;
  tap_type: string;
  location: string | null;
  created_at: string;
}

export default function MembershipCardScreen() {
  const { user, session } = useAuth();
  const router = useRouter();
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [passes, setPasses] = useState<DigitalPass[]>([]);
  const [recentTaps, setRecentTaps] = useState<NfcTap[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingWallet, setAddingWallet] = useState<"apple" | "google" | null>(null);

  const appUrl = process.env.EXPO_PUBLIC_APP_URL || "http://localhost:3000";

  const fetchMember = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("members")
        .select(
          "first_name, last_name, member_number, created_at, role, membership_tiers(name)"
        )
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
      setMember({
        full_name: user?.user_metadata?.full_name || "Member",
        tier_name: "Standard",
        member_number: generateMemberNumber(),
        member_since: new Date().getFullYear().toString(),
        role: "member",
      });
    }
  }, [user?.id]);

  const fetchPasses = useCallback(async () => {
    try {
      const res = await fetch(`${appUrl}/api/wallet/passes`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setPasses(data.passes || []);
        setRecentTaps(data.recent_taps || []);
      }
    } catch {
      // Wallet data is optional — don't block the card
    }
  }, [session?.access_token, appUrl]);

  useEffect(() => {
    Promise.all([fetchMember(), fetchPasses()]).finally(() =>
      setLoading(false)
    );
  }, [fetchMember, fetchPasses]);

  async function handleAddToWallet(platform: "apple" | "google") {
    setAddingWallet(platform);
    try {
      const res = await fetch(`${appUrl}/api/wallet/passes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ platform }),
      });

      const data = await res.json();

      if (res.ok) {
        // Open the pass URL — this triggers wallet add on the device
        if (data.pass_url) {
          await Linking.openURL(data.pass_url);
        }
        Alert.alert(
          "Pass Created",
          `Your ${platform === "apple" ? "Apple Wallet" : "Google Wallet"} pass has been generated.`
        );
        fetchPasses();
      } else if (res.status === 409) {
        Alert.alert("Already Added", data.error);
      } else {
        Alert.alert("Error", data.error || "Failed to generate pass");
      }
    } catch {
      Alert.alert("Error", "Network error — please try again");
    } finally {
      setAddingWallet(null);
    }
  }

  async function handleNfcTap() {
    // Record a self-check-in tap
    try {
      const res = await fetch(`${appUrl}/api/wallet/nfc`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          tap_type: "check_in",
          location: "Mobile App",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        Alert.alert(
          "Checked In",
          `Welcome, ${data.member_name}! Check-in recorded.`
        );
        fetchPasses();
      } else if (res.status === 429) {
        Alert.alert("Already Checked In", data.error);
      } else {
        Alert.alert("Error", data.error || "Check-in failed");
      }
    } catch {
      Alert.alert("Error", "Network error — please try again");
    }
  }

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

  const hasApplePass = passes.some(
    (p) => p.platform === "apple" && p.status === "active"
  );
  const hasGooglePass = passes.some(
    (p) => p.platform === "google" && p.status === "active"
  );

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
              <View style={styles.qrGrid}>
                {generateQRPattern(user?.id || "member").map((filled, i) => (
                  <View
                    key={i}
                    style={[
                      styles.qrDot,
                      {
                        backgroundColor: filled
                          ? Colors.light.primary
                          : Colors.light.surfaceContainerHigh,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
            <Text style={styles.qrHint}>
              Present at check-in or POS for member identification
            </Text>
            <Text style={styles.qrMemberId}>{member?.member_number}</Text>
          </View>

          {/* Check-In Button */}
          <TouchableOpacity
            style={styles.scanButton}
            activeOpacity={0.8}
            onPress={handleNfcTap}
          >
            <Ionicons
              name="wifi-outline"
              size={18}
              color={Colors.light.primaryForeground}
            />
            <Text style={styles.scanButtonText}>TAP TO CHECK IN</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Add to Wallet Section */}
      <View style={styles.walletSection}>
        <Text style={styles.sectionTitle}>Digital Wallet</Text>
        <Text style={styles.sectionSubtitle}>
          Add your membership card to your phone&apos;s wallet for quick NFC
          tap access.
        </Text>

        <View style={styles.walletButtons}>
          {/* Apple Wallet */}
          {Platform.OS === "ios" && (
            <TouchableOpacity
              style={[
                styles.walletButton,
                styles.appleWalletButton,
                hasApplePass && styles.walletButtonDisabled,
              ]}
              activeOpacity={0.8}
              onPress={() => handleAddToWallet("apple")}
              disabled={hasApplePass || addingWallet === "apple"}
            >
              {addingWallet === "apple" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="wallet-outline" size={20} color="#fff" />
                  <View>
                    <Text style={styles.walletButtonLabel}>
                      {hasApplePass ? "Added to" : "Add to"}
                    </Text>
                    <Text style={styles.walletButtonTitle}>Apple Wallet</Text>
                  </View>
                  {hasApplePass && (
                    <Ionicons name="checkmark-circle" size={20} color="#4ade80" />
                  )}
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Google Wallet */}
          {Platform.OS === "android" && (
            <TouchableOpacity
              style={[
                styles.walletButton,
                styles.googleWalletButton,
                hasGooglePass && styles.walletButtonDisabled,
              ]}
              activeOpacity={0.8}
              onPress={() => handleAddToWallet("google")}
              disabled={hasGooglePass || addingWallet === "google"}
            >
              {addingWallet === "google" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="wallet-outline" size={20} color="#fff" />
                  <View>
                    <Text style={styles.walletButtonLabel}>
                      {hasGooglePass ? "Added to" : "Add to"}
                    </Text>
                    <Text style={styles.walletButtonTitle}>Google Wallet</Text>
                  </View>
                  {hasGooglePass && (
                    <Ionicons name="checkmark-circle" size={20} color="#4ade80" />
                  )}
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Show both on web/simulator for testing */}
          {Platform.OS === "web" && (
            <>
              <TouchableOpacity
                style={[styles.walletButton, styles.appleWalletButton]}
                activeOpacity={0.8}
                onPress={() => handleAddToWallet("apple")}
                disabled={addingWallet !== null}
              >
                <Ionicons name="wallet-outline" size={20} color="#fff" />
                <View>
                  <Text style={styles.walletButtonLabel}>Add to</Text>
                  <Text style={styles.walletButtonTitle}>Apple Wallet</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.walletButton, styles.googleWalletButton]}
                activeOpacity={0.8}
                onPress={() => handleAddToWallet("google")}
                disabled={addingWallet !== null}
              >
                <Ionicons name="wallet-outline" size={20} color="#fff" />
                <View>
                  <Text style={styles.walletButtonLabel}>Add to</Text>
                  <Text style={styles.walletButtonTitle}>Google Wallet</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* NFC Info */}
        <View style={styles.nfcInfo}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={Colors.light.onSurfaceVariant}
          />
          <Text style={styles.nfcInfoText}>
            Once added, hold your phone near any ClubOS NFC reader to check in,
            pay, or access facilities.
          </Text>
        </View>
      </View>

      {/* Recent Activity */}
      {recentTaps.length > 0 && (
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentTaps.slice(0, 5).map((tap) => (
            <View key={tap.id} style={styles.activityRow}>
              <View style={styles.activityIcon}>
                <Ionicons
                  name={
                    tap.tap_type === "check_in"
                      ? "checkmark-circle"
                      : tap.tap_type === "pos_payment"
                        ? "card"
                        : tap.tap_type === "access_gate"
                          ? "shield-checkmark"
                          : "flash"
                  }
                  size={16}
                  color={Colors.light.primary}
                />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>
                  {tap.tap_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </Text>
                <Text style={styles.activitySub}>
                  {tap.location || "Club"} &middot;{" "}
                  {new Date(tap.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

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

/**
 * Generate a deterministic 7x7 QR-like pattern from a string seed.
 */
function generateQRPattern(seed: string): boolean[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const pattern: boolean[] = [];
  for (let i = 0; i < 49; i++) {
    const row = Math.floor(i / 7);
    const col = i % 7;
    if (
      (row < 2 && col < 2) ||
      (row < 2 && col > 4) ||
      (row > 4 && col < 2)
    ) {
      pattern.push(true);
    } else {
      pattern.push(((hash >> (i % 31)) & 1) === 1);
    }
  }
  return pattern;
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

  // Card outer
  cardOuter: {
    paddingHorizontal: 24,
    marginBottom: 24,
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
    width: 98,
    height: 98,
    gap: 2,
  },
  qrDot: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  qrMemberId: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    color: Colors.light.onSurfaceVariant,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  qrHint: {
    fontSize: 11,
    color: Colors.light.onSurfaceVariant,
    textAlign: "center",
    maxWidth: 220,
    lineHeight: 15,
  },

  // Check-in button
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

  // Wallet section
  walletSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.foreground,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
    marginBottom: 16,
    lineHeight: 18,
  },
  walletButtons: {
    gap: 10,
    marginBottom: 12,
  },
  walletButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  appleWalletButton: {
    backgroundColor: "#1a1a1a",
  },
  googleWalletButton: {
    backgroundColor: "#4285f4",
  },
  walletButtonDisabled: {
    opacity: 0.7,
  },
  walletButtonLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#ffffffAA",
    letterSpacing: 0.5,
  },
  walletButtonTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  nfcInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: Colors.light.surfaceContainerLow,
    borderRadius: 12,
    padding: 12,
  },
  nfcInfoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.light.onSurfaceVariant,
    lineHeight: 17,
  },

  // Recent activity
  activitySection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.outlineVariant + "30",
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  activitySub: {
    fontSize: 11,
    color: Colors.light.onSurfaceVariant,
    marginTop: 1,
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
