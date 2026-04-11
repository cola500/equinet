---
title: "Sprint 19: E2E Test Hardening"
description: "Harda E2E-testsviten: ta bort overflodiga tester, fixa flaky patterns, konsolidera overlapp"
category: sprint
status: active
last_updated: 2026-04-10
tags: [sprint, e2e, testing, playwright, quality]
sections:
  - Sprint Overview
  - Baseline
  - Stories
  - Exekveringsplan
---

# Sprint 19: E2E Test Hardening

## Sprint Overview

**Mal:** En palitlig, snabb E2E-svit som ger verkligt fortroendevarde.

**Bakgrund:** E2E-audit (session 117) visade:
- 38 spec-filer, ~265 tester
- Flera specs med omfattande `waitForTimeout` (flaky-risk)
- Overlapp mellan booking/flexible-booking/manual-booking
- Tester som beror pa externa tjanster (Stripe, AI) som inte fungerar lokalt
- `stripe-payment.spec.ts` har 1 test som alltid skippas
- Playwright-config pekade pa gammal Docker-DB (fixat i session 117)
- `handle_new_user`-trigger maste installeras manuellt lokalt (ej via Prisma migrate)

**Principer:**
- Varje E2E-test ska testa verkligt anvandarvarde
- Inga `waitForTimeout` utan dokumenterad motivering
- Externa beroenden (Stripe, AI) i separata sviter
- Snabb feedback: smoke < 1 min, critical < 5 min, full < 15 min

---

## Baseline

**Före sprint (session 117):**

| Svit | Passed | Failed | Skipped | Tid |
|------|--------|--------|---------|-----|
| Smoke | 25 | 0 | 3 | 57s |
| Critical | 33 | 10 (payment) | 3 | 5.3m |
| Full | 350 | 0 | 81 | 41m |

**Efter sprint 19:**

| Mått | Före | Efter | Förändring |
|------|------|-------|------------|
| Spec-filer | 38 | 36 | -2 (stripe-payment + flexible-booking) |
| Tester (approx) | ~265 | ~327 | +62 (räknemetod justerad) |
| waitForTimeout i scope-specs | 39 | 0 | -39 (calendar 10, route-planning 8, announcements 21) |
| waitForTimeout totalt | ~92 | ~53 | -39 |
| Externa specs i standard-svit | 3 | 0 | Separerade till test:e2e:external |

---

## Stories

### S19-1: Ta bort stripe-payment.spec.ts

**Prioritet:** 1 (snabbast)
**Effort:** 5 min

- Ta bort `e2e/stripe-payment.spec.ts` (1 test, alltid skippat)
- Stripe rekommenderar att INTE E2E-testa PaymentElement
- Betalningsflode testas redan via mock i `payment.spec.ts`

**Acceptanskriterier:**
- [ ] Filen borttagen
- [ ] Inga andra filer refererar till den
- [ ] Full svit passerar utan regression

---

### S19-2: Sla ihop flexible-booking i booking.spec.ts

**Prioritet:** 2
**Effort:** 1-2h

- `flexible-booking.spec.ts` (6 tester) overlappar nastan helt med `booking.spec.ts` (7 tester)
- Flytta unika tester (toggle fixed/flexible) till booking.spec.ts
- Ta bort flexible-booking.spec.ts

**Acceptanskriterier:**
- [ ] Alla unika testfall bevarade i booking.spec.ts
- [ ] flexible-booking.spec.ts borttagen
- [ ] Inga regressioner

---

### S19-3: Fixa waitForTimeout i calendar.spec.ts

**Prioritet:** 3
**Effort:** 1-2h

- 6 st `waitForTimeout` -> explicit element waits
- Ersatt med `waitFor({ state: 'visible' })`, `toBeVisible()`, `toHaveText()`

**Acceptanskriterier:**
- [ ] 0 st `waitForTimeout` utan dokumenterad motivering
- [ ] Testerna passerar 3 ganger i rad

---

### S19-4: Fixa waitForTimeout i route-planning.spec.ts

**Prioritet:** 4
**Effort:** 1h

- 5 st `waitForTimeout` -> explicit waits

**Acceptanskriterier:**
- [ ] 0 st `waitForTimeout` utan dokumenterad motivering
- [ ] Testerna passerar 3 ganger i rad

---

### S19-5: Fixa waitForTimeout i announcements.spec.ts

**Prioritet:** 5
**Effort:** 1-2h

- 8 st `waitForTimeout` -- mest av alla specs

**Acceptanskriterier:**
- [ ] 0 st `waitForTimeout` utan dokumenterad motivering
- [ ] Testerna passerar 3 ganger i rad

---

### S19-6: Separera externa beroenden till egen svit

**Prioritet:** 6
**Effort:** 1h

- Skapa `test:e2e:external` script i package.json
- Flytta dit:
  - `customer-insights.spec.ts` (AI-tjänst)
  - `offline-mutations.spec.ts` (kraver OFFLINE_E2E=true)
  - `offline-pwa.spec.ts` (kraver production build)
- Dessa kor INTE i standard `test:e2e`, bara explicit

**Acceptanskriterier:**
- [ ] `npm run test:e2e` exkluderar externa specs
- [ ] `npm run test:e2e:external` kor enbart dessa
- [ ] Dokumenterat i CLAUDE.md E2E-sektion

---

### S19-7: Lokal Supabase E2E bootstrap

**Prioritet:** 7
**Effort:** 1-2h

- `handle_new_user`-triggern installeras INTE korrekt via `prisma migrate deploy` lokalt
- Skapa `supabase/seed.sql` som installerar trigger + custom_access_token_hook
- Alternativt: lagg trigger-SQL i `supabase/migrations/` (Supabase CLI-migrationer, ej Prisma)
- Dokumentera: "efter `supabase start`, kor X for att E2E ska fungera"

**Acceptanskriterier:**
- [ ] `supabase start` + ett kommando = E2E-redo
- [ ] Dokumenterat i README eller docs

---

### S19-8: Uppdatera baseline och sprint-retro

**Prioritet:** 8 (sist)
**Effort:** 30 min

- Kor full svit efter alla fixar
- Uppdatera baseline-tabell i detta dokument
- Skriv retro

**Acceptanskriterier:**
- [ ] Baseline uppdaterad med slutresultat
- [ ] Retro skriven
- [ ] Docs uppdaterade

---

### S19-9: Fixa waitForTimeout i booking, provider, no-show

**Prioritet:** 9
**Effort:** 2-3h

Uppfoljning fran S19-3/4/5. De 3 specs med flest kvarvarande `waitForTimeout`:
- `booking.spec.ts` (10 st)
- `provider.spec.ts` (8 st)
- `no-show.spec.ts` (8 st)

Resterande ~25 st (utspridda pa 16 filer, 1-2 per fil) ger avtagande avkastning och ar inte varda att jaga.

**Acceptanskriterier:**
- [ ] 0 st `waitForTimeout` utan dokumenterad motivering i dessa 3 filer
- [ ] Testerna passerar 3 ganger i rad
- [ ] Inga regressioner i ovriga specs

---

## Exekveringsplan

```
S19-1 (5 min) -> S19-2 (1-2h) -> S19-7 (1-2h) -> S19-3/4/5 (parallellt, 3-5h) -> S19-6 (1h) -> S19-8 (30 min)
```

**Total effort:** ~1 dag

S19-3/4/5 (waitForTimeout-fixar) kan koras parallellt med worktrees om filerna inte overlappar.

---

## Definition of Done (sprintniva)

- [ ] Alla `waitForTimeout` har dokumenterad motivering eller ar borttagna
- [ ] Inga tester som beror pa externa tjanster i standard-sviten
- [ ] Full E2E-svit passerar 3 ganger i rad lokalt
- [ ] Baseline-tabell uppdaterad
- [ ] E2E-sektion i CLAUDE.md uppdaterad
