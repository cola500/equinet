---
title: "S9-8: Onboarding-checklista pa dashboard"
description: "Justera befintlig checklista sa att stegen matchar sprintens krav, lagg till tester"
category: plan
status: wip
last_updated: 2026-04-02
sections:
  - Analys
  - Forandringar
  - Filer
  - TDD-plan
  - Risker
---

# S9-8: Onboarding-checklista pa dashboard

## Analys

Komponenten `OnboardingChecklist` finns redan och renderas pa dashboarden.
API-routen `/api/provider/onboarding-status` finns och fungerar.

**Gap mellan sprint-krav och nuvarande implementation:**

| Sprint vill | Nuvarande | Status |
|-------------|-----------|--------|
| Fyll i foretagsinformation | `profileComplete` (buntar ihop profil + plats) | Behover splittas |
| Lagg till minst en tjanst | `hasServices` | OK |
| Satt oppettider | `hasAvailability` | OK |
| Lagg till serviceomrade | Ingat separat steg -- inbakat i `profileComplete` | Behover brytas ut |

**Nuvarande `profileComplete` kollar:** businessName, description, address, city, postalCode, latitude, longitude.

**Nuvarande checklist har ocksa:** "Aktivera bokningar" (`isActive`) -- finns INTE i sprint-kraven.

## Forandringar

### 1. Splitta `profileComplete` -> `profileComplete` + `hasServiceArea`

**API-route (`onboarding-status/route.ts`):**
- `profileComplete`: businessName + description + address + city + postalCode (utan lat/lng)
- `hasServiceArea`: latitude !== null && longitude !== null (ny flagga)
- `allComplete`: profileComplete && hasServices && hasAvailability && hasServiceArea
- Ta bort `isActive` fran onboarding-status (inte relevant for onboarding)

### 2. Uppdatera OnboardingChecklist-komponenten

Nya steg (matchar sprint, justerad ordning):
1. "Fyll i foretagsinformation" -> `/provider/profile`
2. "Lagg till minst en tjanst" -> `/provider/services`
3. "Satt oppettider" -> `/provider/profile?section=availability`
4. "Lagg till serviceomrade" -> `/provider/profile?section=location`

Ta bort: "Aktivera bokningar"

### 3. Uppdatera OnboardingStatus interface

```typescript
interface OnboardingStatus {
  profileComplete: boolean
  hasServices: boolean
  hasAvailability: boolean
  hasServiceArea: boolean
  allComplete: boolean
}
```

### 4. Uppdatera PriorityActionCard

`onboardingComplete` drivs redan av `allComplete` -- ingen andring behovs.

## Filer

| Fil | Andring |
|-----|---------|
| `src/app/api/provider/onboarding-status/route.ts` | Splitta profileComplete, lagg till hasServiceArea, ta bort isActive |
| `src/app/api/provider/onboarding-status/route.test.ts` | NY -- BDD dual-loop (integration) |
| `src/components/provider/OnboardingChecklist.tsx` | Uppdatera steg + interface |
| `src/components/provider/OnboardingChecklist.test.tsx` | NY -- unit-tester for komponent |

## TDD-plan

### Fas 1: RED -- API route tester

Integration-tester for `onboarding-status`:
- Returnerar 401 utan session
- Returnerar 404 om provider saknas
- Returnerar ratt status nar profil ar ofullstandig
- Returnerar `hasServiceArea: false` nar lat/lng saknas
- Returnerar `allComplete: true` nar allt ar klart
- `isActive` ska INTE finnas i response

### Fas 2: GREEN -- Justera API route

Implementera andringar i route.ts sa att testerna passerar.

### Fas 3: RED -- Komponent-tester

Unit-tester for OnboardingChecklist:
- Visar 4 steg med ratt labels
- Markerar klara steg med bockmarkering
- Doljs nar allComplete ar true
- Doljs nar dismissed (localStorage)
- Visar "X av 4 klara"

### Fas 4: GREEN -- Uppdatera komponent

Justera steg-array och interface.

### Fas 5: Verify

- `npx vitest run src/app/api/provider/onboarding-status`
- `npx vitest run src/components/provider/OnboardingChecklist`
- `npm run typecheck`

## Risker

- **Bakatkompabilitet**: iOS native dashboard anropar samma API. Kollar iOS-koden anvander `isActive`?
  - Kontrollera `NativeDashboardView` fore implementation.
- **localStorage-key**: Samma `STORAGE_KEY` som tidigare -- dismissade checklistor forblir dismissade. Kan behova resetta om stegen andras vasentligt.
