---
title: "S43-0 Done: Discovery -- klassning av 36 E2E-specs"
description: "Alla 36 E2E-specs klassade med motivering. Discovery-plan klar för review."
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Lärdomar
---

# S43-0 Done: Discovery

**Sprint:** S43  
**Story:** S43-0  
**Branch:** feature/s43-0-discovery-e2e-klassning  
**Datum:** 2026-04-19

---

## Acceptanskriterier

- [x] Alla 36 specs klassade med motivering
- [x] Summary-tabell med totaler per kategori (STANNA: 12, FLYTTA→integration: 16, FLYTTA→component: 5, TA BORT: 3)
- [x] 2-3 pilot-kandidater explicit markerade (security-headers, unsubscribe, horses)
- [x] Första Fas 3-batch (5 specs) föreslagen + motiverad
- [x] Klar för review

---

## Definition of Done

- [x] Inga TypeScript-fel (inga kodfiler ändrade)
- [x] Säker -- inga kod-ändringar
- [x] Dokumentet klar för review
- [x] Feature branch skapad och klar för PR

---

## Reviews körda

Kördes: tech-architect via tech lead (2026-04-19) — bekräftade 3 invändningar + 3 nya fynd. Planen uppdaterad.

Trivialt? Nej -- discovery-analys av 36 specs med klassning som påverkar hela teststrategin.

**Review-fynd och åtgärder:**
- security-headers utgick som pilot (Next.js headers i next.config.ts, ej route-handler → spike istället)
- 4 specs fick SPLIT-notering: feature-flag-toggle, follow-provider, recurring-bookings, admin
- announcements TA BORT fick förutsättningsnotering om route-announcement-notification
- Pilot reducerad till 2 specs (unsubscribe + horses)
- Pre-pilot verifiering av component-test-setup tillagd för horses-piloten
- security-headers → 30-min spike-backlog (verifiera supertest/Vitest-mönster)

---

## Docs uppdaterade

- Skapad: `docs/plans/testpyramid-omfordelning.md` -- fullständig klassning av alla 36 specs
- `docs/done/s43-0-done.md` -- denna fil

Ingen annan doc-uppdatering behövs (intern analys, ingen ny feature som påverkar slutanvändare).

---

## Verktyg använda

- Läste patterns.md vid planering: N/A (discovery, inte implementation)
- Kollade code-map.md för att hitta filer: nej (använde Glob för e2e/*.spec.ts direkt)
- Hittade matchande pattern: nej (nytt territory -- testpyramid-strategi)

---

## Arkitekturcoverage

N/A (discovery, inte implementation av arkitekturdesign)

---

## Modell

`sonnet`

---

## Avvikelser

- TA BORT: Bara 3 specs (förväntat 4-8). Motivering: De 3 identifierade är tydligt motiverade (payment Stripe-problemet, announcements half-dead, exploratory-baseline catch-all). Att artificiellt lägga till en fjärde vore sunk-cost-bias. Ytterligare kandidater kan tillkomma under S43-2 när vi ser faktisk redundans.

- feature-flag-toggle.spec.ts (730 rader) klassas som FLYTTA→integration trots att den innehåller browser-specifik nav-synlighet. Motivering: API enforcement-testerna dominerar (majoriteten), och nav-synlighet kan testas via component-test för ProviderNav/CustomerNav. Spec-filen bör splitas och delvis tas bort -- detta noteras i klassningen.

---

## Lärdomar

1. **Conditional skips är ett varningssystem.** Specs med `test.skip(true, 'No data available')` är oftast inte E2E-problem -- de är dataprovisioning-problem. Integration-tester med explicit seed löser detta automatiskt.

2. **Browser-kravet är strängare än det verkar.** Av 36 specs är bara 12 genuint browser-beroende (cross-domain state eller SW/offline). 24 specs (67%) kan testas utan browser.

3. **security-headers är den klaraste piloten.** Ingen login, ingen seed, inga Prisma -- bara HTTP-headers. Perfekt för att bevisa mönstret utan risk.

4. **feature-flag-toggle.spec.ts är svitens tekniska skuld.** 730 rader, 94 tester, permanent-skippade env-override-tester. Migrering av denna spec ger störst absolut vinst men kräver omsorg (split + partial delete).

5. **Offline-specs STANNAR men är isolerade.** offline-mutations + offline-pwa kör bara med OFFLINE_E2E=true. De är korrekt isolerade och ska behållas -- men de är inte del av normal CI-körning.
