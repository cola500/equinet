---
title: "S13-5 Done: Registrering via Supabase Auth"
description: "AuthService.register() byter bcrypt mot Supabase admin API"
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Avvikelser
  - Lärdomar
---

# S13-5 Done: Registrering via Supabase Auth

## Acceptanskriterier

- [x] Registrering använder `supabase.auth.admin.createUser()` istället för bcrypt
- [x] `raw_user_meta_data` sätts vid signup (firstName, lastName, phone)
- [x] Sync-trigger (S11-3) skapar automatiskt public.User
- [x] Ghost user upgrade behålls via befintlig bcrypt-path
- [x] Provider-skapande sker server-side (inte via trigger)

Notering: Sprint-dokumentet listade "Ta bort custom verify-email route" och
"Konfigurera Supabase email templates" -- dessa är deploy-steg, inte koddändringar.

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel (`npm run typecheck`)
- [x] Säker (Zod-validering, error handling, ingen privilege escalation)
- [x] Tester skrivna FÖRST (RED), gröna (45 AuthService + 17 route = 62 tester)
- [x] check:all 4/4 gröna (3993 tester totalt)
- [x] Feature branch, alla tester gröna

## Reviews körda

- **tech-architect** (plan): 1 blocker (trigger userType), 2 major (ghost kollision, sanitering). Alla fixade.
- **security-reviewer** (plan): 1 blocker (privilege escalation via metadata), 3 major (rate limiting, lösenordsstyrka, metadata-längd). Alla hanterade.
- **code-reviewer** (kod): 0 blockers, 3 major (silent catch, require(), error mapping), 3 minor. Alla fixade.
- **security-reviewer** (kod): Pågår vid done-filens skapande.

## Avvikelser

1. **Klient-sidan (register page) inte ändrad.** Planen förväntade sig UI-ändringar,
   men eftersom vi behöll server-side proxy (POST /api/auth/register) behövs inga
   klient-ändringar. Formuläret postar till samma endpoint som innan.

2. **check-email-sidan inte ändrad.** Texten funkar oavsett om email kommer från
   Resend eller Supabase.

3. **Sync-trigger inte ändrad.** Planen övervägde trigger-utökning men review
   blockerade det (privilege escalation). Trigger behålls hardkodad till 'customer'.

4. **Ghost users behåller bcrypt-path helt.** Originellt planerat att migrera
   ghost users till Supabase i denna story, men skjuts till S13-2 (cleanup).

## Lärdomar

1. **Self-review av plan sparade en blocker.** Utan tech-architect/security-reviewer
   hade vi byggt en trigger som läser userType från user-controlled metadata --
   en privilege escalation-risk. Lesson: kör ALLTID plan-review för auth-ändringar.

2. **Server-side proxy > klient-side signUp.** Att behålla `/api/auth/register`
   som proxy ger oss: rate limiting, Zod-validering, sanitering, ghost user
   detection -- allt utan att duplicera logik. Enklare än att flytta allt till klienten.

3. **`require()` med path alias fungerar men är fragilt.** Statisk import med
   try/catch i fabriken är renare och ger TypeScript-kontroll.

4. **Supabase admin.createUser() returnerar olika felkoder.** 422 = "already registered",
   andra = service errors. Att mappa alla till EMAIL_ALREADY_EXISTS döljer riktiga
   problem. Skilja feltyperna tidigt.

5. **Silent `.catch(() => {})` är farligt i produktion.** Även om vi förväntar
   oss P2002 (unique constraint) kan andra fel döljas. Logga alltid.
