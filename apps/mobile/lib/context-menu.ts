import { ActionSheetIOS, Alert, Platform, Share } from "react-native";
import { haptics } from "./haptics";

interface MenuAction {
  label: string;
  icon?: string;
  destructive?: boolean;
  onPress: () => void;
}

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
