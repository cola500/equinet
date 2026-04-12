---
title: "S9-10: Tom-tillstand vagledning"
description: "Forbattra tomma tillstand pa tjanster, bokningar och kunder"
category: plan
status: wip
last_updated: 2026-04-03
sections:
  - Analys
  - Forandringar
  - Filer
---

# S9-10: Tom-tillstand vagledning

## Analys

Tre leverantorssidor har tomma tillstand som kan forbattras:

| Sida | Nuvarande | Forbattring |
|------|-----------|-------------|
| Tjänster | Manuell Card+SVG+knapp | Byt till EmptyState-komponent (konsistens) |
| Bokningar | EmptyState med ikon+text, ingen action | Lagg till action om inga tjänster finns |
| Kunder | EmptyState med ikon+text+action | Redan bra -- ingen ändring |
| Dashboard | EmptyState for tjänster+bokningar | Redan bra -- ingen ändring |

## Forandringar

### 1. Tjänster: byt manuell Card till EmptyState

Ersatt ~40 rader manuell Card/SVG/Button med EmptyState-komponent.
EmptyState stodjer inte onClick-action -- bara href. Lagg till onClick-stod
(redan finns i interfacet men knappen renderar med href). Dubbelkolla: ja,
EmptyState stodjer redan onClick via action.onClick.

Dock: den befintliga knappen oppnar serviceDialog. EmptyState action stodjer
onClick -- använd det.

### 2. Bokningar: kontextuell tom-tillstand

Nar `filter === "all"` och inga bokningar:
- Om inga tjänster heller -> "Skapa tjänster forst for att borja ta emot bokningar" med action till /provider/services
- Om tjänster finns -> "Inga bokningar annu. De dyker upp har nar kunder bokar dina tjanster." (befintlig text)

## Filer

| Fil | Ändring |
|-----|---------|
| `src/app/provider/services/page.tsx` | Byt manuell Card till EmptyState |
| `src/app/provider/bookings/page.tsx` | Lagg till kontextuell tom-tillstand |
