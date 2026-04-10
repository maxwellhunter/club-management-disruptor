import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/**
 * Contextual haptic feedback patterns for iOS-native feel.
 */
export const haptics = {
  /** Light tap — tab switches, toggle presses */
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),

  /** Medium tap — button presses, selections */
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),

  /** Heavy tap — confirmations, important actions */
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),

  /** Success — booking confirmed, RSVP sent, payment success */
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),

  /** Warning — approaching limit, expiring soon */
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),

  /** Error — validation failed, action denied */
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),

  /** Selection changed — picker wheels, date selection */
  selection: () => Haptics.selectionAsync(),
};
