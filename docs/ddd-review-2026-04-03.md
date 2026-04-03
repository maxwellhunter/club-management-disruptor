# DDD Architecture Review — 2026-04-03

## Overview

This review assesses the ClubOS codebase against Domain-Driven Design principles, identifying what's working well and where structural changes would improve sustainability and scalability as the product grows.

---

## Current State: What's Working

### 1. Strong Domain Type Modeling
The shared types package (`packages/shared/src/types/index.ts`) defines clear domain entities with well-constrained union types for statuses, roles, and tiers. This acts as a ubiquitous language shared between web and mobile.

### 2. Multi-Tenant Isolation
The `club_id` foreign key on every table, combined with Postgres RLS policies and the `get_member_club_id()` helper function, creates a robust tenancy boundary. This is a solid foundation that most DDD implementations get wrong.

### 3. Zod Schemas as Domain Contracts
`packages/shared/src/schemas/index.ts` encodes domain invariants (golf party size max 4, positive amounts, tier-specific rules) in validation schemas that are shared across the stack. This prevents invalid state at system boundaries.

### 4. Emerging Domain Services
`golf-eligibility.ts` is a good example of extracting domain logic into a reusable service. The eligibility rule (admin/staff always eligible, members need premium/vip/honorary tier) is a core business rule that lives outside any single API route.

---

## Issues: What Needs to Change

### Issue 1: No Bounded Context Separation — All Logic Lives in API Routes

**Problem:** Every API route (48+ route files) contains a mix of authentication, authorization, domain logic, data access, and response formatting. The booking route (`apps/web/src/app/api/bookings/route.ts`) is 280 lines that handles auth, golf eligibility checks, facility lookups, double-booking prevention, capacity checks, booking creation, and email sending — all inline.

**Impact:** As features grow, routes become harder to test, harder to reuse (mobile already calls the same endpoints but the chat handlers in `handlers.ts` duplicate query logic), and changes to business rules require touching HTTP handler code.

**Recommendation:** Extract domain logic into service modules organized by bounded context:

```
apps/web/src/domain/
  booking/
    booking-service.ts      # createBooking(), cancelBooking(), checkAvailability()
    booking-repository.ts   # Supabase queries for bookings
  member/
    member-service.ts       # inviteMember(), updateMember(), claimInvite()
    member-repository.ts    # Supabase queries for members
  billing/
    billing-service.ts      # createInvoice(), processPayment()
  golf/
    golf-service.ts         # checkEligibility(), submitScorecard()
    golf-repository.ts
  event/
    event-service.ts        # createEvent(), rsvp(), getAttendees()
  dining/
    dining-service.ts       # placeOrder(), updateOrderStatus()
```

API routes become thin handlers that call services. Chat handlers call the same services instead of duplicating queries.

**Priority:** High — this is the single biggest structural improvement.

---

### Issue 2: No Repository Abstraction — Direct Supabase Queries Everywhere

**Problem:** Every API route constructs Supabase queries inline with manual `.select()`, `.eq()`, `.from()` chains. The same "get member with tier" join pattern appears in nearly every route. The same `as unknown as` type casting for Supabase join results is repeated dozens of times.

**Impact:**
- Schema changes (renaming a column, adding a join) require updating every route that touches that table
- No single place to add query optimizations, caching, or logging
- The `as unknown as` casting pattern is fragile and hides type errors

**Recommendation:** Create repository modules that encapsulate Supabase queries and return properly typed domain objects:

```typescript
// domain/member/member-repository.ts
export class MemberRepository {
  constructor(private supabase: SupabaseClient) {}

  async findByUserId(userId: string): Promise<MemberWithTier | null> { ... }
  async findByClub(clubId: string, filters: MemberFilters): Promise<DirectoryMember[]> { ... }
  async create(clubId: string, input: InviteMemberInput): Promise<Member> { ... }
}
```

This eliminates the repeated `as unknown as` casts and centralizes data access.

**Priority:** High — directly supports Issue 1.

---

### Issue 3: Domain Rules Scattered Across Route Handlers

**Problem:** Business rules are embedded in HTTP handlers rather than domain objects or services:
- Golf eligibility check is in `golf-eligibility.ts` (good) but the "party size max 4 for golf" rule is inline in the booking route (bad)
- Double-booking prevention logic (dining vs. golf slot rules) is inline in the booking route
- The "admin-only" authorization check is repeated in every admin route with `if (result.member.role !== "admin")`
- Invoice status transitions have no domain enforcement

**Impact:** Rules are invisible to developers reading domain types, easy to bypass when adding new entry points, and impossible to unit test without spinning up HTTP request mocks.

**Recommendation:**
1. Move business rules into domain service methods that throw domain-specific errors
2. Create an authorization middleware or helper that declaratively specifies required roles
3. Encode state machine transitions (booking status, invoice status, order status) as explicit domain functions:

```typescript
// domain/booking/booking-rules.ts
export function validateBookingRequest(
  facility: Facility,
  member: MemberWithTier,
  input: CreateBookingInput
): BookingValidationResult {
  if (facility.type === 'golf' && !isGolfEligible(member)) {
    return { valid: false, error: 'Golf requires premium+ membership' };
  }
  if (facility.type === 'golf' && input.party_size > 4) {
    return { valid: false, error: 'Golf max party size is 4' };
  }
  return { valid: true };
}
```

**Priority:** High — directly improves correctness and testability.

---

### Issue 4: No Domain Events or Event-Driven Patterns

**Problem:** Side effects (email sending, notifications) are tightly coupled to the operations that trigger them. The booking route calls `sendBookingConfirmationEmail()` directly. The member invite route calls `sendInviteEmail()` directly. If you need to add a second side effect (e.g., update a dashboard counter, send a push notification, log an audit trail), you modify the route handler.

**Impact:** Adding cross-cutting concerns means touching every route. Audit logging, analytics, push notifications — each new requirement requires modifying core business logic.

**Recommendation:** Introduce a lightweight domain event pattern:

```typescript
// domain/events.ts
type DomainEvent =
  | { type: 'booking.created'; booking: Booking; member: MemberWithTier }
  | { type: 'member.invited'; member: Member; inviteUrl: string }
  | { type: 'event.rsvp'; eventId: string; memberId: string; status: RsvpStatus };

// Services emit events, handlers subscribe
eventBus.emit({ type: 'booking.created', booking, member });

// Separate handler files
eventBus.on('booking.created', sendBookingConfirmation);
eventBus.on('booking.created', logAuditTrail);
```

This doesn't need to be Kafka or a message queue — a simple in-process event emitter is sufficient at this scale.

**Priority:** Medium — becomes important as you add notifications, audit logging, and analytics.

---

### Issue 5: Aggregate Boundaries Not Enforced

**Problem:** There's no enforcement that child entities are modified through their aggregate root. `GolfScore` rows can be inserted/updated independently of their `GolfRound`. `DiningOrderItem` can be modified without going through `DiningOrder`. `EventRsvp` can be created without validating against the `ClubEvent` capacity.

**Impact:** Data inconsistency risks. A golf round's `total_score` could become out of sync with its individual `GolfScore` records. An event could exceed its capacity if RSVPs are created without checking the event.

**Recommendation:** Enforce aggregate boundaries in the service layer:

```typescript
// domain/golf/golf-service.ts
export async function submitScore(
  roundId: string,
  holeNumber: number,
  score: ScoreInput
): Promise<GolfRound> {
  // Load the full round aggregate
  const round = await golfRepo.findRoundWithScores(roundId);
  // Validate and update through the aggregate
  round.recordScore(holeNumber, score);
  // Persist the entire aggregate
  return golfRepo.saveRound(round);
}
```

**Priority:** Medium — critical for golf scorecards and dining orders where parent-child consistency matters.

---

### Issue 6: Shared Package Mixes Domain Types with API Response DTOs

**Problem:** `packages/shared/src/types/index.ts` contains both domain entities (`Member`, `Booking`, `ClubEvent`) and API response types (`BillingStatus`, `MemberDirectoryResponse`, `EventWithRsvp`, `DiningOrderWithItems`). These serve different purposes: domain types model the business, response types shape API contracts.

**Impact:** Changes to API response shapes can inadvertently affect domain modeling decisions. Mobile and web couple to the same response format, making it harder to evolve APIs independently.

**Recommendation:** Split the shared types:

```
packages/shared/src/
  domain/          # Pure domain types (Member, Booking, ClubEvent)
  api/             # API request/response DTOs (MemberDirectoryResponse, BillingStatus)
  schemas/         # Zod validation (unchanged)
```

**Priority:** Low — the current single file works fine at this scale but will become painful past ~30 entities.

---

### Issue 7: No Explicit State Machines for Status Fields

**Problem:** Multiple entities have status fields with implicit transition rules:
- `BookingStatus`: confirmed → completed, confirmed → cancelled, confirmed → no_show
- `InvoiceStatus`: draft → sent → paid, sent → overdue, any → cancelled
- `DiningOrderStatus`: pending → confirmed → preparing → ready → delivered
- `RoundStatus`: in_progress → completed → verified

These transitions are not enforced anywhere. Any API route can set any status.

**Impact:** Invalid state transitions (e.g., a cancelled booking being marked as completed) are possible. As more features touch these entities, the risk of invalid transitions increases.

**Recommendation:** Create state machine helpers:

```typescript
// domain/shared/state-machine.ts
const bookingTransitions: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function transitionBookingStatus(
  current: BookingStatus,
  next: BookingStatus
): BookingStatus {
  if (!bookingTransitions[current].includes(next)) {
    throw new InvalidTransitionError(current, next);
  }
  return next;
}
```

**Priority:** Medium — prevents data corruption as more features modify entity statuses.

---

## Recommended Implementation Order

| Phase | Changes | Effort |
|-------|---------|--------|
| **Phase 1** | Extract repository layer (Issue 2) — centralize Supabase queries, eliminate `as unknown as` casts | 1-2 weeks |
| **Phase 2** | Extract domain services (Issue 1) — move business logic out of routes into service modules | 1-2 weeks |
| **Phase 3** | Consolidate domain rules (Issue 3) — move inline rules into service/rule modules, add auth middleware | 1 week |
| **Phase 4** | Add state machines (Issue 7) — enforce valid transitions for all status fields | 3-5 days |
| **Phase 5** | Domain events (Issue 4) — decouple side effects from core operations | 1 week |
| **Phase 6** | Aggregate enforcement (Issue 5) — enforce parent-child consistency in services | 1 week |
| **Phase 7** | Split shared types (Issue 6) — separate domain types from API DTOs | 2-3 days |

Phases 1-3 deliver the most value and should be done before adding major new features. Phases 4-7 can be done incrementally as you touch each bounded context.

---

## Architecture Target State

```
packages/shared/src/
  domain/           # Pure domain types
  api/              # API DTOs
  schemas/          # Zod validation
  rules/            # Shared business rules (state machines, eligibility)

apps/web/src/
  domain/
    booking/        # Service + Repository + Rules
    member/         # Service + Repository + Rules
    billing/        # Service + Repository + Rules
    golf/           # Service + Repository + Rules
    event/          # Service + Repository + Rules
    dining/         # Service + Repository + Rules
    shared/         # Auth middleware, event bus, base repository
  app/
    api/            # Thin HTTP handlers that call domain services
    dashboard/      # UI pages (unchanged)
```

This structure makes it possible to:
- Unit test business rules without HTTP or database
- Add new entry points (webhooks, cron jobs, mobile-specific endpoints) that reuse domain logic
- Onboard new developers by pointing them to the bounded context they need
- Evolve each bounded context independently as the product grows
