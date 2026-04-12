---
title: "Sprint 24: Parallell refactoring"
description: "Första parallella sprinten -- webb tech debt + iOS/docs i separata sessioner"
category: sprint
status: draft
last_updated: 2026-04-12
tags: [sprint, parallel, refactoring, tech-debt, ios]
sections:
  - Sprint Overview
  - Bakgrund
  - Parallelliseringsplan
  - Stories Session 1 (webb)
  - Stories Session 2 (iOS + docs)
  - Exekveringsplan
---

# Sprint 24: Parallell refactoring

## Sprint Overview

**Mål:** Minska tech debt i de största filerna + iOS-polish + docs-cleanup. Första sprinten som testar parallella sessioner med domänuppdelning.

**Bakgrund:** Sprint 23 halverade tokenförbrukningen. Backloggen har tech debt-items som passar perfekt för parallellisering -- webb-refactoring och iOS/docs rör helt separata filer.

---

## Parallelliseringsplan

```
Session 1 (huvudrepo):  S24-1 -> S24-2 -> S24-3 -> S24-4   (webb)
Session 2 (worktree):   S24-5 -> S24-6 -> S24-7 -> S24-8   (ios + docs)
```

**Domänöverlapp:** Ingen. Session 1 rör `src/domain/`, `src/components/`, `src/app/api/`, `.github/`. Session 2 rör `ios/`, `docs/`, `src/lib/help/`, `.claude/rules/`.

**Undantag:** S24-6 (hjälpartiklar) rör `src/lib/help/` som tekniskt ligger i `src/`. Men inga andra stories rör den katalogen, så ingen konflikt.

**Startordning:** Session 1 FÖRST. Vänta tills den registrerat sig i status.md. SEDAN session 2.

---

## Stories Session 1: Webb (tech debt + säkerhet)

### S24-1: Extrahera BookingValidation + dependency-factory

**Prioritet:** 1
**Domän:** webb
**Effort:** 2-3h
**Roll:** fullstack

BookingService.ts är 986 rader. Extrahera validering och dependencies utan att ändra API:t.

**Analys (spike):**
- 5 privata validate-metoder (381 rader): `validateService`, `validateProvider`, `validateClosedDay`, `validateRouteOrder`, `validateTravelTime`
- Dependency-factory (100 rader): `getService`, `getProvider`, `getAvailabilityException`, etc.
- Delas av `createBooking`, `createManualBooking` och `rescheduleBooking`
- 1561 rader tester fångar regressioner

**Implementation:**
- Ny `src/domain/booking/BookingValidation.ts` -- alla 5 validate-metoder
- Ny `src/domain/booking/BookingDependencyFactory.ts` -- dependency-factory
- BookingService importerar och använder dem -- inga route-ändringar behövs
- Flytta relevanta tester till `BookingValidation.test.ts`

**INTE:**
- Dela BookingService i tre services (onödig komplexitet)
- Ändra publika metoder eller factory-signaturer
- Röra routes -- alla 17 konsumenter ska fungera utan ändring

**Acceptanskriterier:**
- [ ] BookingService.ts under 600 rader
- [ ] BookingValidation.ts skapad med alla validate-metoder
- [ ] Alla 1561 befintliga tester passerar
- [ ] Inga route-ändringar
- [ ] `npm run check:all` grön

---

### S24-2: Extrahera ManualBookingDialog steg-komponenter

**Prioritet:** 2
**Domän:** webb
**Effort:** 2-3h
**Roll:** fullstack

ManualBookingDialog.tsx är 752 rader. Extrahera steg till egna komponenter.

**Implementation:**
- Identifiera stegen i dialogen (troligen: välj kund, välj tjänst, välj tid, bekräfta)
- Extrahera varje steg till egen komponent i samma katalog
- Behåll state-hantering i ManualBookingDialog (orkestrerare)
- Mobil-först: verifiera att alla steg fungerar på mobil

**Acceptanskriterier:**
- [ ] ManualBookingDialog.tsx under 300 rader
- [ ] Steg-komponenter i `src/components/calendar/`
- [ ] Visuellt identisk (ingen UI-ändring)
- [ ] `npm run check:all` grön

---

### S24-3: Snabba säkerhetsfixar

**Prioritet:** 3
**Domän:** webb
**Effort:** 30 min
**Roll:** fullstack

Tre snabba items från backloggen:

1. **Haiku daterat modell-ID** (5 min) -- byt `claude-haiku-4-5-20251001` till `claude-haiku-4-5` i VoiceInterpretationService.ts
2. **Cron-endpoints x-vercel-signature** (15 min) -- verifiera `x-vercel-signature` header som komplement till CRON_SECRET
3. **CSP report-to** (15 min) -- lägg till `report-to` directive i CSP-headern, skicka till Sentry

**Acceptanskriterier:**
- [ ] Haiku alias, inte daterat ID
- [ ] Cron-endpoints verifierar x-vercel-signature
- [ ] CSP report-to konfigurerat
- [ ] Tester för varje ändring

---

### S24-4: Dependabot auto-merge för patch

**Prioritet:** 4
**Domän:** infra
**Effort:** 15 min
**Roll:** fullstack

Dependabot skapar PRs men ingen mergar dem. Konfigurera auto-merge för patch-uppdateringar.

**Implementation:**
- GitHub Actions workflow som auto-godkänner och mergar Dependabot PRs för patch-versioner
- Bara patch (0.0.x), inte minor eller major

**Acceptanskriterier:**
- [ ] Auto-merge workflow skapad
- [ ] Bara patch-versioner auto-mergas
- [ ] CI måste passera innan merge

---

## Stories Session 2: iOS + docs

### S24-5: iOS cleanup (Task.detached + force unwrap)

**Prioritet:** 1
**Domän:** ios
**Effort:** 15 min
**Roll:** fullstack

Två SwiftUI Pro-fynd från S13-4:

1. `Task.detached` -> `Task` i AuthManager + PushManager
2. Force unwrap -> guard let i `AuthManager.exchangeSessionForWebCookies()`

**Acceptanskriterier:**
- [ ] Inga `Task.detached` kvar
- [ ] Inga force unwraps i AuthManager
- [ ] iOS-tester passerar

---

### S24-6: Hjälpartiklar till markdown

**Prioritet:** 2
**Domän:** docs
**Effort:** 0.5 dag
**Roll:** fullstack

`articles.provider.ts` (1335 rader) och `articles.customer.ts` (788 rader) -- hjälpartiklar hårdkodade i TypeScript. Flytta till markdown-filer.

**Implementation:**
- Skapa `src/lib/help/articles/` med en .md-fil per artikel
- Ny loader som läser markdown vid build/runtime
- Behåll samma API (artikeldata-struktur) så UI:t inte behöver ändras
- Ta bort de gamla TypeScript-filerna

**Acceptanskriterier:**
- [ ] Artiklar i markdown-filer
- [ ] 2100+ rader TypeScript borta
- [ ] Hjälpsidorna fungerar identiskt
- [ ] `npm run check:all` grön

---

### S24-7: Legacy docs svenska tecken

**Prioritet:** 3
**Domän:** docs
**Effort:** 0.5 dag
**Roll:** fullstack

~325 rader i ~10 docs-filer har ASCII-substitut istället för å, ä, ö (onboarding-spike, voice-logging-spike, m.fl.).

**Acceptanskriterier:**
- [ ] Alla docs-filer har korrekta svenska tecken
- [ ] `npm run check:swedish` varning minskar
- [ ] Inga innehållsändringar (bara teckenfix)

---

### S24-8: Applicera parallel-sprint-regler

**Prioritet:** 4
**Domän:** docs
**Effort:** 30 min
**Roll:** fullstack

Applicera utkastet i `docs/plans/parallel-sprint-draft.md` på auto-assign.md och autonomous-sprint.md. Baserat på erfarenheten från denna sprint.

**Implementation:**
- Uppdatera auto-assign.md med worktree-beslut, domäntaggar, startordning
- Uppdatera autonomous-sprint.md med parallell-stöd
- Flytta utkastet till docs/archive/

**Acceptanskriterier:**
- [ ] auto-assign.md hanterar worktree automatiskt
- [ ] autonomous-sprint.md stödjer domänfiltrering
- [ ] Utkastet arkiverat

---

## Exekveringsplan

```
Startordning: Session 1 FÖRST, vänta, SEDAN session 2.

Session 1 (huvudrepo, webb):
  S24-1 (2-3h, BookingValidation) -> S24-2 (2-3h, ManualBookingDialog) -> S24-3 (30m, säkerhet) -> S24-4 (15m, Dependabot)

Session 2 (worktree, ios+docs):
  S24-5 (15m, iOS cleanup) -> S24-6 (0.5d, hjälpartiklar) -> S24-7 (0.5d, svenska tecken) -> S24-8 (30m, parallel-regler)
```

**Total effort:** ~1.5 dag per session, ~1.5 dag elapsed (parallellt).

## Definition of Done (sprintnivå)

- [ ] BookingService.ts under 600 rader
- [ ] ManualBookingDialog.tsx under 300 rader
- [ ] 2100 rader content-as-code borta (hjälpartiklar)
- [ ] Parallella sessioner testade och dokumenterade
- [ ] `npm run check:all` grön i BÅDA sessioner
- [ ] Alla PRs mergade via GitHub
