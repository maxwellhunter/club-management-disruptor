import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { haptics } from "@/lib/haptics";

const API_URL =
  process.env.EXPO_PUBLIC_APP_URL || "http://localhost:3000";

interface DirectoryMember {
  id: string;
  member_number: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  status: string;
  join_date: string;
  tier_name: string | null;
  tier_level: string | null;
}

interface Tier {
  id: string;
  name: string;
  level: string;
}

const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  standard: { bg: "#f3f4f6", text: "#374151" },
  premium: { bg: "#dbeafe", text: "#1e40af" },
  vip: { bg: "#f3e8ff", text: "#7c3aed" },
  honorary: { bg: "#fef3c7", text: "#92400e" },
};

export default function MembersScreen() {
  const { session } = useAuth();
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string | null>(null);

  const getHeaders = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      h["Authorization"] = `Bearer ${session.access_token}`;
    }
    return h;
  }, [session?.access_token]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchMembers = useCallback(async () => {
    const headers = getHeaders();
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (tierFilter) params.set("tier", tierFilter);
      const res = await fetch(
        `${API_URL}/api/members?${params.toString()}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
        setTiers(data.tiers);
      }
    } catch (err) {
      console.error("Failed to fetch members:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch, tierFilter]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const onRefresh = () => {
    haptics.light();
    setRefreshing(true);
    fetchMembers();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={16}
          color={Colors.light.mutedForeground}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email..."
          placeholderTextColor={Colors.light.mutedForeground}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Tier filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[
            styles.filterChip,
            !tierFilter && styles.filterChipActive,
          ]}
          onPress={() => setTierFilter(null)}
        >
          <Text
            style={[
              styles.filterChipText,
              !tierFilter && styles.filterChipTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        {tiers.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[
              styles.filterChip,
              tierFilter === t.id && styles.filterChipActive,
            ]}
            onPress={() => setTierFilter(t.id)}
          >
            <Text
              style={[
                styles.filterChipText,
                tierFilter === t.id && styles.filterChipTextActive,
              ]}
            >
              {t.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Member list */}
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="people-outline"
              size={40}
              color={Colors.light.mutedForeground}
            />
            <Text style={styles.emptyTitle}>No members found</Text>
            <Text style={styles.emptySubtitle}>
              Try adjusting your search or filter.
            </Text>
          </View>
        }
        renderItem={({ item }) => <MemberCard member={item} />}
      />
    </View>
  );
}

function MemberCard({ member }: { member: DirectoryMember }) {
  const initials =
    `${member.first_name[0]}${member.last_name[0]}`.toUpperCase();
  const tierColor = member.tier_level
    ? TIER_COLORS[member.tier_level]
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.memberName} numberOfLines={1}>
              {member.first_name} {member.last_name}
            </Text>
            {tierColor && member.tier_name && (
              <View
                style={[styles.tierBadge, { backgroundColor: tierColor.bg }]}
              >
                <Text style={[styles.tierBadgeText, { color: tierColor.text }]}>
                  {member.tier_name}
                </Text>
              </View>
            )}
          </View>
          {member.member_number && (
            <Text style={styles.memberNumber}>#{member.member_number}</Text>
          )}
        </View>
      </View>

      <View style={styles.contactInfo}>
        <View style={styles.contactRow}>
          <Ionicons
            name="mail-outline"
            size={14}
            color={Colors.light.mutedForeground}
          />
          <Text style={styles.contactText} numberOfLines={1}>
            {member.email}
          </Text>
        </View>
        {member.phone && (
          <View style={styles.contactRow}>
            <Ionicons
              name="call-outline"
              size={14}
              color={Colors.light.mutedForeground}
            />
            <Text style={styles.contactText}>{member.phone}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.background,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: Colors.light.foreground,
  },
  filterRow: {
    maxHeight: 44,
    marginTop: 10,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  filterChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.light.mutedForeground,
  },
  filterChipTextActive: {
    color: "#fff",
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.light.mutedForeground,
  },
  card: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  cardInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.foreground,
    flexShrink: 1,
  },
  memberNumber: {
    fontSize: 12,
    color: Colors.light.mutedForeground,
    marginTop: 2,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  contactInfo: {
    marginTop: 10,
    gap: 6,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contactText: {
    fontSize: 13,
    color: Colors.light.mutedForeground,
    flex: 1,
  },
});
