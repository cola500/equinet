---
title: "S9-6 Done: Vercel Analytics + Backup-dokumentation"
description: "Core Web Vitals tracking och backup RPO/RTO dokumenterat"
category: retro
status: active
last_updated: 2026-04-02
sections:
  - Acceptanskriterier
  - Definition of Done
  - Laerdomar
---

# S9-6 Done: Vercel Analytics + Backup-dokumentation

## Acceptanskriterier

- [x] `@vercel/analytics` installerat och `<Analytics />` i root layout
- [x] RPO/RTO dokumenterat i `docs/operations/backup-policy.md`
- [x] Restore-flow dokumenterad (dashboard + CLI)

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Dokumentation skriven
- [x] Feature branch, redo for review

Ej tillampligt:
- Tester (Analytics ar en drop-in-komponent, ingen logik att testa)
- Sakerhet (ingen ny funktionalitet som exponeras)

## Laerdomar

1. **Supabase free tier har oklar backup-retention** -- dokumentationen
   specificerar inte exakt hur lange backups sparas. `supabase db dump` ar
   obligatorisk komplement pa free tier.

2. **Storage API-objekt inkluderas INTE i backup** -- viktigt att veta om
   vi borjar anvanda Supabase Storage for bilder.

3. **PITR kraver Pro + Small compute** -- inte tillganglig pa free tier.
   2 min RPO ar bra for produktion med riktiga kunder.
