import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "./supabase";

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
