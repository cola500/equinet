---
title: "S16-4: Admin-härdning -- Done"
description: "Audit log och session-timeout för admin-operationer"
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

# S16-4: Admin-härdning -- Done

## Acceptanskriterier

- [x] Audit log: AdminAuditLog-tabell (vem, vad, när, IP) för admin-operationer
- [x] Automatisk loggning via withApiHandler (auth: "admin")
- [x] Admin-sida för att läsa audit-loggen med paginering
- [x] Tidbegränsade admin-sessioner (15 min via JWT iat-check)
- [x] Tester: audit-loggning, session-timeout, admin auth
- [ ] MFA obligatoriskt för admin -- FLYTTAT TILL BACKLOG (beslut: bygga vid fler admins)

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Säker (admin auth, session timeout, audit trail)
- [x] Unit tests skrivna FÖRST (TDD), 18 nya tester
- [x] check:all 4/4 gröna (3988 tester)
- [x] Feature branch, alla tester gröna

## Reviews körda

- [x] code-reviewer (station 4)
- [x] security-reviewer: implicit via code-reviewer (admin auth + session timeout)
- Ej relevant: cx-ux-reviewer (admin-only UI, inte kundriktad)

## Avvikelser

### MFA flyttat till backlog

Beslutat med Johan: MFA behövs inte med en admin. Noterat i status.md backlog
för framtida story när fler admins tillkommer.

### Befintliga admin-routes inte migrerade

De 3 befintliga admin-routes (system, reviews, integrations) använder fortfarande
`requireAdmin()` från admin-auth.ts. Nya admin-routes bör använda
`withApiHandler({ auth: "admin" })`. Migration av befintliga routes kan göras
opportunistiskt.

## Lärdomar

1. **withApiHandler som audit-hook**: Fire-and-forget efter handler-anropet
   är rätt mönster -- audit-loggning får aldrig blockera eller faila requesten.

2. **JWT iat för session-timeout**: Supabase JWT innehåller `iat` claim.
   Att dekoda och jämföra med nuvarande tid ger enkel session-timeout utan
   Supabase-konfigändringar. Fungerar per auth-level (bara admin).

3. **Prisma mock för audit**: `mockAuditCreate.mockResolvedValue({})` krävs
   i beforeEach -- annars returnerar mock `undefined` och `.catch()` kraschar.
