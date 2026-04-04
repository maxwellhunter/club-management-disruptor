# ClubOS — Session Notes (API Tests + Staging Environment)

## What Was Done

### 1. Complete API Route Test Coverage (77 suites, 561 tests)

Every API route in `apps/web/src/app/api/` now has test coverage. Tests use Jest 30 + ts-jest with a consistent mocking pattern for Supabase query chains.

**Test files written this session (26 new):**

| Route | Tests | Key scenarios |
|-------|-------|--------------|
| `bookings/[id]/cancel` | 8 | Auth, ownership, already cancelled, past booking, waitlist promotion, admin cancel |
| `bookings/[id]/modify` | 5 | Auth, validation, ownership, successful modify |
| `bookings/admin/schedule` | 8 | GET/POST/DELETE with admin checks, missing facility |
| `bookings/admin/golf-rates` | 7 | GET/POST/DELETE with admin checks |
| `bookings/my` | 2 | Auth, returns user bookings |
| `bookings/waitlist` | 6 | POST validation/eligibility, GET, DELETE |
| `accounting/export` | 3 | Auth, admin-only, successful export |
| `notifications` | 6 | GET admin list, POST broadcast/single-member |
| `tiers/[id]` | 7 | GET/PATCH/DELETE with 404, conflict handling |
| `billing/status` | 3 | Auth, member not found, returns status |
| `billing/advanced` | 3 | Auth, admin-only, returns summary |
| `members/[id]` | 6 | GET/PATCH/DELETE, ownership, admin update, self-delete prevention |
| `wallet/passes` | 6 | GET/POST/DELETE, duplicate prevention, admin-only delete |
| `wallet/nfc` | 5 | Auth, non-member, self-tap, duplicate (429), invalid barcode |
| `wallet/templates` | 5 | GET/POST, admin-only, create/update |
| `pos/config` | 5 | GET/POST, member-forbidden, admin-only |
| `pos/config/[id]` | 4 | PATCH/DELETE, auth, conflict |
| `pos/transactions` | 5 | GET member-own/admin-all, POST member-forbidden |
| `pos/summary` | 3 | Auth, member-forbidden, returns summary |
| `reports` | 3 | Auth, admin-only, returns report data |
| `insights` | 4 | GET/POST, admin-only, missing API key (503) |
| `invite/[token]` | 6 | GET invalid/expired/success, POST invalid-body/token/success |
| `webhooks/stripe` | 4 | Missing sig, bad sig, unknown event, checkout.session.completed |
| `migration` | 3 | Auth, admin-only, returns stats |
| `migration/upload` | 3 | Auth, admin-only, missing file |
| `migration/execute` | 3 | Auth, admin-only, invalid body |

### 2. Staging Environment Setup

Created a 3-tier environment system: **Local -> Staging -> Production**

**Files created:**
- `apps/web/src/components/env-banner.tsx` — Colored banner (blue=local, orange=staging, hidden in prod)
- `apps/web/src/app/layout.tsx` — Updated to include `<EnvBanner />`
- `scripts/setup-staging.sh` — Interactive setup script (Supabase project, migrations, Vercel config)
- `docs/ENVIRONMENTS.md` — Full environment reference documentation
- `apps/web/.env.example` — Updated with staging/env vars

**How it works:**
- `NEXT_PUBLIC_ENV` controls the environment banner and behavior
- Staging uses a dedicated Supabase project + Vercel preview deploys on the `staging` branch
- Workflow: `feature branch -> PR -> merge to staging -> test -> merge to main -> production`

## Running Tests

```bash
cd apps/web
pnpm test
```

> Note: Use `pnpm test` (not `npx jest` directly) — the turbo pipeline ensures proper ts-jest workspace context.

## Known Issues

- Pre-existing typecheck error in `billing/invoices/[id]/pdf/route.ts` (Buffer type) — not caused by these changes
- ts-jest@29 / jest@30 compatibility requires running through pnpm workspace

## Next Steps

- [ ] Commit and push all changes
- [ ] Create the actual Supabase staging project (run `scripts/setup-staging.sh`)
- [ ] Set up Vercel environment variables for the `staging` branch
- [ ] Wire Stripe payments (currently engine-only, not connected to Stripe API)
