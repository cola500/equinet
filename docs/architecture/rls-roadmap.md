---
title: "RLS Roadmap -- Gradvis migrering till Row Level Security"
description: "Arkitekturbeslut och migreringsplan för Supabase RLS med tunn vertikal slice som MVP"
category: architecture
status: active
last_updated: 2026-04-01
tags: [security, rls, supabase, prisma, architecture, roadmap]
sections:
  - Beslut
  - Fas 1 Nu
  - Fas 2 MVP Vertikal slice
  - Fas 3 Opportunistisk migrering
  - Fas 4 Full migrering
---

# RLS Roadmap

## Beslut (2026-04-01)

**Mål:** Alla kärndomäner skyddade med databas-nivå RLS innan vi skalar till flera leverantörer.

**Strategi:** Gradvis. Inte big-bang-omskrivning. Tunn vertikal slice som MVP, sedan opportunistisk migrering.

**Research:** Se `docs/research/rls-spike.md` för teknisk analys.

---

## Fas 1: Stärk app-lagret (Alt 3) -- NU

Minimal insats, omedelbara förbättringar. Kan vara en story i sprint 7.

- [ ] `findById()` -> `findByIdForProvider(id, providerId)` + `findByIdForCustomer(id, customerId)` i BookingRepository
- [ ] Samma mönster i övriga kärndomäner (Review, Horse, Service)
- [ ] ESLint-regel: varna vid `prisma.booking.find*` utanför `src/infrastructure/`
- [ ] Code review-checklista: "Ny query? Ownership i WHERE?"

**Effort:** 0.5-1 dag

---

## Fas 2: MVP -- Tunn vertikal slice med Supabase-klient + RLS

EN tabell (Booking), EN roll (provider), hela kedjan: RLS-policy -> Supabase-klient -> API route -> test.

### Scope

- Booking-tabellen får RLS-policies (provider + customer + admin)
- EN ny API-route (`/api/v2/bookings`) använder Supabase-klient istället för Prisma
- Befintliga `/api/bookings` routes oförändrade (Prisma, fungerar som innan)
- Feature flag `rls_v2_bookings` styr vilken route som används

### Steg

1. Aktivera RLS på Booking-tabellen i Supabase
2. Skapa policies (provider ser sina, kund ser sina, admin ser alla)
3. Installera `@supabase/supabase-js` (redan i package.json)
4. Skapa `src/infrastructure/supabase/SupabaseBookingRepository.ts`
5. Skapa `/api/v2/bookings/route.ts` som använder Supabase-klienten
6. Verifiera: provider kan INTE se andras bokningar även utan WHERE
7. Tester: integrationstester mot lokal Supabase

### Vad vi lär oss

- Fungerar Supabase-klient + RLS i vår serverless-miljö?
- Hur hanterar vi admin/cron utan JWT?
- Prestanda-skillnad?
- Hur svårt är det att migrera EN repository?

**Effort:** 2-3 dagar
**Trigger:** Innan vi onboardar leverantör #2

---

## Fas 3: Opportunistisk migrering

När vi rör en repository för produktarbete -- migrera den till Supabase-klient + RLS.

Prioritetsordning baserad på säkerhetsrisk:

| Prio | Tabell | Varför |
|------|--------|--------|
| 1 | Booking | Känsligast -- betalning, kunddata |
| 2 | Payment | Finansiell data |
| 3 | CustomerReview | Kopplad till leverantörs rykte |
| 4 | Horse | Kunddata med hälsohistorik |
| 5 | Provider | Företagsdata |
| 6 | Service | Prissättning |
| 7 | Övriga | Vid behov |

**Regel:** Ny feature som rör en kärndomän -> migrera den domänens repository till Supabase + RLS.

---

## Fas 4: Full migrering (om det motiveras)

Ta bort Prisma helt, alla queries via Supabase-klient. Beslut fattas efter fas 2-3 baserat på erfarenhet.

Kräver:
- Alla kärndomäner migrerade
- Migreringsverktyg (Prisma migrate -> Supabase migrations)
- Alla tester omskrivna

**Effort:** 2-4 veckor
**Trigger:** Om fas 2-3 visar att Supabase-klient är klart bättre

---

## Schema-isolation ("slot machine") -- bekräftat 2026-04-02

> Se `docs/research/schema-isolation-spike.md` för fullständiga spike-resultat.

Spike S9-7 bekräftade att PostgreSQL schemas inom samma Supabase-databas ger
fullständig miljöisolering. Relevant för RLS-migreringen:

- **Testmiljö för RLS:** Skapa `rls_test`-schema, aktivera RLS där, testa utan att röra prod
- **Parallell körning:** Prisma kan köra mot `?schema=rls_test` medan `public` är oförändrat
- **Slot machine:** `CREATE SCHEMA X` + `prisma migrate deploy ?schema=X` ger ny miljö på sekunder
- **PgBouncer fungerar:** `search_path` propagerar korrekt i transaction mode (testat mot Supabase)

Detta förenklar fas 2 avsevärt -- RLS-policies kan testas i isolerat schema
innan de appliceras på `public`.

---

## Supabase Auth -- ändrar RLS-kalkylen (2026-04-03)

> Se `docs/research/supabase-auth-spike.md` för fullständig analys.

Supabase Auth-spike visar att auth-migrering och RLS-migrering hänger ihop.
Två vägar framåt:

### Väg A: Prisma + set_config (nuvarande plan)

```
Prisma query → $transaction → set_config('app.provider_id', ...) → RLS filtrerar
```

- Kräver Client Extension-wrapper
- Fungerar med befintlig NextAuth
- `set_config()` per transaktion -- overhead ~2-5ms
- Testad i S10-1 spike

### Väg B: Supabase Auth + Supabase-klient + RLS (nytt alternativ)

```
Supabase-klient med user JWT → RLS använder auth.jwt()->>'providerId' → automatisk filtrering
```

- Kräver auth-migrering (NextAuth → Supabase Auth, 3-5 sprints)
- RLS fungerar automatiskt via JWT claims -- ingen set_config behövs
- Unified auth (webb + iOS), eliminerar dual auth-systemet
- Mindre egen kod (~2000 LOC → ~300 LOC)

### Rekommendation

**Väg B är bättre långsiktigt.** Löser auth OCH RLS i en migrering.
Men väg A ger RLS snabbare (1-2 dagar vs 3-5 sprints).

**Beslut:** Kör S10-1 spike (väg A) för att bevisa att set_config fungerar.
Parallellt: starta Supabase Auth PoC (fas 0 från auth-spike).
Fatta slutgiltigt beslut efter båda spikes.

### Tunna slices oavsett väg

| Slice | Väg A (Prisma) | Väg B (Supabase Auth) |
|-------|---------------|----------------------|
| 1 | set_config infra | Auth PoC + custom claims hook |
| 2 | Booking READ | Booking READ via Supabase-klient |
| 3 | Booking WRITE | Booking WRITE via Supabase-klient |
| 4+ | Fler tabeller | Fler tabeller + migrera routes |

---

## Öppna frågor

- ~~Hur hanterar vi Prisma migrate parallellt med RLS-policies?~~ LÖST: schema-isolation
- ~~Behöver vi service-role-nyckel för admin/cron?~~ JA för väg A. Nej för väg B (service_role bypasses RLS, admin-routes fortsätter via Prisma)
- ~~Kan vi köra Prisma och Supabase-klient mot samma tabell under migreringen?~~ LÖST: separata schemas
- **NY:** Vilken väg väljer vi? Beslut efter S10-1 + Supabase Auth PoC
