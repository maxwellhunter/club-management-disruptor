import * as Linking from "expo-linking";
import { router } from "expo-router";
import { Platform } from "react-native";

/**
 * Maps incoming deep link URLs to app routes.
 *
 * Supported URL schemes:
 *   clubos://bookings        → /(tabs)/bookings
 *   clubos://events          → /(tabs)/events
 *   clubos://event/[id]      → /event/[id]
 *   clubos://chat            → /(tabs)/chat
 *   clubos://profile         → /(tabs)/profile
 *   clubos://membership-card → /membership-card
 *   clubos://announcements   → /announcements
 *   clubos://billing         → /billing
 *   clubos://guests          → /guests
 *   clubos://scorecard       → /scorecard
 *
 * Universal links (https://app.clubos.com/...):
 *   Same path mappings as above
 */

type RouteMap = Record<string, string>;

const ROUTE_MAP: RouteMap = {
  bookings: "/(tabs)/bookings",
  events: "/(tabs)/events",
  chat: "/(tabs)/chat",
  dining: "/(tabs)/dining",
  members: "/(tabs)/members",
  profile: "/(tabs)/profile",
  "membership-card": "/membership-card",
  announcements: "/announcements",
  billing: "/billing",
  guests: "/guests",
  scorecard: "/scorecard",
  reports: "/reports",
  home: "/(tabs)",
};

function handleDeepLink(url: string) {
  try {
    const parsed = Linking.parse(url);
    const path = parsed.path?.replace(/^\/+/, "") || "";

    // Handle event/[id] pattern
    if (path.startsWith("event/")) {
      const eventId = path.split("/")[1];
      if (eventId) {
        router.push(`/event/${eventId}` as never);
        return;
      }
    }

    // Handle settings/* pattern
    if (path.startsWith("settings/")) {
      const settingsPage = path.split("/")[1];
      if (settingsPage) {
        router.push(`/settings/${settingsPage}` as never);
        return;
      }
    }

    // Handle standard routes
    const route = ROUTE_MAP[path];
    if (route) {
      router.push(route as never);
      return;
    }

    // Fallback to home
    if (path) {
      console.log(`[DeepLink] Unmatched path: ${path}`);
    }
  } catch (err) {
    console.error("[DeepLink] Failed to handle URL:", err);
  }
}

export function setupDeepLinking(): () => void {
  // Handle URLs that opened the app
  Linking.getInitialURL().then((url) => {
    if (url) {
      // Delay slightly to let navigation mount
      setTimeout(() => handleDeepLink(url), 500);
    }
  });

  // Handle URLs while app is running
  const subscription = Linking.addEventListener("url", (event) => {
    handleDeepLink(event.url);
  });

  return () => subscription.remove();
}

export function createDeepLink(path: string): string {
  if (Platform.OS === "ios") {
    return Linking.createURL(path);
  }
  return `clubos://${path}`;
}
