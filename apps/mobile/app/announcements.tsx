import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";
import { haptics } from "@/lib/haptics";

const SERIF_FONT = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});

const API_URL =
  process.env.EXPO_PUBLIC_APP_URL || "http://localhost:3000";

type Announcement = {
  id: string;
  title: string;
  content: string;
  priority: "normal" | "important" | "urgent";
  published_at: string | null;
  created_at: string;
  target_tier_ids: string[] | null;
};

function formatTimeAgo(dateString: string): string {
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

function PriorityBadge({ priority }: { priority: Announcement["priority"] }) {
  const config = {
    urgent: { label: "URGENT", bg: "#fef2f2", color: "#dc2626", dot: "#dc2626" },
    important: { label: "IMPORTANT", bg: "#fffbeb", color: "#d97706", dot: "#d97706" },
    normal: { label: "ANNOUNCEMENT", bg: Colors.light.accent, color: Colors.light.primary, dot: Colors.light.primary },
  };
  const c = config[priority];

  return (
    <View style={[badgeStyles.container, { backgroundColor: c.bg }]}>
      <View style={[badgeStyles.dot, { backgroundColor: c.dot }]} />
      <Text style={[badgeStyles.label, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
});

export default function AnnouncementsScreen() {
  const { session } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${API_URL}/api/announcements`, { headers });
      if (!res.ok) return;

      const data = await res.json();
      setAnnouncements(data.announcements ?? []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const onRefresh = useCallback(async () => {
    haptics.light();
    setRefreshing(true);
    await fetchAnnouncements();
    setRefreshing(false);
  }, [fetchAnnouncements]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (announcements.length === 0) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.emptyContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Ionicons
          name="megaphone-outline"
          size={48}
          color={Colors.light.outlineVariant}
        />
        <Text style={styles.emptyTitle}>No Announcements</Text>
        <Text style={styles.emptySubtitle}>
          Club announcements will appear here when posted.
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {announcements.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <PriorityBadge priority={item.priority} />
            <Text style={styles.timeAgo}>
              {formatTimeAgo(item.published_at || item.created_at)}
            </Text>
          </View>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardContent} numberOfLines={3}>
            {item.content}
          </Text>
        </View>
      ))}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 14,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.foreground,
    fontFamily: SERIF_FONT,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 20,
  },

  // Cards
  card: {
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 20,
    padding: 20,
    gap: 10,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeAgo: {
    fontSize: 12,
    color: Colors.light.onSurfaceVariant,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.foreground,
    fontFamily: SERIF_FONT,
    lineHeight: 24,
  },
  cardContent: {
    fontSize: 14,
    color: Colors.light.onSurfaceVariant,
    lineHeight: 21,
  },
});
