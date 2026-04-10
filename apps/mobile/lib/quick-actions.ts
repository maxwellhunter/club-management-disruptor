import { Platform, NativeModules } from "react-native";
import { router } from "expo-router";

const ACTION_ROUTES: Record<string, string> = {
  "com.clubos.app.book-tee-time": "/(tabs)/bookings",
  "com.clubos.app.check-in": "/membership-card",
  "com.clubos.app.concierge": "/(tabs)/chat",
  "com.clubos.app.events": "/(tabs)/events",
};

/**
 * Handle iOS Home Screen Quick Actions (3D Touch / Haptic Touch shortcuts).
 * Call once from the root layout after auth is resolved.
 */
export function handleQuickAction(shortcutType: string | undefined): void {
  if (!shortcutType) return;
  const route = ACTION_ROUTES[shortcutType];
  if (route) {
    // Small delay to ensure navigation is ready
    setTimeout(() => router.push(route as any), 100);
  }
}

/**
 * Check if the app was launched from a Quick Action (cold start).
 * Returns the shortcut item type or null.
 */
export function getInitialQuickAction(): string | null {
  if (Platform.OS !== "ios") return null;
  try {
    const launchOptions = NativeModules.RNBootSplash?.getLaunchOptions?.();
    return launchOptions?.shortcutItem?.type ?? null;
  } catch {
    return null;
  }
}
