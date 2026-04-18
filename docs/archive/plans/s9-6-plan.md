---
title: "S9-6: Vercel Analytics + Backup-dokumentation"
description: "Lagg till Core Web Vitals tracking och dokumentera backup RPO/RTO"
category: plan
status: active
last_updated: 2026-04-02
sections:
  - Uppgifter
  - Filer som andras
---

# S9-6: Vercel Analytics + Backup-dokumentation

## Uppgifter

### Del 1: Vercel Analytics (15 min)

1. `npm install @vercel/analytics`
2. Lagg till `<Analytics />` i root layout (`src/app/layout.tsx`)
3. Verifiera att det bygger utan fel

### Del 2: Backup-dokumentation (45 min)

1. Skriv `docs/operations/backup-policy.md` med:
   - RPO/RTO for Supabase (vad garanterar de?)
   - Restore-steg (hur aterstarller vi?)
   - Vad vi sjalva behover gora vs vad Supabase ger automatiskt
2. Researcha Supabase backup-policy (free vs pro tier)

## Filer som andras

- `package.json` / `package-lock.json` (ny dependency)
- `src/app/layout.tsx` (Analytics-komponent)
- `docs/operations/backup-policy.md` (ny)
