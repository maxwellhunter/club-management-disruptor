import { Resend } from "resend";

// Lazy-init: only create the client if the API key is set
let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Default sender — uses Resend's onboarding domain until a custom domain is configured
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "ClubOS <onboarding@resend.dev>";

interface SendResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Send an email via Resend. Gracefully returns { success: false } if Resend
 * is not configured, so callers don't need to guard.
 */
async function send({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping email to:", to);
    return { success: false, error: "Email not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("[email] Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("[email] Send failed:", err);
    return { success: false, error: "Email send failed" };
  }
}

// ── Email Templates ─────────────────────────────────────────

function baseLayout(content: string, clubName: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f9fafb;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <!-- Header -->
    <div style="background:#16a34a;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${clubName}</h1>
    </div>
    <!-- Body -->
    <div style="padding:32px;">
      ${content}
    </div>
    <!-- Footer -->
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Sent by ${clubName} via ClubOS
      </p>
    </div>
  </div>
</body>
</html>`;
}

function buttonHtml(text: string, url: string) {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${url}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">${text}</a>
  </div>`;
}

// ── Public email functions ──────────────────────────────────

/**
 * Send a member invite email.
 */
export async function sendInviteEmail({
  to,
  memberName,
  clubName,
  tierName,
  inviteUrl,
}: {
  to: string;
  memberName: string;
  clubName: string;
  tierName: string;
  inviteUrl: string;
}): Promise<SendResult> {
  const html = baseLayout(
    `<h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Welcome to ${clubName}!</h2>
     <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6;">
       Hi ${memberName}, you've been invited to join <strong>${clubName}</strong> as a <strong>${tierName}</strong> member.
     </p>
     <p style="margin:0 0 4px;font-size:14px;color:#6b7280;line-height:1.6;">
       Click below to set your password and activate your account. This link expires in 7 days.
     </p>
     ${buttonHtml("Accept Invitation", inviteUrl)}
     <p style="margin:0;font-size:12px;color:#9ca3af;">
       If you didn't expect this invitation, you can safely ignore this email.
     </p>`,
    clubName
  );

  return send({
    to,
    subject: `You're invited to join ${clubName}`,
    html,
  });
}

/**
 * Send an invoice notification email.
 */
export async function sendInvoiceEmail({
  to,
  memberName,
  clubName,
  invoiceDescription,
  amount,
  dueDate,
  dashboardUrl,
}: {
  to: string;
  memberName: string;
  clubName: string;
  invoiceDescription: string;
  amount: number;
  dueDate: string;
  dashboardUrl: string;
}): Promise<SendResult> {
  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);

  const formattedDate = new Date(dueDate + "T12:00:00").toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" }
  );

  const html = baseLayout(
    `<h2 style="margin:0 0 8px;font-size:18px;color:#111827;">New Invoice</h2>
     <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">
       Hi ${memberName}, a new invoice has been issued for your account.
     </p>
     <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:20px;">
       <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Description:</strong> ${invoiceDescription}</p>
       <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Amount:</strong> ${formattedAmount}</p>
       <p style="margin:0;font-size:14px;color:#374151;"><strong>Due:</strong> ${formattedDate}</p>
     </div>
     ${buttonHtml("View in Dashboard", dashboardUrl + "/dashboard/billing")}`,
    clubName
  );

  return send({
    to,
    subject: `Invoice: ${invoiceDescription} — ${formattedAmount}`,
    html,
  });
}

/**
 * Send an announcement notification email.
 */
export async function sendAnnouncementEmail({
  to,
  memberName,
  clubName,
  title,
  content,
  priority,
  dashboardUrl,
}: {
  to: string;
  memberName: string;
  clubName: string;
  title: string;
  content: string;
  priority: string;
  dashboardUrl: string;
}): Promise<SendResult> {
  const priorityBadge =
    priority === "urgent"
      ? '<span style="display:inline-block;background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;margin-left:8px;">URGENT</span>'
      : priority === "high"
        ? '<span style="display:inline-block;background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;margin-left:8px;">IMPORTANT</span>'
        : "";

  // Truncate content for email preview
  const truncated =
    content.length > 500 ? content.substring(0, 500) + "..." : content;

  const html = baseLayout(
    `<h2 style="margin:0 0 8px;font-size:18px;color:#111827;">${title}${priorityBadge}</h2>
     <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">
       Hi ${memberName}, here's a new announcement from ${clubName}:
     </p>
     <div style="background:#f9fafb;border-left:4px solid #16a34a;padding:16px;margin-bottom:20px;border-radius:0 8px 8px 0;">
       <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;">${truncated}</p>
     </div>
     ${buttonHtml("View in ClubOS", dashboardUrl + "/dashboard/messages")}`,
    clubName
  );

  return send({
    to,
    subject: `${priority === "urgent" ? "🚨 " : priority === "high" ? "⚠️ " : ""}${title} — ${clubName}`,
    html,
  });
}

/**
 * Send a booking confirmation email.
 */
export async function sendBookingConfirmationEmail({
  to,
  memberName,
  clubName,
  facilityName,
  date,
  startTime,
  partySize,
  dashboardUrl,
}: {
  to: string;
  memberName: string;
  clubName: string;
  facilityName: string;
  date: string;
  startTime: string;
  partySize: number;
  dashboardUrl: string;
}): Promise<SendResult> {
  const formattedDate = new Date(date + "T12:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" }
  );

  const [h, m] = startTime.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const formattedTime = `${display}:${m} ${ampm}`;

  const html = baseLayout(
    `<h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Booking Confirmed!</h2>
     <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">
       Hi ${memberName}, your reservation is confirmed.
     </p>
     <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px;">
       <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Facility:</strong> ${facilityName}</p>
       <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Date:</strong> ${formattedDate}</p>
       <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Time:</strong> ${formattedTime}</p>
       <p style="margin:0;font-size:14px;color:#374151;"><strong>Party Size:</strong> ${partySize} ${partySize === 1 ? "player" : "players"}</p>
     </div>
     ${buttonHtml("Manage Bookings", dashboardUrl + "/dashboard/bookings")}
     <p style="margin:0;font-size:12px;color:#9ca3af;">
       Need to cancel or modify? Visit your dashboard or contact the pro shop.
     </p>`,
    clubName
  );

  return send({
    to,
    subject: `Booking Confirmed: ${facilityName} — ${formattedDate} at ${formattedTime}`,
    html,
  });
}

/**
 * Check if Resend email is configured.
 */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
