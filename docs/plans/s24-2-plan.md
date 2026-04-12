---
title: "S24-2: ManualBookingDialog steg-split"
description: "Extrahera steg-komponenter fran ManualBookingDialog.tsx"
category: plan
status: active
last_updated: 2026-04-12
sections:
  - Analys
  - Approach
  - Filer
  - Risker
---

# S24-2: ManualBookingDialog steg-split

## Analys

ManualBookingDialog.tsx ar 753 rader. Strukturen:

| Sektion | Rader | Kandidat for extrahering? |
|---------|-------|--------------------------|
| State + hooks | 64-217 | Nej -- delade av alla steg |
| handleSubmit | 225-403 | Nej -- orkestrering |
| JSX: Tjänst & Tid | 428-505 | JA (77 rader) |
| JSX: Kund | 507-618 | JA (111 rader) |
| JSX: Häst | 621-657 | Lite (36 rader) |
| JSX: Anteckningar | 659-669 | Nej (10 rader) |
| JSX: Recurring | 671-729 | JA (58 rader) |
| JSX: Submit | 731-748 | Nej (17 rader) |

## Approach

Extrahera 3 steg-komponenter. State-hantering STANNAR i ManualBookingDialog (orkestrerare).
Varje komponent tar in exakt de props den behover (ingen state-lifting).

### Komponenter att extrahera

1. **ServiceTimeStep** (~77 rader): Tjänst-select, datum, starttid, sluttid, dagsbokningar
2. **CustomerStep** (~111 rader): Sök/manuell-toggle, kundsökning, manuell inmatning
3. **RecurringStep** (~58 rader): Switch, intervall, antal tillfällen

**INTE extraherat:** Häst, anteckningar, submit (for korta for att motivera egna filer).

### Efter extrahering

ManualBookingDialog.tsx: ~753 - 77 - 111 - 58 + ~30 (props-passage) = ~537 rader.
Under 300-målet nås inte utan att bryta ut handleSubmit eller state -- det kräver hook-extrahering
som ar mer riskfyllt. 

**Uppdaterat mål:** Under 500 rader (realistiskt utan att bryta beteende).

Om under 300 krävs: extrahera `useManualBookingForm` custom hook med all state + handleSubmit.
Det ar en fas 2 om Johan vill.

## Filer

| Fil | Aktion |
|-----|--------|
| `src/components/calendar/ServiceTimeStep.tsx` | NY |
| `src/components/calendar/CustomerStep.tsx` | NY |
| `src/components/calendar/RecurringStep.tsx` | NY |
| `src/components/calendar/ManualBookingDialog.tsx` | ANDRAD |

## Risker

1. **State-koppling**: Varje steg behöver tillgång till state via props. Undviker context/store.
2. **Inga tester finns**: Komponenten har inga unit-tester. Refactoring ar rent mekanisk -- visuell verifiering behövs.
3. **Under 300 svårt**: Realistiskt mål ar ~500 rader. Under 300 kräver hook-extrahering.
