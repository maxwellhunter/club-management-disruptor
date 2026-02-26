import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.user_metadata?.full_name ?? "U").charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>
          {user?.user_metadata?.full_name ?? "Member"}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <ProfileRow label="Membership" value="—" />
        <ProfileRow label="Member Since" value="—" />
        <ProfileRow label="Account Balance" value="—" />
      </View>

      <View style={styles.section}>
        <ProfileRow label="Notifications" value="→" />
        <ProfileRow label="Payment Methods" value="→" />
        <ProfileRow label="Family Members" value="→" />
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
    marginTop: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.light.primaryForeground,
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.light.foreground,
  },
  email: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
    marginTop: 2,
  },
  section: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  rowLabel: {
    fontSize: 14,
    color: Colors.light.foreground,
  },
  rowValue: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
  },
  signOutButton: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.destructive,
    marginTop: 8,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.destructive,
  },
});
