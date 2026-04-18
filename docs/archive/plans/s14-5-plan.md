---
title: "S14-5 Plan: RLS-bevistest"
description: "Vitest-integrationstester mot Supabase som bevisar att RLS-policies blockerar cross-tenant access"
category: plan
status: active
last_updated: 2026-04-04
sections:
  - Mål
  - Approach
  - Testscenarier
  - Filer
  - Tasks
---

# S14-5: RLS-bevistest -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vitest-integrationstester som bevisar att RLS-policies (S14-1) faktiskt blockerar cross-tenant access på Supabase.

**Architecture:** Testerna körs mot det riktiga Supabase-projektet (`zzdamokfeenencuggjjp`) med public schema. Admin-klienten (service_role) seedar testdata, autentiserade klienter verifierar att RLS filtrerar korrekt. Skippar gracefully om Supabase env-vars saknas.

**Tech Stack:** Vitest, @supabase/supabase-js, Supabase Auth (signInWithPassword), Custom Access Token Hook (providerId i JWT)

---

## Mål

Bevisa dessa 4 påståenden med automatiska tester:

1. **Cross-tenant isolation**: Provider A kan INTE se Provider B:s bokningar
2. **Anon deny-all**: Anon-nyckel utan session ser ingenting
3. **Service role bypass**: Admin (service_role) ser allt
4. **Alla 7 tabeller**: Policies fungerar på Booking, Payment, Service, Horse, CustomerReview, Notification, BookingSeries

## Approach

- **Seed via service_role** (kringgår RLS) -- skapar testanvändare i auth.users + data i public schema
- **Query via signInWithPassword** -- autentiserade Supabase-klienter med user JWT
- **Custom Access Token Hook** berikar JWT med providerId -- redan aktiv på Supabase
- **Deterministic UUIDs** med `b0...` prefix för enkel cleanup
- **afterAll cleanup** -- tar bort all testdata + auth-användare
- **describe.skipIf** -- hoppar om `SUPABASE_SERVICE_ROLE_KEY` saknas

## Testscenarier

| Test | Tabell | Förväntat |
|------|--------|-----------|
| Provider A ser sina bokningar | Booking | 2 rader (A:s) |
| Provider A ser INTE B:s bokningar | Booking | 0 av B:s |
| Provider B ser sina bokningar | Booking | 2 rader (B:s) |
| Kund A ser sina bokningar | Booking | 2 rader (A:s som kund) |
| Anon ser inga bokningar | Booking | 0 rader |
| Service role ser alla bokningar | Booking | 4 rader |
| Provider A ser sina payments | Payment | via booking JOIN |
| Provider A ser sina services | Service | 1 (sin) |
| Alla authenticated ser aktiva services | Service | alla aktiva |
| Provider A ser kunders hästar | Horse | via ProviderCustomer |
| Häst-ägare ser sin häst | Horse | 1 |
| Provider A ser sina recensioner | CustomerReview | 1 |
| Kund ser sin recension | CustomerReview | 1 |
| Provider A ser sina notifikationer | Notification | 1 |
| Provider A ser sina bokningsserier | BookingSeries | 1 |

## Filer

| Fil | Ansvar |
|-----|--------|
| `src/__tests__/rls/rls-proof.integration.test.ts` | Alla RLS-bevistester |
| `src/__tests__/rls/supabase-test-helpers.ts` | Klient-skapande, seed, cleanup |

## Risker

- **Nätverksberoende**: Kräver Supabase-anslutning. Skippar i CI om env saknas.
- **Datapollution vid krasch**: afterAll kanske inte körs. Deterministic IDs gör manuell cleanup enkel.
- **Hook-fördröjning**: JWT claims beror på custom hook. Om hook inte är aktiv failar testerna med tydligt meddelande.

---

## Tasks

### Task 1: Test helpers (seed + cleanup + klienter)

**Files:**
- Create: `src/__tests__/rls/supabase-test-helpers.ts`

- [ ] **Step 1: Skapa helper-filen med konstanter och klient-factories**

```typescript
// src/__tests__/rls/supabase-test-helpers.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js"

// --- Config (from .env.local) ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// --- Deterministic test IDs (b0-prefix for easy cleanup) ---
export const IDS = {
  PROVIDER_A_USER: "b0000000-0000-4000-a000-000000000001",
  PROVIDER_B_USER: "b0000000-0000-4000-a000-000000000002",
  CUSTOMER_A_USER: "b0000000-0000-4000-a000-000000000003",
  PROVIDER_A: "b0000000-0000-4000-a000-000000000011",
  PROVIDER_B: "b0000000-0000-4000-a000-000000000012",
  SERVICE_A: "b0000000-0000-4000-a000-000000000021",
  SERVICE_B: "b0000000-0000-4000-a000-000000000022",
  BOOKING_A1: "b0000000-0000-4000-a000-000000000031",
  BOOKING_A2: "b0000000-0000-4000-a000-000000000032",
  BOOKING_B1: "b0000000-0000-4000-a000-000000000033",
  BOOKING_B2: "b0000000-0000-4000-a000-000000000034",
  PAYMENT_A1: "b0000000-0000-4000-a000-000000000041",
  PAYMENT_B1: "b0000000-0000-4000-a000-000000000042",
  HORSE_A: "b0000000-0000-4000-a000-000000000051",
  REVIEW_A: "b0000000-0000-4000-a000-000000000061",
  NOTIFICATION_A: "b0000000-0000-4000-a000-000000000071",
  NOTIFICATION_B: "b0000000-0000-4000-a000-000000000072",
  SERIES_A: "b0000000-0000-4000-a000-000000000081",
  SERIES_B: "b0000000-0000-4000-a000-000000000082",
  PROVIDER_CUSTOMER_A: "b0000000-0000-4000-a000-000000000091",
} as const

const TEST_PASSWORD = "rls-test-2026!"

// --- Client factories ---

export function createAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function createAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function createAuthenticatedClient(
  email: string
): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  })
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`)
  return client
}

// --- Seed ---

export async function seedTestData(): Promise<void> {
  const admin = createAdminClient()

  // 1. Create auth users (provider A, provider B, customer A)
  const users = [
    { id: IDS.PROVIDER_A_USER, email: "rls-test-provider-a@test.local" },
    { id: IDS.PROVIDER_B_USER, email: "rls-test-provider-b@test.local" },
    { id: IDS.CUSTOMER_A_USER, email: "rls-test-customer-a@test.local" },
  ]

  for (const u of users) {
    const { error } = await admin.auth.admin.createUser({
      id: u.id,
      email: u.email,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (error && !error.message.includes("already been registered")) {
      throw new Error(`Failed to create user ${u.email}: ${error.message}`)
    }
  }

  // 2. User records (for custom access token hook)
  await admin.from("User").upsert([
    { id: IDS.PROVIDER_A_USER, email: "rls-test-provider-a@test.local", userType: "provider", firstName: "ProvA", lastName: "Test", isAdmin: false },
    { id: IDS.PROVIDER_B_USER, email: "rls-test-provider-b@test.local", userType: "provider", firstName: "ProvB", lastName: "Test", isAdmin: false },
    { id: IDS.CUSTOMER_A_USER, email: "rls-test-customer-a@test.local", userType: "customer", firstName: "KundA", lastName: "Test", isAdmin: false },
  ])

  // 3. Provider records
  await admin.from("Provider").upsert([
    { id: IDS.PROVIDER_A, userId: IDS.PROVIDER_A_USER, businessName: "RLS Test A" },
    { id: IDS.PROVIDER_B, userId: IDS.PROVIDER_B_USER, businessName: "RLS Test B" },
  ])

  // 4. ProviderCustomer (A has customer A)
  await admin.from("ProviderCustomer").upsert([
    { id: IDS.PROVIDER_CUSTOMER_A, providerId: IDS.PROVIDER_A, customerId: IDS.CUSTOMER_A_USER },
  ])

  // 5. Services
  await admin.from("Service").upsert([
    { id: IDS.SERVICE_A, providerId: IDS.PROVIDER_A, name: "RLS Hovvård A", price: 800, durationMinutes: 60, isActive: true },
    { id: IDS.SERVICE_B, providerId: IDS.PROVIDER_B, name: "RLS Hovvård B", price: 900, durationMinutes: 45, isActive: true },
  ])

  // 6. Bookings (2 per provider, customer A is the client)
  await admin.from("Booking").upsert([
    { id: IDS.BOOKING_A1, customerId: IDS.CUSTOMER_A_USER, providerId: IDS.PROVIDER_A, serviceId: IDS.SERVICE_A, bookingDate: "2026-05-01", startTime: "09:00", endTime: "10:00", status: "confirmed" },
    { id: IDS.BOOKING_A2, customerId: IDS.CUSTOMER_A_USER, providerId: IDS.PROVIDER_A, serviceId: IDS.SERVICE_A, bookingDate: "2026-05-02", startTime: "09:00", endTime: "10:00", status: "confirmed" },
    { id: IDS.BOOKING_B1, customerId: IDS.CUSTOMER_A_USER, providerId: IDS.PROVIDER_B, serviceId: IDS.SERVICE_B, bookingDate: "2026-05-01", startTime: "14:00", endTime: "14:45", status: "confirmed" },
    { id: IDS.BOOKING_B2, customerId: IDS.CUSTOMER_A_USER, providerId: IDS.PROVIDER_B, serviceId: IDS.SERVICE_B, bookingDate: "2026-05-02", startTime: "14:00", endTime: "14:45", status: "confirmed" },
  ])

  // 7. Payments (1 per provider, via booking)
  await admin.from("Payment").upsert([
    { id: IDS.PAYMENT_A1, bookingId: IDS.BOOKING_A1, amount: 800, status: "completed", paymentMethod: "swish" },
    { id: IDS.PAYMENT_B1, bookingId: IDS.BOOKING_B1, amount: 900, status: "completed", paymentMethod: "swish" },
  ])

  // 8. Horse (owned by customer A)
  await admin.from("Horse").upsert([
    { id: IDS.HORSE_A, ownerId: IDS.CUSTOMER_A_USER, name: "RLS Testhäst" },
  ])

  // 9. CustomerReview (customer A reviewed provider A)
  await admin.from("CustomerReview").upsert([
    { id: IDS.REVIEW_A, customerId: IDS.CUSTOMER_A_USER, providerId: IDS.PROVIDER_A, rating: 5, comment: "RLS test review" },
  ])

  // 10. Notification (1 per provider user)
  await admin.from("Notification").upsert([
    { id: IDS.NOTIFICATION_A, userId: IDS.PROVIDER_A_USER, type: "booking_confirmed", message: "RLS test notis A", isRead: false },
    { id: IDS.NOTIFICATION_B, userId: IDS.PROVIDER_B_USER, type: "booking_confirmed", message: "RLS test notis B", isRead: false },
  ])

  // 11. BookingSeries (1 per provider)
  await admin.from("BookingSeries").upsert([
    { id: IDS.SERIES_A, providerId: IDS.PROVIDER_A, customerId: IDS.CUSTOMER_A_USER, serviceId: IDS.SERVICE_A, frequency: "weekly", startDate: "2026-05-01", status: "active" },
    { id: IDS.SERIES_B, providerId: IDS.PROVIDER_B, customerId: IDS.CUSTOMER_A_USER, serviceId: IDS.SERVICE_B, frequency: "weekly", startDate: "2026-05-01", status: "active" },
  ])
}

// --- Cleanup (reverse order of creation) ---

export async function cleanupTestData(): Promise<void> {
  const admin = createAdminClient()

  // Delete in dependency order (children first)
  const tables = [
    "BookingSeries", "Notification", "CustomerReview", "Horse",
    "Payment", "Booking", "Service", "ProviderCustomer", "Provider", "User",
  ]

  const allIds = Object.values(IDS)

  for (const table of tables) {
    await admin.from(table).delete().in("id", allIds)
  }

  // Delete auth users
  const userIds = [IDS.PROVIDER_A_USER, IDS.PROVIDER_B_USER, IDS.CUSTOMER_A_USER]
  for (const id of userIds) {
    await admin.auth.admin.deleteUser(id)
  }
}

export function hasSupabaseEnv(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}
```

- [ ] **Step 2: Committa helpern**

```bash
git add src/__tests__/rls/supabase-test-helpers.ts
git commit -m "test: S14-5 RED -- RLS test helpers (seed, cleanup, klienter)"
```

---

### Task 2: Booking RLS-tester (kärnan)

**Files:**
- Create: `src/__tests__/rls/rls-proof.integration.test.ts`

- [ ] **Step 1: Skapa testfilen med Booking-tester**

```typescript
// src/__tests__/rls/rls-proof.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import {
  IDS,
  createAdminClient,
  createAnonClient,
  createAuthenticatedClient,
  seedTestData,
  cleanupTestData,
  hasSupabaseEnv,
} from "./supabase-test-helpers"
import type { SupabaseClient } from "@supabase/supabase-js"

describe.skipIf(!hasSupabaseEnv())("RLS proof tests (Supabase)", () => {
  let providerAClient: SupabaseClient
  let providerBClient: SupabaseClient
  let customerAClient: SupabaseClient
  let adminClient: SupabaseClient

  beforeAll(async () => {
    await seedTestData()

    // Sign in as each user to get authenticated clients
    providerAClient = await createAuthenticatedClient("rls-test-provider-a@test.local")
    providerBClient = await createAuthenticatedClient("rls-test-provider-b@test.local")
    customerAClient = await createAuthenticatedClient("rls-test-customer-a@test.local")
    adminClient = createAdminClient()
  }, 30_000)

  afterAll(async () => {
    await cleanupTestData()
  }, 15_000)

  // --- Booking ---

  describe("Booking", () => {
    it("Provider A sees only their own bookings", async () => {
      const { data } = await providerAClient
        .from("Booking")
        .select("id, providerId")

      expect(data).toHaveLength(2)
      expect(data!.every((b) => b.providerId === IDS.PROVIDER_A)).toBe(true)
    })

    it("Provider B sees only their own bookings", async () => {
      const { data } = await providerBClient
        .from("Booking")
        .select("id, providerId")

      expect(data).toHaveLength(2)
      expect(data!.every((b) => b.providerId === IDS.PROVIDER_B)).toBe(true)
    })

    it("Customer A sees bookings where they are the customer", async () => {
      const { data } = await customerAClient
        .from("Booking")
        .select("id, customerId")

      // Customer A is customer on all 4 bookings (both providers)
      expect(data).toHaveLength(4)
      expect(data!.every((b) => b.customerId === IDS.CUSTOMER_A_USER)).toBe(true)
    })

    it("Anon client sees no bookings", async () => {
      const anon = createAnonClient()
      const { data } = await anon.from("Booking").select("id")

      expect(data).toHaveLength(0)
    })

    it("Service role (admin) sees all bookings", async () => {
      const { data } = await adminClient
        .from("Booking")
        .select("id")
        .in("id", [IDS.BOOKING_A1, IDS.BOOKING_A2, IDS.BOOKING_B1, IDS.BOOKING_B2])

      expect(data).toHaveLength(4)
    })
  })

  // --- Payment ---

  describe("Payment", () => {
    it("Provider A sees payments for their bookings", async () => {
      const { data } = await providerAClient
        .from("Payment")
        .select("id, bookingId")

      const testPayments = data!.filter((p) => p.id === IDS.PAYMENT_A1)
      expect(testPayments).toHaveLength(1)
    })

    it("Provider A does NOT see Provider B:s payments", async () => {
      const { data } = await providerAClient
        .from("Payment")
        .select("id")
        .eq("id", IDS.PAYMENT_B1)

      expect(data).toHaveLength(0)
    })

    it("Customer A sees payments for their bookings", async () => {
      const { data } = await customerAClient
        .from("Payment")
        .select("id")
        .in("id", [IDS.PAYMENT_A1, IDS.PAYMENT_B1])

      // Customer A is on both bookings
      expect(data).toHaveLength(2)
    })
  })

  // --- Service ---

  describe("Service", () => {
    it("Provider A sees own services (including inactive)", async () => {
      const { data } = await providerAClient
        .from("Service")
        .select("id, providerId")
        .eq("id", IDS.SERVICE_A)

      expect(data).toHaveLength(1)
      expect(data![0].providerId).toBe(IDS.PROVIDER_A)
    })

    it("All authenticated users see active services (booking flow)", async () => {
      const { data } = await customerAClient
        .from("Service")
        .select("id")
        .in("id", [IDS.SERVICE_A, IDS.SERVICE_B])

      // Both services are active, customer can see them
      expect(data).toHaveLength(2)
    })
  })

  // --- Horse ---

  describe("Horse", () => {
    it("Horse owner sees their horse", async () => {
      const { data } = await customerAClient
        .from("Horse")
        .select("id, ownerId")
        .eq("id", IDS.HORSE_A)

      expect(data).toHaveLength(1)
      expect(data![0].ownerId).toBe(IDS.CUSTOMER_A_USER)
    })

    it("Provider A sees horses of their customers (via ProviderCustomer)", async () => {
      const { data } = await providerAClient
        .from("Horse")
        .select("id")
        .eq("id", IDS.HORSE_A)

      expect(data).toHaveLength(1)
    })

    it("Provider B does NOT see horse (no ProviderCustomer relation)", async () => {
      const { data } = await providerBClient
        .from("Horse")
        .select("id")
        .eq("id", IDS.HORSE_A)

      expect(data).toHaveLength(0)
    })
  })

  // --- CustomerReview ---

  describe("CustomerReview", () => {
    it("Provider A sees reviews about them", async () => {
      const { data } = await providerAClient
        .from("CustomerReview")
        .select("id, providerId")
        .eq("id", IDS.REVIEW_A)

      expect(data).toHaveLength(1)
    })

    it("Provider B does NOT see Provider A:s reviews", async () => {
      const { data } = await providerBClient
        .from("CustomerReview")
        .select("id")
        .eq("id", IDS.REVIEW_A)

      expect(data).toHaveLength(0)
    })

    it("Customer A sees their own review", async () => {
      const { data } = await customerAClient
        .from("CustomerReview")
        .select("id, customerId")
        .eq("id", IDS.REVIEW_A)

      expect(data).toHaveLength(1)
    })
  })

  // --- Notification ---

  describe("Notification", () => {
    it("Provider A sees only their notifications", async () => {
      const { data } = await providerAClient
        .from("Notification")
        .select("id, userId")
        .in("id", [IDS.NOTIFICATION_A, IDS.NOTIFICATION_B])

      expect(data).toHaveLength(1)
      expect(data![0].id).toBe(IDS.NOTIFICATION_A)
    })

    it("Provider B sees only their notifications", async () => {
      const { data } = await providerBClient
        .from("Notification")
        .select("id")
        .in("id", [IDS.NOTIFICATION_A, IDS.NOTIFICATION_B])

      expect(data).toHaveLength(1)
      expect(data![0].id).toBe(IDS.NOTIFICATION_B)
    })
  })

  // --- BookingSeries ---

  describe("BookingSeries", () => {
    it("Provider A sees only their series", async () => {
      const { data } = await providerAClient
        .from("BookingSeries")
        .select("id, providerId")
        .in("id", [IDS.SERIES_A, IDS.SERIES_B])

      expect(data).toHaveLength(1)
      expect(data![0].id).toBe(IDS.SERIES_A)
    })

    it("Customer A sees series where they are the customer", async () => {
      const { data } = await customerAClient
        .from("BookingSeries")
        .select("id, customerId")
        .in("id", [IDS.SERIES_A, IDS.SERIES_B])

      // Customer A is on both series
      expect(data).toHaveLength(2)
    })
  })
})
```

- [ ] **Step 2: Kör testet och verifiera att det failar (RED)**

```bash
npx vitest run src/__tests__/rls/rls-proof.integration.test.ts
```

Förväntat: Tests ska antingen faila (om RLS inte är deplopad till Supabase) eller passa (om policies redan finns). Om de skippar (inga env-vars): verifiera att `.env.local` har rätt credentials.

- [ ] **Step 3: Committa**

```bash
git add src/__tests__/rls/rls-proof.integration.test.ts
git commit -m "test: S14-5 RED -- RLS proof integration tests (7 tabeller)"
```

---

### Task 3: Deploya migration till Supabase (om inte redan gjort)

- [ ] **Step 1: Verifiera att S14-1 migration finns på Supabase**

Kör testerna. Om de failar med "permission denied" eller liknande: migrationerna behöver deployas.

```bash
npx vitest run src/__tests__/rls/rls-proof.integration.test.ts
```

- [ ] **Step 2: Om migration saknas -- applicera via Supabase Dashboard SQL editor**

Kopiera innehållet i `prisma/migrations/20260404120000_rls_read_policies/migration.sql` och kör det i Supabase Dashboard -> SQL Editor.

- [ ] **Step 3: Kör testerna igen -- alla ska vara GREEN**

```bash
npx vitest run src/__tests__/rls/rls-proof.integration.test.ts
```

Förväntat: Alla tester gröna.

---

### Task 4: Finjustera och verifiera

- [ ] **Step 1: Kör typecheck**

```bash
npm run typecheck
```

- [ ] **Step 2: Kör hela testsviten**

```bash
npm run check:all
```

- [ ] **Step 3: Committa eventuella fixar**

---

### Task 5: Done-fil + status-uppdatering

- [ ] **Step 1: Skriv done-fil**

Create: `docs/done/s14-5-done.md`

- [ ] **Step 2: Uppdatera status.md**

Story -> `done` + commit-hash

- [ ] **Step 3: Committa BÅDA filerna**

```bash
git add docs/done/s14-5-done.md docs/sprints/status.md
git commit -m "docs: S14-5 done -- RLS-bevistest"
```
