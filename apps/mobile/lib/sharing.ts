import * as Clipboard from "expo-clipboard";
import { Alert, Platform, Share } from "react-native";

/** Copy text to clipboard with feedback */
export async function copyToClipboard(text: string, label = "Copied to clipboard") {
  await Clipboard.setStringAsync(text);
  if (Platform.OS === "ios") {
    // iOS shows a native paste banner, no alert needed
  } else {
    Alert.alert(label);
  }
}

/** Share a tee time booking */
export async function shareTeeTime(booking: {
  facilityName: string;
  date: string;
  time: string;
  partySize: number;
  holes?: number;
}): Promise<void> {
  const formattedDate = new Date(booking.date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const message = [
    `Golf at ${booking.facilityName}`,
    `${formattedDate} at ${formatTime(booking.time)}`,
    `${booking.holes || 18} holes \u2022 Party of ${booking.partySize}`,
    "",
    "Booked via ClubOS",
  ].join("\n");

  await shareText(message);
}

/** Share an event */
export async function shareEvent(event: {
  title: string;
  date: string;
  location?: string;
  description?: string;
}): Promise<void> {
  const formattedDate = new Date(event.date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const lines = [event.title, formattedDate];
  if (event.location) lines.push(event.location);
  if (event.description) lines.push("", event.description.slice(0, 200));
  lines.push("", "Shared from ClubOS");

  await shareText(lines.join("\n"));
}

/** Share a scorecard summary */
export async function shareScorecard(round: {
  facilityName: string;
  date: string;
  score: number;
  par: number;
  holes: number;
}): Promise<void> {
  const formattedDate = new Date(round.date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const diff = round.score - round.par;
  const scoreLabel =
    diff === 0 ? "Even par" : diff > 0 ? `+${diff}` : `${diff}`;

  const message = [
    `${round.holes}-Hole Round at ${round.facilityName}`,
    `Score: ${round.score} (${scoreLabel})`,
    `Par: ${round.par}`,
    formattedDate,
    "",
    "Tracked with ClubOS",
  ].join("\n");

  await shareText(message);
}

/** Share a dining reservation */
export async function shareDiningReservation(reservation: {
  venueName: string;
  date: string;
  time: string;
  partySize: number;
}): Promise<void> {
  const formattedDate = new Date(reservation.date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const message = [
    `Dining at ${reservation.venueName}`,
    `${formattedDate} at ${formatTime(reservation.time)}`,
    `Party of ${reservation.partySize}`,
    "",
    "Reserved via ClubOS",
  ].join("\n");

  await shareText(message);
}

/** Share plain text via the native share sheet */
async function shareText(text: string): Promise<void> {
  try {
    await Share.share({ message: text });
  } catch {
    // Fallback: copy to clipboard if share sheet fails
    await copyToClipboard(text, "Copied to clipboard");
  }
}

function formatTime(time: string): string {
  if (time.includes(":")) {
    const [h, m] = time.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }
  return time;
}
