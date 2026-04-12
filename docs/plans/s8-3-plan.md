---
title: "S8-3: Voice logging polish"
description: "5 smaafixar fran voice logging spike"
category: plan
status: wip
last_updated: 2026-04-02
sections:
  - Uppgifter
  - Approach
  - Filer som andras
  - Risker
---

# S8-3: Voice logging polish

## Uppgifter

| # | Uppgift | Fil | Ändring |
|---|---------|-----|---------|
| 1 | Sonnet 4.5 -> 4.6 | `VoiceInterpretationService.ts` rad 188 | Byt modell-ID |
| 2 | Confirm-route till withApiHandler | `api/voice-log/confirm/route.ts` | Migrera till withApiHandler-pattern |
| 3 | UTC-datumlogik | `api/voice-log/route.ts` rad 34-35, confirm/route.ts | Använd leverantorens tidszon |
| 4 | Vercel Preview API-nyckel | -- | **Johan gor detta** (Vercel dashboard, ej kod) |
| 5 | Verifiera SDK-timeout | `VoiceInterpretationService.ts` | Lagg till timeout pa Anthropic-klienten |

## Approach

Enkel TDD. Punkt 1 och 5 ar 1-rads-andringar. Punkt 2 ar withApiHandler-migration (~30 min). Punkt 3 krav verifiering mot befintliga tester.

### Fas 1: Modell-uppgradering + timeout (punkt 1, 5)
- Byt modell-ID fran `claude-sonnet-4-5-20250929` till `claude-sonnet-4-6-20250514`
- Lagg till timeout i Anthropic SDK-klienten (60s)
- Kolla att befintliga tester fortfarande passerar

### Fas 2: withApiHandler-migration (punkt 2)
- RED: Uppdatera tester for ny handler-signatur
- GREEN: Migrera confirm-route till withApiHandler
- Behall samma beteende, bara refaktorera strukturen

### Fas 3: UTC-datumlogik (punkt 3)
- RED: Skriv test som visar att sen kvall (23:00 svensk tid) filtrerar ratt dag
- GREEN: Använd leverantorens tidszon (eller explicit `Europe/Stockholm`) for datumfiltrering

### Fas 4: Verifiering
- `npm run check:all`

## Filer som andras

- `src/domain/voice-log/VoiceInterpretationService.ts` -- modell-ID + timeout
- `src/app/api/voice-log/confirm/route.ts` -- withApiHandler
- `src/app/api/voice-log/confirm/route.test.ts` -- uppdaterade tester
- `src/app/api/voice-log/route.ts` -- UTC-fix
- `src/app/api/voice-log/route.test.ts` -- UTC-tester

## Risker

1. **Modell-ID**: Maste verifiera att `claude-sonnet-4-6-20250514` ar korrekt via Anthropic docs.
2. **withApiHandler**: Confirm-routen har komplex logik (3 Prisma-operationer). Migrationen far inte andra beteende.
3. **Tidszon**: `Europe/Stockholm` ar hardkodat. Framtida leverantörer i andra tidszoner behovs hanteras, men det ar inte i scope nu.
