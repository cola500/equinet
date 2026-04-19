---
title: "Plan S39-3: Messaging optimistisk uppdatering vid sändning"
description: "SWR mutate(optimisticData, false) i MessagingDialog och ThreadView"
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Aktualitet verifierad
  - Approach
  - Filer som ändras
  - Risker
---

# Plan S39-3: Messaging optimistisk uppdatering vid sändning

## Aktualitet verifierad

**Kommandon körda:**
- Läst `MessagingDialog.tsx` rad 91: `await mutate()` — ingen optimistic update
- Läst `ThreadView` rad 75: `await mutate()` — ingen optimistic update

**Resultat:** MINOR-3 bekräftad i båda filerna. Implementera.

**Beslut:** Fortsätt.

## Approach

Mönster (SWR 2.x):
1. Spara `prevData = data` innan
2. Skapa `optimisticMsg` med temp-id och `isFromSelf: true`
3. `mutate({ ...prevData, messages: [...prevData.messages, optimisticMsg] }, false)` — uppdatera cache omedelbart
4. `setContent("")` — töm input direkt
5. POST till API
6. Vid success: `await mutate()` — ersätt optimistic med server-data
7. Vid fel: `mutate(prevData, false)` + `setContent(trimmed)` — rollback + återställ input + toast

Duplicering bedöms under 15 unika rader per fil (en enkel logikändring). Ingen gemensam hook behövs.

## Filer som ändras

1. `src/components/customer/bookings/MessagingDialog.tsx` — handleSend uppdateras
2. `src/app/provider/messages/[bookingId]/page.tsx` — ThreadView handleSend uppdateras

## Risker

- Om `data` är undefined (loading state): optimistisk mutate med undefined → ingen ändring, men POST sker ändå. Guard: `if (!prevData) { ... }` — fallback till vanlig mutate.
- Timing: om SWR-polling hinner köra mellan optimistic update och server-response ersätts optimistic av server-data korrekt.
