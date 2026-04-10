import * as Calendar from "expo-calendar";
import { Platform, Alert } from "react-native";

/** Request calendar permissions and return whether granted */
async function ensureCalendarPermission(): Promise<boolean> {
  const { status: existingStatus } = await Calendar.getCalendarPermissionsAsync();
  if (existingStatus === "granted") return true;

  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === "granted";
}

/** Get or create the ClubOS calendar */
async function getClubOSCalendarId(): Promise<string | null> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

  // Look for existing ClubOS calendar
  const existing = calendars.find((c) => c.title === "ClubOS");
  if (existing) return existing.id;

  // Create new calendar
  if (Platform.OS === "ios") {
    const defaultCalendar = calendars.find(
      (c) => c.source && c.source.name === "iCloud"
    ) || calendars.find(
      (c) => c.source && c.source.isLocalAccount
    ) || calendars[0];

    if (!defaultCalendar?.source) return null;

    const newCalendarId = await Calendar.createCalendarAsync({
      title: "ClubOS",
      color: "#16a34a",
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: defaultCalendar.source.id,
      source: defaultCalendar.source,
      name: "ClubOS",
      ownerAccount: "ClubOS",
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
    return newCalendarId;
  }

  // Android
  const defaultCalendar = calendars.find((c) => c.isPrimary) || calendars[0];
  if (!defaultCalendar?.source) return null;

  const newCalendarId = await Calendar.createCalendarAsync({
    title: "ClubOS",
    color: "#16a34a",
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: defaultCalendar.source.id,
    source: defaultCalendar.source,
    name: "ClubOS",
    ownerAccount: "ClubOS",
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
  return newCalendarId;
}

interface CalendarEventInput {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
}

/** Add an event to the device calendar */
export async function addToCalendar(event: CalendarEventInput): Promise<boolean> {
  const hasPermission = await ensureCalendarPermission();
  if (!hasPermission) {
    Alert.alert(
      "Calendar Access Required",
      "Please enable calendar access in Settings to add events to your calendar."
    );
    return false;
  }

  const calendarId = await getClubOSCalendarId();
  if (!calendarId) {
    Alert.alert("Error", "Could not access your calendar. Please try again.");
    return false;
  }

  await Calendar.createEventAsync(calendarId, {
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate,
    location: event.location,
    notes: event.notes,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    alarms: [{ relativeOffset: -30 }], // 30 min reminder
  });

  return true;
}

/** Add a tee time booking to the calendar */
export async function addTeeTimeToCalendar(booking: {
  facilityName: string;
  date: string;
  startTime: string;
  partySize: number;
  holes?: number;
}): Promise<boolean> {
  const start = new Date(`${booking.date}T${booking.startTime}`);
  const durationMs = (booking.holes === 9 ? 2.5 : 4.5) * 60 * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);

  return addToCalendar({
    title: `Golf — ${booking.facilityName}`,
    startDate: start,
    endDate: end,
    location: booking.facilityName,
    notes: `Party of ${booking.partySize} | ${booking.holes || 18} holes`,
  });
}

/** Add a club event to the calendar */
export async function addEventToCalendar(event: {
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  description?: string;
}): Promise<boolean> {
  const start = new Date(event.startDate);
  const end = event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 2 * 60 * 60 * 1000);

  return addToCalendar({
    title: event.title,
    startDate: start,
    endDate: end,
    location: event.location,
    notes: event.description,
  });
}

/** Add a dining reservation to the calendar */
export async function addDiningToCalendar(reservation: {
  venueName: string;
  date: string;
  time: string;
  partySize: number;
}): Promise<boolean> {
  const start = new Date(`${reservation.date}T${reservation.time}`);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours

  return addToCalendar({
    title: `Dining — ${reservation.venueName}`,
    startDate: start,
    endDate: end,
    location: reservation.venueName,
    notes: `Party of ${reservation.partySize}`,
  });
}
