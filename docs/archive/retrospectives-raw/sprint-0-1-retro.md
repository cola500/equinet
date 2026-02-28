# Sprint 0 & 1 Retrospectives

> Sammanfattning av learnings från Sprint 0 (2025-11-19) och Sprint 1 (2025-11-21).

## Innehåll

1. [Sprint 0 Retrospective](#sprint-0-retrospective-2025-11-19)
2. [Sprint 1 Retrospective](#sprint-1-retrospective-2025-11-21)
3. [Key Learnings](#key-learnings)
4. [Process Improvements](#process-improvements)

---

## Sprint 0 Retrospective (2025-11-19)

### Vad Gick Bra

- **Solid DDD foundation** - 150 tests, 100% coverage, rätt patterns (Entity, ValueObject, Result, Guard)
- **TDD fungerade** - Design blev bättre, tests först är rätt väg
- **Feature branch workflow** - Atomära commits, clean git history
- **Repository abstraction** - Separerar domain från Prisma korrekt

### Vad Kunde Varit Bättre

- **6 test regressions** - Pre-merge gate för svag (körde bara nya filer, inte full suite)
- **API-test antipattern** - Testade implementation (Prisma syntax) istället för beteende (API contract)
- **Repository pattern ofullständig** - Bara BookingRepository, inte Provider/Service
- **E2E tests skippades** - Hade fångat regressionerna

### Konkreta Förbättringar Implementerade

**Test Strategy Migration:**
```typescript
// Implementation-based (Sprint 0)
expect(prisma.provider.findMany).toHaveBeenCalledWith(
  expect.objectContaining({ include: {...} })
)

// Behavior-based (efter Sprint 0)
expect(response.status).toBe(200)
expect(data).toMatchObject({ id: expect.any(String), businessName: expect.any(String) })
expect(data.passwordHash).toBeUndefined() // Security assertion
```

---

## Sprint 1 Retrospective (2025-11-21)

### Vad Gick Bra

- **Repository Pattern är Solid** - Provider + Service repositories fungerar perfekt, redo för Booking
- **Behavior-Based Testing = Game Changer** - Tester överlevde `include` till `select` refactoring utan ändringar! Minskade test maintenance med ~70%
- **TDD Workflow Etablerad** - 100% coverage, tests först sparade faktiskt tid genom att klargöra requirements
- **Git Workflow Atomär** - Clean feature branches, lätt att revertera specifika features

### Vad Gick Mindre Bra

1. **Environment Setup Helt Odokumenterat (KRITISKT)**
   - Problem: E2E tests failade pga saknad `.env`, Playwright setup scripts laddade inte env vars
   - Impact: Skulle ha blockat produktion deployment + ny developer onboarding
   - Fix: Skapade `.env.example`, lade till `import 'dotenv/config'` i setup scripts, dokumenterade required vars
   - Learning: **"90% done" is not done** - Verifiera alltid i target environment

2. **E2E CI Integration Ofullständig (F1-3)**
   - Problem: Local E2E setup fungerar, men GitHub Actions saknar `DATABASE_URL` i alla jobs
   - Impact: CI kan inte enforcea "E2E must pass" gate än
   - Status: 90% klar, behöver 2-3h för att slutföra

3. **Pre-merge Gate Ej Automatiserad**
   - Problem: Manuell checklist i CLAUDE.md = human error risk
   - Impact: Risk att merge:a failing code om developer skippar checklist
   - Solution: GitHub branch protection + automated workflow

4. **Seed Data Management Ad-Hoc**
   - Problem: E2E tests antar specifik data finns, seed är manuellt, ingen garanti för deterministic data
   - Impact: Fungerar för MVP, kommer bryta vid större E2E suite
   - Risk: Flaky tests pga race conditions eller saknad data

### Metrics

| Metric | Värde |
|--------|-------|
| Unit tests | 343 passing (100%) |
| E2E tests | Local setup fungerar |
| Repository Pattern | Provider + Service |
| API Test Migration | 100% behavior-based |
| Sprint Completion | 4.5/5 features (90%) |

---

## Key Learnings

### 1. Behavior-Based Testing Pattern (MANDATORY)

```typescript
// BAD: Tests implementation (broke during refactoring)
expect(prisma.provider.findMany).toHaveBeenCalledWith(
  expect.objectContaining({include: {services: true, user: true}})
)

// GOOD: Tests API contract (survived refactoring, caught security issue)
expect(response.status).toBe(200)
expect(data[0]).toMatchObject({
  id: expect.any(String),
  businessName: expect.any(String),
})
expect(data[0].user.passwordHash).toBeUndefined() // Security assertion!
```

### 2. Environment Setup är Kritiskt

- Alltid ha `.env.example` med alla required vars
- Setup scripts MÅSTE ladda `dotenv/config` före Prisma
- Dokumentera setup i README "Getting Started"
- Seed data ska vara del av test workflow

### 3. Repository Pattern Overhead Motiverat

- Konsistens viktigare än minimal overhead
- Service KOMMER bli komplex (pricing rules, availability, packages)
- Gör testing lättare (mock repository vs Prisma)

---

## Process Improvements

Implementerade efter Sprint 1:

- **DoD Update:** Lagt till "Environment variables documented in `.env.example`"
- **Mid-Sprint Check-in:** 15-min sync för sprints >1 vecka för att fånga blockers tidigt
- **Proaktiv Agent Usage:** Använd security-reviewer för booking (payment-related), data-architect för komplex schema

---

## Relaterade Dokument

- [CLAUDE.md](../../CLAUDE.md) - Aktuell sprint-plan
- [AGENTS.md](../AGENTS.md) - Agent-team guide
- [Security Review 2026-01-21](2026-01-21-security-architecture-review.md) - Säkerhetsaudit
