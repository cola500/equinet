---
title: "Plan: S33-1 UX + visuell review av iOS-appen"
description: "Systematisk audit av alla 15 native-vyer via mobile-mcp + cx-ux-reviewer"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Aktualitet verifierad
  - Approach
  - Steg
  - Risker
---

# Plan: S33-1 UX + visuell review av iOS-appen

## Aktualitet verifierad

Verifietat 2026-04-18:

```
grep NativeBookingDetailView ios/Equinet/Equinet/ -rl
-> NativeBookingDetailView.swift bekräftad (skapad i S32-2)
```

15 Native*View.swift-filer bekräftade:
- NativeBookingDetailView, NativeBookingsView, NativeDashboardView
- NativeCustomersView, NativeServicesView, NativeCalendarView
- NativeProfileView, NativeReviewsView, NativeInsightsView
- NativeAnnouncementsView, NativeDueForServiceView, NativeGroupBookingsView
- NativeMoreView, NativeHelpView, NativeLoginView

Audit-story: verifiera att mobile-mcp och --debug-autologin fungerar i steg 1 (setup).

## Approach

Tre lager:
1. **mobile-mcp screenshots + accessibility tree** per vy -- visuell sanning
2. **cx-ux-reviewer subagent** på 3+ prioriterade filer -- strukturerad UX-analys
3. **Rapport** med fynd-tabell och triage -- backlog eller direktfix (<15 min)

Ingen ny kod om inte minor-fynd appliceras.

## Steg

1. **Setup & aktualitet**: Boota simulator, launch app, bekräfta screenshot fungerar
2. **Visuell audit** (15 vyer i prioritetsordning): screenshot + a11y tree per vy
3. **cx-ux-reviewer**: NativeBookingDetailView + 10 haptic-fixar från S32-3 + NativeDashboardView
4. **Rapport**: `docs/retrospectives/2026-04-18-ios-ux-audit.md`
5. **Triage**: blocker -> stopp, major -> backlog/ny story, minor -> direktfix eller backlog
6. **Verifiera**: `xcodebuild test -only-testing:EquinetTests`

## Risker

- mobile-mcp kan ha regredat (WebDriverAgent-timeout) -- om screenshot tar >10s: restart simulator
- --debug-autologin kräver dev-server; plan B: logga in manuellt
- cx-ux-reviewer på 12+ filer kan ge mycket output -- fokusera på kritiska fynd (blocker/major)

## Filer som berörs

- Inga källkodsändringar planerade (audit-story)
- `docs/retrospectives/2026-04-18-ios-ux-audit.md` (ny)
- `ios-learnings.md` om nya mönster hittas
- Eventuellt: minor-fixar i berörda Native*View.swift-filer
