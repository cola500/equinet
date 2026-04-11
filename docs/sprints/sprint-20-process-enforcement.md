---
title: "Sprint 20: Process Enforcement"
description: "Automatisera kontroll av processer som idag bara ar dokumenterade men inte uppfoljda"
category: sprint
status: draft
last_updated: 2026-04-10
tags: [sprint, quality, enforcement, ci, hooks]
sections:
  - Sprint Overview
  - Bakgrund
  - Stories
  - Exekveringsplan
---

# Sprint 20: Process Enforcement

## Sprint Overview

**Mal:** Automatisera kontroll av de viktigaste processerna som idag bara ar dokumenterade men inte uppfoljda. Fokus pa skydd med lagst effort.

**Bakgrund:** Process-audit (session 117) avslojde att flera "obligatoriska" krav saknar enforcement:
- Coverage-mal ar aspirationella, ingen CI-gate
- Repository pattern for karndomaner kontrolleras bara i code review
- Supabase `.eq()` ownership-filter har ingen automation
- Done-fil + status.md i samma commit gloms regelbundet
- BDD dual-loop-struktur valideras inte

**Princip:** Automatisera det som ger verkligt skydd med minst effort. Saker som funkar bra via code review behover inte lint-regler.

---

## Stories

### S20-1: Coverage-gate i CI

**Prioritet:** 1
**Effort:** 1h
**Roll:** fullstack

Lagg till coverage-threshold i vitest.config.ts och CI workflow.

**Implementation:**
- `vitest.config.ts`: `coverage.thresholds` med `lines: 70, branches: 60, functions: 70`
- CI workflow: `npm run test:run -- --coverage` med `--check-coverage`
- Lokal: `npm run test:coverage` script i package.json

**Acceptanskriterier:**
- [ ] CI failar om coverage < 70%
- [ ] `npm run test:coverage` visar coverage-rapport lokalt
- [ ] Dokumenterat i CLAUDE.md (Automated Quality Gates)

---

### S20-2: Supabase .eq() ownership audit-hook

**Prioritet:** 2
**Effort:** 30 min
**Roll:** fullstack

PostToolUse hook som varnar nar en Supabase-query saknar explicit `.eq()` for ownership.

**Implementation:**
- Ny hook: `.claude/hooks/post-supabase-query-check.sh`
- Triggas vid Edit/Write av `src/app/api/**/route.ts`
- Grep: om filen har `.from(` + `.select(` men saknar `.eq("providerId"` eller `.eq("userId"` -> varna
- Registrera i `.claude/settings.local.json`

**Acceptanskriterier:**
- [ ] Hook varnar vid ny Supabase-query utan .eq() filter
- [ ] Inga false positives pa publika endpoints (t.ex. `/api/stables`)
- [ ] Testfall: skapa route med .from() utan .eq() -> varning visas

---

### S20-3: Done-fil + status atomisk commit-check

**Prioritet:** 3
**Effort:** 30 min
**Roll:** fullstack

Utoka `definition-of-done.sh` hooken att kontrollera att done-fil och status.md committas tillsammans.

**Implementation:**
- I `definition-of-done.sh`: om staged filer innehaller `docs/done/*.md`, kontrollera att `docs/sprints/status.md` ocksa ar staged
- Varning (inte block) om status.md saknas

**Acceptanskriterier:**
- [ ] Varning vid commit av done-fil utan status.md
- [ ] Ingen varning vid vanliga commits utan done-fil
- [ ] Testfall: `git add docs/done/test.md && git commit` -> varning

---

### S20-4: Pre-commit repository pattern-varning

**Prioritet:** 4
**Effort:** 30 min
**Roll:** fullstack

PostToolUse hook som varnar vid `prisma.booking.`, `prisma.provider.`, etc. direkt i API routes (karndomaner ska anvanda repository).

**Implementation:**
- Utoka `post-api-route-verify.sh` med grep for `prisma\.(booking|provider|service|customerReview|horse|follow|subscription)\.`
- Varning: "Karndomaner ska anvanda repository pattern, inte Prisma direkt"
- Undantag: `$transaction`-block (kanda TS-problem)

**Acceptanskriterier:**
- [ ] Varning vid prisma.booking.findMany() i API route
- [ ] Ingen varning vid prisma.availability.findMany() (stoddomaner)
- [ ] Ingen varning i repository-filer (infrastructure/)

---

### S20-5: BDD dual-loop pasminnelse for karndomaner

**Prioritet:** 5
**Effort:** 30 min
**Roll:** fullstack

Utoka `tdd-reminder.sh` att paminna om BDD dual-loop nar en API route eller domain service redigeras.

**Implementation:**
- Om filen matchar `src/app/api/**/route.ts` eller `src/domain/**/*.ts`:
  - Kontrollera om `.integration.test.ts` finns i samma katalog
  - Om inte: paminn om BDD dual-loop med yttre integrationstest
- Befintlig TDD-paminnelse behalles for ovriga filer

**Acceptanskriterier:**
- [ ] Paminnelse om integration test vid API route-redigering
- [ ] Ingen paminnelse om integration test redan finns
- [ ] Befintlig TDD-paminnelse opaverkad for utilities/hooks

---

### S20-6: Dokumentera och stam av

**Prioritet:** 6 (sist)
**Effort:** 30 min
**Roll:** fullstack

- Uppdatera CLAUDE.md (Automated Quality Gates) med nya hooks och CI-gates
- Uppdatera `.claude/rules/` vid behov
- Kor `npm run check:all` + verifiering

**Acceptanskriterier:**
- [ ] CLAUDE.md uppdaterad
- [ ] Alla nya hooks dokumenterade
- [ ] `npm run check:all` gron

---

## Exekveringsplan

```
S20-1 (1h) -> S20-2 (30m) -> S20-3 (30m) -> S20-4 (30m) -> S20-5 (30m) -> S20-6 (30m)
```

**Total effort:** ~3-4h

Alla stories ar sekventiella (hooks bygger pa varandra).

## Definition of Done (sprintniva)

- [ ] Coverage-gate aktiv i CI
- [ ] Supabase .eq() hook installerad och testad
- [ ] Done+status atomisk check installerad
- [ ] Repository pattern-varning installerad
- [ ] BDD dual-loop-paminnelse installerad
- [ ] CLAUDE.md uppdaterad
- [ ] `npm run check:all` gron
