---
title: Rollmigrering -- framsteg
description: Status för migrering av manuella auth/roll-checks till centrala helpers (requireProvider, requireCustomer, requireAuth)
category: architecture
status: in-progress
last_updated: 2026-03-28
sections:
  - Migrerade filer
  - Kvarvarande routes
  - Testjusteringar
  - Kända risker
---

# Rollmigrering -- framsteg

> Central fil: `src/lib/roles.ts` (ROLES, requireAuth, requireProvider, requireCustomer)
> Startad 2026-03-28. Typ: inkrementell, batchvis migrering.

---

## Statistik

| Mätpunkt | Antal |
|----------|-------|
| Routes med centrala helpers | ~65 anrop i route-filer |
| Kvarvarande manuella userType-checks | ~16 (i 12 filer) |
| Tester vid senaste körning | 3721 gröna, 0 regressioner |

---

## Pilot (batch 1) -- 3 routes

| Fil | Guard | Teständringar |
|-----|-------|---------------|
| `api/services/route.ts` | requireProvider | +providerId i mock, 401->403 för fel roll |
| `api/horses/route.ts` | requireAuth | Inga |
| `api/notifications/route.ts` | requireAuth | Inga |

## Batch 2 -- 12 routes (provider + customer)

### Provider-routes (8 st)

| Fil | Guard | Teständringar |
|-----|-------|---------------|
| `api/provider/subscription/status/route.ts` | requireProvider | Inga (redan korrekt) |
| `api/provider/subscription/portal/route.ts` | requireProvider | Inga |
| `api/provider/subscription/checkout/route.ts` | requireProvider | Inga |
| `api/provider/profile/route.ts` | requireProvider | 401->403 för fel roll |
| `api/provider/due-for-service/route.ts` | requireProvider | +providerId, felmeddelande-assertion |
| `api/voice-log/route.ts` | requireProvider | +providerId |
| `api/voice-log/confirm/route.ts` | requireProvider | +providerId |
| `api/customer-reviews/route.ts` | requireProvider | 401->403, +providerId-saknas test |

### Customer-routes (4 st)

| Fil | Guard | Teständringar |
|-----|-------|---------------|
| `api/follows/route.ts` | requireCustomer | Inga |
| `api/follows/[providerId]/route.ts` | requireCustomer + requireAuth (GET) | Inga |
| `api/municipality-watches/route.ts` | requireCustomer | Inga |
| `api/municipality-watches/[id]/route.ts` | requireCustomer | Inga |

## Batch 3 -- 12 routes (mekaniska/låg risk)

### Provider-routes (8 st)

| Fil | Guard | Teständringar | Notering |
|-----|-------|---------------|----------|
| `provider/customers/route.ts` | requireProvider | +providerId, 401->403 | GET+POST |
| `provider/customers/[customerId]/route.ts` | requireProvider | Felmeddelande-assertion | GET+PUT+DELETE |
| `provider/bookings/[id]/notes/route.ts` | requireProvider | +providerId | Lade till saknad Response-catch |
| `provider/bookings/[id]/quick-note/route.ts` | requireProvider | +providerId | Lade till saknad Response-catch |
| `services/[id]/route.ts` | requireProvider | +providerId, 401->403 | PUT+DELETE |
| `integrations/fortnox/disconnect/route.ts` | requireProvider | +providerId, 401->403 | Tog bort SessionUser-cast |
| `integrations/fortnox/callback/route.ts` | requireProvider | Redirect->403 JSON | OAuth callback, auth-delen ren |
| `customers/search/route.ts` | requireProvider | Standard | |
| `provider/horses/[horseId]/interval/route.ts` | requireProvider | Standard | Intern authorizeProvider() uppdaterad |

### Customer/review-routes (3 st)

| Fil | Guard | Teständringar |
|-----|-------|---------------|
| `reviews/route.ts` | requireCustomer (POST) | 401->403 |
| `reviews/[id]/route.ts` | requireCustomer (PUT+DELETE) | Inga |
| `reviews/[id]/reply/route.ts` | Behåller `resolveAuth` (dual JWT+session) | 401->403 för rollcheck |

### Upptäckter i batch 3

1. **notes/quick-note saknade Response-catch**: `provider/bookings/[id]/notes/route.ts` och `quick-note/route.ts` hade ingen `if (error instanceof Response) return error` i catch-blocket. Utan detta hade thrown Response från `requireProvider` fallit igenom till generisk 500. Agenten lade till saknad catch -- en **bugg som upptäcktes tack vare migreringen**.

2. **reply/route.ts har dual-auth**: `reviews/[id]/reply/route.ts` använder `resolveAuth` (mobiltoken + session). Ersattes inte med `requireProvider` helt, bara rollchecken standardiserades till 403.

3. **Fortnox callback ändrade beteende**: Gamla koden redirectade till `/` vid fel roll. Nya koden returnerar 403 JSON. Mer konsekvent men ändrar beteende för webbläsaranrop (som inte bör ske direkt).

---

## Batch 4 -- 7 routes (IDOR-routes, provider/customers/[customerId]/*)

| Fil | Guard | IDOR-logik (orörd) | Teständringar |
|-----|-------|--------------------|---------------|
| `[customerId]/notes/route.ts` | requireProvider | hasCustomerRelationship | Felmeddelande-assertion |
| `[customerId]/notes/[noteId]/route.ts` | requireProvider | Atomic WHERE (noteId + providerId) | Inga |
| `[customerId]/horses/route.ts` | requireProvider | hasCustomerRelationship | Felmeddelande-assertion |
| `[customerId]/horses/[horseId]/route.ts` | requireProvider | hasCustomerRelationship + horse ownership | Inga |
| `[customerId]/insights/route.ts` | requireProvider | ProviderRepo lookup | +providerId i mock |
| `[customerId]/invite/route.ts` | requireProvider | Feature flag + providerId | Inga |
| `[customerId]/merge/route.ts` | requireProvider | Feature flag + providerId | Inga |

**Ingen IDOR-logik rördes.** Alla `hasCustomerRelationship()`-anrop, atomic WHERE-klausuler och ägarkontroller är identiska.

---

## Kvarvarande routes (20 filer, ~26 manuella checks)

### Medelrisk -- IDOR-routes (7 filer, rekommenderad batch 4)

Alla har IDOR-checks via `hasCustomerRelationship()` eller ägarverifiering. Auth-delen är ren att byta, men kräver verifiering att IDOR-logiken inte påverkas.

- `provider/customers/[customerId]/horses/route.ts` -- IDOR check
- `provider/customers/[customerId]/horses/[horseId]/route.ts` -- nästlad IDOR
- `provider/customers/[customerId]/notes/route.ts` -- IDOR check
- `provider/customers/[customerId]/notes/[noteId]/route.ts` -- IDOR + ägarkontroll
- `provider/customers/[customerId]/insights/route.ts` -- IDOR + AI rate limit
- `provider/customers/[customerId]/invite/route.ts` -- feature flag + IDOR
- `provider/customers/[customerId]/merge/route.ts` -- feature flag + komplex merge

### Batch 5a -- mekaniska (5 filer, alla har tester) KLAR

Migrerade 2026-03-28. Feature flags och IDOR-checks orörda.

| Fil | Guard | Teständringar |
|-----|-------|---------------|
| `routes/my-routes/route.ts` | requireProvider | +2 nya tester (403 fel roll, 403 saknad profil) |
| `routes/[id]/route.ts` | requireProvider | +providerId i mock, +2 nya tester |
| `routes/[id]/stops/[stopId]/route.ts` | requireProvider | Felmeddelande uppdaterat |
| `route-orders/my-orders/route.ts` | requireCustomer | Felmeddelande uppdaterat |
| `route-orders/[id]/bookings/route.ts` | requireProvider | +providerId i 5 mockar |


### Batch 5b -- mixed public/private (3 filer) KLAR

Migrerade 2026-03-28. GET-handlers förblev publika (orörda). requireProvider applicerades bara i mutation-handlers.

| Fil | GET | Mutation | Teständringar |
|-----|-----|---------|---------------|
| `providers/[id]/availability-schedule/route.ts` | Publik (orörd) | PUT: requireProvider | Felmeddelande-assertion |
| `providers/[id]/availability-exceptions/route.ts` | Publik (orörd) | POST: requireProvider | +providerId i 17 mockar |
| `providers/[id]/availability-exceptions/[date]/route.ts` | Publik (orörd) | DELETE: requireProvider | +providerId i 7 mockar |

Bonus: 2 routes hade plain-text Response för fel roll -- nu konsekvent JSON (förbättring).

### Batch 5c -- övrigt medelrisk (4 filer)

| Fil | Auth-mönster | Risk | Test |
|-----|-------------|------|------|
| `route-orders/available/route.ts` | Rate limit FÖRE auth (ovanlig ordning) | Medel-hög | Ja |
| `integrations/fortnox/connect/route.ts` | requireProvider | Låg | **Nej** |
| `integrations/fortnox/sync/route.ts` | Rate limit före auth | Medel | Ja |
| `customer/due-for-service/route.ts` | requireCustomer + feature flag | Låg | **Nej** |

### Kvarvarande (12 filer) -- pausad, tas individuellt

**Medelrisk med tester (5 st):**

| Fil | Riskfaktor |
|-----|------------|
| `integrations/fortnox/sync/route.ts` | Rate limit före auth (ovanlig ordning) |
| `route-orders/available/route.ts` | Rate limit före auth |
| `customers/[id]/horses/route.ts` | Mixed auth-logik |
| `group-bookings/available/route.ts` | Blandad logik |
| `group-bookings/[id]/match/route.ts` | Provider match-logik |

**Saknar tester (2 st):**

| Fil | Riskfaktor |
|-----|------------|
| `integrations/fortnox/connect/route.ts` | Saknar testfil |
| `customer/due-for-service/route.ts` | Saknar testfil |

**Högrisk (4 st):**

| Fil | Riskfaktor |
|-----|------------|
| `route-orders/route.ts` (480 LOC) | Dual-mode kund/leverantör i samma POST |
| `bookings/manual/route.ts` | Custom rate limiter + ghost user + event dispatch |
| `bookings/[id]/reschedule/route.ts` | Customer + feature flag + IDOR + domain error mapper |
| `customer/horses/[horseId]/intervals/route.ts` | Egen `authorizeCustomer()`, saknar test |

**Delvis migrerad (1 st):**

| Fil | Riskfaktor |
|-----|------------|
| `reviews/[id]/reply/route.ts` | Dual-auth (mobiltoken + session), rollcheck standardiserad men auth ej bytt |

---

## Slutstatus -- migrering pausad 2026-03-28

### Vad som är migrerat

**47 routes** migrerade i 6 batchar (pilot + batch 2-5b):
- 14 tester uppdaterade med `providerId` i mockar
- 8 tester uppdaterade med 401->403 för fel roll
- 4 nya tester skapade
- 2 buggar hittade och fixade (saknad Response-catch i notes/quick-note)
- 1 inkonsistens standardiserad (plain-text -> JSON felrespons i availability)

Alla 3721 tester gröna efter varje batch. 0 regressioner genom hela migreringen.

### Vad som återstår

12 filer med manuella userType-checks. Dessa har alla minst ett specialfall:
- Ovanlig ordning (rate limit före auth)
- Saknade tester
- Dual-mode auth (kund + leverantör i samma handler)
- Custom auth-helpers
- Dual-auth (mobiltoken + session)

### Varför resterande inte bör tas batchvis

Batch-migrering fungerar när mönstret är förutsägbart och mekaniskt. De 47 migrerade routes följde alla samma mönster: auth-boilerplate överst, sedan IDOR/logik. De 12 kvarvarande har var sin avvikelse som kräver individuell bedömning -- att batcha dem skapar risk för att missa ett specialfall.

### Rekommenderad strategi för kvarvarande 12

1. **Skriv tester först** för `fortnox/connect` och `customer/due-for-service` (2 filer)
2. **Ta sedan medelrisk-filerna en åt gången** i samband med annat arbete i samma area
3. **Högrisk-filerna** (`route-orders/route.ts`, `bookings/manual`, `bookings/reschedule`) migreras bäst i samband med refaktorering av själva route-logiken
4. **Varje migrering = egen commit** för enkel rollback

### Har migreringen redan gett största nyttan?

**Ja.** 47 av 59 icke-native/icke-admin routes (80%) använder nu centrala helpers. De kvarvarande 12 filerna utgör en liten andel och har alla specialfall som gör dem låg-frekventa att ändra. Investeringen i ytterligare migrering ger avtagande avkastning.

Största vinsterna redan realiserade:
- `ROLES`-konstanter och typade returvärden (`ProviderUser`, `CustomerUser`)
- Konsekvent 401/403-beteende (hittas nu automatiskt vid nya routes)
- `providerId` garanterat icke-null i provider-routes
- Mönstret dokumenterat och bevisat i 6 batchar

### Högrisk -- bör tas separat (4 filer, sist)

- `route-orders/route.ts` (480 LOC) -- dual-mode kund/leverantör i samma POST
- `bookings/manual/route.ts` -- custom rate limiter + ghost user + event dispatch
- `bookings/[id]/reschedule/route.ts` -- customer + feature flag + IDOR + domain error mapper
- `customer/horses/[horseId]/intervals/route.ts` -- egen `authorizeCustomer()`, **saknar test**
- `reviews/[id]/reply/route.ts` -- dual-auth (mobiltoken + session), delvis migrerad
- `group-bookings/[id]/match/route.ts` -- provider match-logik

---

## Riskklassning av kvarvarande routes

### Mekaniska / låg risk (13 filer)

Ren auth+rollcheck utan IDOR, ägarverifiering eller blandad auth. Alla har tester.

| Fil | Guard | Notering |
|-----|-------|----------|
| `provider/customers/route.ts` | requireProvider | GET+POST, standard |
| `provider/customers/[customerId]/route.ts` | requireProvider | GET+PUT+DELETE, standard |
| `provider/bookings/[id]/notes/route.ts` | requireProvider | Standard |
| `provider/bookings/[id]/quick-note/route.ts` | requireProvider | Standard |
| `provider/horses/[horseId]/interval/route.ts` | requireProvider | Standard |
| `services/[id]/route.ts` | requireProvider | PUT, standard |
| `integrations/fortnox/disconnect/route.ts` | requireProvider | POST, standard |
| `integrations/fortnox/callback/route.ts` | requireProvider | GET, OAuth callback men auth-delen är ren |
| `reviews/route.ts` | requireCustomer (POST) | Bara POST kräver auth |
| `reviews/[id]/route.ts` | requireCustomer (PUT) | IDOR hanteras av service |
| `reviews/[id]/reply/route.ts` | requireProvider | Standard |
| `customers/search/route.ts` | requireProvider | Standard |
| `customer/due-for-service/route.ts` | requireCustomer | Feature flag + GET, **saknar test** |

### Medelrisk / kräver eftertanke (16 filer)

IDOR-checks (`hasCustomerRelationship`), feature flags, mixed public/private handlers, eller avvikande ordning.

| Fil | Guard | Riskfaktor |
|-----|-------|------------|
| `provider/customers/[customerId]/horses/route.ts` | requireProvider | IDOR via `hasCustomerRelationship()` |
| `provider/customers/[customerId]/horses/[horseId]/route.ts` | requireProvider | Nästlad IDOR: provider->kund->häst |
| `provider/customers/[customerId]/notes/route.ts` | requireProvider | IDOR-check |
| `provider/customers/[customerId]/notes/[noteId]/route.ts` | requireProvider | IDOR + ägarkontroll av anteckning |
| `provider/customers/[customerId]/insights/route.ts` | requireProvider | IDOR + AI rate limit |
| `provider/customers/[customerId]/invite/route.ts` | requireProvider | Feature flag + IDOR |
| `provider/customers/[customerId]/merge/route.ts` | requireProvider | Feature flag + komplex merge |
| `providers/[id]/availability-schedule/route.ts` | requireProvider (PUT) | GET publik, PUT provider-only |
| `providers/[id]/availability-exceptions/route.ts` | requireProvider (POST) | GET publik, POST provider-only |
| `providers/[id]/availability-exceptions/[date]/route.ts` | requireProvider | DELETE, ägarcheck |
| `routes/my-routes/route.ts` | requireProvider | Feature flag före auth (ovanlig ordning), **saknar test** |
| `routes/[id]/route.ts` | requireProvider | IDOR ownership |
| `routes/[id]/stops/[stopId]/route.ts` | requireProvider | IDOR nästlad |
| `integrations/fortnox/sync/route.ts` | requireProvider | Rate limit före auth (ovanlig ordning) |
| `integrations/fortnox/connect/route.ts` | requireProvider | **Saknar test** |
| `group-bookings/available/route.ts` | requireAuth | Blandad logik |

### Högre risk / bör tas separat (4 filer)

Komplex blandad auth, dual-mode, custom auth-helpers, eller saknade tester på känslig kod.

| Fil | Riskfaktor |
|-----|------------|
| `route-orders/route.ts` (480 LOC) | Dual-mode: kund ELLER leverantör i samma POST. Kräver noggrann granskning. |
| `bookings/manual/route.ts` | Custom rate limiter + event dispatch + ghost user creation |
| `bookings/[id]/reschedule/route.ts` | Customer-only + feature flag + IDOR + domain error mapper |
| `customer/horses/[horseId]/intervals/route.ts` | Egen `authorizeCustomer()` helper, **saknar test** |

---

## Rekommenderad batch 3

**Scope**: De 13 mekaniska/låg-risk-filerna ovan (exklusive `customer/due-for-service` som saknar test).

**Uppdelning för parallella agenter:**
- Agent A: `provider/customers/route.ts` + `[customerId]/route.ts` + `provider/bookings/[id]/notes` + `quick-note`
- Agent B: `services/[id]` + `reviews/route.ts` + `reviews/[id]` + `reviews/[id]/reply`
- Agent C: `fortnox/disconnect` + `fortnox/callback` + `customers/search` + `provider/horses/[horseId]/interval`

**Batch 4**: Medelrisk-gruppen (provider/customers/[customerId]/* med IDOR)
**Batch 5**: Availability-routes (mixed public/private)
**Sist**: De 4 högrisk-filerna, en åt gången

---

## Vanliga testjusteringar

### 1. Provider-mockar behöver providerId

```typescript
// Före:
vi.mocked(auth).mockResolvedValue({
  user: { id: 'user123', userType: 'provider' },
} as never)

// Efter:
vi.mocked(auth).mockResolvedValue({
  user: { id: 'user123', userType: 'provider', providerId: 'provider123' },
} as never)
```

### 2. Fel roll: 401 -> 403

Gamla koden returnerade ibland 401 ("Ej inloggad") för fel roll. Nya koden returnerar korrekt 403 ("Åtkomst nekad").

```typescript
// Före:
expect(response.status).toBe(401)
expect(data.error).toBe('Ej inloggad')

// Efter:
expect(response.status).toBe(403)
expect(data.error).toBe('Åtkomst nekad')
```

### 3. Customer-tester behöver sällan ändras

`requireCustomer` kräver bara `user.id` + `userType === "customer"`. De flesta customer-tester hade redan korrekt mock-format och förväntade 403 för fel roll.

---

## Kända risker och specialfall

### Mixed-auth routes (providers/[id]/availability-*)

Dessa har GET = publik (ingen auth) och POST/PUT/DELETE = provider-only. `requireProvider` ska bara användas i mutations-handlern, inte i GET.

### Route-orders/route.ts (480 LOC)

Hanterar både kundbeställningar och leverantörsannonseringar i samma fil. Kräver noggrann granskning av vilken handler som ska ha vilken guard.

### Fortnox-routes (ingen testfil)

`integrations/fortnox/connect/route.ts` saknar testfil. Migration möjlig men utan automatisk verifiering.

### reviews/route.ts (mixed roles)

POST = customer (skapa recension), GET = provider (lista recensioner). Kräver olika guards per handler.

---

## Exkluderade routes (rör ej)

| Kategori | Antal | Anledning |
|----------|-------|-----------|
| Native routes (`/api/native/*`) | ~20 | Använder `authFromMobileToken`, inte `auth()` |
| Admin routes (`/api/admin/*`) | ~12 | Använder `requireAdmin()` med DB-lookup |
| Webhook routes (`/api/webhooks/*`) | 1 | Egen signaturverifiering |
| Cron routes (`/api/cron/*`) | ~3 | CRON_SECRET verifiering |
| Test routes (`/api/test/*`) | 1 | NODE_ENV guard |
