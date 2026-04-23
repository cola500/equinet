---
title: "Done: S53-2 Demo-seed för en leverantör"
description: "Script och dokumentation för att seed:a demo-leverantören Erik Järnfot"
category: plan
status: active
last_updated: 2026-04-23
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Arkitekturcoverage
  - Modell
  - Lärdomar
---

# Done: S53-2 Demo-seed för en leverantör

## Acceptanskriterier

- [x] Script kör utan fel mot lokal DB (`npm run db:seed:demo-provider`)
- [x] Kör igen → inga dubbletter (idempotens verifierad)
- [x] Trovärdig data: realistiska namn (Lisa Andersson, Flash, Järnfots Hovslageri), priser
      (750–2500 kr), intervaller (6–8 veckor), recensionstext på svenska
- [x] Docs-fil med inloggning + reset-instruktioner: `docs/operations/demo-setup.md`

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (ingen XSS/injection — seed-script, inga user-inputs)
- [x] check:all 4/4 grön
- [x] Feature branch, mergad via PR
- [x] Content matchar kod: `docs/operations/demo-setup.md` skapad

## Reviews körda

- [x] code-reviewer — 2 Major-fynd + 2 Minor. Alla Major åtgärdade:
  - M1: `listUsers()` utan pagination byttes mot `prisma.user.findUnique({ email })` (ingen pagination-risk)
  - M2: Reset-logik för `ProviderCustomerNote` begränsad till demo-kunder (lade till `customerId: { in: demoCustomerIds }`)
  - Minor #4 (saknat bokningsantal i summary) åtgärdat
  - Minor #3 (lösenord i klartext) noterat, accepterat för lokal demo-script
- [ ] security-reviewer — ej tillämplig (seed-script, inga API-routes, inga user-facing inputs)
- [ ] cx-ux-reviewer — ej tillämplig (inga UI-ändringar)
- [ ] ios-expert — ej tillämplig (inga iOS-ändringar)
- [ ] tech-architect — ej tillämplig (inga arkitekturförändringar, mönster följer befintlig seed.ts)

## Docs uppdaterade

- [x] `docs/operations/demo-setup.md` — ny fil med inloggning, walkthrough, reset-guide
- Ingen README-uppdatering (intern dev-tooling, ej user-facing feature)
- Ingen NFR-uppdatering (ej relevant)

## Verktyg använda

- Läste patterns.md vid planering: nej (seed-script, inget domain-pattern)
- Kollade code-map.md: nej (kände till relevanta filer)
- Hittade matchande pattern: `prisma/seed-demo.ts` + `prisma/seed.ts` — kopierade idempotens-mönster och Supabase Auth-mönster

## Arkitekturcoverage

- Inget designdokument (S53-2 är ett verktyg, ej en feature med designspecifikation)

## Modell

sonnet

## Lärdomar

- `supabase.auth.admin.getUserByEmail()` finns inte i detta SDK — använd Prisma-lookup på `public.User` istället för att hämta userId när `email_exists`-felet fås. Renare och undviker pagination-fälla.
- Reset-logik för relationsdata (`ProviderCustomerNote`) måste filtrera på BÅDA FK:erna (providerId + customerId), annars rensas data utanför demo-scopet.
- `prisma/seed-demo.ts` har samma `listUsers()`-pagination-bugg (ärvd från `seed.ts`). Att rapportera som backlog-rad vore meningslöst (används aldrig mot stor DB) men värt att notera i got
chas.
