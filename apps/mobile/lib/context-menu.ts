import { ActionSheetIOS, Platform, Alert } from "react-native";
import { haptics } from "./haptics";

export interface ContextMenuItem {
  label: string;
  icon?: string;
  destructive?: boolean;
  onPress: () => void;
}

/**
 * Show a native iOS action sheet (context menu) or Android alert fallback.
 * Trigger on long-press for a native-feeling interaction.
 */
export function showContextMenu(
  title: string,
  items: ContextMenuItem[]
): void {
  haptics.medium();

  if (Platform.OS === "ios") {
    const labels = items.map((i) => i.label);
    labels.push("Cancel");

    const destructiveIndex = items.findIndex((i) => i.destructive);
    const cancelIndex = labels.length - 1;

    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: labels,
        destructiveButtonIndex: destructiveIndex >= 0 ? destructiveIndex : undefined,
        cancelButtonIndex: cancelIndex,
      },
      (index) => {
        if (index < items.length) {
          items[index].onPress();
        }
      }
    );
  } else {
    // Android fallback using Alert
    const buttons = items.map((item) => ({
      text: item.label,
      style: (item.destructive ? "destructive" : "default") as "destructive" | "default",
      onPress: item.onPress,
    }));
    buttons.push({ text: "Cancel", style: "default" as "destructive" | "default", onPress: () => {} });

    Alert.alert(title, undefined, buttons);
  }
}
