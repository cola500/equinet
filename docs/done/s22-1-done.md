---
title: "S22-1 Done: Onboarding Welcome-vy"
description: "Ny welcome-vy for nya leverantorer pa dashboard"
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

# S22-1 Done: Onboarding Welcome-vy

## Acceptanskriterier

- [x] Ny leverantor ser welcome-vy vid forsta inloggning
- [x] Varje steg-knapp navigerar till ratt sida
- [x] Klara steg visas som grona bockar
- [x] "Visa dashboard anda" visar vanlig dashboard
- [x] Nar alla 4 klara -> welcome-vy forsvinner automatiskt
- [x] Mobil-responsiv (max-w-lg, touch targets 44px)
- [x] Tester: rendering med olika onboarding-status-kombinationer (10 tester)

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (Zod-validering, error handling, ingen XSS/SQL injection)
- [x] Unit tests skrivna FORST, 10 nya tester, coverage >= 70%
- [x] Feature branch, alla tester grona, 4/4 quality gates
- [x] Docs uppdaterade vid behov

## Reviews

- Kordes: code-reviewer, tech-architect (plan)
- code-reviewer: 4 minors, alla fixade (SSR-safe localStorage, aria-label, onDismiss wiring, plan-avvikelse noterad)
- tech-architect: 1 major (dismiss-logik agarskap), 2 minors (rubrik, dismiss internt). Alla addresserade.

## Avvikelser

- **Stats-korten doljs INTE** under onboarding (avvikelse fran plan). Welcome-vyn visas ovanfor befintligt innehall. Motivering: enklare implementation, stats-korten visar "0" men ar inte forvirrande med welcome-vyn ovanfor.

## Lardomar

- `replace_all` i Edit-verktyget ar farligt med korta strangmatchningar -- `STORAGE_KEY` matchade aven som del av `ONBOARDING_STORAGE_KEY`, resulterade i `ONBOARDING_ONBOARDING_STORAGE_KEY`.
- JSDOM localStorage-mockar med Object.defineProperty fungerar bast med samma monster i alla testfiler -- spy-baserade approacher (vi.spyOn(Storage.prototype)) krockar med redan overskriven localStorage.
