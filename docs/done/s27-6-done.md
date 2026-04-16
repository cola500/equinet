---
title: "S27-6: iOS cleanup -- Done"
description: "Verifiering att Task.detached och force unwraps redan fixade"
category: plan
status: active
last_updated: 2026-04-16
sections:
  - Acceptanskriterier
  - Avvikelser
---

# S27-6: iOS cleanup -- Done

## Acceptanskriterier

- [x] Inga `Task.detached` kvar (verifierat: grep hittar inga)
- [x] Inga force unwraps i AuthManager (verifierat: alla anvander guard let)
- [x] iOS-tester: ej korta (inga kodandringar gjorda)

## Definition of Done

- [x] Inga kodandringar behovdes

## Reviews

Kordes: ingen (inga kodandringar)

## Avvikelser

Bada problemen (Task.detached och force unwraps) ar redan fixade i tidigare sprintar. Ingen kodandring behovdes -- storyn ar en verifieringsuppgift.
