import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";

const DEV_ACCOUNTS = [
  {
    label: "Max Hunter",
    role: "Admin" as const,
    description: "Full access",
    email: "admin@greenfieldcc.com",
    badgeColor: { bg: "#fee2e2", text: "#b91c1c", border: "#fecaca" },
  },
  {
    label: "Sarah Chen",
    role: "Staff" as const,
    description: "Staff access",
    email: "staff@greenfieldcc.com",
    badgeColor: { bg: "#dbeafe", text: "#1d4ed8", border: "#bfdbfe" },
  },
  {
    label: "James Wilson",
    role: "Member" as const,
    description: "Standard tier",
    email: "member@greenfieldcc.com",
    badgeColor: { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0" },
  },
  {
    label: "Emily Brooks",
    role: "Member" as const,
    description: "Golf tier",
    email: "golf@greenfieldcc.com",
    badgeColor: { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0" },
  },
];

const DEV_PASSWORD = "clubos-demo-2026";
const isDev = __DEV__;

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      Alert.alert("Error", error.message);
    }
    setLoading(false);
  }

  function handleDevSelect(account: (typeof DEV_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(DEV_PASSWORD);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>
          Club<Text style={styles.logoAccent}>OS</Text>
        </Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        {isDev && (
          <View style={styles.devPanel}>
            <View style={styles.devHeader}>
              <Text style={styles.devHeaderIcon}>🔧</Text>
              <Text style={styles.devHeaderText}>
                Dev Mode — Greenfield CC
              </Text>
            </View>
            {DEV_ACCOUNTS.map((account) => {
              const isSelected = email === account.email;
              return (
                <TouchableOpacity
                  key={account.email}
                  style={[
                    styles.devCard,
                    isSelected && styles.devCardSelected,
                  ]}
                  onPress={() => handleDevSelect(account)}
                  activeOpacity={0.7}
                >
                  <View style={styles.devCardRow}>
                    <Text style={styles.devCardName}>{account.label}</Text>
                    <View
                      style={[
                        styles.devBadge,
                        {
                          backgroundColor: account.badgeColor.bg,
                          borderColor: account.badgeColor.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.devBadgeText,
                          { color: account.badgeColor.text },
                        ]}
                      >
                        {account.role}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.devCardDesc}>{account.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Colors.light.mutedForeground}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={Colors.light.mutedForeground}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Signing in..." : "Sign In"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text style={styles.link}>Sign up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logo: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    color: Colors.light.foreground,
  },
  logoAccent: {
    color: Colors.light.primary,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  // Dev switcher
  devPanel: {
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
    gap: 8,
  },
  devHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  devHeaderIcon: {
    fontSize: 13,
  },
  devHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400e",
  },
  devCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  devCardSelected: {
    borderColor: Colors.light.primary,
    borderWidth: 2,
  },
  devCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  devCardName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  devBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  devBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  devCardDesc: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },
  // Form
  form: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.light.foreground,
    backgroundColor: Colors.light.background,
  },
  button: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: Colors.light.primaryForeground,
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
  },
  link: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: "500",
  },
});
