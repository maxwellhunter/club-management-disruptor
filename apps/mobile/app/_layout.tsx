import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";
import { setupNotificationDeepLinking, clearBadge } from "@/lib/notifications";

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

  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="event/[id]"
          options={{
            headerTitle: "Event Details",
            headerBackTitle: "Back",
            headerTintColor: Colors.light.primary,
          }}
        />
        <Stack.Screen
          name="announcements"
          options={{
            headerTitle: "Announcements",
            headerBackTitle: "Back",
            headerTintColor: Colors.light.primary,
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
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
