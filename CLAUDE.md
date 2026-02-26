# ClubOS — Project Reference

## What is this?
AI-powered country club management SaaS ("ClubOS") — built to disrupt legacy club software (Jonas Club, Northstar, ClubEssential). Handles member management, billing, bookings, communications, and has a Claude-powered AI chat assistant as a key differentiator.

## Tech Stack
- **Monorepo**: Turborepo + pnpm workspaces
- **Web**: Next.js 15 (App Router) in `apps/web`
- **Mobile**: React Native + Expo (Expo Router) in `apps/mobile`
- **Backend/DB**: Supabase (Postgres, Auth, Realtime, Storage, Edge Functions)
- **Payments**: Stripe (Connect for multi-tenant, Subscriptions for recurring dues)
- **AI Chat**: Claude API via `@anthropic-ai/sdk`
- **Styling**: Tailwind CSS v4 + CSS custom properties (green primary theme)
- **Validation**: Zod (shared between web and API)
- **Email** (planned): Resend
- **Deployment** (planned): Vercel (web) + EAS (mobile)

## Project Structure
```
apps/
  web/                      # Next.js 15 app
    src/
      app/                  # App Router pages
        (auth routes)       # /login, /signup, /auth/callback
        dashboard/          # Authenticated pages (members, billing, bookings, events, messages, chat)
        api/chat/           # Claude AI chat endpoint
      components/           # React components (sidebar.tsx)
      lib/supabase/         # Supabase client helpers (server.ts, client.ts, middleware.ts)
      middleware.ts          # Auth middleware — redirects unauthenticated users
  mobile/                     # Expo React Native app
    app/                    # Expo Router screens (file-based routing)
      (auth)/               # Login, signup screens (Stack navigator)
      (tabs)/               # Authenticated tab screens (Home, Bookings, Events, Chat, Profile)
    lib/                    # Supabase client + AuthContext provider
    constants/              # Theme colors (matches web CSS custom properties)
packages/
  shared/                   # @club/shared — shared types + Zod schemas
    src/types/index.ts      # All entity types (Member, Booking, Event, Invoice, etc.)
    src/schemas/index.ts    # Zod validation schemas for all entities
    src/index.ts            # Re-exports everything
  supabase/                 # @club/supabase — DB config + migrations
    migrations/             # SQL migrations (00001_initial_schema.sql)
    seed.sql                # Dev seed data (demo club, tiers, facilities)
    config.toml             # Supabase local config
```

## Key Architecture Decisions
- **Multi-tenant**: Each club is an org. All tables have `club_id` FK. Row-Level Security scopes all queries to the user's club.
- **Auth flow**: Supabase Auth → middleware checks session → redirects to `/login` if unauthenticated. Public routes: `/`, `/login`, `/signup`, `/auth/callback`.
- **Shared package**: Types and Zod schemas in `@club/shared` are imported by both web and mobile apps. Import as `import { Member, createMemberSchema } from "@club/shared"`.
- **AI Chat**: POST `/api/chat` → authenticates user via Supabase → sends messages to Claude API. Gracefully handles missing `ANTHROPIC_API_KEY`. Mobile calls the same endpoint.
- **Mobile auth**: Expo SecureStore for token persistence. `AuthProvider` context wraps the app, Expo Router file-based routing mirrors web structure. Auth state redirects between `(auth)` and `(tabs)` groups.
- **Mobile navigation**: Tab bar with 5 tabs (Home, Bookings, Events, AI Chat, Profile). Auth screens use Stack navigator.

## Database Schema (14 tables)
`clubs` → `membership_tiers`, `families`, `members`, `facilities`, `booking_slots`, `bookings`, `events`, `event_rsvps`, `invoices`, `payments`, `announcements`, `chat_conversations`, `chat_messages`

All tables have RLS enabled. Helper functions: `get_member_club_id()`, `is_club_admin()`. Auto-updated `updated_at` triggers on mutable tables.

## Commands
```bash
# Prerequisites: Node 21 via nvm
source ~/.nvm/nvm.sh && nvm use 21

# Install dependencies
pnpm install

# Development (web)
pnpm dev              # Starts Next.js dev server (port 3000)

# Development (mobile)
cd apps/mobile && npx expo start

# Build
pnpm build            # Turbo builds all packages

# Type checking
pnpm typecheck
```

## Environment Variables
**Web** — Copy `.env.example` to `apps/web/.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` — for admin operations
- `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET`
- `ANTHROPIC_API_KEY` — for AI chat
- `RESEND_API_KEY` — for email

**Mobile** — Create `apps/mobile/.env` with:
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` — same Supabase project
- `EXPO_PUBLIC_APP_URL` — URL of the web app (for AI chat API calls)

## MVP Feature Modules (Status)
1. **Member Management** — scaffolded (empty state UI, no CRUD yet)
2. **Billing & Payments** — scaffolded (stat cards, no Stripe wiring yet)
3. **Bookings** — scaffolded (facility tabs, no booking logic yet)
4. **Events** — scaffolded (empty state, no CRUD yet)
5. **Communications** — scaffolded (empty state, no sending yet)
6. **AI Chat** — API route wired to Claude, chat UI with suggestions

## Conventions
- Package names use `@club/` scope (e.g., `@club/web`, `@club/mobile`, `@club/shared`)
- **Web**: CSS uses custom properties (`--primary`, `--background`, etc.) defined in `globals.css` with dark mode support via `prefers-color-scheme`
- **Mobile**: Theme colors in `constants/theme.ts` mirror the web CSS custom properties (Colors.light / Colors.dark)
- Supabase server client (web): `import { createClient } from "@/lib/supabase/server"` (async, uses cookies)
- Supabase browser client (web): `import { createClient } from "@/lib/supabase/client"`
- Supabase mobile client: `import { supabase } from "@/lib/supabase"` (uses Expo SecureStore for tokens)
- Web dashboard pages are server components by default; add `"use client"` only when needed
- Mobile uses Expo Router file-based routing with `(auth)` and `(tabs)` route groups
- Green theme: primary color is `#16a34a` (light) / `#22c55e` (dark) — consistent across web and mobile

## GitHub
Repo: https://github.com/maxwellhunter/club-management-disruptor
