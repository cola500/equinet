---
title: "S40-0: Svenska + datum-veckodag + touch-target 44pt"
description: "Plan för att polera SmartReplyChips från hackathon-version till prod-standard"
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Syfte
  - Filer som ändras
  - Steg
  - Risker
---

# S40-0: Svenska + datum-veckodag + touch-target 44pt

## Aktualitet verifierad

**Kommandon körda:** `Read SmartReplyChips.tsx`, `Read page.tsx`
**Resultat:** `SmartReplyChips.tsx` har 5 templates inkl. "Min adress: {adress}", `min-h-[36px]` finns i className, datum-format saknar `weekday`. Allt stämmer med sprint-spec.
**Beslut:** Fortsätt

## Syfte

Polera hackathon-prototypen `SmartReplyChips` till prod-standard: korrekta svenska templates, datum med veckodag, och 44pt touch-target enligt ui-components.md.

## Filer som ändras

- `src/components/provider/messages/SmartReplyChips.tsx` -- templates, touch-target
- `src/app/provider/messages/[bookingId]/page.tsx` -- datum-format med veckodag

## Steg

1. **Steg 0 (FÖRE KOD)**: Ta before-screenshot med dev-server (desktop 1280×800 + mobil 375×667)
2. **Steg 1**: Ta bort template 4 ("Min adress: {adress}") + ta bort `adress` från `SmartReplyVars`
3. **Steg 2**: Skriv om templates till mer naturlig svenska (se sprint-doc)
4. **Steg 3**: Uppdatera datum-format: lägg till `weekday: "long"` i `toLocaleDateString`
5. **Steg 4**: Ändra `min-h-[36px]` -> `min-h-[44px]` i className, öka padding (`py-1.5` -> `py-2`)
6. **Steg 5**: Ta bort `adress` från `smartReplyVars`-byggaren i page.tsx
7. **Verifiering**: `npm run check:all` + visuell verifiering

## Risker

- `adress`-fältet kan användas någon annanstans -- verifiera med grep
- Padding-ökning kan ändra layout mer än förväntat -- verifiera visuellt
