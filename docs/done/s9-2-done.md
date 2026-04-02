---
title: "S9-2: Stripe webhook idempotens-verifiering -- Done"
description: "Verifierat och hardnat webhook-idempotens med atomisk WHERE-guard"
category: retro
status: active
last_updated: 2026-04-02
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
  - Lardomar
---

# S9-2: Stripe webhook idempotens-verifiering -- Done

## Acceptanskriterier

- [x] Test bevisar idempotens (dubbel-event, samma resultat)
- [x] Befintlig `if (payment.status === "succeeded") return` bekraftad -- men kompletterad med atomisk DB-guard

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (atomisk WHERE forhindrar race condition)
- [x] Unit tests skrivna forst (9 tester), integration tests uppdaterade (5 tester)
- [x] Feature branch, alla tester grona (3908), check:all 4/4

## Avvikelser

Planen forutsatte att befintlig status-guard var tillracklig. Johan identifierade
race condition-risken: read-then-write ar inte atomiskt. Laget till `updateMany`
med `WHERE status NOT IN (...)` som riktig guard. Read-check behalles som
optimering (undviker onodigt `generateInvoiceNumber()`-anrop).

## Lardomar

- **Atomisk WHERE > read-then-check**: Prisma `updateMany` med status-guard i WHERE
  ar det ratta monstret for idempotens. `update` (som kraver unik WHERE) kan inte
  ta status-villkor, sa `updateMany` ar nodvandigt.
- **Concurrent Promise.all-test**: Simulerar race condition i unit-test genom att
  mocka `updatePaymentStatus` att returnera 1 forsta gangen och 0 andra.
  Verifierar att servicen hanterar baade "vann racet" och "forlorde racet".
- **Webhook triggar inte email**: En viktig insikt -- notiser skickas fran
  payment-routen, inte fran webhook. Om detta andras i framtiden maste
  email-sanding ocksa vara idempotent.
