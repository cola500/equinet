---
title: "Sprint 13: Supabase Auth Fas 3 -- Cleanup (UTKAST)"
description: "Ta bort NextAuth, MobileTokenService, passwordHash. Unified auth."
category: sprint
status: draft
last_updated: 2026-04-03
tags: [sprint, auth, supabase, cleanup, ios]
sections:
  - Sprint Overview
  - Stories
  - Sprint Retro Template
---

# Sprint 13: Supabase Auth Fas 3 -- Cleanup (UTKAST)

**Status:** UTKAST -- aktiveras efter sprint 12
**Sprint Duration:** 1 vecka
**Sprint Goal:** Ta bort NextAuth. En auth-källa. RLS automatiskt.

---

## Sprint Overview

Sprint 11 byggde grunden (dual-auth helper, user migration, sync trigger).
Sprint 12 migrerade alla routes. Sprint 13 tar bort det gamla systemet.

**Efter sprint 13:**
- NextAuth borta (ingen beta-dependency)
- MobileTokenService borta (iOS använder Supabase Swift SDK)
- passwordHash borta från User-modellen
- En auth-källa: Supabase Auth
- RLS fungerar automatiskt via user JWT

---

## Stories

### S13-1: Byt huvudlogin till Supabase Auth -- READY

**Prioritet:** Högst
**Typ:** Feature
**Beskrivning:** `/login` byter från NextAuth `signIn("credentials")` till
Supabase `signInWithPassword`. `/supabase-login` (S12-1) blir `/login`.
Befintlig NextAuth login tas bort.

**Uppgifter:**
1. Flytta SupabaseLoginForm till `/login`
2. Ta bort NextAuth-specifik login-logik (web-login route, signIn-anrop)
3. Ta bort `/supabase-login` (redirect till `/login`)
4. Uppdatera tester

**Effort:** 1 dag

---

### S13-2: Ta bort NextAuth + MobileTokenService -- READY

**Prioritet:** Hög
**Typ:** Cleanup
**Beskrivning:** Ta bort alla NextAuth-beroenden och custom mobile token-systemet.

**Filer att ta bort:**
- `src/lib/auth.ts` (NextAuth config)
- `src/lib/auth.config.ts` (edge config)
- `src/lib/auth-server.ts` (re-export)
- `src/lib/mobile-auth.ts` (Bearer token helper)
- `src/domain/auth/MobileTokenService.ts`
- `src/infrastructure/persistence/mobile-token/`
- `src/app/api/auth/mobile-token/*` (3 routes)
- `src/app/api/auth/web-login/` (S9-9, inte längre behövd)
- `src/app/api/auth/native-login/` (ersätts av Supabase Swift SDK)

**Filer att uppdatera:**
- `src/lib/auth-dual.ts` -- ta bort NextAuth-fallback (bara Bearer + Supabase kvar)
- `middleware.ts` -- ta bort NextAuth import
- `package.json` -- ta bort `next-auth`, `@auth/prisma-adapter`

**Effort:** 1 dag

---

### S13-3: Ta bort passwordHash från User -- READY

**Prioritet:** Medel
**Typ:** Schema-ändring
**Beskrivning:** Supabase Auth hanterar lösenord i `auth.users`. `passwordHash`
i `public.User` behövs inte längre.

**Uppgifter:**
1. Prisma-migration: `ALTER TABLE "User" DROP COLUMN "passwordHash"`
2. Uppdatera sync-trigger (sätter redan `''`, ta bort kolumnen helt)
3. Ta bort bcrypt-beroende om inget annat använder det

**Effort:** 0.5 dag

---

### S13-4: iOS Supabase Swift SDK -- READY

**Prioritet:** Hög
**Typ:** iOS-migrering
**Beskrivning:** Byt iOS-appens auth från custom MobileTokenService till
Supabase Swift SDK. Eliminerar dual auth-systemet.

**Uppgifter:**
1. Installera `supabase-swift` via Swift Package Manager
2. Byt AuthManager: `APIClient.login()` -> `supabase.auth.signIn(email:password:)`
3. Ta bort Keychain token-lagring (Supabase SDK hanterar det)
4. Uppdatera APIClient: Bearer-header ersätts av Supabase session
5. WebView: dela Supabase-session via cookies
6. Testa: login, logout, token-refresh, offline

**Effort:** 1-2 dagar

---

### S13-5: Registrering via Supabase Auth -- READY

**Prioritet:** Medel
**Typ:** Feature
**Beskrivning:** Byt registreringssidan från custom endpoint till
`supabase.auth.signUp()`. Email-verifiering hanteras av Supabase.

**Uppgifter:**
1. Uppdatera `/register` att använda `supabase.auth.signUp()`
2. `raw_user_meta_data` sätts vid signup (firstName, lastName)
3. Sync-trigger (S11-3) skapar automatiskt public.User
4. Ta bort custom verify-email route
5. Konfigurera Supabase email templates (svenska)

**Effort:** 1 dag

---

## Prioritetsordning

1. **S13-1** Login-byte (synlig ändring)
2. **S13-4** iOS Swift SDK (kräver app-uppdatering)
3. **S13-5** Registrering (ny user-flow)
4. **S13-2** Ta bort NextAuth (cleanup)
5. **S13-3** Ta bort passwordHash (schema)

---

## Risker

| Risk | Mitigation |
|------|-----------|
| Alla användare måste logga in på nytt | S11-2 migrerade users -- samma lösenord fungerar |
| iOS-app kräver uppdatering samtidigt | Koordinera release |
| Borttagna routes bryter iOS-appen | S13-4 måste vara klar FÖRE S13-2 |
| Email templates på svenska | Konfigurera i Supabase Dashboard före go-live |

---

## Sprint Retro Template

### Vad gick bra?

### Vad kan förbättras?

### Processändring till nästa sprint?

### Auth-migrering komplett? Vad återstår?
