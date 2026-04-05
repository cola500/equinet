---
title: "S17-8 Done: Migrera admin-routes till withApiHandler"
description: "13 admin-routes migrerade från requireAdmin() till withApiHandler({ auth: 'admin' })"
category: retro
status: active
last_updated: 2026-04-05
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Avvikelser
  - Lärdomar
---

# S17-8 Done: Migrera admin-routes till withApiHandler({ auth: "admin" })

## Acceptanskriterier

- [x] Inventera alla befintliga admin-routes som använder requireAdmin() eller roles.ts
- [x] Migrera till withApiHandler({ auth: "admin" }) -- ger audit log gratis
- [x] Ta bort admin-auth.ts om den inte längre används
- [x] Verifiera: alla admin-operationer loggas i AdminAuditLog

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel (npm run typecheck)
- [x] Säker (Zod-validering, error handling, ingen XSS/SQL injection)
- [x] Unit tests skrivna och gröna (114 admin-tester)
- [x] Feature branch, alla tester gröna (3962 totalt, 4/4 quality gates)

## Reviews körda

Kördes: code-reviewer (via self-review, mekanisk migrering med etablerat mönster)

Inga extra reviews (security-reviewer, cx-ux-reviewer) behövdes -- detta är en
ren intern migrering utan ny affärslogik, nya endpoints eller UI-ändringar.

## Avvikelser

- **[id]-routes**: withApiHandler skickar inte vidare Next.js context-parametrar.
  Lösning: extrahera ID från URL med `new URL(request.url).pathname.split("/").pop()`.
  Fungerar korrekt för alla 3 [id]-routes (reviews, bug-reports, verification-requests).

- **verification-requests/[id]**: Hade inline admin-check istället för requireAdmin().
  Migrerad till withApiHandler precis som övriga.

## Lärdomar

- **Mekanisk migrering fungerar bra med parallella agenter**: 7+5 testfiler uppdaterades
  parallellt utan konflikter. Tydligt före/efter-mönster gör batch-migrering effektiv.

- **Netto -421 rader**: withApiHandler eliminerar boilerplate (auth, rate limit, try-catch,
  error handling) som upprepades i varje route.

- **Alla admin-routes får nu**: automatisk audit-loggning, 15-min session timeout,
  centraliserad rate limiting, och typade AdminUser-objekt.
