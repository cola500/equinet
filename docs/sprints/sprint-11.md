---
title: "Sprint 11: Supabase Auth Fas 1 -- Parallell drift"
description: "Första stegen mot Supabase Auth: helper-funktion, användarmigrering, första route-migrering"
category: sprint
status: active
last_updated: 2026-04-03
tags: [sprint, auth, supabase, migration, rls]
sections:
  - Sprint Overview
  - Arkitekturbeslut
  - Stories
  - Sprint Retro Template
---

# Sprint 11: Supabase Auth Fas 1 -- Parallell drift

**Sprint Duration:** 1 vecka
**Sprint Goal:** Bygga grunden för parallell drift: dual-auth helper, migrera befintliga användare till Supabase Auth, migrera första route.

---

## Sprint Overview

S10-5 bekräftade GO för Supabase Auth. Sprint 11 börjar den faktiska migreringen
i tunna slices. NextAuth behålls intakt -- nya routes använder Supabase Auth,
gamla fortsätter som innan. Inga användare märker skillnad.

**Principer:**
- Parallell drift: båda auth-systemen aktiva
- Feature flag `supabase_auth_poc` styr vilka routes som använder Supabase Auth
- Inga breaking changes -- befintlig funktionalitet oförändrad
- Varje slice kan pausas eller reverteras

---

## Arkitekturbeslut (från S10-1 + S10-5)

| Beslut | Motivering |
|--------|-----------|
| Väg B: Supabase Auth + RLS | Löser auth OCH RLS. Eliminerar dual auth. |
| Prisma + set_config (Väg A) parkerad | Supabase-pooler blockerar SET ROLE |
| Parallell drift under migrering | NextAuth kvar tills alla routes migrerade |
| RLS utan FORCE | service_role (Prisma) kringgår RLS -- befintliga routes oförändrade |

---

## Stories

### S11-1: Dual-auth helper -- READY

**Prioritet:** Högst (grund för allt annat)
**Typ:** Infrastruktur
**Beskrivning:** Skapa en helper-funktion som stödjer båda auth-systemen. Routes kan
gradvis migrera från NextAuth till Supabase Auth utan att bryta befintlig funktionalitet.

**Uppgifter:**

1. Skapa `src/lib/auth-dual.ts`:
   - `getAuthUser(request)` -- försöker Supabase Auth först, faller tillbaka till NextAuth
   - Returnerar normaliserad `AuthUser { id, email, userType, providerId, isAdmin }`
   - Feature flag styr vilken som försöks först

2. Tester (BDD dual-loop):
   - Supabase Auth-user returneras korrekt
   - NextAuth-user returneras som fallback
   - Inget auth -> null
   - Feature flag av -> bara NextAuth

**Acceptanskriterier:**
- [ ] `getAuthUser()` fungerar med båda auth-systemen
- [ ] Tester med mockad Supabase + NextAuth
- [ ] Befintliga routes oförändrade

**Effort:** 0.5-1 dag
**Stationsflöde:** Plan -> Red -> Green -> Review -> Verify -> Merge

---

### S11-2: Migrera befintliga användare till auth.users -- READY

**Prioritet:** Hög
**Typ:** Data-migrering
**Beskrivning:** Kopiera befintliga användare från `public.User` till `auth.users`
med matchande UUID. Lösenords-hashar (bcrypt) kopieras direkt.

**Uppgifter:**

1. Skriv migreringsscript (`scripts/migrate-users-to-supabase-auth.ts`):
   - Läs alla användare från `public.User` (exkludera ghost users)
   - Infoga i `auth.users` med samma UUID, email, bcrypt-hash
   - Sätt `raw_user_meta_data` med firstName, lastName, userType
   - Skip redan migrerade (idempotent)

2. Testa mot staging-schema först
3. Kör mot nytt Supabase-projekt (`zzdamokfeenencuggjjp`)
4. Verifiera: befintlig användare kan logga in via Supabase Auth med samma lösenord

**Acceptanskriterier:**
- [ ] Alla icke-ghost användare migrerade
- [ ] UUID matchar mellan auth.users och public.User
- [ ] Login fungerar med befintligt lösenord
- [ ] Custom claims (providerId) korrekt i JWT

**Effort:** 0.5-1 dag
**Stationsflöde:** Plan -> Green -> Verify -> Merge

---

### S11-3: Sync-trigger auth.users -> public.User -- READY

**Prioritet:** Hög
**Typ:** Infrastruktur
**Beskrivning:** PL/pgSQL-trigger som skapar en `public.User`-rad automatiskt
när en ny användare registrerar sig via Supabase Auth.

**Uppgifter:**

1. Prisma-migration med `handle_new_user()` trigger (från auth-spike)
2. Testa: registrera ny användare via Supabase Auth -> public.User skapas
3. Felhantering: vad händer om triggern failar?

**Acceptanskriterier:**
- [ ] Ny Supabase Auth-registrering skapar public.User
- [ ] UUID matchar
- [ ] userType, firstName, lastName synkas
- [ ] Trigger-fel ger tydligt felmeddelande

**Effort:** 0.5 dag
**Stationsflöde:** Plan -> Red -> Green -> Review -> Verify -> Merge

---

### S11-4: Migrera EN route till Supabase Auth -- READY

**Prioritet:** Medel
**Typ:** Feature
**Beskrivning:** Migrera en enkel, lågrisks route från `auth()` till `getAuthUser()`.
Bevisar att dual-auth-helpern fungerar i praktiken.

**Kandidater (välj en):**
- `/api/provider/onboarding-status` -- enkel GET, ingen write
- `/api/feature-flags` -- enkel GET, publik data
- `/api/notifications/unread-count` -- enkel GET

**Uppgifter:**

1. Byt `auth()` till `getAuthUser()` i vald route
2. Uppdatera tester
3. Verifiera: route fungerar med båda auth-systemen
4. Feature flag: Supabase Auth används bara om `supabase_auth_poc` är på

**Acceptanskriterier:**
- [ ] Route fungerar med NextAuth (flagga av)
- [ ] Route fungerar med Supabase Auth (flagga på)
- [ ] Befintliga tester gröna

**Effort:** 2-4h
**Stationsflöde:** Plan -> Red -> Green -> Review -> Verify -> Merge

---

### S11-5: Supabase Auth login-sida (parallell) -- BACKLOG

**Prioritet:** Låg (backlog)
**Typ:** UI
**Beskrivning:** Ny login-komponent som använder Supabase Auth `signInWithPassword`.
Visas bakom feature flag. Befintlig NextAuth login oförändrad.

**Effort:** 1 dag
**Trigger:** Efter S11-1-4 bekräftat att dual-auth fungerar

---

## Prioritetsordning

1. **S11-1** Dual-auth helper (grund)
2. **S11-2** Migrera användare (data)
3. **S11-3** Sync-trigger (infra)
4. **S11-4** Migrera en route (bevis)
5. **S11-5** Login-sida (backlog)

---

## Sprint Retro Template

### Vad gick bra?

### Vad kan förbättras?

### Processändring till nästa sprint?

> Varje sprint MÅSTE resultera i minst en processförbättring.

### Auth-migrering: hur känns den?
