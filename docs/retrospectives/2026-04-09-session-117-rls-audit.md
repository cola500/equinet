---
title: "Retro: Session 117 -- Lokal dev-setup + RLS-audit"
description: "CSP-fix, seed-setup och upptackt av RLS OR-policy-lacka i S14-routes"
category: retro
status: active
last_updated: 2026-04-09
sections:
  - Sammanfattning
  - Vad hande
  - Rotorsaksanalys
  - Vad gick bra
  - Vad gick fel
  - Atgarder
  - Lardomar
---

# Retro: Session 117 -- Lokal dev-setup + RLS-audit

## Sammanfattning

Felsökning av lokal login avslöjade tre separata problem: CSP blockerade Supabase, testanvändare saknades, och -- viktigast -- en säkerhetsbrist där providers kunde se andra providers data via Supabase-klientens RLS-policies.

**Tidsatgang:** ~1 session
**Paverkan:** Säkerhetsfix i 3 API routes, 4 dokumentationsfiler uppdaterade

## Vad hande

1. **Login fungerade inte lokalt** -- "Load failed" TypeError
2. Utredning visade att CSP blockerade `127.0.0.1:54321` (CSP hade bara `localhost:54321`)
3. Efter CSP-fix: inga testanvändare. Korde `npm run db:seed:force`
4. Efter seed: login fungerade, men **manuell bokning failade** med "Ogiltig tjänst"
5. Utredning visade att GET `/api/services` returnerade ALLA providers tjänster
6. Rotorsak: RLS-policies ar OR -- `service_public_read` (alla aktiva) + `service_provider_read` (egna) = alla
7. Genomlysning av alla S14-routes: samma problem i `/api/bookings` och `/api/notifications`
8. Fixat med explicit `.eq()` filter i alla 3 routes

## Rotorsaksanalys (5 Whys)

**Symptom:** Provider ser andra providers tjänster i dropdown

1. **Varfor?** GET `/api/services` returnerar alla aktiva tjänster
2. **Varfor?** Routen har ingen `.eq("providerId")` -- litar enbart pa RLS
3. **Varfor?** S14-migreringen antog att RLS = komplett filtrering
4. **Varfor?** Vi forstod inte att RLS-policies ar OR, inte AND
5. **Varfor?** Ingen checklista eller code review-punkt fangade detta monster

**Grundorsak:** Bristande forstaelse for RLS OR-semantik vid S14-migreringen. `service_public_read` (avsedd for kundsökning) gjorde att provider-scoped endpoint exponerade alla providers data.

## Vad gick bra

- **Snabb felsökning:** CSP-problemet identifierades via webbläsarens konsol-output
- **Seed-skriptet fungerade perfekt** -- skapar auth-användare + Prisma-data i ett steg
- **Genomlysningen var effektiv** -- explore-agent hittade alla berörda routes snabbt
- **Testerna fangade mock-ändringar** -- tvingade oss att uppdatera alla 3 testfiler
- **Gotcha #33 fanns redan** -- bara behövde utökas med `127.0.0.1`

## Vad gick fel

- **S14 code review missade RLS OR-semantik** -- checklistorna hade ingen punkt for detta
- **Gotcha #34 var inaktuell** -- sa "acceptera begränsningen lokalt" istallet for att fixa
- **`.env.local` trumfar `.env`** bet oss igen -- dev-servern använde gamla nycklar tills omstart
- **Lokal dev-setup var inte dokumenterat steg-for-steg** -- seed + auth + CSP var tre separata problem

## Åtgärder

| Åtgärd | Fil | Status |
|--------|-----|--------|
| CSP: lagg till `127.0.0.1:54321` | `next.config.ts` | Klar |
| Explicit `.eq()` i GET `/api/services` | `src/app/api/services/route.ts` | Klar |
| Explicit `.eq()` i GET `/api/bookings` | `src/app/api/bookings/route.ts` | Klar |
| Explicit `.eq()` i GET `/api/notifications` | `src/app/api/notifications/route.ts` | Klar |
| Tester uppdaterade (mock-kedjor) | 3 testfiler | Klar |
| Ny checklistepunkt i api-routes.md | `.claude/rules/api-routes.md` | Klar |
| Ny checklistepunkt i code-review-checklist.md | `.claude/rules/code-review-checklist.md` | Klar |
| Gotcha #33 uppdaterad (localhost vs 127.0.0.1) | `docs/guides/gotchas.md` | Klar |
| Gotcha #34 omskriven (RLS OR-semantik) | `docs/guides/gotchas.md` | Klar |
| Key learning i CLAUDE.md | `CLAUDE.md` | Klar |

## Lardomar

1. **RLS-policies ar OR, inte AND.** En publik read-policy kombinerad med en provider-specifik policy ger provider tillgang till alla rader som matchar NAGON av policyerna. Explicit `.eq()` i queries ar obligatoriskt -- RLS ar defense in depth, inte enda filtret.

2. **`localhost` != `127.0.0.1` i CSP.** Webbläsaren behandlar dessa som olika origins. Supabase CLI default-URL ar `127.0.0.1`, men CSP hade bara `localhost`. Symptom: tyst fetch-failure, login visar "Ogiltig email eller lösenord".

3. **Migrering fran Prisma till Supabase-klient kraver extra granskning.** Prisma-routes hade explicit WHERE-klausuler. Supabase-klient queries utan `.eq()` litar enbart pa RLS -- vilket kan vara otillrackligt om publika policies finns.

4. **`NEXT_PUBLIC_*` kraver omstart av dev-servern.** Turbopack bakar in dessa vid start. Ändring i `.env.local` slaar inte igenom utan omstart.

5. **Checklistor maste uppdateras efter nya patterns.** S14-migreringen introducerade Supabase-klient queries men checklistorna hade inga punkter for detta. Nu fixat.
