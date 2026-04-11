---
title: "Sprint 21: Härdning inför lansering"
description: "Åtgärda säkerhetsfynd från härdningsgranskning -- webhook-idempotens, auth-luckor, monitoring"
category: sprint
status: active
last_updated: 2026-04-11
tags: [sprint, security, hardening, launch]
sections:
  - Sprint Overview
  - Bakgrund
  - Stories
  - Exekveringsplan
---

# Sprint 21: Härdning inför lansering

## Sprint Overview

**Mål:** Åtgärda alla Major-fynd från härdningsgranskningen (2026-04-11) så att inga kända säkerhetsluckor finns vid lansering.

**Bakgrund:** Tre parallella granskningar (security-reviewer, tech-architect, code-reviewer) identifierade 5 Major-problem och 15 Minor-problem. Denna sprint täcker alla Major plus de Minor-items som har högst ROI (snabba att fixa, stort skydd).

**Granskningskällor:**
- Security review: Stripe webhook, öppna routes, IDOR, headers, cookies
- Tech architect: infrastruktur, monitoring, incident response
- Code review: auth-routes, webhook-handlers, kodkvalitet

---

## Stories

### S21-1: Stripe webhook idempotens (event-ID dedup)

**Prioritet:** 1
**Effort:** 2h
**Roll:** fullstack

Stripe kan skicka samma event flera gånger vid retry. `PaymentWebhookService` har partiell idempotens (terminal state guard) men saknar event-ID dedup. `SubscriptionService` saknar replay-skydd helt.

**Implementation:**
- Skapa Prisma-modell `StripeWebhookEvent` med `eventId` (UNIQUE), `type`, `processedAt`
- I `src/app/api/webhooks/stripe/route.ts`: kontrollera `WHERE NOT EXISTS` före bearbetning
- I `SubscriptionService`: lägg till terminal-state-guards likt `PaymentWebhookService.guardNotInStatus()`
- Logga duplicerade events med `logger.info("Duplicate Stripe event skipped", { eventId })`

**Acceptanskriterier:**
- [ ] StripeWebhookEvent-tabell skapad med UNIQUE constraint på eventId
- [ ] Duplicerade events avvisas utan bearbetning
- [ ] SubscriptionService har terminal-state-guards (canceled kan inte skrivas tillbaka till active)
- [ ] Tester: replay av samma event -> no-op, concurrent events -> bara en bearbetas
- [ ] Migration skapad och testad lokalt

---

### S21-2: Auth på /api/routing + blockera test-endpoints

**Prioritet:** 2
**Effort:** 30 min
**Roll:** fullstack

Två separata problem:
1. `/api/routing` är en öppen OSRM-proxy utan auth
2. `/api/test/reset-rate-limit` skyddas av `NODE_ENV` som är `production` även på preview-deploys

**Implementation:**
- `/api/routing/route.ts`: lägg till `getAuthUser(request)` + 401-guard
- `/api/test/reset-rate-limit/route.ts`: lägg till extra guard, t.ex. kontrollera att `ALLOW_TEST_ENDPOINTS` env-variabel finns (bara satt lokalt och i CI)
- Alternativt: blockera `/api/test/*` i `middleware.ts` i produktion

**Acceptanskriterier:**
- [ ] `/api/routing` kräver inloggning
- [ ] `/api/test/*` routes blockerade på Vercel (preview + prod)
- [ ] Tester: oautentiserad request -> 401
- [ ] E2E-tester som använder reset-rate-limit fortsätter fungera lokalt

---

### S21-3: Auth-routes cleanup

**Prioritet:** 3
**Effort:** 1h
**Roll:** fullstack

Samlar tre relaterade auth-route-problem i en story:
1. `register/route.ts` har manuell IP-extraktion istället för `getClientIP()`
2. `resend-verification` och `verify-email` saknar `.strict()` på Zod-schema
3. Inkonsekvent `RateLimitServiceError`-hantering (500 istället för 503) i 4 auth-routes
4. `native-session-exchange` saknar Zod-validering på `refreshToken`

**Implementation:**
- Byt `x-forwarded-for`-logik till `getClientIP(request)` i register-routen
- Lägg till `.strict()` på alla Zod-scheman i auth-routes
- Lägg till inner try/catch för `RateLimitServiceError` -> 503 i: forgot-password, resend-verification, reset-password, register
- Lägg till Zod-schema för `refreshToken` i native-session-exchange (optional string)
- Uppdatera befintliga tester

**Acceptanskriterier:**
- [ ] Alla auth-routes använder `getClientIP()`
- [ ] Alla Zod-scheman har `.strict()`
- [ ] `RateLimitServiceError` -> 503 i alla auth-routes
- [ ] `refreshToken` valideras med Zod
- [ ] Befintliga tester fortsätter passera

---

### S21-4: Uptime-monitoring + Stripe webhook alerting

**Prioritet:** 4
**Effort:** 30 min
**Roll:** fullstack

Sentry fångar appfel men inte nedtid. Stripe webhook-failures har ingen notifieringskanal.

**Implementation:**
- Registrera `/api/health` i Betterstack (gratis) eller UptimeRobot med 5-minutersintervall
- Aktivera webhook-alerts i Stripe Dashboard -> Webhooks -> Alerts (e-post)
- Dokumentera i `docs/operations/monitoring.md`

**Acceptanskriterier:**
- [ ] Uptime-monitoring aktiv på `/api/health`
- [ ] Stripe webhook-alerts aktiverade
- [ ] Dokumenterat i operations-docs

---

### S21-5: CSP + HSTS + preview-skydd (snabba vinsterna)

**Prioritet:** 5
**Effort:** 30 min
**Roll:** fullstack

Tre snabba security header-förbättringar:
1. HSTS: lägg till `; preload`
2. CSP `connect-src`: pinna till specifik Supabase-subdomän istället för wildcard
3. Rate limiting på `/api/widget/next-booking` och `/api/auth/session`

**Implementation:**
- `next.config.ts`: uppdatera HSTS-header med `; preload`
- `next.config.ts`: byt `*.supabase.co` till `zzdamokfeenencuggjjp.supabase.co` i connect-src
- `widget/next-booking/route.ts`: lägg till `rateLimiters.api()`
- `auth/session/route.ts`: lägg till `rateLimiters.api()`

**Acceptanskriterier:**
- [ ] HSTS inkluderar `preload`
- [ ] CSP connect-src pinnad till specifik subdomän
- [ ] Rate limiting på widget/next-booking och auth/session
- [ ] Appen fungerar som vanligt (ingen CSP-blockering)

---

### S21-6: Dokumentera och stäm av

**Prioritet:** 6 (sist)
**Effort:** 30 min
**Roll:** fullstack

- Uppdatera backlog.md: flytta åtgärdade items till Genomfört
- Uppdatera CLAUDE.md Key Learnings med nya gotchas (event-ID dedup, test-endpoint guard)
- Kör `npm run check:all` + verifiering

**Acceptanskriterier:**
- [ ] Backlog uppdaterad
- [ ] CLAUDE.md uppdaterad med nya learnings
- [ ] `npm run check:all` grön
- [ ] Alla Major-fynd åtgärdade eller dokumenterat varför inte

---

## Exekveringsplan

```
S21-1 (2h, Stripe dedup) -> S21-2 (30m, auth+test) -> S21-3 (1h, auth cleanup) -> S21-4 (30m, monitoring) -> S21-5 (30m, headers) -> S21-6 (30m, docs)
```

**Total effort:** ~5h

S21-1 först -- största risken. S21-2-3 täpper auth-luckor. S21-4-5 är snabba observability/header-vinster. S21-6 stämmer av.

## Definition of Done (sprintnivå)

- [ ] Inga kvarvarande Major-fynd från härdningsgranskningen
- [ ] Stripe webhook idempotent (event-ID dedup + terminal-state-guards)
- [ ] Inga öppna proxyer utan auth
- [ ] Test-endpoints blockerade i prod
- [ ] Uptime-monitoring aktiv
- [ ] `npm run check:all` grön
