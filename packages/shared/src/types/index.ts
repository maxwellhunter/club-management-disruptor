// ============================================
// Core Entity Types for ClubOS
// ============================================

export type MemberRole = "admin" | "staff" | "member";
export type MemberStatus = "active" | "inactive" | "suspended" | "pending" | "invited";
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
  invite_token: string | null;
  invite_expires_at: string | null;
  invite_sent_at: string | null;
  invite_accepted_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus | null;
  created_at: string;
  updated_at: string;
}

// Invite claim page data (returned by GET /api/invite/[token])
export interface InviteInfo {
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  tier_name: string | null;
  club_name: string;
  club_logo_url: string | null;
  expires_at: string;
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

// Golf pricing types
export type GolfDayType = "weekday" | "weekend";
export type GolfTimeType = "prime" | "afternoon" | "twilight";
export type GolfHoles = "9" | "18";

export interface GolfRate {
  id: string;
  club_id: string;
  facility_id: string;
  name: string;
  holes: GolfHoles;
  day_type: GolfDayType;
  time_type: GolfTimeType;
  member_price: number;
  guest_price: number;
  cart_fee: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GolfRateWithFacility extends GolfRate {
  facility_name: string;
}

export interface GolfRatesResponse {
  rates: GolfRateWithFacility[];
  facilities: { id: string; name: string }[];
  role: MemberRole;
}

// POS types
export type POSProvider = "stripe_terminal" | "square" | "toast" | "lightspeed" | "manual";
export type POSTransactionStatus = "pending" | "completed" | "refunded" | "voided" | "failed";
export type POSTransactionType = "sale" | "refund" | "void";
export type POSLocation = "dining" | "pro_shop" | "bar" | "snack_bar" | "other";

export interface POSConfig {
  id: string;
  club_id: string;
  provider: POSProvider;
  location: POSLocation;
  name: string;
  is_active: boolean;
  config: Record<string, unknown>; // provider-specific config (encrypted at rest)
  created_at: string;
  updated_at: string;
}

export interface POSTransaction {
  id: string;
  club_id: string;
  pos_config_id: string;
  member_id: string | null; // null for guest/walk-up sales
  invoice_id: string | null;
  external_id: string | null; // ID from the POS provider
  type: POSTransactionType;
  status: POSTransactionStatus;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  payment_method: string | null; // card, cash, member_charge, etc.
  location: POSLocation;
  description: string | null;
  items: POSTransactionItem[];
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface POSTransactionItem {
  id: string;
  transaction_id: string;
  name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  category: string | null;
}

export interface POSTerminalSummary {
  totalSales: number;
  transactionCount: number;
  averageTicket: number;
  tipTotal: number;
  salesByLocation: { location: POSLocation; total: number; count: number }[];
  salesByHour: { hour: number; total: number; count: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
  recentTransactions: POSTransaction[];
}

// Accounting / GL Export types
export type AccountingProvider = "quickbooks" | "sage" | "xero" | "csv";
export type GLAccountType = "revenue" | "expense" | "asset" | "liability" | "equity";
export type ExportStatus = "pending" | "completed" | "failed";
export type ExportFormat = "iif" | "qbo" | "csv";
export type JournalEntrySource = "invoice" | "payment" | "pos_transaction" | "refund";

export interface GLAccount {
  id: string;
  club_id: string;
  account_number: string;
  name: string;
  type: GLAccountType;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface GLMapping {
  id: string;
  club_id: string;
  source_category: string; // e.g., "membership_dues", "dining_revenue", "pro_shop_revenue"
  gl_account_id: string;
  description: string | null;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  club_id: string;
  export_batch_id: string | null;
  source: JournalEntrySource;
  source_id: string; // invoice_id, payment_id, or pos_transaction_id
  date: string;
  description: string;
  debit_account_id: string;
  credit_account_id: string;
  amount: number;
  member_id: string | null;
  reference: string | null;
  created_at: string;
}

export interface ExportBatch {
  id: string;
  club_id: string;
  format: ExportFormat;
  provider: AccountingProvider;
  status: ExportStatus;
  date_from: string;
  date_to: string;
  entry_count: number;
  total_debits: number;
  total_credits: number;
  file_url: string | null;
  error_message: string | null;
  exported_by: string;
  created_at: string;
}

export interface AccountingSummary {
  glAccounts: GLAccount[];
  mappings: (GLMapping & { account_name: string; account_number: string })[];
  recentExports: ExportBatch[];
  unmappedCategories: string[];
  periodSummary: {
    revenue: number;
    payments: number;
    posSales: number;
    outstanding: number;
  };
}

// Data Migration types
export type ImportSourceSystem = "jonas" | "northstar" | "clubessential" | "generic_csv";
export type ImportEntityType = "members" | "invoices" | "payments" | "bookings" | "events";
export type ImportStatus = "pending" | "validating" | "preview" | "importing" | "completed" | "failed" | "cancelled";

export interface ImportBatch {
  id: string;
  club_id: string;
  source_system: ImportSourceSystem;
  entity_type: ImportEntityType;
  status: ImportStatus;
  file_name: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  imported_rows: number;
  skipped_rows: number;
  field_mapping: Record<string, string>; // source_column -> target_field
  errors: ImportError[];
  imported_by: string;
  created_at: string;
  completed_at: string | null;
}

export interface ImportError {
  row: number;
  field: string;
  value: string;
  message: string;
}

export interface ImportPreview {
  batch_id: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  errors: ImportError[];
  sample_rows: Record<string, unknown>[];
  detected_columns: string[];
  suggested_mapping: Record<string, string>;
}

export interface ImportFieldMapping {
  source_column: string;
  target_field: string;
  transform?: string; // e.g., "date:MM/DD/YYYY", "phone:strip", "currency:cents"
}

export interface ImportHistorySummary {
  recentImports: ImportBatch[];
  stats: {
    totalImports: number;
    totalMembersImported: number;
    totalInvoicesImported: number;
    lastImportDate: string | null;
  };
}

// Advanced Billing types
export type SpendingMinimumPeriod = "monthly" | "quarterly" | "annually";
export type SpendingCategory = "dining" | "pro_shop" | "bar" | "total";
export type AssessmentType = "capital_improvement" | "seasonal" | "special" | "initiation";
export type AssessmentStatus = "draft" | "active" | "completed" | "cancelled";
export type AssessmentMemberStatus = "pending" | "invoiced" | "partial" | "paid" | "waived";
export type BillingCycleType = "dues" | "minimum_shortfall" | "assessment";
export type BillingCycleStatus = "pending" | "running" | "completed" | "failed";

export interface SpendingMinimum {
  id: string;
  club_id: string;
  tier_id: string;
  name: string;
  category: SpendingCategory;
  amount: number;
  period: SpendingMinimumPeriod;
  enforce_shortfall: boolean;
  shortfall_description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpendingMinimumWithTier extends SpendingMinimum {
  tier_name: string;
  tier_level: MembershipTierLevel;
}

export interface SpendingTracking {
  id: string;
  club_id: string;
  member_id: string;
  minimum_id: string;
  period_start: string;
  period_end: string;
  amount_spent: number;
  amount_required: number;
  shortfall: number;
  shortfall_invoiced: boolean;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpendingTrackingWithDetails extends SpendingTracking {
  member_name: string;
  minimum_name: string;
  category: SpendingCategory;
}

export interface Assessment {
  id: string;
  club_id: string;
  name: string;
  description: string | null;
  type: AssessmentType;
  amount: number;
  target_all_members: boolean;
  target_tier_ids: string[] | null;
  target_member_ids: string[] | null;
  due_date: string;
  allow_installments: boolean;
  installment_count: number;
  installment_amount: number | null;
  status: AssessmentStatus;
  invoices_generated: boolean;
  total_assessed: number;
  total_collected: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AssessmentMember {
  id: string;
  assessment_id: string;
  member_id: string;
  amount: number;
  paid_amount: number;
  status: AssessmentMemberStatus;
  waiver_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssessmentMemberWithDetails extends AssessmentMember {
  first_name: string;
  last_name: string;
  email: string;
  member_number: string | null;
}

export interface BillingCycle {
  id: string;
  club_id: string;
  period_start: string;
  period_end: string;
  type: BillingCycleType;
  status: BillingCycleStatus;
  invoices_created: number;
  total_amount: number;
  error_message: string | null;
  run_by: string;
  created_at: string;
  completed_at: string | null;
}

export interface BillingCredit {
  id: string;
  club_id: string;
  member_id: string;
  amount: number;
  reason: string;
  applied_to_invoice_id: string | null;
  created_by: string;
  created_at: string;
}

export interface FamilyBillingInfo {
  family_id: string;
  family_name: string;
  primary_member_id: string;
  primary_member_name: string;
  billing_consolidated: boolean;
  billing_email: string | null;
  members: {
    id: string;
    first_name: string;
    last_name: string;
    outstanding_balance: number;
  }[];
  total_outstanding: number;
}

export interface AdvancedBillingSummary {
  spending_minimums: SpendingMinimumWithTier[];
  assessments: Assessment[];
  recent_cycles: BillingCycle[];
  families: FamilyBillingInfo[];
  stats: {
    active_minimums: number;
    active_assessments: number;
    total_assessed: number;
    total_collected: number;
    families_with_consolidation: number;
    shortfall_pending: number;
  };
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
