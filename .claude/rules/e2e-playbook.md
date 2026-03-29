---
title: E2E Playbook
description: Strategi för när och hur vi skriver E2E-tester i Equinet
category: rule
status: active
last_updated: 2026-03-29
tags: [e2e, playwright, testing, strategy]
paths:
  - "e2e/**/*.spec.ts"
sections:
  - Syfte
  - När vi ska skriva E2E
  - När vi inte ska skriva E2E
  - Designregler
  - Testdata och miljö
  - Felsökning
  - Anti-patterns
  - Definition of Done
---

# E2E Playbook -- Equinet

> Projektspecifik playbook för Equinet. Beskriver hur vi använder E2E-tester i detta projekt -- inte en generell standard.

## Syfte

E2E verifierar kritiska användarflöden från webbläsare till databas. Vi använder E2E för att fånga fel som unit-tester inte kan: navigation, auth-flöden, formulär som sparar till backend, och flerstegsbeteenden.

E2E är ett separat verifieringsspår -- inte en del av Nivå 1/2 i webb-testflödet.

**Typer av E2E vi skriver:**
- **Smoke:** App startar, login fungerar, ett kärnflöde går igenom.
- **Kritiska flöden:** Bokning, route orders, betalning, kundhantering.
- **Regressioner:** Tidigare buggar vi vill låsa så de inte återkommer.

**Relation till `e2e.md`:** Denna playbook beskriver **strategi och när**. `.claude/rules/e2e.md` beskriver **tekniska gotchas och hur** (selektorer, seed-helpers, rate-limit-patterns).

## När vi ska skriva E2E

- Nytt användarflöde med flera steg (bokning, registrering, betalning)
- Auth-relaterade flöden (login, logout, rollväxling)
- Feature flag-gating som påverkar UI-synlighet
- Flöden där frontend och backend måste samspela (formulär -> API -> databasändring -> UI-uppdatering)
- Regressioner som inte fångades av unit-tester

## När vi inte ska skriva E2E

- Enkel CRUD i en domain service -- testa med unit/integration
- API-route validering (Zod, auth, felkoder) -- testa med route.test.ts
- UI-komponent rendering och state -- testa med unit eller visuell verifiering
- Intern refaktorering utan beteendeförändring -- om testerna redan är gröna räcker Nivå 1/2
- Utility-funktioner och beräkningar

**Tumregel:** Om testet kan skrivas som unit-test, skriv det som unit-test.

## Designregler

- **Ett test = ett tydligt användarflöde.** "Kund bokar tid" -- inte "kund bokar + avbokar + ombokar + lämnar recension".
- **Stabila selektorer.** `getByRole` > `getByLabel` > `getByPlaceholder`. Undvik CSS-klasser. Se `e2e.md` för selektorguide.
- **Undvik waitForTimeout.** Använd `waitFor({ state: 'visible' })`, `toBeVisible()`, eller `page.waitForResponse()`.
- **Verifiera tydliga tillstånd.** Kontrollera att rätt text, status eller element syns -- inte att "sidan laddade".
- **Testa flöden, inte implementation.** Klicka som en användare, verifiera vad användaren ser. Mocka inte interna API-svar.
- **Varje test måste vara oberoende.** Ingen delad state mellan tester. Seed i `beforeAll`, cleanup i `afterAll`.

## Testdata och miljö

- **Seed-data:** `e2e/setup/seed-helpers.ts` för per-spec data. Markera med `E2E-spec:<tag>` för cleanup.
- **Cleanup:** `cleanupSpecData(tag)` i `afterAll`. Global cleanup i `cleanup.setup.ts`.
- **Rate-limit reset:** Alltid i `beforeEach` -- `await page.request.post('/api/test/reset-rate-limit').catch(() => {})`.
- **Unika identifiers:** Använd `Date.now()` för testdata som kan kollidera.
- **Feature flags:** Sätt i `beforeAll` via admin API. Återställ i `afterAll`. Se `e2e.md` för detaljer.
- **Deterministisk data:** Seed ska producera samma resultat varje gång. Undvik slumpmässiga värden som påverkar assertions.
- **Reproducerbarhet:** En spec ska kunna köras isolerat: `npx playwright test e2e/bookings.spec.ts`.

## Felsökning

Vid failande E2E, följ denna ordning:

1. **Kör headed:** `npx playwright test e2e/failing.spec.ts --headed` -- se vad som händer visuellt.
2. **Kör en spec i taget:** `npx playwright test e2e/failing.spec.ts:215` -- isolera specifikt test.
3. **Granska trace/screenshot:** Playwright sparar traces vid failure. Öppna med `npx playwright show-trace`.
4. **Avgör var felet ligger:**
   - **App-bugg:** Testet hittar ett verkligt fel -- fixa appen.
   - **Test-bugg:** Selektorn matchar inte längre, timing-problem -- fixa testet.
   - **Data-bugg:** Seed-data saknas eller kolliderar -- fixa seed.
   - **Miljö-bugg:** Dev-server nere, port upptagen, rate-limit -- starta om miljön.
5. **Kör aldrig desktop + mobil parallellt.** De delar dev-server och ger falska failures.

## Anti-patterns

- **För många E2E.** Täck kritiska flöden, inte varje edge case. Unit-tester är billigare.
- **Sköra selektorer.** `.border.rounded-lg` går sönder vid CSS-ändring. Använd roller och labels.
- **Dolda beroenden.** Test B förutsätter att Test A kördes först -- gör varje test oberoende.
- **Blandade syften.** Ett test som testar bokning + betalning + recension testar ingenting bra.
- **waitForTimeout.** Döljer timing-problem istället för att lösa dem.
- **networkidle.** Resolverar aldrig i specs med SWR-polling. Använd `domcontentloaded` + explicit element-wait.

## Definition of Done för E2E

- [ ] Testet beskriver ett tydligt användarflöde
- [ ] Kör isolerat utan beroende på andra specs
- [ ] Seed-data markerad med `E2E-spec:<tag>`, cleanup i `afterAll`
- [ ] Rate-limit reset i `beforeEach`
- [ ] Stabila selektorer (inga CSS-klasser)
- [ ] Inga `waitForTimeout()` utan tydlig motivering
- [ ] Passerar 3 gånger i rad lokalt utan flakiness
