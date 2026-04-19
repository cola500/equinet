---
title: "Sprint 44: Testpyramid — TA BORT + Batch 2 + coverage-gap-fix"
description: "Fortsätt E2E-migrering: 3 specs raderas, 5 flyttas till integration, horses-CRUD-gap täpps. Svit: 29 → 21 specs."
category: sprint
status: planned
last_updated: 2026-04-19
tags: [sprint, testing, e2e, integration-tests, test-pyramid]
sections:
  - Sprint Overview
  - Status efter S43
  - Stories
  - Exekveringsplan
  - Risker
  - Definition of Done
---

# Sprint 44: Testpyramid — TA BORT + Batch 2 + coverage-gap-fix

## Sprint Overview

**Mål:** Fortsätt E2E-migrering efter S43. Radera 3 döda specs, migrera 5 enkla till integration-nivå, täpp S43-1:s coverage-gap för horses-CRUD. Efter sprinten: 29 → 21 E2E-specs.

**Bakgrund:** S43 levererade 7 migrationer (2 pilot + 5 batch) + förtydligad trivial-gating (PR #227). Kvar efter S43: 17 specs att adressera (10 integration + 4 component + 3 ta bort). Denna sprint tar de enklaste först.

**Scope-avgränsning:** Sparar SPLIT-specs (feature-flag-toggle, follow-provider, admin, recurring-bookings, provider) till S45 — de är tyngre och kräver två-fil-migration (integration + component). Component-migrationer (auth, customer-profile, municipality-watch, provider-profile-edit) parkeras också till S45.

---

## Status efter S43

| Kategori | Totalt | Gjort (S43) | Kvar |
|----------|--------|-------------|------|
| STANNA | 12 | 0 | 12 |
| FLYTTA → integration | 16 | 6 (pilot + batch 1) | 10 |
| FLYTTA → component | 5 | 1 (horses) | 4 |
| TA BORT | 3 | 0 | 3 |
| **E2E totalt** | **36** | **7 borta** | **29** |

**Efter S44 (scope):** 29 - 3 (ta bort) - 5 (batch 2) = **21 E2E-specs kvar**.

---

## Stories

### S44-0: TA BORT-batch — radera 3 döda specs

**Prioritet:** 0
**Effort:** 0.5 dag (3-4h)
**Domän:** tests (`e2e/*.spec.ts` + verifiering)

Radera de 3 specs som Discovery klassat som TA BORT. Verifiera motivering innan radering.

**Specs att radera:**

| Spec | Motivering (Discovery) | Verifiering före radering |
|------|------------------------|----------------------------|
| `announcements.spec.ts` (456 rader) | 50% skip, täcks av route-planning + route-announcement-notification + booking | Kör de 3 ersättar-specs, verifiera att de inte har skip där announcements täckte |
| `exploratory-baseline.spec.ts` (302 rader) | Catch-all, täcks av provider.spec.ts + admin.spec.ts + calendar.spec.ts | Sampla 5 tester i spec, verifiera motsvarande täckning i ersättare |
| `payment.spec.ts` (337 rader) | Stripe E2E fundamentalt brutet (iframe-sandbox). Täcks av `bookings/[id]/payment/route.integration.test.ts` + `webhooks/stripe/route.integration.test.ts` | Läs de 2 integration-testfilerna, verifiera coverage |

**Process per spec:**
1. Verifiera ersättar-täckning (läs ersättar-filerna, sampla tester)
2. Notera eventuella gap i batch-rapport
3. `git rm e2e/<spec>.spec.ts` med motivering i commit-message
4. Kör `npm run check:all` efter varje radering

**Acceptanskriterier:**
- [ ] 3 specs raderade från `e2e/`
- [ ] Per-spec-verifiering dokumenterad (vilka ersättare verifierades)
- [ ] Gap-rapport i `docs/metrics/testpyramid/removed-2026-04-XX.md` om något hittades
- [ ] `npm run check:all` grön efter alla raderingar
- [ ] E2E-svit: 29 → 26 specs

**Reviews:** code-reviewer (verifiera att ersättartäckning är legitim, inte bortförklaring)

**Arkitekturcoverage:** N/A

---

### S44-1: Batch 2 — 5 integration-migrationer

**Prioritet:** 1
**Effort:** 1 dag
**Domän:** tests (`src/app/api/**/*.integration.test.ts`)

Följ S43-2-mönstret: plan-commit först, en commit per migrerad spec, batch-rapport avslutningsvis med **coverage-gap per spec**.

**Specs i scope:**

| Spec | Rader | Mål-fil | Anmärkning |
|------|-------|---------|------------|
| `security-headers.spec.ts` | 100 | SPIKE först (30 min) — se nedan | SPIKE krävs per Discovery-plan |
| `customer-invite.spec.ts` | 98 | `src/app/api/customer-invite/route.integration.test.ts` | Enkel — HMAC-token-logik |
| `group-bookings.spec.ts` | 220 | `src/app/api/group-bookings/route.integration.test.ts` (finns redan delvis!) | Feature-flag-gatad — ignorera env-override-tester |
| `provider-notes.spec.ts` | 336 | `src/app/api/provider/customers/[id]/notes/route.integration.test.ts` | CRUD-anteckningar |
| `route-planning.spec.ts` | 235 | `src/app/api/routes/route.integration.test.ts` | Rutt-CRUD |

**SPIKE för security-headers (30 min, före migration-start):**

Verifiera om Next.js security-headers kan testas via integration-test-mönstret. Möjligheter:
- `NextRequest` → `NextResponse` visar inte `next.config.ts` headers
- Alternativ: starta Next.js test-server via `fetch('/')` — kräver extra setup
- Alternativ: testa middleware direkt om headers sätts där

**Efter SPIKE:**
- Om möjligt i integration: fortsätt med migration → ny `src/__tests__/security-headers.integration.test.ts`
- Om inte möjligt: markera security-headers som STANNA i Discovery-planen, dokumentera beslut

**Process per spec (samma som S43-2):**
1. Läs E2E-spec
2. Skriv integration-test med samma/utökad coverage (auth 401/403, happy path, edge cases)
3. Kör `npm run check:all`
4. Ta bort E2E-spec
5. Committa med meddelandet `feat(tests): S44-1 migrate <spec>.spec.ts → integration (<N> tests)`
6. Notera coverage-gap per spec för batch-rapporten

**Acceptanskriterier:**
- [ ] 4 specs migrerade (security-headers 5:e eller markerad STANNA)
- [ ] Plan-fil committad FÖRE implementation: `docs/plans/s44-1-plan.md`
- [ ] En commit per migrerad spec
- [ ] Batch-rapport i `docs/metrics/testpyramid/batch-2-2026-04-XX.md`:
  - Sammanfattning (antal, tidsvinst)
  - Per-spec coverage-gap-lista
  - Om security-headers: SPIKE-resultat + beslut
- [ ] `npm run check:all` grön
- [ ] E2E-svit: 26 → 21-22 specs

**Reviews:** code-reviewer (S43-2-precedent: kolla auth-täckning 401/403, IDOR-scenarios, smoke-motivering om tillämpligt)

**Arkitekturcoverage:** N/A

---

### S44-2: horses-CRUD coverage-gap + filter=upcoming-fix

**Prioritet:** 2
**Effort:** 1.5-2h
**Domän:** tests (`src/app/customer/horses/page.test.tsx` + `src/app/api/provider/due-for-service/route.integration.test.ts`)

Täpp två gap som S43-review hittade:

**Gap 1: horses-CRUD (1-2h)**
- Ursprung: S43-1 flyttade HorseForm till component-test men tappade täckning för page.tsx (delete-dialog, edit-flöde, fetch-felfall)
- Lösning: skapa `src/app/customer/horses/page.test.tsx` med MSW-mockade fetch-anrop
- Testa: delete-bekräftelsedialog, edit-flöde, fetch 401/500-felfall, tom-tillstånd

**Gap 2: filter=upcoming-test (15 min)**
- Ursprung: S43-2 batch-review — `due-for-service` route dokumenterar `filter=upcoming` men integration-testet saknar scenariot
- Lösning: lägg till 1-2 tester i `src/app/api/provider/due-for-service/route.integration.test.ts`

**Acceptanskriterier:**
- [ ] `page.test.tsx` med ≥5 tester för CRUD-scenarios + felhantering
- [ ] `filter=upcoming`-test tillagd i due-for-service-integration
- [ ] `npm run check:all` grön
- [ ] Backlog-rader för gap tas bort när stängda

**Reviews:** code-reviewer (verifiera att MSW-mockar är rimliga, inte överspecifika)

**Arkitekturcoverage:** N/A

---

## Exekveringsplan

```
Sekventiellt (ingen parallelisering inom sprinten):

S44-0 (0.5 dag, TA BORT) 
  → S44-1 SPIKE (30 min, security-headers) 
  → S44-1 plan-commit 
  → S44-1 batch (1 dag)
  → S44-2 (1.5-2h, coverage-gap-fix)
```

**Total effort:** ~2 dagar.

**Varför TA BORT först?** Snabb vinst (29 → 26 specs), rensar terrassen innan tyngre migreringar. Om något av ersättar-täckningarna visar sig vara bortförklaring hittar vi det tidigt.

---

## Risker

| Risk | Sannolikhet | Mitigering |
|------|-------------|-----------|
| announcements-täckning luddig (Discovery: "täcks av andra specs") | Medel | Verifieringssteg i S44-0 — om gap hittas: dokumentera i backlog-rad ELLER håll kvar specen |
| security-headers SPIKE blockerar S44-1 | Låg | Om SPIKE failar: fortsätt med 4 andra specs, markera security-headers STANNA och gå vidare |
| group-bookings feature-flag-beroende | Låg | `route.integration.test.ts` finns delvis — kontrollera att mönstret funkar utan flag |
| horses page.test.tsx — MSW-setup saknas | Medel | Om MSW inte finns etablerad: alternativet är `vi.mock('fetch')` direkt. Välj det enklare |

---

## Definition of Done (sprintnivå)

- [ ] S44-0: 3 specs raderade, ersättar-verifiering dokumenterad
- [ ] S44-1: plan-fil committad, 4-5 specs migrerade, batch-rapport med coverage-gap per spec
- [ ] S44-2: horses-CRUD-gap täppt, filter=upcoming-test tillagd
- [ ] E2E-svit: 29 → 21-22 specs
- [ ] `npm run check:all` grön
- [ ] Sprint-gates: `test:e2e:smoke` grön, `migrate:status` rent, `metrics:report` uppdaterad
- [ ] Docs-uppdatering: README testantal, CLAUDE.md gotchas (om SPIKE-beslut)
- [ ] Sprint-retro i `docs/retrospectives/<datum>-sprint-44.md`

**Inte i scope (sparas S45):**
- SPLIT-specs: feature-flag-toggle, follow-provider, admin, recurring-bookings, provider
- Component-migrationer: auth, customer-profile, municipality-watch, provider-profile-edit
- Fas 4 (rensa övriga skip-specs — mycket av detta görs automatiskt via TA BORT + migreringar)
- Fas 5 (hårdhärda smoke-tier — väntar tills sviten är ~12 specs)
