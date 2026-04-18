---
title: "S37-1: Suspense skeleton i ThreadView"
description: "Ersätt fallback={null} med ThreadSkeleton för att undvika blank flash vid navigering"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Problem
  - Approach
  - Filer som berörs
  - Risker
---

# S37-1: Suspense skeleton i ThreadView

## Aktualitet verifierad

**Kommandon körda:** `grep -r "fallback={null}" src/app/provider/messages/`
**Resultat:** Hittad på rad 191 i `src/app/provider/messages/[bookingId]/page.tsx`
**Beslut:** Fortsätt

## Problem

`<Suspense fallback={null}>` i `src/app/provider/messages/[bookingId]/page.tsx` rad 191 ger en blank vy medan `useSearchParams()` löser upp. Detta är MAJOR-1 från S36-2-audit.

## Approach

Trivial UI-ändring, <30 min. Mekanisk ändring utan ny affärslogik.

1. Skapa inline `ThreadSkeleton`-komponent i samma fil (under 30 rader)
   - Header-skeleton (tillbaka-pil + namnplatshållare)
   - 3 meddelanderader med `animate-pulse`
   - Skriv-fält placeholder
2. Ersätt `fallback={null}` med `<ThreadSkeleton />`

## Filer som berörs

- `src/app/provider/messages/[bookingId]/page.tsx` — enda filen

## Risker

Ingen — rent UI, ingen affärslogik, ingen API-yta.
