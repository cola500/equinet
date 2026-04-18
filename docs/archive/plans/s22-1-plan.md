---
title: "S22-1: Onboarding Welcome-vy"
description: "Plan for welcome-vy som ersatter tom dashboard for nya leverantorer"
category: plan
status: active
last_updated: 2026-04-11
sections:
  - Oversikt
  - Approach
  - Filer
  - Risker
---

# S22-1: Onboarding Welcome-vy

## Oversikt

Ny leverantor som loggar in forsta gangen (allComplete === false) ska motas av en tydlig welcome-vy istallet for tom dashboard med stats-kort som visar "0". Vyn guidar genom de 4 stegen i OnboardingChecklist.

## Approach

1. **Ny komponent `OnboardingWelcome`** (`src/components/provider/OnboardingWelcome.tsx`)
   - Tar `onboardingStatus` som prop (profileComplete, hasServices, hasAvailability, hasServiceArea)
   - Visar progress-bar (X av 4 klara)
   - 4 steg med status (gron bock / cirkel) + CTA-knapp
   - "Visa dashboard anda"-knapp som satter localStorage + callback
   - Mobil-forst: full-width, max-w-lg, vertikalt

2. **Villkorlig rendering i dashboard**
   - I `ProviderDashboard`: om `!onboardingComplete && !dismissed` -> visa `OnboardingWelcome` istallet for stats+snabblankar
   - Ateranvand befintlig `fetchOnboardingStatus()` och `onboardingComplete` state
   - Lagg till `dismissed` state (lases fran localStorage, samma nyckel som OnboardingChecklist)

3. **Tester**
   - `OnboardingWelcome.test.tsx`: rendering med olika status-kombinationer, dismiss-knapp, navigation

## Filer

| Fil | Andring |
|-----|---------|
| `src/components/provider/OnboardingWelcome.tsx` | NY -- welcome-komponent |
| `src/components/provider/OnboardingWelcome.test.tsx` | NY -- tester |
| `src/app/provider/dashboard/page.tsx` | ANDRAD -- villkorlig rendering |
| `src/components/provider/OnboardingChecklist.tsx` | ANDRAD -- exportera CHECKLIST_STEPS + STORAGE_KEY |

## Risker

- **Lag risk**: Bygger pa befintligt API och befintlig checklist-logik
- **localStorage-delning**: OnboardingChecklist och OnboardingWelcome delar STORAGE_KEY -- saker att exportera konstanten
