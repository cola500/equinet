---
title: "S21-2 Done: Auth pa routing + blockera test-endpoints"
description: "Auth pa OSRM-proxy, ALLOW_TEST_ENDPOINTS env guard"
category: retro
status: active
last_updated: 2026-04-11
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Laerdomar
---

# S21-2 Done

## Acceptanskriterier

- [x] /api/routing kraver inloggning (getAuthUser + 401)
- [x] /api/test/* routes blockerade pa Vercel (preview + prod) via ALLOW_TEST_ENDPOINTS
- [x] Tester: oautentiserad request -> 401
- [x] E2E-tester som anvander reset-rate-limit fortsatter fungera lokalt (playwright.config.ts)

## Definition of Done

- [x] Fungerar, inga TypeScript-fel
- [x] Saker (auth, validering)
- [x] Tester skrivna FORST (TDD), 12 tester grona
- [x] Feature branch, alla tester grona

## Reviews

- Kordes: code-reviewer (inline, enkel story)
- Skippad: security-reviewer (plan-review tillracklig, enkla andringar)

## Laerdomar

- **`vi.hoisted()`** kravs for alla mock-variabler som refereras i vi.mock factories (TDZ-problem)
- **NODE_ENV ar opålitlig**: Vercel satter `production` pa ALLA deploys inkl preview. Anvand explicita feature-env-variabler istallet.
