/**
 * iOS Context Menu Utilities
 *
 * Provides ActionSheetIOS-based context menus for long-press actions on cards.
 * Falls back to Alert.alert on Android.
 */
import { ActionSheetIOS, Alert, Platform } from "react-native";
import { haptics } from "./haptics";

interface MenuAction {
  label: string;
  icon?: string;
  destructive?: boolean;
  onPress: () => void;
}

/**
 * Show a context menu with haptic feedback.
 * On iOS, uses the native ActionSheetIOS for a polished feel.
 * On Android, falls back to Alert.alert with buttons.
 */
export function showContextMenu(
  title: string,
  actions: MenuAction[],
): void {
  haptics.medium();

  if (Platform.OS === "ios") {
    const labels = [...actions.map((a) => a.label), "Cancel"];
    const destructiveIndex = actions.findIndex((a) => a.destructive);

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: labels,
        cancelButtonIndex: labels.length - 1,
        destructiveButtonIndex: destructiveIndex >= 0 ? destructiveIndex : undefined,
        title,
      },
      (index) => {
        if (index < actions.length) {
          actions[index].onPress();
        }
      },
    );
  } else {
    Alert.alert(
      title,
      undefined,
      [
        ...actions.map((a) => ({
          text: a.label,
          onPress: a.onPress,
          style: (a.destructive ? "destructive" : "default") as "destructive" | "default",
        })),
        { text: "Cancel", style: "cancel" as const },
      ],
    );
  }
}

// ─── Pre-built context menus for common entities ────────────────────

export function showBookingContextMenu(options: {
  bookingId: string;
  facilityName: string;
  date: string;
  time: string;
  onAddToCalendar: () => void;
  onShare: () => void;
  onCancel: () => void;
}): void {
  showContextMenu(`${options.facilityName} — ${options.date}`, [
    { label: "Add to Calendar", onPress: options.onAddToCalendar },
    { label: "Share Tee Time", onPress: options.onShare },
    { label: "Cancel Booking", destructive: true, onPress: options.onCancel },
  ]);
}

export function showEventContextMenu(options: {
  title: string;
  onAddToCalendar: () => void;
  onShare: () => void;
  onViewDetails: () => void;
}): void {
  showContextMenu(options.title, [
    { label: "Add to Calendar", onPress: options.onAddToCalendar },
    { label: "Share Event", onPress: options.onShare },
    { label: "View Details", onPress: options.onViewDetails },
  ]);
}

export function showAnnouncementContextMenu(options: {
  title: string;
  onShare: () => void;
  onViewAll: () => void;
}): void {
  showContextMenu(options.title, [
    { label: "View All Announcements", onPress: options.onViewAll },
    { label: "Share", onPress: options.onShare },
  ]);
}
