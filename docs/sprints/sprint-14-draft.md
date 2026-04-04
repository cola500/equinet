---
title: "Sprint 14: RLS Live -- Policies + Supabase-klient reads (UTKAST)"
description: "Aktivera RLS på alla kärndomäner, byt till Supabase-klient för reads"
category: sprint
status: draft
last_updated: 2026-04-03
tags: [sprint, rls, supabase, security, database]
sections:
  - Sprint Overview
  - Förutsättningar
  - Stories
  - Sprint Retro Template
---

# Sprint 14: RLS Live (UTKAST)

**Status:** UTKAST -- aktiveras efter sprint 13 (NextAuth borta)
**Sprint Duration:** 1 vecka
**Sprint Goal:** Database-nivå säkerhet. Provider ser bara sin egen data, automatiskt.

---

## Sprint Overview

Sprint 13 tar bort NextAuth. Alla användare autenticeras via Supabase Auth.
Sprint 14 aktiverar RLS på kärndomäner -- den sista pusselbiten.

**Före sprint 14:** App-lagret skyddar data (ownership checks i routes/repositories).
**Efter sprint 14:** Databasen skyddar data (RLS policies). App-lagret är defense-in-depth.

**Approach:** Policies skapas per tabell via Prisma-migrationer. Reads byter
gradvis från Prisma (service_role, kringgår RLS) till Supabase-klient (user JWT, RLS aktiv).
Writes behålls via Prisma (service_role) tills vidare.

---

## Förutsättningar

- [ ] Sprint 13 klar (NextAuth borta, alla routes via Supabase Auth)
- [ ] Custom Access Token Hook aktiv med providerId/customerId i JWT
- [ ] Alla användare migrerade till auth.users (S11-2)

---

## Stories

### S14-0: iOS-verifiering av Supabase Auth -- READY

**Prioritet:** Högst (blockerar resten av sprinten)
**Typ:** Verifiering
**Tagg:** ios
**Beskrivning:** Sprint 13 verifierade webben (12 sidor via Playwright MCP) men iOS
kunde inte verifieras automatiskt. Kräver Xcode-build mot Supabase-projektet.

**Uppgifter:**
1. Bygga iOS-appen mot Supabase-projektet (`zzdamokfeenencuggjjp`)
2. Verifiera i simulator:
   - Login via Supabase Swift SDK
   - Dashboard med data
   - Navigation: alla tabs
   - WebView-sidor: autentiserade (cookies via session-exchange)
   - Native skärmar: annonsering, insikter
   - Logout + re-login
3. Fixa eventuella buggar som upptäcks

**Effort:** 0.5-1 dag
**Stationsflöde:** Red (testplan) -> Green (fixa buggar) -> Review -> Verify -> Merge

---

### S14-1: RLS-policies på kärndomäner -- READY

**Prioritet:** Högst
**Typ:** Säkerhet
**Beskrivning:** Skapa READ-policies på alla kärndomäners tabeller.
Prisma-migration med SQL.

**Tabeller och policies:**

| Tabell | Policy | Villkor |
|--------|--------|---------|
| Booking | Provider ser sina | `"providerId" = auth.jwt()->'app_metadata'->>'providerId'` |
| Booking | Kund ser sina | `"customerId" = auth.uid()` |
| Payment | Via booking-relation | JOIN Booking för provider/kund |
| Service | Provider ser sina | `"providerId" = auth.jwt()->'app_metadata'->>'providerId'` |
| Horse | Via ProviderCustomer-relation | Provider som har kunden |
| CustomerReview | Provider ser sina | `"providerId" = auth.jwt()->'app_metadata'->>'providerId'` |
| Notification | Användare ser sina | `"userId" = auth.uid()` |

**OBS:** Ingen `FORCE ROW LEVEL SECURITY` -- service_role (Prisma) kringgår
RLS och hanterar admin/cron/writes.

**Effort:** 1 dag
**Stationsflöde:** Plan -> Red -> Green -> Review -> Verify -> Merge

---

### S14-2: Supabase-klient för Booking reads -- READY

**Prioritet:** Hög
**Typ:** Feature
**Beskrivning:** Tunn vertikal slice: EN route byter från Prisma till
Supabase-klient för reads. Bevisar att RLS filtrerar automatiskt.

**Kandidat:** `GET /api/bookings` -- listar leverantörens bokningar.

**Mönster:**
```typescript
// Före (Prisma, service_role, kringgår RLS):
const bookings = await prisma.booking.findMany({
  where: { providerId: authUser.providerId }
})

// Efter (Supabase-klient, user JWT, RLS filtrerar):
const supabase = await createSupabaseServerClient()
const { data: bookings } = await supabase
  .from('Booking')
  .select('id, status, bookingDate, ...')
```

WHERE-villkoret försvinner -- RLS hanterar det.

**Effort:** 0.5-1 dag
**Stationsflöde:** Plan -> Red -> Green -> Review -> Verify -> Merge

---

### S14-3: Supabase-klient för fler reads (batch) -- READY

**Prioritet:** Medel
**Typ:** Feature
**Beskrivning:** Migrera fler read-routes till Supabase-klient efter att
S14-2 bevisat mönstret.

**Kandidater:**
- `GET /api/services` -- leverantörens tjänster
- `GET /api/provider/customers` -- leverantörens kunder
- `GET /api/notifications` -- användarens notiser

**Effort:** 1-2 dagar

---

### S14-4: WRITE-policies (om tid) -- BACKLOG

**Prioritet:** Låg
**Typ:** Säkerhet
**Beskrivning:** INSERT/UPDATE/DELETE policies. Writes körs fortfarande
via Prisma (service_role) så detta är extra defense-in-depth.

**Effort:** 1 dag

---

### S14-5: RLS-bevistest -- READY

**Prioritet:** Hög
**Typ:** Test
**Beskrivning:** Integrationstester som bevisar att RLS faktiskt blockerar.

**Tester:**
1. Provider A kan INTE se Provider B:s bokningar via Supabase-klient
2. Anon-användare ser ingenting
3. Admin (via service_role/Prisma) ser allt
4. Ny bokning synlig direkt efter skapande (RLS + insert)

**Effort:** 0.5 dag

---

### S14-6: Fixa E2E i CI -- lokal Supabase Auth -- READY

**Prioritet:** Hög
**Typ:** Infrastruktur
**Beskrivning:** Alla 19 E2E-tester som kräver login failar i CI sedan S13
(NextAuth -> Supabase Auth). CI har ingen Supabase-instans -- login når aldrig
dashboard.

**Rotorsak:** `signInWithPassword` kräver GoTrue (Supabase Auth), men CI kör
bara lokal PostgreSQL med dummy Supabase env-vars.

**Approach:** Lägg till `supabase start` i GitHub Actions E2E-jobb. Ger lokal
GoTrue + PostgREST. E2E-testerna kör mot riktig auth-instans.

**Uppgifter:**
1. Lägg till Supabase CLI + `supabase start` i E2E-steget i `quality-gates.yml`
2. Sätt `NEXT_PUBLIC_SUPABASE_URL` och `SUPABASE_SERVICE_ROLE_KEY` till lokala värden
3. Seeda auth.users i CI (migreringsscript eller SQL)
4. Verifiera: alla 19 failande tester passerar

**Effort:** 0.5-1 dag

---

## Prioritetsordning

0. **S14-0** iOS-verifiering av Supabase Auth (blockerare)
1. **S14-1** Policies (grund)
2. **S14-5** Bevistest (verifierar policies)
3. **S14-6** Fixa E2E i CI (19 failande tester)
4. **S14-2** Booking reads via Supabase (tunn slice)
5. **S14-3** Fler reads (batch)
6. **S14-4** Write-policies (backlog)

---

## Sprint Retro Template

### Vad gick bra?

### Vad kan förbättras?

### RLS komplett? Vad återstår?

### Hur mycket app-kod kunde vi ta bort tack vare RLS?
