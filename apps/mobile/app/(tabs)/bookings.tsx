import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Colors } from "@/constants/theme";

const facilityTabs = ["All", "Golf", "Tennis", "Dining", "Pool"];

export default function BookingsScreen() {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
        contentContainerStyle={styles.tabsContent}
      >
        {facilityTabs.map((tab, i) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, i === 0 && styles.tabActive]}
          >
            <Text style={[styles.tabText, i === 0 && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📅</Text>
        <Text style={styles.emptyTitle}>No bookings yet</Text>
        <Text style={styles.emptyText}>
          Configure your facilities to enable booking.
        </Text>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>New Booking</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  tabs: {
    maxHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabActive: {
    backgroundColor: Colors.light.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.light.mutedForeground,
  },
  tabTextActive: {
    color: Colors.light.primaryForeground,
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
    marginBottom: 20,
  },
  button: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonText: {
    color: Colors.light.primaryForeground,
    fontSize: 14,
    fontWeight: "600",
  },
});
