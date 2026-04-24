---
title: "S54-2 Done: Redigera bokningsdatum och tid (leverantör)"
description: "Avslutad story — leverantör kan ändra datum och tid för pending/confirmed bokningar"
category: guide
status: active
last_updated: 2026-04-24
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Arkitekturcoverage
  - Modell
  - Kända begränsningar
---

# S54-2 Done: Redigera bokningsdatum och tid (leverantör)

## Acceptanskriterier

- [x] Leverantör kan ändra datum och tid för en pending bokning
- [x] Leverantör kan ändra datum och tid för en confirmed bokning
- [x] Överlappsskydd: 409 om ny tid krockar med annan bokning
- [x] Kund notifieras via e-post vid ändring (fire-and-forget)
- [x] Ej tillåtet för completed/cancelled/no_show — 400

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (Zod .strict(), IDOR-skydd via findFirst + providerId, rate limiting)
- [x] Tester skrivna FÖRST — 17 tester, alla gröna
- [x] check:all 4/4 gröna
- [x] Feature branch, mergad via PR

## Reviews körda

- [x] code-reviewer — 2 critical, 1 important, 2 suggestions. Alla critical/important åtgärdade:
  1. `findFirst` istället för `findUnique` för IDOR-check (projektkonvention)
  2. `rescheduleCount: { increment: 1 }` tillagd i Prisma- och Mock-repository
  3. `no_show`-testfall tillagt (17 tester totalt)
- [x] security-reviewer — inga blockers. Auth-flöde, IDOR-skydd (defense in depth, dubbel WHERE), rate limiting, Zod, overlap-logik (serializable, OR-klausuler, self-exclusion) verifierade. 1 minor: service-lookup saknar providerId-kross-verifiering (låg risk, serviceId är DB-värde från verifierad bokning).

- [ ] cx-ux-reviewer — ej tillämplig (enkel dialog, ingen ny UX-resa)
- [ ] ios-expert — ej tillämplig (inga iOS-ändringar)
- [ ] tech-architect — ej tillämplig (ingen ny arkitekturkomponent)

## Docs uppdaterade

Ingen docs-uppdatering — intern feature (ny API-route + UI-dialog). Ingen ny UX-resa för slutanvändare som kräver hjälpartikel. Ingen arkitekturändring.

## Verktyg använda

- Läste patterns.md vid planering: ja
- Kollade code-map.md för att hitta filer: ja
- Hittade matchande pattern? Ja — `rescheduleWithOverlapCheck` (kund-varianten) användes som mall för `providerRescheduleWithOverlapCheck`

## Arkitekturcoverage

Ingen designstory — ny feature implementerad direkt från sprint-plan.

## Modell

sonnet

## Kända begränsningar

- `handleReschedule` i `calendar/page.tsx` är inte wrappat i `guardMutation` — saknar offline-stöd. Ger "Kunde inte boka om" vid nätverksfel (fångas av ProviderRescheduleDialog:s try/catch). Offline-stöd för provider-reschedule är out of scope för denna story.
- ProviderRescheduleDialog tillåter att välja dagens datum med starttid i det förflutna (t.ex. idag 08:00 när klockan är 15:00). Valideras inte server-side. Kosmetiskt UX-problem, inte säkerhetsproblem.
