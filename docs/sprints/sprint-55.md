---
title: "Sprint 55: iOS demo mode"
description: "iOS-appen speglar webb-appens demo mode — NativeMoreView och NativeProfileView filtreras på samma sätt som ProviderNav och profil-sidan."
category: sprint
status: planned
last_updated: 2026-04-24
tags: [sprint, demo, ios, native]
sections:
  - Sprint Overview
  - Stories
  - Definition of Done
---

# Sprint 55: iOS demo mode

## Sprint Overview

**Mål:** iOS-appen ska bete sig likadant som webb-appen i demo mode.

Webb-beteende (referens, `src/lib/demo-mode.ts` + `src/components/layout/ProviderNav.tsx`):
- Bottom nav visar bara 5 fasta flikar: Översikt, Kalender, Bokningar, Kunder, Tjänster
- Mer-fliken finns men visar bara "Min profil"
- Profilen döljer: Verifiering, Exportera data, Prenumeration, Radera konto, Omboka (self_reschedule), Återkommande (recurring_bookings)

Demo mode aktiveras via `demo_mode`-feature flag (DB) eller `NEXT_PUBLIC_DEMO_MODE=true` (env).
På iOS: `featureFlags["demo_mode"] ?? false` — dicten finns redan i alla native views.

**Effort-mål:** ~2h totalt, 2 filer.

---

## Stories

### S55-1: iOS demo mode — NativeMoreView + NativeProfileView

**Prioritet:** 1
**Effort:** 2h
**Domän:** `ios`
**Filer:**
- `ios/Equinet/Equinet/NativeMoreView.swift`
- `ios/Equinet/Equinet/NativeProfileView.swift`

**NativeMoreView — vad ska ändras:**

`visibleSections` filtrerar idag bara på feature flags. Lägg till demo mode-filtrering:
- När `demo_mode` är true: visa bara menyalternativet "Min profil" (`/provider/profile`)
- Alla andra items döljs (Tjänster, Kunder, Recensioner, Ruttplanering etc.)

Referens: webb linje 194 + 298 i `ProviderNav.tsx`:
```
const visibleMoreItems = demo ? [] : secondaryNavItems.filter(isVisible)
moreItems={demo ? visibleMoreItems.filter((i) => i.href === "/provider/profile") : visibleMoreItems}
```

**NativeProfileView — vad ska ändras:**

Lägg till `let isDemoMode = featureFlags["demo_mode"] ?? false` och använd den för att dölja:
- `linksSection` (innehåller Verifiering + Exportera data) — dölj helt i demo
- `dangerZoneSection` (Radera konto) — dölj i demo
- `rescheduleSection` — ändra villkor: `featureFlags["self_reschedule"] ?? false && !isDemoMode`
- `recurringSection` — ändra villkor: `featureFlags["recurring_bookings"] ?? false && !isDemoMode`

Referens: webb `src/app/provider/profile/page.tsx` rad 65–66, 374–491.

**Acceptanskriterier:**
- [ ] Mer-fliken visar bara "Min profil" när demo_mode är true
- [ ] Profil-fliken döljer Verifiering, Exportera data, Radera konto i demo mode
- [ ] Omboka och Återkommande-sektionerna döljs i demo mode
- [ ] Normalt läge (demo_mode false) är opåverkat
- [ ] XCTest-tester för ProfileViewModel eller MoreViewModel täcker demo-filtrering (om testbar)

**Reviews:** code-reviewer + ios-expert (iOS Swift-filer)

---

## Definition of Done

- [ ] S55-1 done: iOS beter sig likadant som webb i demo mode
- [ ] Visuell verifiering med mobile-mcp (Mer-fliken + Profil-fliken i demo mode)
- [ ] Normalt läge opåverkat (regressionstest)

**Inte i scope:**
- Ändra vilka 5 flikar som visas i tab baren i demo mode (webb har 5 fasta flikar men iOS tab bar-struktur skiljer sig)
- Demo mode-aktivering/inloggningsflöde
