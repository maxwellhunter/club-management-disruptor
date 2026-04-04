/**
 * Push Notification Sender — Uses Expo Push API to deliver notifications
 *
 * Handles:
 * - Single and batch sending via Expo push service
 * - Preference checking (skip if member opted out)
 * - Template variable interpolation
 * - Delivery receipt tracking
 * - Automatic token cleanup on invalid tokens
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  to: string;            // Expo push token
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;           // Receipt ID for delivery tracking
  message?: string;
  details?: { error?: string };
}

interface SendResult {
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/** Send a push notification to a single Expo push token */
async function sendPush(message: PushMessage): Promise<ExpoPushTicket> {
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await res.json();
    // Expo returns { data: ticket } for single, { data: [ticket] } for batch
    return result.data ?? result;
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Network error",
    };
  }
}

/** Send push notifications in batches (Expo supports up to 100 per request) */
async function sendBatch(messages: PushMessage[]): Promise<ExpoPushTicket[]> {
  const BATCH_SIZE = 100;
  const tickets: ExpoPushTicket[] = [];

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(batch),
      });

      const result = await res.json();
      const batchTickets = Array.isArray(result.data) ? result.data : [result.data];
      tickets.push(...batchTickets);
    } catch (error) {
      // Fill with errors for this batch
      batch.forEach(() => {
        tickets.push({
          status: "error",
          message: error instanceof Error ? error.message : "Batch send failed",
        });
      });
    }
  }

  return tickets;
}

/** Interpolate template variables: "Hello {{name}}" → "Hello John" */
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/** Check if a member has push notifications enabled for a category */
async function isPushEnabled(
  adminClient: SupabaseClient,
  memberId: string,
  category: string
): Promise<boolean> {
  const { data } = await adminClient
    .from("notification_preferences")
    .select("push_enabled")
    .eq("member_id", memberId)
    .eq("category", category)
    .maybeSingle();

  // Default to enabled if no preference exists
  return data?.push_enabled ?? true;
}

/** Send a notification to a specific member */
export async function sendToMember(
  adminClient: SupabaseClient,
  clubId: string,
  memberId: string,
  category: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ sent: boolean; reason?: string }> {
  // Check preferences
  const enabled = await isPushEnabled(adminClient, memberId, category);
  if (!enabled) {
    await logNotification(adminClient, clubId, memberId, category, title, body, data, "skipped");
    return { sent: false, reason: "Push disabled by member" };
  }

  // Get push token
  const { data: member } = await adminClient
    .from("members")
    .select("push_token")
    .eq("id", memberId)
    .single();

  if (!member?.push_token) {
    await logNotification(adminClient, clubId, memberId, category, title, body, data, "skipped", "No push token");
    return { sent: false, reason: "No push token" };
  }

  // Send
  const ticket = await sendPush({
    to: member.push_token,
    title,
    body,
    data,
    sound: "default",
    channelId: "default",
  });

  if (ticket.status === "ok") {
    await logNotification(adminClient, clubId, memberId, category, title, body, data, "sent", undefined, ticket.id);
    return { sent: true };
  } else {
    const errorMsg = ticket.details?.error === "DeviceNotRegistered"
      ? "Device not registered"
      : ticket.message ?? "Unknown error";

    // Clean up invalid tokens
    if (ticket.details?.error === "DeviceNotRegistered") {
      await adminClient
        .from("members")
        .update({ push_token: null })
        .eq("id", memberId);
    }

    await logNotification(adminClient, clubId, memberId, category, title, body, data, "failed", errorMsg);
    return { sent: false, reason: errorMsg };
  }
}

/** Send a notification to all members of a club (with optional tier/category filtering) */
export async function sendToClub(
  adminClient: SupabaseClient,
  clubId: string,
  category: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  options?: {
    tierIds?: string[];
    memberIds?: string[];
    templateVars?: Record<string, string>;
  }
): Promise<SendResult> {
  const result: SendResult = { sent: 0, skipped: 0, failed: 0, errors: [] };

  // Build member query
  let query = adminClient
    .from("members")
    .select("id, first_name, last_name, push_token, membership_tier_id")
    .eq("club_id", clubId)
    .eq("status", "active")
    .not("push_token", "is", null);

  if (options?.memberIds && options.memberIds.length > 0) {
    query = query.in("id", options.memberIds);
  } else if (options?.tierIds && options.tierIds.length > 0) {
    query = query.in("membership_tier_id", options.tierIds);
  }

  const { data: members } = await query;
  if (!members || members.length === 0) {
    result.errors.push("No eligible members with push tokens found");
    return result;
  }

  // Check preferences in bulk
  const memberIds = members.map((m) => m.id);
  const { data: prefs } = await adminClient
    .from("notification_preferences")
    .select("member_id, push_enabled")
    .in("member_id", memberIds)
    .eq("category", category);

  const disabledSet = new Set(
    (prefs ?? []).filter((p) => !p.push_enabled).map((p) => p.member_id)
  );

  // Build messages
  const messages: PushMessage[] = [];
  const messageMembers: string[] = [];

  for (const member of members) {
    if (disabledSet.has(member.id)) {
      result.skipped++;
      continue;
    }

    const vars = {
      first_name: member.first_name,
      last_name: member.last_name,
      ...options?.templateVars,
    };

    messages.push({
      to: member.push_token,
      title: interpolate(title, vars),
      body: interpolate(body, vars),
      data,
      sound: "default",
      channelId: "default",
    });
    messageMembers.push(member.id);
  }

  if (messages.length === 0) {
    return result;
  }

  // Send batch
  const tickets = await sendBatch(messages);

  // Log results
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const memberId = messageMembers[i];

    if (ticket.status === "ok") {
      result.sent++;
      await logNotification(adminClient, clubId, memberId, category, messages[i].title, messages[i].body, data, "sent", undefined, ticket.id);
    } else {
      result.failed++;
      const errorMsg = ticket.message ?? "Send failed";
      result.errors.push(`Member ${memberId}: ${errorMsg}`);
      await logNotification(adminClient, clubId, memberId, category, messages[i].title, messages[i].body, data, "failed", errorMsg);

      // Clean up invalid tokens
      if (ticket.details?.error === "DeviceNotRegistered") {
        await adminClient
          .from("members")
          .update({ push_token: null })
          .eq("id", memberId);
      }
    }
  }

  return result;
}

/** Log a notification to the audit trail */
async function logNotification(
  adminClient: SupabaseClient,
  clubId: string,
  memberId: string,
  category: string,
  title: string,
  body: string,
  data: Record<string, unknown> | undefined,
  status: string,
  errorMessage?: string,
  expoReceiptId?: string
) {
  await adminClient.from("notification_log").insert({
    club_id: clubId,
    member_id: memberId,
    category,
    title,
    body,
    data: data ?? null,
    channel: "push",
    status,
    error_message: errorMessage ?? null,
    expo_receipt_id: expoReceiptId ?? null,
    sent_at: status === "sent" ? new Date().toISOString() : null,
  });
}

/** Pre-built notification senders for common club events */
export const ClubNotifications = {
  /** New booking confirmed */
  bookingConfirmed: (adminClient: SupabaseClient, clubId: string, memberId: string, facilityName: string, date: string, time: string) =>
    sendToMember(adminClient, clubId, memberId, "bookings", "Booking Confirmed", `Your ${facilityName} booking on ${date} at ${time} is confirmed.`, { type: "booking", screen: "bookings" }),

  /** Booking cancelled */
  bookingCancelled: (adminClient: SupabaseClient, clubId: string, memberId: string, facilityName: string, date: string) =>
    sendToMember(adminClient, clubId, memberId, "bookings", "Booking Cancelled", `Your ${facilityName} booking on ${date} has been cancelled.`, { type: "booking", screen: "bookings" }),

  /** New event published */
  eventPublished: (adminClient: SupabaseClient, clubId: string, eventTitle: string, eventDate: string) =>
    sendToClub(adminClient, clubId, "events", "New Event", `"${eventTitle}" on ${eventDate} — RSVP now!`, { type: "event", screen: "events" }),

  /** Invoice sent */
  invoiceSent: (adminClient: SupabaseClient, clubId: string, memberId: string, amount: string, description: string) =>
    sendToMember(adminClient, clubId, memberId, "billing", "New Invoice", `${description} — ${amount}`, { type: "invoice", screen: "billing" }),

  /** Announcement */
  announcement: (adminClient: SupabaseClient, clubId: string, title: string, tierIds?: string[]) =>
    sendToClub(adminClient, clubId, "announcements", title, "Tap to read the full announcement.", { type: "announcement", screen: "messages" }, { tierIds }),

  /** Guest checked in */
  guestCheckedIn: (adminClient: SupabaseClient, clubId: string, memberId: string, guestName: string) =>
    sendToMember(adminClient, clubId, memberId, "guests", "Guest Checked In", `${guestName} has been checked in at the club.`, { type: "guest", screen: "guests" }),

  /** Dining order ready */
  orderReady: (adminClient: SupabaseClient, clubId: string, memberId: string, facilityName: string) =>
    sendToMember(adminClient, clubId, memberId, "dining", "Order Ready", `Your order at ${facilityName} is ready for pickup.`, { type: "dining", screen: "dining" }),
};
