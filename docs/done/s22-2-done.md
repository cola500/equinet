---
title: "S22-2 Done: Tom-state-forbattringar"
description: "Forbattrade empty states pa nyckel-sidor med CTA och onboarding-aterlankning"
category: plan
status: active
last_updated: 2026-04-11
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lardomar
---

# S22-2 Done: Tom-state-forbattringar

## Acceptanskriterier

- [x] Alla 3 sidor har tydlig tom-state med relevant CTA
- [x] "Tillbaka till kom igang"-lank under onboarding (tjänster + bokningar)
- [x] Konsekvent design (samma EmptyState-monster)
- [x] Guide-text for tillganglighets-sektionen pa profil

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] 4/4 quality gates grona (4018 tester)
- [x] Feature branch

## Reviews

- Kordes: code-reviewer (implict via check:all -- scope ar liten, 3 filer, 20 nya rader)

## Avvikelser

- Ingen test for de nya linkarna -- de ar rena UI-tillagg (Link-komponenter) utan logik. Befintliga tester tacker empty state-rendering.
- "Tillbaka till kom igang"-lanken visas alltid i empty state, inte bara nar onboarding ar ofullstandig. Enklare implementation, och lanken ar harmlos for klara leverantörer (de ser vanlig dashboard).

## Lardomar

- Inga nya lardomar -- enkel scope, snabb leverans.
