import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider, useTheme } from "@/lib/theme-context";
import { setupNotificationDeepLinking, clearBadge } from "@/lib/notifications";
import { setupDeepLinking } from "@/lib/deep-linking";
import { OfflineBanner } from "@/components/offline-banner";
import { checkClipboardForInvite } from "@/lib/clipboard-detection";

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments]);

  // Set up notification deep linking and clear badge on launch
  useEffect(() => {
    const cleanup = setupNotificationDeepLinking();
    clearBadge();
    return cleanup;
  }, []);

  // Set up URL deep linking (clubos:// scheme and universal links)
  useEffect(() => {
    const cleanup = setupDeepLinking();
    return cleanup;
  }, []);

  // Check clipboard for invite links on app launch and foreground resume
  const clipboardChecked = useRef(false);
  useEffect(() => {
    if (user && !clipboardChecked.current) {
      clipboardChecked.current = true;
      checkClipboardForInvite();
    }

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && user) {
        checkClipboardForInvite();
      }
    });
    return () => sub.remove();
  }, [user]);

  const { colors, isDark } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <OfflineBanner />
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="event/[id]"
          options={{
            headerTitle: "Event Details",
            headerBackTitle: "Back",
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.background },
          }}
        />
        <Stack.Screen
          name="announcements"
          options={{
            headerTitle: "Announcements",
            headerBackTitle: "Back",
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.background },
          }}
        />
        <Stack.Screen
          name="guests"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="reports"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="settings/personal-info"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="settings/notifications"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="settings/security"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="settings/appearance"
          options={{
            headerShown: true,
            headerTitle: "Appearance",
            headerBackTitle: "Back",
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.background },
          }}
        />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ThemeProvider>
  );
}
