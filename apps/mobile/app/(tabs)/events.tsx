import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/theme";

export default function EventsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🎉</Text>
        <Text style={styles.emptyTitle}>No upcoming events</Text>
        <Text style={styles.emptyText}>
          Club events, tournaments, and social gatherings will appear here.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.foreground,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
    textAlign: "center",
  },
});
