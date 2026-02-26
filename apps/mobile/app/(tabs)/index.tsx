import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const name = user?.user_metadata?.full_name || "there";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back, {name}</Text>
        <Text style={styles.subtitle}>Here's what's happening at your club.</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Bookings Today" value="—" />
        <StatCard label="Upcoming Events" value="—" />
        <StatCard label="Account Balance" value="—" />
        <StatCard label="Messages" value="—" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <QuickAction
          label="Book a Tee Time"
          onPress={() => router.push("/(tabs)/bookings")}
        />
        <QuickAction
          label="Browse Events"
          onPress={() => router.push("/(tabs)/events")}
        />
        <QuickAction
          label="Ask AI Assistant"
          onPress={() => router.push("/(tabs)/chat")}
        />
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function QuickAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <Text style={styles.quickActionText}>{label}</Text>
      <Text style={styles.quickActionArrow}>→</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.light.foreground,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 16,
    padding: 16,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.mutedForeground,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.light.foreground,
    marginTop: 4,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.foreground,
    marginBottom: 4,
  },
  quickAction: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  quickActionText: {
    fontSize: 14,
    color: Colors.light.foreground,
  },
  quickActionArrow: {
    fontSize: 16,
    color: Colors.light.mutedForeground,
  },
});
