import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "./supabase";
import { router } from "expo-router";

// Configure notification handler — show alerts even when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request push notification permissions and register the device token.
 * Stores the Expo push token in the member's profile for server-side sending.
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  // Check / request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  // Get Expo push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: projectId ?? undefined,
  });
  const token = tokenData.data;

  // Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#16a34a",
    });
  }

  // Store token in Supabase for the member
  try {
    await supabase
      .from("members")
      .update({ push_token: token })
      .eq("user_id", userId);
  } catch {
    // Token storage is best-effort — don't block the app
  }

  return token;
}

/**
 * Schedule a local notification (e.g., booking reminders).
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  triggerSeconds?: number,
) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: "default" },
    trigger: triggerSeconds
      ? { seconds: triggerSeconds, type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL }
      : null,
  });
}

/**
 * Get the current badge count.
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

/**
 * Clear badge count.
 */
export async function clearBadge() {
  await Notifications.setBadgeCountAsync(0);
}

/**
 * Handle notification deep links — routes user to relevant screen when tapping a notification.
 * Call this once from the root layout to register the response listener.
 */
export function setupNotificationDeepLinking(): () => void {
  // Handle notification taps when app is in foreground or background
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data) return;

      const { type, id } = data;

      switch (type) {
        case "booking":
          router.push("/(tabs)/bookings");
          break;
        case "event":
          if (id) {
            router.push(`/event/${id}`);
          } else {
            router.push("/(tabs)/events");
          }
          break;
        case "dining":
          router.push("/(tabs)/dining");
          break;
        case "announcement":
          router.push("/announcements");
          break;
        case "billing":
          router.push("/billing");
          break;
        case "chat":
          router.push("/(tabs)/chat");
          break;
        default:
          // Unknown type — go to home
          router.push("/(tabs)");
          break;
      }
    }
  );

  return () => subscription.remove();
}

/**
 * Check if app was opened from a notification (cold start).
 */
export async function getInitialNotification() {
  const response = await Notifications.getLastNotificationResponseAsync();
  return response?.notification.request.content.data as Record<string, string> | undefined;
}
