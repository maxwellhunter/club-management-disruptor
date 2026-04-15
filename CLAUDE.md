# ClubOS — Project Reference

## What is this?
AI-powered country club management SaaS ("ClubOS") — built to disrupt legacy club software (Jonas Club, Northstar, ClubEssential). Handles member management, billing, bookings, communications, and has a Claude-powered AI chat assistant as a key differentiator.

## Tech Stack
- **Monorepo**: Turborepo + pnpm workspaces
- **Web**: Next.js 15 (App Router) in `apps/web`
- **iOS**: Native Swift/SwiftUI app in `apps/ios` (distributed via TestFlight)
- **Backend/DB**: Supabase (Postgres, Auth, Realtime, Storage, Edge Functions)
- **Payments**: Stripe (Connect for multi-tenant, Subscriptions for recurring dues)
- **AI Chat**: Claude API via `@anthropic-ai/sdk`
- **Styling**: Tailwind CSS v4 + CSS custom properties (green primary theme)
- **Validation**: Zod (shared between web and API)
- **Email**: Resend (invite, invoice, announcement, booking confirmation templates)
- **Testing**: Jest 30 + ts-jest
- **Deployment**: Vercel (web) + TestFlight/App Store (iOS)

## Project Structure
```
apps/
  web/                      # Next.js 15 app
    src/
      app/                  # App Router pages
        (auth routes)       # /login, /signup, /auth/callback
        invite/[token]/     # Public invite claim page (password set + account activation)
        dashboard/          # Authenticated pages
          members/          # Member list, detail, add/edit modals
          billing/          # Billing dashboard, invoices, spending tracking
          bookings/         # Tee time wizard, my bookings, admin schedule/rates
          events/           # Event list, detail, RSVP, admin CRUD
          messages/         # Announcements (admin create/publish, member view)
          chat/             # AI chat with Claude
          digital-cards/    # NFC wallet passes, tap history, card design
          reports/          # Reporting dashboard
          ai-insights/      # AI-powered analytics
          guests/           # Guest management
          data-migration/   # Jonas/Northstar/CSV import tools
        api/                # REST API routes
          members/          # GET/POST, [id] GET/PATCH/DELETE, status, resend-invite
          bookings/         # CRUD, tee-times, cancel, modify, admin/schedule, admin/golf-rates
          events/           # GET, [id] GET, rsvp POST, admin CRUD + attendees
          announcements/    # GET/POST, [id] GET/PATCH/DELETE
          guests/           # Visits POST/PATCH with policy enforcement
          wallet/           # passes GET/POST/DELETE, nfc POST, templates GET/POST
          invite/[token]/   # GET (load invite) / POST (claim invite)
          chat/             # Claude AI chat endpoint
      components/           # React components (sidebar, event-card, etc.)
      lib/
        supabase/           # Supabase client helpers (server.ts, client.ts, middleware.ts)
        billing/            # Billing engine, spending tracker
        wallet/             # Pass generator (Apple/Google Wallet, NFC, barcodes)
        golf-eligibility.ts # Member tier lookup + golf access check
        email.ts            # Resend email service (invite, invoice, announcement, booking)
      middleware.ts          # Auth middleware — redirects unauthenticated users
  ios/                        # Native Swift/SwiftUI app
    ClubOS/                 # Xcode project
      Views/                # SwiftUI views (Events, Dining, Bookings, Chat, Profile)
      Models/               # Data models
      Services/             # API client, auth service
packages/
  shared/                   # @club/shared — shared types + Zod schemas
    src/types/index.ts      # All entity types (Member, Booking, Event, Invoice, DigitalPass, etc.)
    src/schemas/index.ts    # Zod validation schemas for all entities
    src/index.ts            # Re-exports everything
  supabase/                 # @club/supabase — DB config + migrations
    migrations/             # 15 SQL migrations (00001–00015)
    seed.sql                # Dev seed data (demo club, tiers, facilities, menus)
    config.toml             # Supabase local config
```

## Key Architecture Decisions
- **Multi-tenant**: Each club is an org. All tables have `club_id` FK. Row-Level Security scopes all queries to the user's club.
- **Auth flow**: Supabase Auth → middleware checks session → redirects to `/login` if unauthenticated. Public routes: `/`, `/login`, `/signup`, `/auth/callback`.
- **Shared package**: Types and Zod schemas in `@club/shared` are imported by the web app. Import as `import { Member, createMemberSchema } from "@club/shared"`.
- **AI Chat**: POST `/api/chat` → authenticates user via Supabase → sends messages to Claude API. Gracefully handles missing `ANTHROPIC_API_KEY`. iOS app calls the same endpoint.
- **iOS app**: Native Swift/SwiftUI app with Supabase Auth (Keychain token persistence). Tab bar navigation (Home, Bookings, Events, AI Chat, Profile). Distributed via TestFlight.
- **API auth pattern**: `createApiClient()` helper handles both cookie auth (web) and Bearer token auth (iOS). Returns `{ supabase, adminClient, caller }` where `caller` has `member: MemberWithTier` with `tier_name` and `tier_level` (but NOT `member_number` — query separately if needed).
- **Family billing**: ALL family members (including primary) go to a single consolidated invoice. Primary is NOT billed separately.
- **Invite flow**: Admin creates member with `status: 'invited'` → generates 7-day token → member visits `/invite/[token]` → sets password → Supabase Auth user created → member activated.

## Database Schema (44 tables, all RLS-enabled)

**Core**: `clubs`, `membership_tiers`, `families`, `members`, `facilities`, `booking_slots`, `bookings`, `booking_waitlist`, `events`, `event_rsvps`, `invoices`, `payments`, `announcements`, `chat_conversations`, `chat_messages`

**Dining/POS**: `menu_categories`, `menu_items`, `dining_orders`, `dining_order_items`, `pos_configs`, `pos_transactions`, `pos_transaction_items`

**Advanced Billing**: `spending_minimums`, `spending_tracking`, `assessments`, `assessment_members`, `billing_cycles`, `billing_credits`

**Guest Management**: `guest_policies`, `guests`, `guest_visits`, `guest_fee_schedules`

**Notifications**: `notification_preferences`, `notification_log`, `notification_templates`

**Digital Cards**: `digital_passes`, `nfc_tap_log`, `card_templates`

**Accounting**: `gl_accounts`, `gl_mappings`, `export_batches`, `journal_entries`

**Data Migration**: `import_batches`

**Golf**: `golf_rates`

Helper functions: `get_member_club_id()`, `is_club_admin()`. Auto-updated `updated_at` triggers on mutable tables.

**Supabase project**: `iicwnlruopqhrzkgjsmu` (us-east-1)

## Commands
```bash
# Prerequisites: Node 21 via nvm
source ~/.nvm/nvm.sh && nvm use 21

# Install dependencies
pnpm install

# Development (web)
pnpm dev              # Starts Next.js dev server (port 3000)

# Build
pnpm build            # Turbo builds all packages

# Type checking
pnpm typecheck

# Tests
pnpm test             # Run all tests (Jest 30)
pnpm test -- --watch  # Watch mode
```

## Environment Variables
**Web** — Copy `.env.example` to `apps/web/.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` — for admin operations
- `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET`
- `ANTHROPIC_API_KEY` — for AI chat
- `RESEND_API_KEY` — for email

## Feature Modules (Status)

### Core MVP (fully wired)
1. **Member Management** — Full CRUD: list/search/filter, detail page, add/edit modals, invite system (token-based, 7-day expiry), resend invite, deactivate/reactivate, role-based access, email notifications
2. **Bookings** — Multi-step tee time wizard, slot selection with availability, my bookings (edit/cancel), waitlist with auto-promotion on cancellation, admin schedule config (generate slots), admin golf rates CRUD, email confirmations
3. **Events** — Event list (role-based), detail with capacity bar, RSVP flow (attending/declined/maybe) with capacity enforcement, admin CRUD with draft→publish workflow, attendee management
4. **Communications** — Announcement list (admin: all/published/drafts tabs; member: published only), create/edit/delete, priority levels (low/normal/high/urgent), tier-targeted audience, email blast on publish
5. **AI Chat** — Claude API endpoint, chat UI with suggested prompts, iOS support via shared endpoint
6. **Billing & Payments** — Billing engine with dues calculation, family consolidated billing, spending minimum tracking + shortfall invoicing, assessments (capital/seasonal with installments), billing cycle tracking. **Not yet wired to Stripe** — engine is tested but payments are manual/seeded.

### Competitive Analysis Features (built)
7. **Golf Tee Times & Rates** — Dynamic pricing by facility/holes/day/time, member vs guest rates, admin CRUD
8. **Dining & Menu Orders** — Full menu system (categories + items), POS transaction tracking across 4 locations
9. **Guest Management** — Guest registration, configurable policies (per facility, blackout days, visit limits), fee schedules with weekend surcharges, visit tracking with auto-invoicing
10. **Data Migration** — Import tools for Jonas/Northstar/ClubEssential/CSV with field mapping, validation, and progress tracking
11. **Advanced Billing** — Spending minimums per tier, shortfall enforcement, capital assessments with installment plans, family billing consolidation, member credits/adjustments
12. **Accounting & GL Export** — Chart of accounts, GL mappings, journal entries, export batches (QuickBooks/Sage/Xero/CSV)
13. **Push Notifications** — Server infrastructure with per-member category preferences, notification templates with {{variable}} placeholders, delivery tracking
14. **AI Insights Dashboard** — AI-powered analytics dashboard
15. **Digital Member Cards (NFC)** — Apple/Google Wallet pass generation, NFC tap-to-check-in with 30s dedup, barcode-to-member resolution, card design templates, mobile wallet buttons (platform-aware)

### Testing
- **82 unit tests** covering billing engine (dues cycles, family consolidation, shortfall), spending tracker, guest policy enforcement, and pass generator (barcode determinism, Apple/Google pass structure)
- Test files in `__tests__/` directories alongside source files

## Conventions
- Package names use `@club/` scope (e.g., `@club/web`, `@club/shared`)
- **Web**: CSS uses custom properties (`--primary`, `--background`, etc.) defined in `globals.css` with dark mode support via `prefers-color-scheme`
- Supabase server client (web): `import { createClient } from "@/lib/supabase/server"` (async, uses cookies)
- Supabase browser client (web): `import { createClient } from "@/lib/supabase/client"`
- Web dashboard pages are server components by default; add `"use client"` only when needed
- **iOS**: Native SwiftUI views, Supabase Swift SDK for auth and data. When building new web features, always port them to the iOS app in the same session.
- Green theme: primary color is `#16a34a` (light) / `#22c55e` (dark) — consistent across web and iOS

## SwiftUI Pitfalls (iOS 26 — learned the hard way)

### 1. `NavigationStack` + `Picker` sibling = invisible hit-test dead zone
Wrapping a child view in a second `NavigationStack` while its sibling Picker lives in a `VStack` makes UIKit install an invisible `UINavigationBar` gesture region over the top of the child's scroll content. Symptom: the top button(s) and the first row of cards become unclickable.

**Fix**: `NavigationStack` must be the OUTERMOST view. The Picker lives INSIDE its root, above the child. The child accepts the path as `@Binding`. See `apps/ios/ClubOS/Views/Spaces/BookView.swift` for the canonical pattern.

### 2. `image.resizable().aspectRatio(.fill).frame(height: N).clipped()` projects an invisible hit-eating zone above the card
`.clipped()` and `.clipShape(...)` clip VISUALS, not the hit-test region. With `.aspectRatio(.fill)` the underlying image view overflows the frame; the overflow grabs taps on whatever sits above (and sometimes below) the visual card.

**Symptom**: cards laid out in a `VStack(spacing:)` with image headers cause the Buttons sitting in the gap immediately above each card to become unclickable. The card's own buttons (Edit, Cancel, etc.) may also stop firing because the overflow re-enters.

**Fix**: add `.contentShape(Rectangle())` immediately after the `.clipShape(...)` (or after the image's `.clipped()`) on any image-backed card header. This forces the hit shape to match the visual bounds. See `bookingCard` in `apps/ios/ClubOS/Views/Golf/GolfBookingView.swift` for the canonical fix.

**General rule**: any time you render a `CachedAsyncImage` / `AsyncImage` with `.fill` content mode followed by a frame + clip, append `.contentShape(Rectangle())` (or the matching shape).

### 3. `Button { } label: { HStack(...).frame(maxWidth: .infinity).background(_, in: Shape) }.buttonStyle(.plain)` — pair the shape background with `.contentShape(Shape)`
Full-width plain Buttons whose label uses the shape-variant of `.background(_, in: Shape)` can have a hit region that doesn't match the visible pill on iOS 26. Always pair the visual shape with `.contentShape(<sameShape>)` inside the label.

## Demo Accounts (Supabase Auth)
| Role | Email | Name | Tier |
|------|-------|------|------|
| Admin | `admin@greenfieldcc.com` | Max Hunter | — |
| Staff | `staff@greenfieldcc.com` | Sarah Chen | Standard |
| Member | `member@greenfieldcc.com` | James Wilson | Standard |
| Member | `golf@greenfieldcc.com` | Emily Brooks | Golf |

16 additional seeded members (no auth users — use invite flow or create manually).

## Seed Data (live DB)
- 1 club (Greenfield CC), 4 tiers, 7 facilities, 20 members, 3 families
- 1,008 booking slots (golf tee times + dining), 22 bookings
- 4 events, 16 RSVPs
- 20 invoices (paid/sent/overdue), 8 payments
- 5 guests (1 blocked), 7 guest visits, 3 guest policies, 4 fee schedules
- 4 POS configs, 10 POS transactions (dining, bar, pro shop, snack bar + 1 refund)
- 4 spending minimums, 2 assessments, 3 billing cycles
- 5 announcements, 5 notification templates, 1 card template
- 10 GL accounts, 4 GL mappings
- 8 menu categories, 57 menu items (Main Dining + Grill Room)

## Workflow: "Commit and Push"
When the user says **"commit and push"** (or similar), always perform ALL of the following steps in order:
1. **Run tests** — `pnpm test` must pass before committing
2. **Commit** — stage relevant files and commit with a descriptive message
3. **Push** — `git push origin main` (or current branch)
4. **Deploy to Vercel** — run `vercel --prod` from the repo root to trigger a production deployment (don't wait for build to finish, just confirm it was triggered)
5. **Migrations reminder** — if any new or modified files exist in `packages/supabase/migrations/`, list them and remind the user to run the SQL manually in the Supabase dashboard SQL Editor (`https://supabase.com/dashboard/project/iicwnlruopqhrzkgjsmu/sql/new`).

**Important**: Always confirm each step's result before moving to the next. If any step fails, stop and report the error rather than continuing.

## Workflow: "Create a TestFlight build"
When the user asks for a **TestFlight build**, **always** use the existing script:
```bash
./scripts/upload-testflight.sh
```
It handles archive → export → upload end-to-end and uses `destination: upload` in `apps/ios/ExportOptions.plist`, so the final `xcodebuild -exportArchive` ships the `.ipa` straight to App Store Connect via the user's signed-in Xcode credentials — **no App Store Connect API key needed**.

**Do NOT**:
- Manually run `xcodebuild archive` / `xcodebuild -exportArchive` piecemeal — the script already does it.
- Bump `CURRENT_PROJECT_VERSION` in `project.yml` — `ExportOptions.plist` has `manageAppVersionAndBuildNumber: true`, so Apple auto-assigns the build number.
- Ask the user for an ASC API key — the script doesn't need one.

After the script prints `✅ Build uploaded to App Store Connect`, tell the user it'll appear in TestFlight in ~15 minutes at https://appstoreconnect.apple.com/apps.

## GitHub
Repo: https://github.com/maxwellhunter/club-management-disruptor
