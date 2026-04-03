---
title: "Sprint 12: Supabase Auth Fas 2 -- Route-migrering"
description: "Migrera API routes från auth() till getAuthUser(), Supabase login-sida"
category: sprint
status: active
last_updated: 2026-04-03
tags: [sprint, auth, supabase, migration]
sections:
  - Sprint Overview
  - Stories
  - Sprint Retro Template
---

# Sprint 12: Supabase Auth Fas 2 -- Route-migrering

**Sprint Duration:** 1 vecka
**Sprint Goal:** Migrera kärnroutes till dual-auth. Skapa Supabase login-sida.

---

## Sprint Overview

Sprint 11 bevisade att dual-auth fungerar (S11-4: onboarding-status migrerad).
Sprint 12 migrerar fler routes i batchar och skapar login-sidan.

**Mönstret per route:** `auth()` -> `getAuthUser(request)`, `session.user.id` -> `authUser.id`.
Bevisat i S11-4, mekanisk migrering härifrån.

---

## Stories

### S12-1: Supabase Auth login-sida -- READY

**Prioritet:** Högst
**Typ:** Feature
**Beskrivning:** Ny login-komponent som använder `signInWithPassword` via Supabase Auth.
Bakom feature flag `supabase_auth_poc`. Befintlig NextAuth login oförändrad.

**Uppgifter:**
1. Skapa `/app/(auth)/supabase-login/page.tsx` med Supabase `signInWithPassword`
2. Feature flag gate -- flagga av = redirect till `/login`
3. Success -> redirect till dashboard
4. Felhantering: overifierad email, fel lösenord, blockerat konto
5. Tester

**Effort:** 1 dag
**Stationsflöde:** Plan -> Red -> Green -> Review -> Verify -> Merge

---

### S12-2: Migrera booking routes (batch) -- READY

**Prioritet:** Hög
**Typ:** Migrering
**Beskrivning:** Migrera alla booking-relaterade API routes till `getAuthUser()`.
Kärndomän -- viktigast att migrera.

**Scope:**
- `/api/bookings` (GET, POST)
- `/api/bookings/[id]` (GET, PATCH, DELETE)
- `/api/bookings/[id]/payment` (GET, POST)
- `/api/bookings/manual` (POST)

**Mönster:** Samma som S11-4 -- byt import, byt anrop, uppdatera tester.

**Effort:** 0.5-1 dag
**Stationsflöde:** Plan -> Red -> Green -> Review -> Verify -> Merge

---

### S12-3: Migrera provider routes (batch) -- READY

**Prioritet:** Hög
**Typ:** Migrering
**Beskrivning:** Migrera provider-specifika routes.

**Scope:**
- `/api/provider/profile` (GET, PUT)
- `/api/provider/customers` (GET, POST)
- `/api/provider/customers/[customerId]` (GET, PUT, DELETE)
- `/api/services` (GET, POST)
- `/api/services/[id]` (PUT, DELETE)

**Effort:** 0.5-1 dag
**Stationsflöde:** Förenklat (mekanisk): Green -> Review -> Verify -> Merge

---

### S12-4: Migrera native routes (batch) -- READY

**Prioritet:** Medel
**Typ:** Migrering
**Beskrivning:** Migrera native iOS-endpoints. Dessa använder redan
`authFromMobileToken()` som ingår i `getAuthUser()`-prioritetsordningen (Bearer först).

**Scope:** Alla `/api/native/*` routes (dashboard, bookings, calendar, customers,
services, reviews, due-for-service, announcements, insights)

**Notering:** Dessa routes bör redan fungera med `getAuthUser()` utan ändring
(Bearer-token hanteras först). Tester behöver dock uppdateras.

**Effort:** 0.5 dag
**Stationsflöde:** Förenklat (mekanisk): Green -> Review -> Verify -> Merge

---

### S12-5: Migrera auth routes -- READY

**Prioritet:** Medel
**Typ:** Migrering
**Beskrivning:** Migrera auth-specifika routes (register, verify-email, forgot/reset-password).
Dessa kräver mer eftertanke -- de interagerar med Supabase Auth direkt.

**Effort:** 1-2 dagar
**Trigger:** Efter S12-1-4 bekräftat att migreringen fungerar

---

## Prioritetsordning

1. **S12-1** Login-sida (Supabase Auth)
2. **S12-2** Booking routes
3. **S12-3** Provider routes
4. **S12-4** Native routes
5. **S12-5** Auth routes (backlog)

---

## Sprint Retro Template

### Vad gick bra?

### Vad kan förbättras?

### Processändring till nästa sprint?

### Hur många routes migrerade? Hur många kvar?
