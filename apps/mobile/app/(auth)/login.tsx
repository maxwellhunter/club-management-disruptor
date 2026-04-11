import { useState, useEffect } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuth } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/lib/theme-context";
import { haptics } from "@/lib/haptics";
import {
  hasBiometricHardware,
  isBiometricEnrolled,
  isBiometricLoginEnabled,
  getBiometricType,
  getBiometricLabel,
  authenticateWithBiometrics,
  getBiometricCredentials,
  type BiometricType,
} from "@/lib/biometrics";
import { supabase } from "@/lib/supabase";

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
  const [rememberMe, setRememberMe] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>("none");
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const { signIn, signInWithApple } = useAuth();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    checkBiometrics();
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAuthAvailable);
    }
  }, []);

  async function checkBiometrics() {
    const [hasHardware, isEnrolled, isEnabled] = await Promise.all([
      hasBiometricHardware(),
      isBiometricEnrolled(),
      isBiometricLoginEnabled(),
    ]);
    if (hasHardware && isEnrolled && isEnabled) {
      setBiometricAvailable(true);
      const type = await getBiometricType();
      setBiometricType(type);
    }
  }

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    haptics.medium();
    const { error } = await signIn(email, password);
    if (error) {
      haptics.error();
      Alert.alert("Error", error.message);
    } else {
      haptics.success();
    }
    setLoading(false);
  }

  async function handleBiometricLogin() {
    if (!biometricAvailable) {
      Alert.alert(
        "Biometrics Not Set Up",
        "Sign in with your password first, then enable biometric login in Settings > Security."
      );
      return;
    }

    haptics.medium();
    const authenticated = await authenticateWithBiometrics();
    if (!authenticated) return;

    setLoading(true);
    const credentials = await getBiometricCredentials();
    if (!credentials) {
      haptics.error();
      Alert.alert("Error", "No saved credentials. Please sign in with your password.");
      setLoading(false);
      return;
    }

    // Use refresh token to restore session
    const { error } = await supabase.auth.refreshSession({
      refresh_token: credentials.refreshToken,
    });
    if (error) {
      haptics.error();
      Alert.alert("Session Expired", "Please sign in with your password again.");
    } else {
      haptics.success();
    }
    setLoading(false);
  }

  async function handleAppleSignIn() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        setLoading(true);
        haptics.medium();
        const { error } = await signInWithApple(credential.identityToken);
        if (error) {
          haptics.error();
          Alert.alert("Error", error.message);
        } else {
          haptics.success();
        }
        setLoading(false);
      }
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Error", "Apple Sign-In failed. Please try again.");
      }
    }
  }

  function handleDevSelect(account: (typeof DEV_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(DEV_PASSWORD);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header / Branding */}
        <View style={styles.brandingArea}>
          <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
            <Ionicons name="diamond" size={20} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.brandName, { color: colors.onSurfaceVariant }]}>CLUB OS</Text>
          <View style={[styles.brandDivider, { backgroundColor: colors.outlineVariant }]} />
        </View>

        {/* Sign In Heading */}
        <Text style={[styles.heading, { color: colors.foreground }]}>Sign In</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
          Enter your credentials to access the club.
        </Text>

        {/* Dev Switcher */}
        {isDev && (
          <View style={styles.devPanel}>
            <View style={styles.devHeader}>
              <Ionicons name="build-outline" size={13} color="#92400e" />
              <Text style={styles.devHeaderText}>
                Dev Mode — The Lakes
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

        {/* Form */}
        <View style={styles.form}>
          {/* Email Field */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>EMAIL ADDRESS</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceContainerLowest, borderBottomColor: colors.outlineVariant }]}>
              <Ionicons
                name="mail-outline"
                size={18}
                color={colors.onSurfaceVariant}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="name@example.com"
                placeholderTextColor={colors.outlineVariant}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                keyboardAppearance={isDark ? "dark" : "light"}
              />
            </View>
          </View>

          {/* Password Field */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>PASSWORD</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceContainerLowest, borderBottomColor: colors.outlineVariant }]}>
              <Ionicons
                name="lock-open-outline"
                size={18}
                color={colors.onSurfaceVariant}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="••••••••"
                placeholderTextColor={colors.outlineVariant}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                keyboardAppearance={isDark ? "dark" : "light"}
              />
            </View>
          </View>

          {/* Remember Me / Forgot Password Row */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  { borderColor: colors.outline },
                  rememberMe && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                {rememberMe && (
                  <Ionicons name="checkmark" size={12} color={colors.primaryForeground} />
                )}
              </View>
              <Text style={[styles.rememberText, { color: colors.onSurfaceVariant }]}>Remember Me</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primaryContainer }, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
              {loading ? "Signing in..." : "Sign In"}
            </Text>
            {!loading && (
              <Ionicons
                name="arrow-forward"
                size={18}
                color={colors.primaryForeground}
                style={{ marginLeft: 8 }}
              />
            )}
          </TouchableOpacity>

          {/* Or Divider */}
          <View style={styles.orDivider}>
            <View style={[styles.orLine, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[styles.orText, { color: colors.onSurfaceVariant }]}>or</Text>
            <View style={[styles.orLine, { backgroundColor: colors.outlineVariant }]} />
          </View>

          {/* Biometrics Button */}
          <TouchableOpacity
            style={[styles.biometricsButton, { backgroundColor: colors.surfaceContainerHigh }]}
            activeOpacity={0.7}
            onPress={handleBiometricLogin}
          >
            <Ionicons
              name={biometricType === "facial" ? "scan-outline" : "finger-print"}
              size={20}
              color={biometricAvailable ? colors.primary : colors.onSurfaceVariant}
            />
            <Text style={[
              styles.biometricsText,
              { color: colors.foreground },
              biometricAvailable && { color: colors.primary, fontWeight: "600" },
            ]}>
              {biometricAvailable
                ? `Sign in with ${getBiometricLabel(biometricType)}`
                : "Fast Sign-in with Biometrics"}
            </Text>
          </TouchableOpacity>

          {/* Apple Sign-In Button — adapts to system appearance */}
          {appleAuthAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={
                isDark
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={16}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            />
          )}
        </View>

        {/* Footer Links */}
        <View style={styles.footerLinks}>
          <TouchableOpacity style={styles.footerLink} activeOpacity={0.7}>
            <Ionicons
              name="help-circle-outline"
              size={16}
              color={colors.onSurfaceVariant}
            />
            <Text style={[styles.footerLinkText, { color: colors.onSurfaceVariant }]}>Need help?</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerLink} activeOpacity={0.7}>
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color={colors.onSurfaceVariant}
            />
            <Text style={[styles.footerLinkText, { color: colors.onSurfaceVariant }]}>Security</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Up Link */}
        <View style={styles.signupRow}>
          <Text style={[styles.signupText, { color: colors.onSurfaceVariant }]}>Don't have an account? </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text style={[styles.signupLink, { color: colors.primary }]}>Sign up</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Legal Footer */}
        <Text style={[styles.legalText, { color: colors.outline }]}>
          Reserved access for registered members of ClubOS.{"\n"}
          Unauthorized access is strictly prohibited.
        </Text>
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
    paddingHorizontal: 32,
    paddingVertical: 48,
  },

  // Branding
  brandingArea: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  brandName: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 4,
    color: Colors.light.onSurfaceVariant,
    marginBottom: 16,
  },
  brandDivider: {
    width: 40,
    height: 1,
    backgroundColor: Colors.light.outlineVariant,
  },

  // Heading
  heading: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.light.foreground,
    textAlign: "center",
    marginBottom: 8,
    // Noto Serif would be ideal here, but system serif works for RN
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.onSurfaceVariant,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 20,
  },

  // Dev switcher
  devPanel: {
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    borderRadius: 16,
    padding: 14,
    marginBottom: 28,
    gap: 8,
  },
  devHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
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
    gap: 20,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    color: Colors.light.onSurfaceVariant,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.outlineVariant,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.light.foreground,
  },

  // Options row
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: -4,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.light.outline,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  rememberText: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
  },
  forgotText: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: "500",
  },

  // Button
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 4,
    // Gradient effect approximation — using primaryContainer as base
    backgroundColor: Colors.light.primaryContainer,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: Colors.light.primaryForeground,
    fontSize: 16,
    fontWeight: "600",
  },

  // Or divider
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.outlineVariant,
  },
  orText: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
  },

  // Biometrics
  biometricsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceContainerHigh,
  },
  biometricsText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.light.foreground,
  },

  // Apple Sign-In
  appleButton: {
    height: 50,
    width: "100%",
  },

  // Footer links
  footerLinks: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginTop: 28,
  },
  footerLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  footerLinkText: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
  },

  // Sign up
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  signupText: {
    fontSize: 14,
    color: Colors.light.onSurfaceVariant,
  },
  signupLink: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: "600",
  },

  // Legal
  legalText: {
    fontSize: 11,
    color: Colors.light.outline,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 16,
  },
});
