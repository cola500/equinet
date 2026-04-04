---
title: "S13-3 Done: Ta bort passwordHash"
description: "Drop passwordHash-kolumnen, migrera losenordsoperationer till Supabase Auth, ta bort bcrypt"
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lardomar
---

# S13-3 Done: Ta bort passwordHash fran User

## Acceptanskriterier

- [x] Prisma-migration: `ALTER TABLE "User" DROP COLUMN "passwordHash"`
- [x] Sync-trigger uppdaterad (passwordHash borttagen fran INSERT)
- [x] bcrypt-beroende borttaget fran package.json
- [x] Alla losenordsoperationer migrerade till Supabase Auth

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel (`npm run typecheck`)
- [x] Saker (validering, error handling, ingen XSS/SQL injection)
- [x] Unit tests uppdaterade och grona (3901 pass)
- [x] Feature branch, alla tester grona

## Reviews

- Kordes: tech-architect (plan-review, 2 findings fixade), code-reviewer (inte kord separat -- integrerad i implement-skill)
- security-reviewer: relevant (accept-invite route andrad) -- manuellt verifierad: auth, rate limit, Zod, svenska felmeddelanden, logger (inte console)

## Avvikelser

1. **registerLegacy borttagen helt** (inte bara passwordHash). Supabase ar enda registreringsvagen.
   Om supabaseAdmin saknas returneras REGISTRATION_FAILED. Ingen bcrypt-fallback.

2. **AccountDeletionService -- aktiv produktionsbug fixad.** Losenordsverifiering anvande
   `bcrypt.compare(password, user.passwordHash)` dar `passwordHash` var `''` for Supabase-anvandare.
   Kontoborttagning var blockerad for alla nya anvandare. Fixat med `signInWithPassword()`.

3. **scripts/verify-password-hash.ts borttaget** (engangsskript, importerade bcrypt).
   scripts/migrate-users-to-supabase-auth.ts behallt men uppdaterat (historiskt engangsjobb).

4. **Fasordning andrad** fran planen: schema-migration kors sist (inte forst) for att undvika
   att bryta kod som fortfarande refererar kolumnen.

## Lardomar

1. **Borttagning av en databaskolumn har enorm blast radius.** passwordHash refererades i 35+ filer
   trots att den var overfloding. Lesson: deprekera kolumner gradvis (nullable -> unused -> drop).

2. **Parallella subagenter for testuppdateringar** var mycket effektivt. Auth-tester (komplex
   logik) och non-auth-tester (enkla assertion-borttagningar) kunde koras samtidigt.

3. **Tech-architect review hittade kritisk fasordningsbug.** DROP COLUMN forst hade brutit
   produktion. Self-review med subagenter ar ovardigt.

4. **AccountDeletionService-buggen var redan i produktion.** Nar passwordHash satts till '' av
   sync-triggern slutade bcrypt.compare att fungera. Bra att vi hittade den nu.
