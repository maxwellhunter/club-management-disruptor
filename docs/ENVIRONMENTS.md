# ClubOS — Environment Setup

## Overview

| Environment | Branch | Supabase | Vercel | URL |
|-------------|--------|----------|--------|-----|
| **Local** | any | `supabase start` (local) | `localhost:3000` | http://localhost:3000 |
| **Staging** | `staging` | Dedicated staging project | Preview deployment | https://clubos-staging.vercel.app |
| **Production** | `main` | `iicwnlruopqhrzkgjsmu` | Production deployment | https://clubos.vercel.app |

## Quick Start: Create Staging

### 1. Create a Supabase staging project

Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New Project**:
- **Name**: `clubos-staging`
- **Region**: `us-east-1` (same as prod)
- **Password**: generate a strong one

Copy the **project ref** (the ID in the URL, e.g. `abcdefghijklmnop`).

### 2. Apply migrations + seed data

```bash
cd packages/supabase

# Link to your staging project
supabase link --project-ref <your-staging-ref>

# Push all migrations
supabase db push

# Seed with demo data
psql <staging-connection-string> -f seed.sql
```

### 3. Set Vercel environment variables

In [Vercel Dashboard](https://vercel.com) → **Project Settings** → **Environment Variables**:

Add these scoped to **Preview** environment, filtered to the `staging` branch:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<staging-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (from Supabase Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | (from Supabase Settings → API) |
| `NEXT_PUBLIC_ENV` | `staging` |
| `NEXT_PUBLIC_APP_URL` | `https://clubos-staging.vercel.app` |
| `STRIPE_SECRET_KEY` | (use **test** mode key) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | (use **test** mode key) |
| `ANTHROPIC_API_KEY` | (same as prod — or a separate key with lower limits) |
| `RESEND_API_KEY` | (same key — Resend test mode auto-applies to unverified domains) |

### 4. Create and push the staging branch

```bash
git checkout -b staging main
git push -u origin staging
```

Vercel will auto-deploy on push.

### 5. Local staging testing

To run locally against the staging database:

```bash
cp apps/web/.env.staging.local apps/web/.env.local
pnpm dev
```

## Deployment Workflow

```
feature branch → PR → merge to staging → test → merge to main → production
                  ↓
            Vercel preview
```

**Day-to-day:**
```bash
# Work on a feature
git checkout -b feat/my-feature staging
# ... develop ...
git push origin feat/my-feature
# Create PR targeting 'staging'

# After QA on staging:
git checkout main
git merge staging
git push origin main   # → prod deploy
```

**Hotfix:**
```bash
git checkout -b hotfix/urgent main
# ... fix ...
git push origin hotfix/urgent
# Create PR targeting 'main' (skip staging for urgent fixes)
# Then merge main back into staging
```

## Environment Banner

A colored banner appears in non-production environments:
- **Blue**: `LOCAL DEV` — local development
- **Orange**: `STAGING` — staging environment
- Hidden in production

Controlled by `NEXT_PUBLIC_ENV` env var.

## Database Migrations

Migrations live in `packages/supabase/migrations/`. Apply them to staging:

```bash
cd packages/supabase
supabase link --project-ref <staging-ref>
supabase db push
```

**Important**: Always test migrations on staging before production. The workflow:
1. Write migration in `packages/supabase/migrations/`
2. Test locally with `supabase db reset`
3. Push to staging: `supabase db push` (linked to staging)
4. Verify staging works
5. Switch link and push to prod: `supabase link --project-ref iicwnlruopqhrzkgjsmu && supabase db push`

## Stripe

Both local and staging use Stripe **test mode** keys. Production uses **live mode** keys.

- Test dashboard: https://dashboard.stripe.com/test
- Webhook testing: Use `stripe listen --forward-to localhost:3000/api/webhooks/stripe` locally
- Staging webhook: Configure a Stripe webhook endpoint pointing to your staging URL

## Mobile App

Update `apps/mobile/.env`:
```bash
# Point to staging
EXPO_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<staging-anon-key>
EXPO_PUBLIC_APP_URL=https://clubos-staging.vercel.app
```
