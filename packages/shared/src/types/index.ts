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

export interface FamilyMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  tier_name: string | null;
  is_primary: boolean;
}

export interface FamilyWithMembers extends Family {
  members: FamilyMember[];
  member_count: number;
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
  image_url: string | null;
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
export type RsvpStatus = "attending" | "declined" | "waitlisted";

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
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export type DietaryTag =
  | "vegetarian"
  | "vegan"
  | "gluten-free"
  | "nut-free"
  | "dairy-free"
  | "shellfish-free"
  | "spicy"
  | "halal"
  | "kosher";

export const DIETARY_TAGS: { value: DietaryTag; label: string; emoji: string }[] = [
  { value: "vegetarian", label: "Vegetarian", emoji: "🥬" },
  { value: "vegan", label: "Vegan", emoji: "🌱" },
  { value: "gluten-free", label: "Gluten-Free", emoji: "🌾" },
  { value: "nut-free", label: "Nut-Free", emoji: "🥜" },
  { value: "dairy-free", label: "Dairy-Free", emoji: "🥛" },
  { value: "shellfish-free", label: "Shellfish-Free", emoji: "🦐" },
  { value: "spicy", label: "Spicy", emoji: "🌶️" },
  { value: "halal", label: "Halal", emoji: "☪️" },
  { value: "kosher", label: "Kosher", emoji: "✡️" },
];

export interface FacilityTable {
  number: string;
  seats: number;
  location: string;
}

export interface MenuItem {
  id: string;
  club_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  dietary_tags: DietaryTag[];
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
  estimated_prep_minutes: number | null;
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

// Golf Player Rates (per-tier pricing)
export type BookingPlayerType = "member" | "guest";

export interface GolfPlayerRate {
  id: string;
  club_id: string;
  facility_id: string;
  name: string;
  tier_id: string | null;
  is_guest: boolean;
  day_type: GolfDayType;
  time_type: GolfTimeType;
  holes: GolfHoles;
  greens_fee: number;
  cart_fee: number;
  caddie_fee: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GolfPlayerRateWithDetails extends GolfPlayerRate {
  facility_name: string;
  tier_name: string | null;
}

export interface GolfPlayerRatesResponse {
  rates: GolfPlayerRateWithDetails[];
  facilities: { id: string; name: string }[];
  tiers: { id: string; name: string; level: string }[];
  role: MemberRole;
}

export interface BookingPlayer {
  id: string;
  booking_id: string;
  player_type: BookingPlayerType;
  member_id: string | null;
  guest_id: string | null;
  guest_name: string | null;
  greens_fee: number;
  cart_fee: number;
  caddie_fee: number;
  total_fee: number;
  rate_id: string | null;
  fee_invoiced: boolean;
  invoice_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface BookingPlayerWithNames extends BookingPlayer {
  member_first_name: string | null;
  member_last_name: string | null;
  tier_name: string | null;
}

// Golf Scorecard types
export type TeeSet = "back" | "middle" | "forward";
export type RoundStatus = "in_progress" | "completed" | "verified" | "cancelled";
export type WeatherCondition = "sunny" | "cloudy" | "windy" | "rainy" | "cold";

export interface CourseHole {
  id: string;
  facility_id: string;
  hole_number: number;
  par: number;
  yardage_back: number;
  yardage_middle: number | null;
  yardage_forward: number | null;
  handicap_index: number;
  created_at: string;
}

export interface GolfRound {
  id: string;
  club_id: string;
  facility_id: string;
  member_id: string;
  booking_id: string | null;
  played_at: string;
  tee_set: TeeSet;
  holes_played: 9 | 18;
  total_score: number | null;
  total_putts: number | null;
  total_fairways_hit: number | null;
  total_greens_in_regulation: number | null;
  weather: WeatherCondition | null;
  notes: string | null;
  status: RoundStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GolfScore {
  id: string;
  round_id: string;
  hole_number: number;
  strokes: number | null;
  putts: number | null;
  fairway_hit: boolean | null;
  green_in_regulation: boolean | null;
  penalty_strokes: number;
  created_at: string;
  updated_at: string;
}

export interface GolfRoundWithDetails extends GolfRound {
  facility_name: string;
  member_first_name: string;
  member_last_name: string;
  scores: GolfScore[];
}

export interface GolfRoundSummary extends GolfRound {
  facility_name: string;
  member_first_name: string;
  member_last_name: string;
  score_to_par: number | null;
  course_par: number | null;
}

export interface CourseLayout {
  facility: { id: string; name: string; description: string | null };
  holes: CourseHole[];
  total_par: number;
  total_yardage: { back: number; middle: number; forward: number };
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
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface POSTransaction {
  id: string;
  club_id: string;
  pos_config_id: string;
  member_id: string | null;
  invoice_id: string | null;
  external_id: string | null;
  type: POSTransactionType;
  status: POSTransactionStatus;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  payment_method: string | null;
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

// Guest Management types
export type GuestVisitStatus = "registered" | "checked_in" | "checked_out" | "no_show" | "cancelled";

export interface GuestPolicy {
  id: string;
  club_id: string;
  name: string;
  facility_type: FacilityType | null;
  max_guests_per_visit: number;
  max_guest_visits_per_month: number | null;
  max_same_guest_per_month: number;
  guest_fee: number;
  require_member_present: boolean;
  blackout_days: number[];
  advance_registration_required: boolean;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Guest {
  id: string;
  club_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_blocked: boolean;
  block_reason: string | null;
  total_visits: number;
  last_visit_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuestVisit {
  id: string;
  club_id: string;
  guest_id: string;
  host_member_id: string;
  visit_date: string;
  facility_type: FacilityType | null;
  check_in_time: string | null;
  check_out_time: string | null;
  guest_fee: number;
  fee_invoiced: boolean;
  invoice_id: string | null;
  booking_id: string | null;
  status: GuestVisitStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuestVisitWithDetails extends GuestVisit {
  guest_first_name: string;
  guest_last_name: string;
  host_first_name: string;
  host_last_name: string;
}

export interface GuestFeeSchedule {
  id: string;
  club_id: string;
  facility_type: FacilityType;
  tier_id: string | null;
  guest_fee: number;
  weekend_surcharge: number;
  is_active: boolean;
  created_at: string;
}

export interface GuestManagementSummary {
  policies: GuestPolicy[];
  guests: Guest[];
  recent_visits: GuestVisitWithDetails[];
  fee_schedules: (GuestFeeSchedule & { tier_name: string | null })[];
  stats: {
    total_guests: number;
    visits_this_month: number;
    guest_fees_this_month: number;
    blocked_guests: number;
    upcoming_visits: number;
  };
}

// Push Notification types
export type NotificationChannel = "push" | "email" | "in_app";
export type NotificationStatus = "pending" | "sent" | "delivered" | "failed" | "skipped";
export type NotificationCategory = "bookings" | "events" | "announcements" | "billing" | "dining" | "marketing" | "guests";

export interface NotificationPreference {
  id: string;
  member_id: string;
  category: NotificationCategory;
  push_enabled: boolean;
  email_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationLogEntry {
  id: string;
  club_id: string;
  member_id: string | null;
  category: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  error_message: string | null;
  expo_receipt_id: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface NotificationTemplate {
  id: string;
  club_id: string;
  name: string;
  category: string;
  title_template: string;
  body_template: string;
  is_active: boolean;
  created_at: string;
}

export interface NotificationDashboard {
  log: NotificationLogEntry[];
  templates: NotificationTemplate[];
  stats: {
    sent_this_month: number;
    failed_this_month: number;
    skipped_this_month: number;
    members_with_tokens: number;
  };
}

// ============================================
// Digital Member Cards & NFC
// ============================================

export type DigitalPassPlatform = "apple" | "google";
export type DigitalPassStatus = "active" | "suspended" | "revoked" | "expired";
export type NfcTapType = "check_in" | "pos_payment" | "access_gate" | "event_entry";

export interface DigitalPass {
  id: string;
  club_id: string;
  member_id: string;
  platform: DigitalPassPlatform;
  pass_serial: string;
  pass_type_id: string | null;
  status: DigitalPassStatus;
  device_library_id: string | null;
  push_token: string | null;
  barcode_payload: string;
  last_updated_tag: string | null;
  metadata: Record<string, unknown>;
  installed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DigitalPassWithMember extends DigitalPass {
  member_name: string;
  member_number: string | null;
  tier_name: string | null;
}

export interface NfcTapLog {
  id: string;
  club_id: string;
  member_id: string;
  facility_id: string | null;
  tap_type: NfcTapType;
  location: string | null;
  device_id: string | null;
  latitude: number | null;
  longitude: number | null;
  verified: boolean;
  created_at: string;
}

export interface NfcTapLogWithMember extends NfcTapLog {
  member_name: string;
  member_number: string | null;
}

export interface CardTemplate {
  id: string;
  club_id: string;
  name: string;
  is_active: boolean;
  apple_background_color: string;
  apple_foreground_color: string;
  apple_label_color: string;
  google_hex_background: string;
  google_logo_url: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DigitalCardsSummary {
  total_passes: number;
  active_passes: number;
  apple_passes: number;
  google_passes: number;
  taps_today: number;
  taps_this_month: number;
  recent_taps: NfcTapLogWithMember[];
  passes: DigitalPassWithMember[];
  template: CardTemplate | null;
}

export interface WalletPassPayload {
  pass_url: string;
  platform: DigitalPassPlatform;
  serial: string;
}

// Member Charge Posting types
export interface MemberChargeTransaction {
  id: string;
  created_at: string;
  location: string;
  description: string | null;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  items: { id: string; name: string; quantity: number; unit_price: number; total: number; category: string | null }[];
}

export interface MemberChargeTab {
  member_id: string;
  member_name: string;
  period: string;
  transactions: MemberChargeTransaction[];
  summary: {
    transaction_count: number;
    subtotal_total: number;
    tax_total: number;
    tip_total: number;
    grand_total: number;
    invoice_id: string | null;
  };
}

export interface OpenTab {
  member_id: string;
  first_name: string;
  last_name: string;
  member_number: string | null;
  tx_count: number;
  tab_total: number;
}

// Monthly Statement types
export type StatementRunStatus = "pending" | "running" | "completed" | "failed";

export interface MonthlyStatementRun {
  id: string;
  club_id: string;
  period: string;
  status: StatementRunStatus;
  members_processed: number;
  statements_sent: number;
  total_amount: number;
  error_message: string | null;
  run_by: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface MemberStatement {
  id: string;
  statement_run_id: string;
  club_id: string;
  member_id: string;
  period: string;
  dues_amount: number;
  charges_amount: number;
  assessments_amount: number;
  credits_amount: number;
  previous_balance: number;
  total_due: number;
  invoice_ids: string[];
  email_sent: boolean;
  email_sent_at: string | null;
  pdf_generated: boolean;
  created_at: string;
}

export interface StatementLineItem {
  category: "dues" | "charges" | "assessment" | "credit" | "payment" | "previous_balance";
  description: string;
  amount: number;
  date: string;
  invoice_id?: string;
}

export interface MemberStatementDetail extends MemberStatement {
  member_name: string;
  member_email: string;
  member_number: string | null;
  tier_name: string | null;
  line_items: StatementLineItem[];
}

// Payment Method & Auto-Draft types
export type PaymentMethodType = "us_bank_account" | "card";
export type PaymentMethodStatus = "active" | "requires_confirmation" | "failed" | "detached";
export type MandateStatus = "active" | "inactive" | "pending";

export interface PaymentMethodRecord {
  id: string;
  club_id: string;
  member_id: string;
  stripe_payment_method_id: string;
  type: PaymentMethodType;
  label: string;
  last_four: string | null;
  bank_name: string | null;
  card_brand: string | null;
  is_default: boolean;
  status: PaymentMethodStatus;
  stripe_mandate_id: string | null;
  mandate_status: MandateStatus | null;
  created_at: string;
  updated_at: string;
}

export type AutodraftRunStatus = "pending" | "processing" | "completed" | "failed" | "partial";
export type AutodraftItemStatus = "pending" | "processing" | "succeeded" | "failed" | "skipped" | "requires_action";

export interface AutodraftRun {
  id: string;
  club_id: string;
  period: string;
  status: AutodraftRunStatus;
  members_attempted: number;
  members_succeeded: number;
  members_failed: number;
  members_skipped: number;
  total_collected: number;
  total_failed: number;
  error_message: string | null;
  run_by: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AutodraftItem {
  id: string;
  run_id: string;
  club_id: string;
  member_id: string;
  statement_id: string | null;
  payment_method_id: string | null;
  stripe_payment_intent_id: string | null;
  amount: number;
  status: AutodraftItemStatus;
  failure_reason: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AutodraftSettings {
  id: string;
  club_id: string;
  enabled: boolean;
  draft_day_of_month: number;
  grace_period_days: number;
  retry_failed: boolean;
  max_retries: number;
  notify_members: boolean;
  advance_notice_days: number;
  created_at: string;
  updated_at: string;
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
