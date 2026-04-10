import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { haptics } from "@/lib/haptics";
import {
  hasBiometricHardware,
  isBiometricEnrolled,
  isBiometricLoginEnabled,
  getBiometricType,
  getBiometricLabel,
  authenticateWithBiometrics,
  enableBiometricLogin,
  disableBiometricLogin,
  type BiometricType,
} from "@/lib/biometrics";

export default function SecurityScreen() {
  const { user, session } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [biometricHardware, setBiometricHardware] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>("none");

  useEffect(() => {
    checkBiometricStatus();
  }, []);

  async function checkBiometricStatus() {
    const [hasHardware, isEnrolled, isEnabled] = await Promise.all([
      hasBiometricHardware(),
      isBiometricEnrolled(),
      isBiometricLoginEnabled(),
    ]);
    setBiometricHardware(hasHardware);
    setBiometricEnrolled(isEnrolled);
    setBiometricEnabled(isEnabled);
    if (hasHardware) {
      const type = await getBiometricType();
      setBiometricType(type);
    }
  }

  async function handleToggleBiometric(value: boolean) {
    if (value) {
      // Verify identity before enabling
      const authenticated = await authenticateWithBiometrics(
        `Enable ${getBiometricLabel(biometricType)} for quick sign-in`
      );
      if (!authenticated) return;

      if (!user?.email || !session?.refresh_token) {
        Alert.alert("Error", "Could not save credentials. Please sign in again.");
        return;
      }

      await enableBiometricLogin(user.email, session.refresh_token);
      setBiometricEnabled(true);
      haptics.success();
      Alert.alert("Enabled", `${getBiometricLabel(biometricType)} sign-in is now active.`);
    } else {
      await disableBiometricLogin();
      setBiometricEnabled(false);
      haptics.medium();
    }
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      haptics.success();
      Alert.alert("Success", "Your password has been updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not update password";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.light.foreground} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Security & Privacy</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Change Password */}
        <Text style={styles.sectionTitle}>Change Password</Text>
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>CURRENT PASSWORD</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrent}
                placeholder="Enter current password"
                placeholderTextColor={Colors.light.outline}
              />
              <TouchableOpacity
                onPress={() => setShowCurrent(!showCurrent)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showCurrent ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={Colors.light.onSurfaceVariant}
                />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={styles.label}>NEW PASSWORD</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNew}
                placeholder="At least 8 characters"
                placeholderTextColor={Colors.light.outline}
              />
              <TouchableOpacity
                onPress={() => setShowNew(!showNew)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showNew ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={Colors.light.onSurfaceVariant}
                />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={styles.label}>CONFIRM NEW PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="Repeat new password"
              placeholderTextColor={Colors.light.outline}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleChangePassword}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Updating..." : "Update Password"}
          </Text>
        </TouchableOpacity>

        {/* Biometric Authentication */}
        {biometricHardware && biometricEnrolled && (
          <>
            <Text style={styles.sectionTitle}>
              {getBiometricLabel(biometricType)}
            </Text>
            <View style={styles.card}>
              <View style={styles.biometricRow}>
                <View style={styles.biometricIconWrap}>
                  <Ionicons
                    name={biometricType === "facial" ? "scan-outline" : "finger-print-outline"}
                    size={22}
                    color={biometricEnabled ? Colors.light.primary : Colors.light.onSurfaceVariant}
                  />
                </View>
                <View style={styles.biometricContent}>
                  <Text style={styles.biometricTitle}>
                    Quick Sign-in with {getBiometricLabel(biometricType)}
                  </Text>
                  <Text style={styles.biometricSubtitle}>
                    Use {getBiometricLabel(biometricType)} to sign in without entering your password
                  </Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: Colors.light.outlineVariant, true: Colors.light.primary + "80" }}
                  thumbColor={biometricEnabled ? Colors.light.primary : "#f4f3f4"}
                  ios_backgroundColor={Colors.light.outlineVariant}
                />
              </View>
            </View>
          </>
        )}

        {/* Account Info */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color={Colors.light.onSurfaceVariant} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={Colors.light.onSurfaceVariant} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Account Created</Text>
              <Text style={styles.infoValue}>
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "—"}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="finger-print-outline" size={18} color={Colors.light.onSurfaceVariant} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Two-Factor Authentication</Text>
              <Text style={styles.infoValue}>Not enabled</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 20,
  },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "600", color: Colors.light.foreground },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: Colors.light.onSurfaceVariant,
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 10,
  },
  card: {
    marginHorizontal: 24,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.light.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  field: { paddingVertical: 8 },
  label: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    color: Colors.light.outline,
    marginBottom: 6,
  },
  passwordRow: { flexDirection: "row", alignItems: "center" },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: Colors.light.foreground,
    backgroundColor: Colors.light.surfaceContainerLow,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  eyeBtn: { padding: 8, marginLeft: 4 },
  divider: {
    height: 1,
    backgroundColor: Colors.light.surfaceContainerLow,
    marginVertical: 4,
  },
  saveButton: {
    marginHorizontal: 24,
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.primaryForeground,
  },
  biometricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  biometricIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  biometricContent: {
    flex: 1,
    gap: 2,
  },
  biometricTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  biometricSubtitle: {
    fontSize: 12,
    color: Colors.light.onSurfaceVariant,
    lineHeight: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  infoText: { flex: 1, gap: 2 },
  infoLabel: { fontSize: 12, color: Colors.light.onSurfaceVariant },
  infoValue: { fontSize: 14, fontWeight: "500", color: Colors.light.foreground },
});
