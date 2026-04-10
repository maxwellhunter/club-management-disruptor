import { z } from "zod";

// ============================================
// Zod Validation Schemas for ClubOS
// ============================================

// Member schemas
export const createMemberSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  role: z.enum(["admin", "staff", "member"]).default("member"),
  membership_tier_id: z.string().uuid().optional(),
  member_number: z.string().optional(),
  notes: z.string().optional(),
});

export const updateMemberSchema = createMemberSchema.partial();

// Invite: admin creates a member and sends invite
export const inviteMemberSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  role: z.enum(["admin", "staff", "member"]).default("member"),
  membership_tier_id: z.string().uuid().optional().nullable(),
  member_number: z.string().optional(),
  notes: z.string().optional(),
  send_invite: z.boolean().default(true),
});

// Invite claim: member sets password to activate account
export const claimInviteSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Membership tier schemas
export const createTierSchema = z.object({
  name: z.string().min(1, "Tier name is required").max(100),
  level: z.enum(["standard", "premium", "vip", "honorary"]),
  description: z.string().optional(),
  monthly_dues: z.number().min(0, "Dues cannot be negative"),
  annual_dues: z.number().min(0).optional(),
  benefits: z.array(z.string()).default([]),
});

// Booking schemas
// Player entry for booking creation
export const bookingPlayerEntrySchema = z.object({
  player_type: z.enum(["member", "guest"]),
  member_id: z.string().uuid().nullable().optional(),
  guest_name: z.string().max(200).nullable().optional(),
});

export const createBookingSchema = z.object({
  facility_id: z.string().uuid("Invalid facility"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  party_size: z.number().int().min(1).max(20).default(1),
  notes: z.string().optional(),
  players: z.array(bookingPlayerEntrySchema).optional(),
});

export const modifyBookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format").optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format").optional(),
  party_size: z.number().int().min(1).max(4).optional(),
  notes: z.string().optional(),
});

// Event schemas
export const createEventSchema = z.object({
  title: z.string().min(1, "Event title is required").max(200),
  description: z.string().optional(),
  location: z.string().optional(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime().optional(),
  capacity: z.number().int().min(1).optional(),
  price: z.number().min(0).optional(),
});

export const updateEventSchema = createEventSchema.partial().extend({
  status: z
    .enum(["draft", "published", "cancelled", "completed"])
    .optional(),
});

export const rsvpSchema = z.object({
  event_id: z.string().uuid(),
  status: z.enum(["attending", "declined", "maybe"]),
  guest_count: z.number().int().min(0).max(10).default(0),
});

// Invoice schemas
export const createInvoiceSchema = z.object({
  member_id: z.string().uuid(),
  amount: z.number().min(0.01, "Amount must be positive"),
  description: z.string().min(1, "Description is required"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Announcement schemas
export const createAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(1, "Content is required"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  target_tier_ids: z.array(z.string().uuid()).optional(),
});

// Golf rate schemas
export const createGolfRateSchema = z.object({
  facility_id: z.string().uuid("Invalid facility"),
  name: z.string().min(1, "Rate name is required").max(100),
  holes: z.enum(["9", "18"]).default("18"),
  day_type: z.enum(["weekday", "weekend"]).default("weekday"),
  time_type: z.enum(["prime", "afternoon", "twilight"]).default("prime"),
  member_price: z.number().min(0, "Price cannot be negative"),
  guest_price: z.number().min(0, "Price cannot be negative"),
  cart_fee: z.number().min(0, "Fee cannot be negative").default(0),
  is_active: z.boolean().default(true),
});

export const updateGolfRateSchema = createGolfRateSchema.partial().extend({
  id: z.string().uuid(),
});

// Chat schemas
export const chatMessageSchema = z.object({
  message: z.string().min(1).max(4000),
});

// Club schemas
export const createClubSchema = z.object({
  name: z.string().min(1, "Club name is required").max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  timezone: z.string().default("America/New_York"),
});

// Dining reservation schema
export const createDiningReservationSchema = z.object({
  facility_id: z.string().uuid("Invalid facility"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  party_size: z.number().int().min(1).max(20).default(2),
  notes: z.string().optional(),
});

// Menu management schemas (admin)
export const createMenuCategorySchema = z.object({
  facility_id: z.string().uuid(),
  name: z.string().min(1, "Category name is required").max(100),
  description: z.string().optional(),
  sort_order: z.number().int().min(0).default(0),
});

const dietaryTagEnum = z.enum([
  "vegetarian",
  "vegan",
  "gluten-free",
  "nut-free",
  "dairy-free",
  "shellfish-free",
  "spicy",
  "halal",
  "kosher",
]);

export const createMenuItemSchema = z.object({
  category_id: z.string().uuid(),
  name: z.string().min(1, "Item name is required").max(200),
  description: z.string().optional(),
  price: z.number().min(0, "Price must be non-negative"),
  image_url: z.string().url().optional().or(z.literal("")),
  dietary_tags: z.array(dietaryTagEnum).default([]),
  is_available: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
});

export const updateMenuItemSchema = createMenuItemSchema.partial();

export const updateMenuCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100).optional(),
  description: z.string().optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

// Ordering schemas
export const createDiningOrderSchema = z.object({
  facility_id: z.string().uuid(),
  member_id: z.string().uuid().optional(), // Admin-only: place order on behalf of member
  booking_id: z.string().uuid().optional(),
  table_number: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        menu_item_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(50).default(1),
        special_instructions: z.string().optional(),
      })
    )
    .min(1, "Order must have at least one item"),
});

export const updateDiningOrderStatusSchema = z.object({
  status: z.enum([
    "confirmed",
    "preparing",
    "ready",
    "delivered",
    "cancelled",
  ]),
  estimated_prep_minutes: z.number().int().min(1).max(120).optional(),
});

// Schedule configuration schema (admin — generate booking slots)
export const scheduleConfigSchema = z.object({
  facility_id: z.string().uuid(),
  days_of_week: z.array(z.number().int().min(0).max(6)).min(1, "Select at least one day"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
  interval_minutes: z.number().int().min(5).max(120).default(10),
  max_bookings: z.number().int().min(1).max(100).default(1),
});

// Family schemas
export const createFamilySchema = z.object({
  name: z.string().min(1, "Family name is required").max(100),
  primary_member_id: z.string().uuid("Invalid primary member").optional(),
});

export const updateFamilySchema = z.object({
  name: z.string().min(1, "Family name is required").max(100).optional(),
  primary_member_id: z.string().uuid("Invalid primary member").optional().nullable(),
});

export const assignFamilySchema = z.object({
  family_id: z.string().uuid("Invalid family").nullable(),
});

// Golf scorecard schemas
export const createGolfRoundSchema = z.object({
  facility_id: z.string().uuid("Invalid facility"),
  booking_id: z.string().uuid().optional(),
  played_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").default(new Date().toISOString().slice(0, 10)),
  tee_set: z.enum(["back", "middle", "forward"]).default("middle"),
  holes_played: z.union([z.literal(9), z.literal(18)]).default(18),
  weather: z.enum(["sunny", "cloudy", "windy", "rainy", "cold"]).optional(),
  notes: z.string().max(500).optional(),
});

export const updateGolfScoreSchema = z.object({
  hole_number: z.number().int().min(1).max(18),
  strokes: z.number().int().min(1).max(20).optional().nullable(),
  putts: z.number().int().min(0).max(10).optional().nullable(),
  fairway_hit: z.boolean().optional().nullable(),
  green_in_regulation: z.boolean().optional().nullable(),
  penalty_strokes: z.number().int().min(0).max(10).default(0),
});

export const submitScoresSchema = z.object({
  scores: z.array(updateGolfScoreSchema).min(1),
});

export const createCourseHoleSchema = z.object({
  facility_id: z.string().uuid("Invalid facility"),
  hole_number: z.number().int().min(1).max(18),
  par: z.number().int().min(3).max(6),
  yardage_back: z.number().int().min(50).max(700),
  yardage_middle: z.number().int().min(50).max(700).optional(),
  yardage_forward: z.number().int().min(50).max(700).optional(),
  handicap_index: z.number().int().min(1).max(18),
});

// Golf player rate schemas
export const golfDayTypes = ["weekday", "weekend"] as const;
export const golfTimeTypes = ["prime", "afternoon", "twilight"] as const;
export const golfHolesOptions = ["9", "18"] as const;

export const createGolfPlayerRateSchema = z.object({
  facility_id: z.string().uuid("Invalid facility"),
  name: z.string().min(1).max(200),
  tier_id: z.string().uuid().nullable().optional(),
  is_guest: z.boolean().default(false),
  day_type: z.enum(golfDayTypes),
  time_type: z.enum(golfTimeTypes),
  holes: z.enum(golfHolesOptions),
  greens_fee: z.number().min(0),
  cart_fee: z.number().min(0).default(0),
  caddie_fee: z.number().min(0).default(0),
});

export const updateGolfPlayerRateSchema = createGolfPlayerRateSchema.partial().extend({
  id: z.string().uuid(),
  is_active: z.boolean().optional(),
});

// Booking player schemas
export const addBookingPlayerSchema = z.object({
  booking_id: z.string().uuid(),
  player_type: z.enum(["member", "guest"]),
  member_id: z.string().uuid().nullable().optional(),
  guest_id: z.string().uuid().nullable().optional(),
  guest_name: z.string().max(200).nullable().optional(),
});

// POS schemas
export const posProviders = ["stripe_terminal", "square", "toast", "lightspeed", "manual"] as const;
export const posLocations = ["dining", "pro_shop", "bar", "snack_bar", "other"] as const;

export const createPOSConfigSchema = z.object({
  provider: z.enum(posProviders),
  location: z.enum(posLocations),
  name: z.string().min(1, "Name is required").max(100),
  config: z.record(z.unknown()).default({}),
});

export const updatePOSConfigSchema = createPOSConfigSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const createPOSTransactionSchema = z.object({
  pos_config_id: z.string().uuid(),
  member_id: z.string().uuid().optional().nullable(),
  type: z.enum(["sale", "refund", "void"]).default("sale"),
  subtotal: z.number().min(0),
  tax: z.number().min(0).default(0),
  tip: z.number().min(0).default(0),
  payment_method: z.string().optional().nullable(),
  location: z.enum(posLocations),
  description: z.string().optional().nullable(),
  items: z.array(
    z.object({
      name: z.string().min(1),
      sku: z.string().optional().nullable(),
      quantity: z.number().int().min(1),
      unit_price: z.number().min(0),
      category: z.string().optional().nullable(),
    })
  ).min(1, "At least one item is required"),
  metadata: z.record(z.unknown()).optional().nullable(),
});

// Accounting / GL Export schemas
export const glAccountTypes = ["revenue", "expense", "asset", "liability", "equity"] as const;
export const exportFormats = ["iif", "qbo", "csv"] as const;
export const accountingProviders = ["quickbooks", "sage", "xero", "csv"] as const;

export const createGLAccountSchema = z.object({
  account_number: z.string().min(1, "Account number is required").max(20),
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(glAccountTypes),
  description: z.string().optional().nullable(),
});

export const createGLMappingSchema = z.object({
  source_category: z.string().min(1),
  gl_account_id: z.string().uuid(),
  description: z.string().optional().nullable(),
});

export const createExportSchema = z.object({
  format: z.enum(exportFormats),
  provider: z.enum(accountingProviders),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date (YYYY-MM-DD)"),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date (YYYY-MM-DD)"),
});

// Advanced Billing schemas
export const spendingCategories = ["dining", "pro_shop", "bar", "total"] as const;
export const spendingPeriods = ["monthly", "quarterly", "annually"] as const;
export const assessmentTypes = ["capital_improvement", "seasonal", "special", "initiation"] as const;

export const createSpendingMinimumSchema = z.object({
  tier_id: z.string().uuid("Invalid tier"),
  name: z.string().min(1, "Name is required").max(100),
  category: z.enum(spendingCategories),
  amount: z.number().min(0.01, "Amount must be positive"),
  period: z.enum(spendingPeriods).default("monthly"),
  enforce_shortfall: z.boolean().default(true),
  shortfall_description: z.string().optional(),
});

export const updateSpendingMinimumSchema = createSpendingMinimumSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const createAssessmentSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().optional(),
  type: z.enum(assessmentTypes),
  amount: z.number().min(0.01, "Amount must be positive"),
  target_all_members: z.boolean().default(false),
  target_tier_ids: z.array(z.string().uuid()).optional().nullable(),
  target_member_ids: z.array(z.string().uuid()).optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  allow_installments: z.boolean().default(false),
  installment_count: z.number().int().min(1).max(60).default(1),
});

export const runBillingCycleSchema = z.object({
  type: z.enum(["dues", "minimum_shortfall", "assessment"]),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  assessment_id: z.string().uuid().optional(), // Required when type = assessment
});

export const createBillingCreditSchema = z.object({
  member_id: z.string().uuid(),
  amount: z.number().refine((v) => v !== 0, "Amount cannot be zero"),
  reason: z.string().min(1, "Reason is required"),
});

export const updateFamilyBillingSchema = z.object({
  family_id: z.string().uuid(),
  billing_consolidated: z.boolean(),
  billing_email: z.string().email().optional().nullable(),
});

// Guest Management schemas
export const guestVisitStatuses = ["registered", "checked_in", "checked_out", "no_show", "cancelled"] as const;
export const facilityTypes = ["golf", "tennis", "dining", "pool", "fitness", "other"] as const;

export const createGuestSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const registerGuestVisitSchema = z.object({
  guest_id: z.string().uuid().optional(), // Omit to create new guest inline
  guest: createGuestSchema.optional(),     // Inline guest creation
  visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  facility_type: z.enum(facilityTypes).optional().nullable(),
  booking_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateGuestVisitStatusSchema = z.object({
  status: z.enum(guestVisitStatuses),
});

export const createGuestPolicySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  facility_type: z.enum(facilityTypes).optional().nullable(),
  max_guests_per_visit: z.number().int().min(1).max(20).default(4),
  max_guest_visits_per_month: z.number().int().min(1).optional().nullable(),
  max_same_guest_per_month: z.number().int().min(1).default(4),
  guest_fee: z.number().min(0).default(0),
  require_member_present: z.boolean().default(true),
  blackout_days: z.array(z.number().int().min(0).max(6)).default([]),
  advance_registration_required: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export const createGuestFeeScheduleSchema = z.object({
  facility_type: z.enum(facilityTypes),
  tier_id: z.string().uuid().optional().nullable(),
  guest_fee: z.number().min(0),
  weekend_surcharge: z.number().min(0).default(0),
});

// Data Migration schemas
export const importSourceSystems = ["jonas", "northstar", "clubessential", "generic_csv"] as const;
export const importEntityTypes = ["members", "invoices", "payments", "bookings", "events"] as const;

export const createImportSchema = z.object({
  source_system: z.enum(importSourceSystems),
  entity_type: z.enum(importEntityTypes),
});

export const importFieldMappingSchema = z.object({
  batch_id: z.string().uuid(),
  mapping: z.record(z.string()), // source_column -> target_field
});

// Export inferred types from schemas
export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type CreateTierInput = z.infer<typeof createTierSchema>;
export type BookingPlayerEntry = z.infer<typeof bookingPlayerEntrySchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type ModifyBookingInput = z.infer<typeof modifyBookingSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type RsvpInput = z.infer<typeof rsvpSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type CreateClubInput = z.infer<typeof createClubSchema>;
export type CreateDiningReservationInput = z.infer<
  typeof createDiningReservationSchema
>;
export type CreateMenuCategoryInput = z.infer<typeof createMenuCategorySchema>;
export type UpdateMenuCategoryInput = z.infer<typeof updateMenuCategorySchema>;
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
export type CreateDiningOrderInput = z.infer<typeof createDiningOrderSchema>;
export type UpdateDiningOrderStatusInput = z.infer<
  typeof updateDiningOrderStatusSchema
>;
export type ScheduleConfigInput = z.infer<typeof scheduleConfigSchema>;
export type CreateGolfRateInput = z.infer<typeof createGolfRateSchema>;
export type UpdateGolfRateInput = z.infer<typeof updateGolfRateSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type ClaimInviteInput = z.infer<typeof claimInviteSchema>;
export type CreateFamilyInput = z.infer<typeof createFamilySchema>;
export type UpdateFamilyInput = z.infer<typeof updateFamilySchema>;
export type AssignFamilyInput = z.infer<typeof assignFamilySchema>;
export type CreateGolfRoundInput = z.infer<typeof createGolfRoundSchema>;
export type UpdateGolfScoreInput = z.infer<typeof updateGolfScoreSchema>;
export type SubmitScoresInput = z.infer<typeof submitScoresSchema>;
export type CreateCourseHoleInput = z.infer<typeof createCourseHoleSchema>;
export type CreatePOSConfigInput = z.infer<typeof createPOSConfigSchema>;
export type UpdatePOSConfigInput = z.infer<typeof updatePOSConfigSchema>;
export type CreatePOSTransactionInput = z.infer<typeof createPOSTransactionSchema>;
export type CreateGLAccountInput = z.infer<typeof createGLAccountSchema>;
export type CreateGLMappingInput = z.infer<typeof createGLMappingSchema>;
export type CreateExportInput = z.infer<typeof createExportSchema>;
export type CreateImportInput = z.infer<typeof createImportSchema>;
export type ImportFieldMappingInput = z.infer<typeof importFieldMappingSchema>;
export type CreateSpendingMinimumInput = z.infer<typeof createSpendingMinimumSchema>;
export type UpdateSpendingMinimumInput = z.infer<typeof updateSpendingMinimumSchema>;
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type RunBillingCycleInput = z.infer<typeof runBillingCycleSchema>;
export type CreateBillingCreditInput = z.infer<typeof createBillingCreditSchema>;
export type UpdateFamilyBillingInput = z.infer<typeof updateFamilyBillingSchema>;
export type CreateGuestInput = z.infer<typeof createGuestSchema>;
export type RegisterGuestVisitInput = z.infer<typeof registerGuestVisitSchema>;
export type UpdateGuestVisitStatusInput = z.infer<typeof updateGuestVisitStatusSchema>;
export type CreateGuestPolicyInput = z.infer<typeof createGuestPolicySchema>;
export type CreateGuestFeeScheduleInput = z.infer<typeof createGuestFeeScheduleSchema>;

// ============================================
// Digital Member Cards & NFC Schemas
// ============================================

export const generatePassSchema = z.object({
  platform: z.enum(["apple", "google"]),
});

export const recordNfcTapSchema = z.object({
  member_id: z.string().uuid().optional(), // resolved from barcode if not provided
  barcode_payload: z.string().optional(),
  tap_type: z.enum(["check_in", "pos_payment", "access_gate", "event_entry"]).default("check_in"),
  facility_id: z.string().uuid().optional(),
  location: z.string().max(200).optional(),
  device_id: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const updateCardTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  apple_background_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  apple_foreground_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  apple_label_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  google_hex_background: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  google_logo_url: z.string().url().optional(),
  logo_url: z.string().url().optional(),
  hero_image_url: z.string().url().optional(),
  description: z.string().max(500).optional(),
});

export const revokePassSchema = z.object({
  pass_id: z.string().uuid(),
});

export type GeneratePassInput = z.infer<typeof generatePassSchema>;
export type RecordNfcTapInput = z.infer<typeof recordNfcTapSchema>;
export type UpdateCardTemplateInput = z.infer<typeof updateCardTemplateSchema>;
export type RevokePassInput = z.infer<typeof revokePassSchema>;
