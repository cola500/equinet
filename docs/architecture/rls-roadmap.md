---
title: "RLS-arkitektur -- Beslut och status"
description: "Arkitekturbeslut: Prisma + repository som primaer dataatkomst, RLS som defense-in-depth"
category: architecture
status: active
last_updated: 2026-04-11
tags: [security, rls, supabase, prisma, architecture]
sections:
  - Sammanfattning
  - Bakgrund
  - Vad vi byggde
  - Arkitekturbeslut
  - Hur det fungerar idag
  - Vad vi inte gor
  - Kvarvarande arbete
---

# RLS-arkitektur -- Beslut och status

## Sammanfattning

Equinet anvander **tva lager av dataatkomstskydd** som arbetar tillsammans:

1. **Prisma + repository-monster** (primart): Alla API routes gar via repositories med
   `WHERE providerId = ...` / `WHERE customerId = ...`. Detta ar det aktiva skyddet
   som kontrollerar atkomst i 97% av routes.

2. **Supabase RLS-policies** (defense-in-depth): 28 policies pa 7 karndomaner.
   Om en route-bug missar en ownership-check, fangar RLS det pa databasniva.
   Inga rader lackar aven om applikationskoden har en bugg.

**Beslut (2026-04-11):** Vi migrerar INTE fler routes till Supabase-klient.
Prisma + repository forblir primar dataatkomst. RLS ar sakerhetsnatet.

---

## Bakgrund

### Problemet vi ville losa

Nar flera leverantorer delar samma databas maste varje leverantor bara se sin egen data.
Utan skydd kan en bugg i en API route lata leverantor A se leverantor B:s bokningar.

### Tva vagar utvarderades

| | Vag A: Prisma + set_config | Vag B: Supabase Auth + RLS |
|---|---|---|
| **Hur** | `set_config('app.provider_id', ...)` per transaktion | JWT claims + automatisk RLS-filtrering |
| **Fordel** | Snabbt att implementera | Unified auth, mindre egen kod |
| **Nackdel** | Tva auth-system kvar | Kraver auth-migrering (3-5 sprints) |

**Vi valde Vag B** -- losa auth OCH RLS i en migrering. Arbetet gjordes i sprint 10-14.

### Kronologi

| Sprint | Vad |
|--------|-----|
| S7 | RLS-spike: teknisk analys av alternativ |
| S9-7 | Schema-isolation bekraftad (testmiljo for RLS) |
| S10-1 | Supabase Auth PoC: hela kedjan bevisad |
| S10-5 | GO-beslut for Supabase Auth |
| S11 | Dual-auth helper, anvandarmigering, sync-trigger |
| S12 | Route-migrering till `getAuthUser()`, Supabase login |
| S13 | NextAuth borttagen, iOS Swift SDK, passwordHash borttagen |
| S14 | RLS-policies aktiverade, bevistester, 3 routes migrerade till Supabase-klient |

---

## Vad vi byggde

### Supabase Auth (klart, S10-S13)

- Alla anvandare autentiseras via Supabase Auth
- Custom Access Token Hook (PL/pgSQL) lagger `providerId`, `userType`, `isAdmin` i JWT
- iOS-appen anvandar Supabase Swift SDK
- NextAuth ar helt borttagen

### RLS-policies (klart, S14)

**28 policies pa 7 karndomaner:**

| Tabell | READ-policies | WRITE-policies |
|--------|--------------|----------------|
| Booking | Provider (egna), Customer (egna) | Provider CRUD, Customer create/update |
| Payment | Provider (via booking JOIN), Customer (via booking JOIN) | Provider create |
| Service | Provider (egna), Public (aktiva) | Provider CRUD |
| Horse | Owner, Provider (via ProviderCustomer) | Owner CRUD |
| CustomerReview | Provider (mottagna), Customer (skrivna) | Customer create |
| Notification | User (egna) | System |
| BookingSeries | Provider (egna), Customer (egna) | Provider/Customer CRUD |

**Hjalpfunktioner i databasen:**
- `rls_provider_id()` -- extraherar providerId fran JWT `app_metadata`
- `rls_user_id()` -- extraherar userId fran JWT
- `rls_is_admin()` -- kollar admin-status i JWT

**24 bevistester** i `src/__tests__/rls/rls-proof.integration.test.ts` verifierar
cross-tenant isolation mot live Supabase. Testerna kor med riktiga anvandare
(signInWithPassword) och bekraftar att RLS blockerar atkomst till andras data.

### Migrerade routes (3 st)

Dessa GET-routes anvandar Supabase-klient istallet for Prisma, och far RLS-filtrering automatiskt:

- `GET /api/bookings` (provider-path)
- `GET /api/services`
- `GET /api/notifications`

---

## Arkitekturbeslut (2026-04-11)

### Beslut

**Prisma + repository-monster forblir primar dataatkomst. RLS ar defense-in-depth.**

Vi migrerar INTE fler routes fran Prisma till Supabase-klient.

### Motivering

**1. Repository-monstret fungerar och ar val-testat**

Alla karndomaner (Booking, Provider, Service, Horse, CustomerReview, Follow, Subscription)
anvandar repository pattern med ownership i WHERE-clauser. Detta ar bevisat genom
~3900 enhetstester och 24 RLS-bevistester.

```typescript
// Exempel: BookingRepository
findByIdForProvider(id: string, providerId: string) {
  return prisma.booking.findFirst({
    where: { id, providerId }  // Atomisk ownership-check
  })
}
```

**2. PostgREST (Supabase-klient) har begransningar**

| Feature | Prisma | Supabase-klient (PostgREST) |
|---------|--------|-----------------------------|
| groupBy / aggregering | Ja | Nej |
| Komplexa relationer | Ja (include/select) | Begransat (FK-hints) |
| Transaktioner | `$transaction` | Nej (kraver RPC) |
| TypeScript-typer | Genererade fran schema | Manuella eller genererade |
| Migreringsstod | prisma migrate | Separat verktyg |

Exempel: `/api/provider/customers` anvandar `groupBy` for att aggregera bokningsdata
per kund. Detta gar inte med PostgREST -- darav stannade den pa Prisma i S14.

**3. Migrering av 106 routes ger mer risk an varde**

- 3-5 sprints av mekaniskt arbete
- Tva data-access-monster under hela migreringsperioden (mer komplexitet)
- Risk for regressioner i fungerande routes
- Sakerhetsvinstern ar marginal -- RLS fangar redan buggar som defense-in-depth

**4. Defense-in-depth ar uppnatt**

Det var alltid malet. Sakerhetsarkitekturen har nu 4 lager:

```
Lager 1: Rate limiting (forhindra brute force)
Lager 2: Auth + session (getAuthUser, JWT-validering)
Lager 3: Repository ownership (WHERE providerId = ...)
Lager 4: RLS-policies (databasniva, fangar buggar i lager 3)
```

Om en route-bug missar ownership-checken i lager 3, blockerar RLS i lager 4.
Det ar precis vad defense-in-depth betyder.

### Vad detta innebar i praktiken

- **Nya routes**: Anvandar Prisma + repository med ownership-guard (som idag)
- **RLS-policies**: Behalls och underhalls -- de ar sakerhetsnatet
- **De 3 migrerade routes**: Behalls pa Supabase-klient (fungerar, ingen anledning att revertera)
- **Bevistester**: Behalls och utvidgas vid behov
- **Nya karndomaner**: Far RLS-policy nar de skapas

---

## Hur det fungerar idag

### Dataflode (typisk API request)

```
Klient (webb/iOS)
    |
    v
API Route (/api/bookings)
    |
    +-- getAuthUser(request)        [Lager 2: Auth]
    |       |
    |       +-- JWT-validering (Supabase Auth)
    |       +-- providerId fran app_metadata
    |
    +-- rateLimiters.api(ip)        [Lager 1: Rate limit]
    |
    +-- BookingRepository           [Lager 3: Ownership]
    |       |
    |       +-- prisma.booking.findMany({
    |       |     where: { providerId }    <-- Ownership i WHERE
    |       |     select: { ... }          <-- Bara nodvandiga falt
    |       |   })
    |       |
    |       +-- Prisma (service_role) -> PostgreSQL
    |                                      |
    |                                      +-- RLS-policy [Lager 4]
    |                                           (redundant har, men
    |                                            fangar buggar)
    v
Response (filtrerad data)
```

### Nar RLS faktiskt skyddar

RLS ar inte redundant -- det skyddar i dessa scenarion:

1. **Bugg i repository**: Om nagon skriver `prisma.booking.findMany({})` utan WHERE
   -- RLS blockerar atkomst till andras data (via `service_role` kringgars RLS dock,
   sa detta galler bara Supabase-klient-queries)

2. **Supabase Dashboard / PostgREST**: Om nagon gor en direkt query via Supabase
   Dashboard med en user JWT -- RLS filtrerar automatiskt

3. **De 3 migrerade routes**: Bookings, Services, Notifications gar via Supabase-klient
   och far full RLS-filtrering

4. **Framtida Supabase Realtime**: Om vi lagger till live-uppdateringar via WebSocket
   filterar RLS automatiskt vilka rader som broadcastas

### Viktig begransning

Prisma anvandar `service_role` som kringgar RLS. Det betyder att RLS-skyddet INTE
ar aktivt for de ~106 routes som anvandar Prisma direkt. For dessa routes ar
repository-monstret (lager 3) det enda aktiva skyddet.

Detta ar ett medvetet beslut -- repository-monstret ar val-testat och vi har
code review-hooks som varnar om ownership saknas i nya routes.

---

## Vad vi inte gor

### Fas 3-4 fran ursprunglig roadmap (STRUKEN)

Den ursprungliga planen hade:
- **Fas 3**: Opportunistisk migrering av fler repositories till Supabase-klient
- **Fas 4**: Ta bort Prisma helt, alla queries via Supabase-klient

Dessa faser ar **strukna**. Motivering: se [Arkitekturbeslut](#arkitekturbeslut-2026-04-11).

### Migrera resterande routes

De ~106 routes som anvandar Prisma stannar pa Prisma. Ingen migrering planerad.

---

## Kvarvarande arbete

### Dokumentation (lag prioritet)

- [ ] Uppdatera `docs/architecture/database.md` sakerhetslager-sektion (refererar `auth()`)
- [ ] Markera gammal RLS-research som arkiverad

### Underhall (lopande)

- [ ] Nya karndomaner far RLS-policy vid skapande
- [ ] RLS-bevistester utvidgas om nya tabeller laggs till
- [ ] Code review-hooks (`post-api-route-verify.sh`) haller koll pa ownership-guards

### Inte langre aktuellt

- ~~Slice 7: cleanup (ta bort v1-routes)~~ -- inga v1/v2-routes existerar
- ~~Markera PrismaBookingRepository som @deprecated~~ -- den ar fortfarande primar
- ~~Ta bort feature flags for RLS~~ -- inga RLS-specifika flaggor anvands
