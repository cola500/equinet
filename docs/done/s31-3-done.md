---
title: "Done: S31-3 Release-checklista som återanvändbart dokument"
description: "Skapade docs/testing/release-checklist.md med automatiska gates, kritiska flöden och pre-launch-blockerare"
category: plan
status: archived
last_updated: 2026-04-18
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Avvikelser
  - Lärdomar
---

# Done: S31-3 Release-checklista som återanvändbart dokument

## Acceptanskriterier

- [x] `docs/testing/release-checklist.md` skapad
- [x] Täcker kritiska flöden: registrering, e-postverifiering, fullständig bokningscykel, admin MFA
- [x] Täcker feature-specifika flöden: offline (webb + iOS), hjälpcentral, ruttplanering, onboarding-wizard, återkommande bokningar
- [x] Täcker pre-launch-blockerare: Apple Developer, Stripe live-mode, Vercel Pro
- [x] Länkad från README.md (Testing-sektion)
- [x] Format: checkbox per rad med "Var att klicka" + "Förväntat resultat" per punkt
- [x] `npm run check:all` grön -- 4/4 gröna

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker -- enbart markdown-content
- [x] Tester skrivna FÖRST -- inga nya routes/services
- [x] Feature branch, `check:all` grön
- [x] Content matchar kod: checklistan täcker faktiska features

## Reviews körda

Kördes: ingen (trivial -- dokumentationsändring, ingen ny logik eller API-yta, check:all grön)

## Docs uppdaterade

Uppdaterade:
- `docs/testing/release-checklist.md` (ny)
- `README.md` (länk tillagd under Testning-sektionen)

## Avvikelser

Inga.

## Lärdomar

- Release-checklistan är mest värdefull som levande dokument -- den bör uppdateras när nya features lanseras
- Tabellformat (Steg | Var | Förväntat resultat) är lättare att bocka av än löptext
- Pre-launch-blockerare är viktigt att separera från QA-checkpoints -- de blockerar lansering av helt andra skäl
