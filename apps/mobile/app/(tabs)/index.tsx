import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";

const API_URL =
  process.env.EXPO_PUBLIC_APP_URL || "http://localhost:3000";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type ItineraryItem = {
  id: string;
  type: "tee_time" | "dining" | "event";
  title: string;
  time: string;
  subtitle: string;
  detail?: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type Announcement = {
  id: string;
  title: string;
  content: string;
  priority: "normal" | "important" | "urgent";
  published_at: string | null;
  created_at: string;
};

type ClubEvent = {
  id: string;
  title: string;
  category: string;
  description: string;
  image_url?: string;
};

function formatAnnouncementTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function HomeScreen() {
  const { user, session } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const firstName =
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "there";

  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch today's bookings
      const today = new Date().toISOString().split("T")[0];
      const { data: bookings } = await supabase
        .from("bookings")
        .select("*, facilities(name, type)")
        .eq("date", today)
        .eq("member_id", user?.id)
        .order("start_time", { ascending: true });

      const items: ItineraryItem[] = (bookings || []).map((b: any) => ({
        id: b.id,
        type: b.facilities?.type === "dining" ? "dining" : "tee_time",
        title:
          b.facilities?.type === "dining"
            ? "Dining Reservation"
            : "Tee Time",
        time: formatTime(b.start_time),
        subtitle: b.facilities?.name || "Club Facility",
        detail:
          b.party_size > 1 ? `Party of ${b.party_size}` : undefined,
        icon:
          b.facilities?.type === "dining"
            ? "restaurant-outline"
            : "golf-outline",
      }));
      setItinerary(items);

      // Fetch upcoming events
      const { data: eventData } = await supabase
        .from("events")
        .select("id, title, description, image_url, event_type")
        .gte("start_datetime", new Date().toISOString())
        .eq("status", "published")
        .order("start_datetime", { ascending: true })
        .limit(3);

      setEvents(
        (eventData || []).map((e: any) => ({
          id: e.id,
          title: e.title,
          category: formatCategory(e.event_type),
          description: e.description?.slice(0, 120) || "",
          image_url: e.image_url,
        }))
      );

      // Fetch announcements from web API (tier filtering happens server-side)
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }
        const announcementsRes = await fetch(`${API_URL}/api/announcements`, {
          headers,
        });
        if (announcementsRes.ok) {
          const announcementsData = await announcementsRes.json();
          setAnnouncements(
            (announcementsData.announcements ?? []).slice(0, 3)
          );
        }
      } catch {
        // Announcements fetch failed — non-critical
      }
    } catch {
      // Silently fail — show empty states
    }
  }, [user?.id, session?.access_token]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [fetchDashboardData]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.logoMark}>
            <Ionicons
              name="diamond"
              size={14}
              color={Colors.light.primaryForeground}
            />
          </View>
          <TouchableOpacity activeOpacity={0.7}>
            <Ionicons
              name="notifications-outline"
              size={22}
              color={Colors.light.onSurfaceVariant}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.welcomeLabel}>WELCOME BACK</Text>
        <Text style={styles.greeting}>
          {getGreeting()},{"\n"}
          {firstName}
        </Text>
      </View>

      {/* Today's Itinerary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Itinerary</Text>
        {itinerary.length > 0 ? (
          <View style={styles.itineraryCard}>
            {itinerary.map((item, index) => (
              <View key={item.id}>
                {index > 0 && <View style={styles.itineraryDivider} />}
                <View style={styles.itineraryRow}>
                  <View style={styles.itineraryIconWrap}>
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={Colors.light.primary}
                    />
                  </View>
                  <View style={styles.itineraryContent}>
                    <Text style={styles.itineraryTitle}>{item.title}</Text>
                    <Text style={styles.itineraryTime}>
                      {item.time} — {item.subtitle}
                    </Text>
                    {item.detail && (
                      <View style={styles.itineraryDetailRow}>
                        <Ionicons
                          name="people-outline"
                          size={13}
                          color={Colors.light.onSurfaceVariant}
                        />
                        <Text style={styles.itineraryDetail}>
                          {item.detail}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.itineraryCard}>
            <View style={styles.emptyItinerary}>
              <Ionicons
                name="calendar-outline"
                size={28}
                color={Colors.light.outlineVariant}
              />
              <Text style={styles.emptyText}>No activities scheduled today</Text>
              <TouchableOpacity
                style={styles.emptyAction}
                onPress={() => router.push("/(tabs)/bookings")}
                activeOpacity={0.7}
              >
                <Text style={styles.emptyActionText}>Make a Booking</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Club Announcements */}
      {announcements.length > 0 && (
        <View style={styles.section}>
          {/* Urgent/Important banner */}
          {announcements.some((a) => a.priority === "urgent" || a.priority === "important") && (
            <View style={styles.urgentBanner}>
              <Ionicons
                name="alert-circle"
                size={16}
                color="#d97706"
              />
              <Text style={styles.urgentBannerText}>
                {announcements.filter((a) => a.priority === "urgent").length > 0
                  ? "Urgent announcement from your club"
                  : "Important announcement from your club"}
              </Text>
            </View>
          )}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { paddingHorizontal: 0, marginBottom: 0 }]}>Announcements</Text>
            <TouchableOpacity
              onPress={() => router.push("/announcements")}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.announcementsCard}>
            {announcements.map((item, index) => (
              <View key={item.id}>
                {index > 0 && <View style={styles.announcementDivider} />}
                <TouchableOpacity
                  style={styles.announcementRow}
                  onPress={() => router.push("/announcements")}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.priorityDot,
                      item.priority === "urgent" && { backgroundColor: "#dc2626" },
                      item.priority === "important" && { backgroundColor: "#d97706" },
                      item.priority === "normal" && { backgroundColor: Colors.light.primary },
                    ]}
                  />
                  <View style={styles.announcementContent}>
                    <Text style={styles.announcementTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.announcementTime}>
                      {formatAnnouncementTime(item.published_at || item.created_at)}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={Colors.light.outlineVariant}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Concierge Services */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Concierge Services</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.servicesScroll}
        >
          <ServiceButton
            icon="golf-outline"
            label="Book Tee Time"
            onPress={() => router.push("/(tabs)/bookings")}
          />
          <ServiceButton
            icon="restaurant-outline"
            label="Reserve Table"
            onPress={() => router.push("/(tabs)/dining")}
          />
          <ServiceButton
            icon="fast-food-outline"
            label="Order to Course"
            onPress={() => router.push("/(tabs)/dining")}
          />
          <ServiceButton
            icon="sparkles-outline"
            label="Club Events"
            onPress={() => router.push("/(tabs)/events")}
          />
          <ServiceButton
            icon="people-outline"
            label="Guest Mgmt"
            onPress={() => router.push("/guests")}
          />
          <ServiceButton
            icon="chatbubble-ellipses-outline"
            label="AI Concierge"
            onPress={() => router.push("/(tabs)/chat")}
          />
        </ScrollView>
      </View>

      {/* Club News & Events */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Club News & Events</Text>
        {events.length > 0 ? (
          events.map((event, index) => (
            <TouchableOpacity
              key={event.id}
              style={[
                index === 0 ? styles.heroEventCard : styles.eventCard,
              ]}
              activeOpacity={0.7}
              onPress={() => router.push(`/event/${event.id}`)}
            >
              {index === 0 && event.image_url ? (
                <Image
                  source={{ uri: event.image_url }}
                  style={styles.heroEventImage}
                  resizeMode="cover"
                />
              ) : null}
              <View
                style={index === 0 ? styles.heroEventContent : styles.eventContent}
              >
                <View style={styles.eventCategoryBadge}>
                  <Text style={styles.eventCategoryText}>
                    {event.category}
                  </Text>
                </View>
                <Text
                  style={
                    index === 0 ? styles.heroEventTitle : styles.eventTitle
                  }
                  numberOfLines={2}
                >
                  {event.title}
                </Text>
                <Text style={styles.eventDescription} numberOfLines={2}>
                  {event.description}
                </Text>
                {index === 0 && (
                  <View style={styles.heroEventCta}>
                    <Text style={styles.heroEventCtaText}>Learn More</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={Colors.light.primary}
                    />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyEventsCard}>
            <Ionicons
              name="megaphone-outline"
              size={28}
              color={Colors.light.outlineVariant}
            />
            <Text style={styles.emptyText}>No upcoming events</Text>
            <TouchableOpacity
              style={styles.emptyAction}
              onPress={() => router.push("/(tabs)/events")}
              activeOpacity={0.7}
            >
              <Text style={styles.emptyActionText}>Browse Events</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Bottom spacer for tab bar */}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function ServiceButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.serviceButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.serviceIconWrap}>
        <Ionicons name={icon} size={22} color={Colors.light.primary} />
      </View>
      <Text style={styles.serviceLabel} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function formatCategory(type: string | null): string {
  if (!type) return "Club Event";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    paddingBottom: 20,
  },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 28,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
    color: Colors.light.onSurfaceVariant,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 30,
    fontWeight: "700",
    color: Colors.light.foreground,
    lineHeight: 36,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },

  // Sections
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: Colors.light.onSurfaceVariant,
    paddingHorizontal: 24,
    marginBottom: 12,
  },

  // Itinerary
  itineraryCard: {
    marginHorizontal: 24,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 20,
    padding: 20,
    // Subtle shadow
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 2,
  },
  itineraryRow: {
    flexDirection: "row",
    gap: 14,
  },
  itineraryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  itineraryContent: {
    flex: 1,
    gap: 2,
  },
  itineraryTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  itineraryTime: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
  },
  itineraryDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  itineraryDetail: {
    fontSize: 12,
    color: Colors.light.onSurfaceVariant,
  },
  itineraryDivider: {
    height: 1,
    backgroundColor: Colors.light.surfaceContainerLow,
    marginVertical: 14,
  },
  emptyItinerary: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
  },
  emptyAction: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.primaryContainer,
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.primaryForeground,
  },

  // Announcements
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.primary,
  },
  urgentBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 24,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#fffbeb",
  },
  urgentBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400e",
    flex: 1,
  },
  announcementsCard: {
    marginHorizontal: 24,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 20,
    padding: 16,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 2,
  },
  announcementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  announcementContent: {
    flex: 1,
    gap: 2,
  },
  announcementTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  announcementTime: {
    fontSize: 12,
    color: Colors.light.onSurfaceVariant,
  },
  announcementDivider: {
    height: 1,
    backgroundColor: Colors.light.surfaceContainerLow,
    marginVertical: 10,
  },

  // Concierge Services
  servicesScroll: {
    paddingHorizontal: 24,
    gap: 12,
  },
  serviceButton: {
    width: 88,
    alignItems: "center",
    gap: 8,
  },
  serviceIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  serviceLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.light.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 14,
  },

  // Events - Hero card (first event)
  heroEventCard: {
    marginHorizontal: 24,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceContainerLowest,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 2,
  },
  heroEventImage: {
    width: "100%",
    height: 160,
    backgroundColor: Colors.light.surfaceContainerHigh,
  },
  heroEventContent: {
    padding: 20,
    gap: 8,
  },
  heroEventTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.foreground,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  heroEventCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  heroEventCtaText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.primary,
  },

  // Events - Standard cards
  eventCard: {
    marginHorizontal: 24,
    flexDirection: "row",
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceContainerLowest,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  eventContent: {
    flex: 1,
    padding: 16,
    gap: 4,
  },
  eventCategoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.light.surfaceContainerHigh,
    marginBottom: 2,
  },
  eventCategoryText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: Colors.light.onSurfaceVariant,
    textTransform: "uppercase",
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  eventDescription: {
    fontSize: 12,
    color: Colors.light.onSurfaceVariant,
    lineHeight: 17,
  },

  // Empty events
  emptyEventsCard: {
    marginHorizontal: 24,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 8,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
});
