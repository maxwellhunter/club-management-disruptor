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
export const createBookingSchema = z.object({
  facility_id: z.string().uuid("Invalid facility"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  party_size: z.number().int().min(1).max(20).default(1),
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

// Export inferred types from schemas
export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type CreateTierInput = z.infer<typeof createTierSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type RsvpInput = z.infer<typeof rsvpSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type CreateClubInput = z.infer<typeof createClubSchema>;
