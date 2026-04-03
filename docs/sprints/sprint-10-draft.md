---
title: "Sprint 10: RLS Slice + Demo-feedback (UTKAST)"
description: "Tunn vertikal RLS-slice pa Booking + stories baserade pa leverantorsdemo"
category: sprint
status: draft
last_updated: 2026-04-03
tags: [sprint, rls, security, demo-feedback, onboarding]
sections:
  - Sprint Overview
  - Stories
  - Sprint Retro Template
---

# Sprint 10: RLS Slice + Demo-feedback (UTKAST)

**Status:** UTKAST -- justeras efter demo-feedback
**Sprint Duration:** 1 vecka
**Sprint Goal:** Bevisa att RLS fungerar med Prisma. Agera pa demo-feedback.

---

## Sprint Overview

Tva spar: (1) RLS-spike pa Booking i staging-schema -- bevisar om Prisma + set_config + RLS
fungerar i praktiken. (2) Demo-feedback stories som laggs till efter leverantorsvisningen.

---

## Stories

### S10-1: RLS Slice -- Booking READ med Prisma + set_config -- READY

**Prioritet:** Hogst
**Typ:** Research/spike
**Beskrivning:** Tunnaste mojliga RLS-slice. EN tabell (Booking), EN operation (READ),
EN roll (provider). Testar hela kedjan i staging-schema utan att rora prod.

**Uppgifter:**

1. **Skapa staging-schema i Supabase** (bekraftat fungerar fran S9-7)
   - `CREATE SCHEMA rls_test` via Supabase SQL Editor
   - `prisma migrate deploy` med `?schema=rls_test`
   - Seed testdata (minst 2 providers med bokningar)

2. **Aktivera RLS pa Booking i rls_test-schemat**
   ```sql
   ALTER TABLE rls_test."Booking" ENABLE ROW LEVEL SECURITY;
   ALTER TABLE rls_test."Booking" FORCE ROW LEVEL SECURITY;
   
   CREATE POLICY booking_provider_read ON rls_test."Booking"
     FOR SELECT USING ("providerId" = current_setting('app.provider_id', TRUE));
   ```

3. **Testa Prisma + set_config i transaktion**
   ```typescript
   const bookings = await prisma.$transaction([
     prisma.$queryRaw`SELECT set_config('app.provider_id', ${providerId}, TRUE)`,
     prisma.booking.findMany({ where: { status: "confirmed" } })
   ])
   ```
   Verifiera: provider A ser BARA sina bokningar, inte provider B:s.

4. **Testa utan set_config** (negativ-test)
   - Query utan `set_config` ska returnera 0 rader (RLS blockerar)

5. **Testa via PgBouncer pooler-URL**
   - Samma test som steg 3 men mot pooler (port 5432)
   - Bekrafta att set_config fungerar i transaction mode

6. **Testa $queryRawUnsafe**
   - Kör providers-routens raw query mot rls_test-schemat
   - Verifiera att RLS appliceras aven pa raw queries

7. **Mata prestanda**
   - Tid for 100 queries med set_config vs utan
   - Overhead per query?

8. **Dokumentera resultat**
   - `docs/research/rls-prisma-spike.md`
   - Go/No-go for RLS med Prisma
   - Om Go: skiss pa Prisma Client Extension
   - Om No-go: rekommendation (Supabase-klient eller behall app-lager)

9. **Rensa**
   - `DROP SCHEMA rls_test CASCADE`

**Acceptanskriterier:**
- [ ] RLS-policy aktiv pa Booking i rls_test
- [ ] Prisma + set_config i transaktion testad
- [ ] Negativ-test: utan set_config returnerar 0 rader
- [ ] PgBouncer testad
- [ ] Raw query testad
- [ ] Prestanda matt
- [ ] Research-dokument med Go/No-go

**Effort:** 1-2 dagar
**Tidbox:** Max 2 sessioner
**Stationsflode:** Forenklat: Plan -> Research -> Dokumentera -> Review

---

### S10-2: Verifierings-felmeddelande (fran S9-9, om ej klar) -- READY

**Prioritet:** Hög
**Typ:** Buggfix
**Beskrivning:** Overifierad email ger "Ogiltig email eller lösenord" istället för
"Din e-post är inte verifierad". Flyttad från sprint 9 om ej slutförd.

**Effort:** 1-2h

---

### S10-3: Tom-tillstand vagledning (fran S9-10, om ej klar) -- READY

**Prioritet:** Medel
**Typ:** UX
**Beskrivning:** Tomma listor utan forklaring. Lagg till hjalpttexter.

**Effort:** 0.5 dag

---

### S10-4: customer_insights AI-spike (fran S9-4) -- READY

**Prioritet:** Medel
**Typ:** Research/spike
**Beskrivning:** Samma monster som voice logging spike -- fungerar AI-kopplingen?

**Effort:** 1 dag

---

### S10-N: Demo-feedback stories -- TBD

> Laggs till efter leverantorsdemon. Kandidater fran sprint-5.md:
>
> | Feedback | Story | Effort |
> |----------|-------|--------|
> | "Kundernas upplevelse" | Kundflode-polish | 1 vecka |
> | "Rutten for dagen" | Ruttplanering (Mapbox) | 2 veckor |
> | "Koppla Fortnox" | Fortnox-integration | 2-3 veckor |
> | "Testa med riktiga kunder" | Onboarding utan seed | 1 vecka |

---

## Prioritetsordning

1. **S10-1** RLS spike (1-2 dagar, arkitekturbeslut)
2. **S10-2** Verifierings-felmeddelande (1-2h, buggfix)
3. **S10-3** Tom-tillstand vagledning (0.5 dag, UX)
4. **S10-4** customer_insights spike (1 dag)
5. **S10-N** Demo-feedback (TBD)

---

## Sprint Retro Template

### Vad gick bra?

### Vad kan forbattras?

### Processandring till nasta sprint?

> Varje sprint MASTE resultera i minst en processforrbattring.

### RLS-beslut: Go eller No-go?

### Demo-feedback som paverkade sprinten?
