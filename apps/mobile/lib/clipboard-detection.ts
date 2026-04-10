import * as Clipboard from "expo-clipboard";
import { Alert, Linking } from "react-native";

const INVITE_URL_PATTERN = /clubos\.com\/invite\/([a-zA-Z0-9_-]+)/;
const CLUBOS_DEEP_LINK_PATTERN = /clubos:\/\/(.+)/;

/**
 * Check the clipboard for a ClubOS invite link and offer to open it.
 * Called once on app launch (foreground) to auto-detect pasted invite tokens.
 */
export async function checkClipboardForInvite(): Promise<void> {
  try {
    const hasString = await Clipboard.hasStringAsync();
    if (!hasString) return;

    const content = await Clipboard.getStringAsync();
    if (!content) return;

    // Check for invite URL
    const inviteMatch = content.match(INVITE_URL_PATTERN);
    if (inviteMatch) {
      const token = inviteMatch[1];
      Alert.alert(
        "Invite Link Detected",
        "It looks like you copied a ClubOS invite link. Would you like to open it?",
        [
          { text: "Ignore", style: "cancel" },
          {
            text: "Open Invite",
            onPress: () => {
              Linking.openURL(`clubos://invite/${token}`);
              // Clear clipboard to avoid re-detecting
              Clipboard.setStringAsync("");
            },
          },
        ]
      );
      return;
    }

    // Check for deep link
    const deepLinkMatch = content.match(CLUBOS_DEEP_LINK_PATTERN);
    if (deepLinkMatch) {
      Linking.openURL(content);
      Clipboard.setStringAsync("");
    }
  } catch {
    // Clipboard access failed — non-critical
  }
}
