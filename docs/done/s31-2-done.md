---
title: "Done: S31-2 Admin testing-guide uppdatering"
description: "Uppdatering av admin testing-guide med MFA- och native iOS-testscenarier"
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

# Done: S31-2 Admin testing-guide uppdatering

## Acceptanskriterier

- [x] Testing-guide reflekterar nuvarande feature-set
- [x] Nya features har test-scenarier:
  - MFA för admin: 6 checkpoints (enrollment, QR, verifiering, felaktig kod)
  - Native iOS-flöden: 13 checkpoints (splash, kalender, bokningar, kunder, profil, offline, push, widget, synk)
- [x] Obsoleta scenarier borttagna eller markerade -- inga obsoleta hittades, alla features aktiva
- [x] Admin-sidan renderar korrekt -- testing-guide är markdown med frontmatter, renderas via admin/testing-guide

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (validering, error handling, ingen XSS/injection) -- enbart markdown-content
- [x] Tester skrivna FÖRST, coverage >= 70% -- inga nya routes/services
- [x] Feature branch, `check:all` grön -- 4/4 gröna
- [x] Content matchar kod: testing-guide uppdaterad med MFA och native iOS

## Reviews körda

Kördes: ingen (trivial -- dokumentationsändring, ingen ny logik eller API-yta, check:all grön)

## Docs uppdaterade

Uppdaterade:
- `docs/testing/testing-guide.md` (MFA-sektion + iOS native-sektion tillagda)

Ej uppdaterade (motivering): README, NFR, CLAUDE.md -- dokumentationsonly story

## Avvikelser

Inga. Alla scenarier begärda i storyn implementerades.

## Lärdomar

- Testing-guide var komplett för webb-features men hade inga iOS-flöden alls
- MFA-gapet var uppenbart -- admin/mfa/setup och admin/mfa/verify-sidor saknade testscenarier
- Framöver: nya features ska alltid ha en rad i testing-guide vid lansering (se Docs-matris i auto-assign.md)
