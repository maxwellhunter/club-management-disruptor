// ============================================
// Core Entity Types for ClubOS
// ============================================

export type MemberRole = "admin" | "staff" | "member";
export type MemberStatus = "active" | "inactive" | "suspended" | "pending";
export type MembershipTierLevel = "standard" | "premium" | "vip" | "honorary";

export interface Club {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  club_id: string;
  user_id: string;
  member_number: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: MemberRole;
  status: MemberStatus;
  membership_tier_id: string | null;
  family_id: string | null;
  join_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MembershipTier {
  id: string;
  club_id: string;
  name: string;
  level: MembershipTierLevel;
  description: string | null;
  monthly_dues: number;
  annual_dues: number | null;
  benefits: string[];
  is_active: boolean;
  created_at: string;
}

export interface Family {
  id: string;
  club_id: string;
  name: string;
  primary_member_id: string;
  created_at: string;
}

// Booking types
export type FacilityType = "golf" | "tennis" | "dining" | "pool" | "fitness" | "other";
export type BookingStatus = "confirmed" | "pending" | "cancelled" | "completed" | "no_show";

export interface Facility {
  id: string;
  club_id: string;
  name: string;
  type: FacilityType;
  description: string | null;
  capacity: number | null;
  is_active: boolean;
  created_at: string;
}

export interface BookingSlot {
  id: string;
  facility_id: string;
  day_of_week: number; // 0-6
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  max_bookings: number;
  is_active: boolean;
}

export interface Booking {
  id: string;
  club_id: string;
  facility_id: string;
  member_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  party_size: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Event types
export type EventStatus = "draft" | "published" | "cancelled" | "completed";
export type RsvpStatus = "attending" | "declined" | "maybe" | "waitlisted";

export interface ClubEvent {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
  capacity: number | null;
  price: number | null;
  status: EventStatus;
  image_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventRsvp {
  id: string;
  event_id: string;
  member_id: string;
  status: RsvpStatus;
  guest_count: number;
  created_at: string;
  updated_at: string;
}

// Billing types
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled" | "void";
export type PaymentMethod = "card" | "ach" | "check" | "cash" | "other";

export interface Invoice {
  id: string;
  club_id: string;
  member_id: string;
  stripe_invoice_id: string | null;
  amount: number;
  status: InvoiceStatus;
  description: string;
  due_date: string;
  paid_at: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  club_id: string;
  member_id: string;
  invoice_id: string | null;
  stripe_payment_id: string | null;
  amount: number;
  method: PaymentMethod;
  description: string | null;
  created_at: string;
}

// Communication types
export type AnnouncementPriority = "low" | "normal" | "high" | "urgent";

export interface Announcement {
  id: string;
  club_id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  target_tier_ids: string[] | null; // null = all members
  published_at: string | null;
  created_by: string;
  created_at: string;
}

// Chat types
export interface ChatConversation {
  id: string;
  club_id: string;
  member_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}
