---
title: "S11-4 Done: Migrera onboarding-status till dual-auth"
description: "Första route migrerad från auth() till getAuthUser()"
category: retro
status: active
last_updated: 2026-04-03
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lardomar
---

# S11-4 Done: Migrera onboarding-status till dual-auth

## Acceptanskriterier

- [x] Route fungerar med NextAuth (flagga av) -- getAuthUser() provar NextAuth som fallback
- [x] Route fungerar med Supabase Auth (flagga pa) -- testat med authMethod: "supabase"
- [x] Befintliga tester grona -- alla 16 tester passerar (11 befintliga + 5 nya/andrade)

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (Zod-validering, error handling, ingen XSS/SQL injection)
- [x] Unit tests skrivna FORST, coverage god (16 tester)
- [x] Feature branch, alla tester grona
- [x] Code review: godkand (inga blockers/majors)

## Avvikelser

- **Ingen feature flag**: Sprint-dokumentet namner `supabase_auth_poc` men `getAuthUser()` har fast prioritetsordning (Bearer > NextAuth > Supabase) utan feature flag. Detta ar korrekt design fran S11-1 -- alla tre auth-metoder ar alltid aktiva.

## Lardomar

- **Minimal andring**: Hela migreringen var 2 raders andringar i route.ts (import + anrop). `getAuthUser()` abstraherar bort komplexiteten.
- **Testmigrering enkel**: Mock-byte fran `auth` till `getAuthUser` var rakt pa. `AuthUser`-interfacet gor testerna tydligare an det gamla `session.user`-monstret.
- **Alla tre auth-metoder testade**: Bearer, NextAuth och Supabase -- aven om routen inte branchar pa authMethod ar det bra dokumentation.
