// ============================================
// Core Entity Types for ClubOS
// ============================================

export type MemberRole = "admin" | "staff" | "member";
export type MemberStatus = "active" | "inactive" | "suspended" | "pending";
export type MembershipTierLevel = "standard" | "premium" | "vip" | "honorary";
export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "trialing"
  | "incomplete";

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
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus | null;
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
  stripe_product_id: string | null;
  stripe_price_id: string | null;
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

// Tier levels that can book golf
export const GOLF_ELIGIBLE_TIERS: MembershipTierLevel[] = ["premium", "vip", "honorary"];

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

// Tee time slot for availability display
export interface TeeTimeSlot {
  start_time: string; // "06:00"
  end_time: string; // "06:10"
  is_available: boolean;
  booking_id?: string; // present if booked
}

// Booking with joined facility and member details
export interface BookingWithDetails extends Booking {
  facility_name: string;
  facility_type: FacilityType;
  member_first_name: string;
  member_last_name: string;
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

// Event with RSVP count and current user's RSVP status
export interface EventWithRsvp extends ClubEvent {
  rsvp_count: number;
  user_rsvp_status: RsvpStatus | null;
}

// Events API response (includes role for conditional UI)
export interface EventsResponse {
  events: EventWithRsvp[];
  role: MemberRole;
}

// Event attendee (RSVP joined with member info, for admin attendee list)
export interface EventAttendee {
  rsvp_id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: RsvpStatus;
  guest_count: number;
  rsvp_created_at: string;
}

export interface EventAttendeesResponse {
  attendees: EventAttendee[];
  event_id: string;
  total_guests: number;
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

// Billing status response (from GET /api/billing/status)
export interface BillingStatus {
  role: MemberRole;
  tierName: string | null;
  hasStripeCustomer: boolean;
  subscription: {
    status: SubscriptionStatus;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    amount: number;
    tierName: string;
  } | null;
  recentInvoices: Invoice[];
}

// Admin billing overview response
export interface BillingOverview {
  outstandingBalance: number;
  collectedMtd: number;
  overdueCount: number;
  recentInvoices: (Invoice & { member_name: string })[];
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

// Dining & Menu types
export type DiningOrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

export interface MenuCategory {
  id: string;
  club_id: string;
  facility_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface MenuItem {
  id: string;
  club_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DiningOrder {
  id: string;
  club_id: string;
  member_id: string;
  facility_id: string;
  booking_id: string | null;
  invoice_id: string | null;
  status: DiningOrderStatus;
  table_number: string | null;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiningOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  special_instructions: string | null;
  created_at: string;
}

// Menu with categories and items (API response)
export interface MenuWithItems {
  facility: { id: string; name: string; type: string };
  categories: (MenuCategory & { items: MenuItem[] })[];
}

// Order with line items (API response)
export interface DiningOrderWithItems extends DiningOrder {
  items: DiningOrderItem[];
  facility_name: string;
  member_first_name: string;
  member_last_name: string;
}

// Dining slot for availability display
export interface DiningSlot {
  start_time: string;
  end_time: string;
  is_available: boolean;
  bookings_remaining: number;
}

// Member directory types
export interface DirectoryMember {
  id: string;
  member_number: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: MemberRole;
  status: MemberStatus;
  join_date: string;
  tier_name: string | null;
  tier_level: MembershipTierLevel | null;
}

export interface MemberDirectoryResponse {
  members: DirectoryMember[];
  tiers: { id: string; name: string; level: MembershipTierLevel }[];
  role: MemberRole;
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
