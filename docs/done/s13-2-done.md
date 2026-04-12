---
title: "S13-2 Done: Ta bort NextAuth + MobileTokenService"
description: "Cleanup -- NextAuth och MobileTokenService borttagna, Supabase Auth enda auth-kallan"
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

# S13-2 Done: Ta bort NextAuth + MobileTokenService

## Acceptanskriterier

- [x] NextAuth-beroende borttaget fran package.json
- [x] Alla NextAuth-filer borttagna (auth.ts, auth.config.ts, [...nextauth], next-auth.d.ts)
- [x] MobileTokenService + infrastructure borttagen
- [x] mobile-token API routes borttagna (3 routes)
- [x] native-login route borttagen
- [x] auth-dual.ts forenklad till bara Supabase
- [x] auth-server.ts drop-in replacement (135 routes opaverkade)
- [x] middleware.ts omskriven med Supabase cookie-refresh
- [x] Klientkomponenter migrerade (SessionProvider, useAuth, Header, DeleteAccountDialog)
- [x] env.ts uppdaterad (NEXTAUTH -> SUPABASE vars)
- [x] Inga imports av next-auth kvar i src/

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (Supabase cookie-refresh, NextAuth cookie cleanup, null-guard)
- [x] Tester: 3911 passing, 28 borttagna med raderade moduler
- [x] check:all 4/4 grona (typecheck + test + lint + swedish)
- [x] Feature branch, alla tester grona

## Reviews

Kordes:
- **tech-architect** (plan): 1 blocker (middleware cookie-refresh), 4 majors. Alla atagardat.
- **security-reviewer** (plan): 2 kritiska (null-guard, NextAuth cookie cleanup), 3 majors. Alla atagardat.
- **code-reviewer** (kod): 2 majors (env.ts, authMethod i tester), 1 borderline (stale kommentarer). Alla fixade.

## Avvikelser

1. **MobileToken Prisma-modell behalls** -- flyttad till S13-3 (schema-ändring efter produktionsvalidering). Rekommendation fran bade tech-architect och security-reviewer.
2. **Ny fil skapad: `/api/auth/session`** -- lightweight session endpoint for klient-polling. Ersatter NextAuth:s inbyggda session-endpoint. Ingen rate limiting (m1 minor -- laggs till vid behov).
3. **Extra DB-roundtrip per request** -- auth-server.ts gor nu Prisma-lookup for varje request (tidigare hade NextAuth detta i JWT). Accepterad risk -- redan monstret i auth-dual (75 routes). Minimal overhead.

## Lardomar

1. **Drop-in replacement-strategi fungerade utmarkt** -- att byta internals i auth-server.ts utan att andra 135 routes var ratt val. Alternativet (batch-migrering) hade varit enormt scope.
2. **authMethod-typen kravde bulk-update av ~65 testfiler** -- sed var effektivt men skapade syntaxfel i 3 filer. Manuell fix kravdes. Lardomen: sed pa multi-line patterns ar risky, använd grep + manuell fix for komplexa ersattningar.
3. **env.ts var inte med i planen** -- code-reviewer hittade att NEXTAUTH_SECRET/URL fortfarande validerades. Lardomen: nar du tar bort ett paket, sok efter strangnamnet i ALLA filer (inte bara imports).
4. **Supabase SSR cookie-refresh ar kritiskt** -- bade tech-architect och security-reviewer flaggade att middleware maste satta cookies pa response-objektet. Utan detta ruttnar sessioner tyst.
5. **NextAuth cookie cleanup vid signOut** -- kvarliggande session-cookies fran pre-migrering maste rensas explicit. Security-reviewer pekade pa detta.

## Statistik

- 91 filer andrade
- ~25 filer borttagna
- 2 filer skapade
- -2924 netto LOC
- 3911 tester grona
- next-auth: borttaget
