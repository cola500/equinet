---
title: "S21-5 Done: CSP + HSTS + rate limiting"
description: "HSTS preload, CSP pinning, rate limiting pa widget + session"
category: retro
status: active
last_updated: 2026-04-11
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
---

# S21-5 Done

## Acceptanskriterier

- [x] HSTS inkluderar preload
- [x] CSP connect-src pinnad till specifik Supabase-subdoman (zzdamokfeenencuggjjp)
- [x] Rate limiting pa widget/next-booking och auth/session
- [x] Appen fungerar som vanligt (typecheck + test + lint grona)

## Definition of Done

- [x] Fungerar, inga TypeScript-fel
- [x] Saker (CSP, HSTS, rate limiting)
- [x] 4008 tester grona
- [x] Feature branch

## Reviews

- Kordes: code-reviewer (inline, mekaniska andringar)
