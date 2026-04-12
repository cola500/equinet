---
title: "S4-7 Done: Seed-data + visuell verifiering"
description: "Justerad demo-seed och visuell verifiering av due-for-service native"
category: retro
status: active
last_updated: 2026-04-01
sections:
  - Acceptanskriterier
  - Definition of Done
  - Lardomar
---

# S4-7 Done: Seed-data + visuell verifiering

## Acceptanskriterier

- [x] Minst 2 hästar visas som "overdue" i native-vyn (Bella 22d, Storm 15d)
- [x] Filter fungerar korrekt (Alla=3, Forsenade=2, Inom 2 veckor=1)
- [x] Screenshots tagna med mobile-mcp och verifierade
- [x] Seed-script fungerar med `npm run db:seed:demo:reset`

## Definition of Done

- [x] Fungerar som forvantat
- [x] Seed-data ger realistiskt due-for-service-scenario
- [x] Feature branch, alla tester grona
- [ ] Mergad till main (vantar review)

## Ändringar

| Fil | Ändring |
|-----|---------|
| `prisma/seed-demo.ts` | Storm: -7d -> -70d, Saga: -21d -> -49d, +Bella Hovvard -63d |

## Verifierade scenarios

| Hast | Tjänst | Dagar sedan | Intervall | Status | Dagar |
|------|--------|-------------|-----------|--------|-------|
| Bella | Hovvard utan beslag | 63d | 6v | Forsenad | -22d |
| Storm | Hovslagning | 70d | 8v | Forsenad | -15d |
| Saga | Hovslagning | 49d | 8v | Inom 2 veckor | +6d |

## Lardomar

1. **Xcode 26 simulator**: iPhone 16 Pro finns inte -- använd iPhone 17 Pro.
2. **Seed-data for due-for-service**: Completed-bokningar maste vara aldre an
   service-intervallet for att trigga overdue. 70 dagar > 8 veckor (56 dagar).
3. **mobile-mcp dialog-hantering**: iOS-simulatorn visar push-notis-dialog och
   Save Password-dialog vid forsta login. Avvisa manuellt innan navigering.
