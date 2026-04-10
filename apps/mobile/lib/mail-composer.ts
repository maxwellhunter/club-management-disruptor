import { Alert, Linking, Platform, ActionSheetIOS } from "react-native";

interface ComposeOptions {
  to: string;
  subject?: string;
  body?: string;
}

function buildMailtoUrl({ to, subject, body }: ComposeOptions): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const qs = params.toString();
  return `mailto:${to}${qs ? `?${qs}` : ""}`;
}

export async function composeMail(options: ComposeOptions): Promise<void> {
  const url = buildMailtoUrl(options);
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  } else {
    Alert.alert(
      "No Email App",
      "Please configure a mail account in Settings to send email.",
    );
  }
}

export function showContactOptions() {
  const options = [
    "Email Front Desk",
    "Email Golf Pro Shop",
    "Email Dining Reservations",
    "Call the Club",
    "Cancel",
  ];

  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        title: "Contact The Lakes",
        message: "How would you like to reach us?",
      },
      (index) => {
        switch (index) {
          case 0:
            composeMail({
              to: "frontdesk@thelakes.club",
              subject: "Member Inquiry",
            });
            break;
          case 1:
            composeMail({
              to: "proshop@thelakes.club",
              subject: "Golf Inquiry",
            });
            break;
          case 2:
            composeMail({
              to: "dining@thelakes.club",
              subject: "Dining Reservation",
            });
            break;
          case 3:
            Linking.openURL("tel:+15551234567");
            break;
        }
      },
    );
  } else {
    Alert.alert("Contact The Lakes", "How would you like to reach us?", [
      {
        text: "Email Front Desk",
        onPress: () =>
          composeMail({ to: "frontdesk@thelakes.club", subject: "Member Inquiry" }),
      },
      {
        text: "Call the Club",
        onPress: () => Linking.openURL("tel:+15551234567"),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }
}
