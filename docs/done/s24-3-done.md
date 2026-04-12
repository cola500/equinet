---
title: "S24-3 Done: Snabba säkerhetsfixar"
description: "Haiku alias, cron HMAC-signatur, CSP report-to"
category: retro
status: active
last_updated: 2026-04-12
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Avvikelser
  - Lärdomar
---

# S24-3 Done: Snabba säkerhetsfixar

## Acceptanskriterier

- [x] Haiku modell-ID bytt till alias (`claude-haiku-4-5`)
- [x] Cron-routes verifierar `x-vercel-signature` via shared helper
- [x] CSP `report-uri` och `report-to` tillagda i båda CSP-block
- [x] Timing-safe jämförelser (timingSafeEqual) i cron-auth

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (timingSafeEqual, HMAC-verifiering)
- [x] Tester skrivna och gröna (8 nya för cron-auth, 4026 totalt)
- [x] `check:all` 4/4 gröna

## Reviews körda

- [x] code-reviewer -- 2 blockers (timing-unsafe comparisons), 1 major (route-planning CSP), alla fixade
- Kördes: code-reviewer (enda relevanta -- inga UI- eller arkitekturändringar)

## Avvikelser

- **HMAC-verifiering för GET cron**: Vercel skickar `x-vercel-signature` med HMAC av request body, men GET-requests har ingen body. HMAC-checken är effektivt inaktiv för nuvarande GET cron-routes. Bearer-verifiering skyddar ändå. Helpern stödjer HMAC för framtida POST cron-routes.

## Lärdomar

- **timingSafeEqual obligatoriskt**: Alla secret-jämförelser måste använda timing-safe comparison. String `===`/`!==` läcker information via sidokanal.
- **Separata CSP-block**: `next.config.ts` har två CSP-block (route-planning + catch-all). Säkerhetsdirectives måste läggas till i BÅDA.
- **Sentry CSP report-URI**: Parsas från DSN-formatet `https://<key>@<host>/<project>` till `https://<host>/api/<project>/security/?sentry_key=<key>`.
