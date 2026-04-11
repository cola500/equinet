---
title: "Produktbacklog"
description: "Alla kända stories och uppgifter, speglar roadmap.md. Plockas in i sprintar vid behov."
category: sprint
status: active
last_updated: 2026-04-11
tags: [backlog, roadmap, planning]
sections:
  - Blockerare
  - Kritiskt
  - Kvalitet och säkerhet
  - iOS
  - Betalning
  - Features som kräver arbete
  - Genomfört (arkiv)
  - Research
---

# Produktbacklog

> Speglar `docs/roadmap.md`. Plockas in i sprintar vid behov.
> Prioritetsordning inom varje kategori.
> Senast genomgangen: 2026-04-11

## Blockerare (vantar pa Johan)

| Story | Blockerare | Effort |
|-------|-----------|--------|
| Push live (APNs) | Apple Developer 99 USD | Config, 15 min |
| Stripe live-mode | Stripe foretagsverifiering | Config, 15 min |
| Swish aktivering | Stripe foretagsverifiering | 1 rad kodandring |

## Kritiskt

| Story | Effort | Varför kritiskt |
|-------|--------|----------------|
| GDPR data retention policy | Mellanlång sikt | Radering av gammal data |

## Kvalitet och säkerhet

| Story | Effort | Prioritet |
|-------|--------|-----------|
| Preview deploy-skydd | 15 min | Preview-deploys är publika. Aktivera Vercel Password Protection. |
| Cron-endpoints x-vercel-signature | 30 min | CRON_SECRET bra, men x-vercel-signature som komplement = defense in depth. |
| Haiku daterat modell-ID | 5 min | `claude-haiku-4-5-20251001` i VoiceInterpretationService.ts rad 264. Byt till alias `claude-haiku-4-5`. |
| E-postverifiering Resend (S17-5) | 0.5 dag | Verifiera Resend-leverans i prod |
| MFA för admin | 1 dag | Supabase TOTP-enrollment + verifiering |
| CSP report-to | 15 min | Vi har CSP men vet inte när den blockerar i prod. Skicka till Sentry. |
| Dependabot auto-merge för patch | 15 min | PRs skapas men ingen mergar dem. Patch kan auto-mergas. |
| Migrationstest på ren DB i CI | 30 min | CI kör migrate deploy, inte reset. Fångar inte trasiga migrationer från scratch. |
| Legacy docs svenska tecken (325 rader) | 0.5 dag | ASCII-substitut i ~10 filer (onboarding-spike, voice-logging-spike, m.fl.) |
| E2E: fixa 77 skippade tester | 1-2 veckor | Låg prioritet |
| recurring_bookings E2E-verifiering | 1 dag | Medel |
| group_bookings E2E + UX-review | 2-3 dagar | Medel |
| withApiHandler resterande routes (131 st) | Löpande | Opportunistiskt |
| accept-invite affärslogik till AuthService | 1h | Komplex logik (token-validering, Supabase user creation, atomisk upgrade) direkt i route. Bör ligga i domain service. |
| console.* i legacy docs | 0.5 dag | Låg prioritet |

## iOS

| Story | Effort | Prioritet |
|-------|--------|-----------|
| `Task.detached` -> `Task` i AuthManager + PushManager | 5 min | Lag (SwiftUI Pro review S13-4) |
| Force unwrap -> guard let i AuthManager.exchangeSessionForWebCookies() | 5 min | Lag (SwiftUI Pro review S13-4) |

### iOS-migrering (6 kvarvarande provider WebView-skarmar)

| Skarm | Bakom flagga | Komplexitet | Beroende |
|-------|-------------|-------------|----------|
| Rostloggning | voice_logging | Hog (Speech + AI) | Inget (fungerar) |
| Annonsering | route_announcements | Medel | Inget |
| Business insights | business_insights | Medel (Recharts) | Inget |
| Ruttplanering | route_planning | Hog (Mapbox/OSRM) | Mapbox-token |
| Gruppbokningar | group_bookings | Hog | Inget |
| Hjalpcentral | help_center | Lag | Inget |

**Kundskärmar (alla WebView):** Bokningar, hästar, gruppbokningar, profil, FAQ, hjälp, export.

## Betalning

| Story | Effort | Beroende |
|-------|--------|----------|
| Swish i Payment Element | 1 rad + test | Stripe foretagsverifiering |
| Provider subscription (monetarisering) | 1-2 veckor | Prissbeslut |
| Fortnox-integration (fakturering) | 2-3 veckor | Fortnox API-access |

## Features som kraver arbete innan lansering

| Flagga | Problem | Effort |
|--------|---------|--------|
| route_planning | Kraver Mapbox-token | Mapbox-konto + token + verifiering 1-2 dagar |
| route_announcements | Beroende av route_planning | Loses med route_planning |
| business_insights | Behover realistisk data | Polish + seed-data 1-2 dagar |
| offline_mode | Komplex, inga E2E-tester | E2E + stabilisering 1-2 veckor |
| follow_provider | Varde vid volym | Verifiering vid skalning |
| municipality_watch | Varde vid volym | Verifiering vid skalning |
| stable_profiles | Aldrig testad i prod | Beslut: behalla eller ta bort? |

## Vid lansering

| Item | Effort | Motivering |
|------|--------|------------|
| Uppgradera till Vercel Pro | $20/man | Hobby tillater inte kommersiellt bruk |
| Rate limit alerting | 30 min | Skicka 429-hits till Sentry |
| Log aggregation (Axiom/Logtail) | 0.5 dag | Strukturerade loggar for felsökning i prod |
| Skew protection / rolling releases | 15 min | Kraver Vercel Pro |
| CORS headers | 15 min | Inga externa klienter annu |
| A11y-testning (axe-core) | 1 dag | Playwright axe-integration |
| Supabase Realtime | 1-2 dagar | Live-uppdatering via WebSocket, ersatter SWR-polling |

## Genomfort (arkiv)

> Items borttagna fran aktiv backlog 2026-04-11 efter genomgang.

| Item | Nar | Bevis |
|------|-----|-------|
| Vercel Analytics | S9 | `@vercel/analytics` i package.json |
| Dependabot | S17 | `.github/dependabot.yml` konfigurerad |
| Supabase Auth PoC (Fas 0) | S10-1 | Hela kedjan bevisad (login, claims, RLS) |
| RLS-migrering slice 1-6 | S14 | 28 policies, 7 domaner, 24 bevistester. Slice 7 struken -- se [arkitekturbeslut](../architecture/rls-roadmap.md#arkitekturbeslut-2026-04-11) |
| Voice logging polish (S7-5/S8-3) | S8-3 | Done-fil finns |
| customer_insights AI-spike | S8-2 | Riktig Anthropic API, inte mock |
| Sonnet 4.5 -> 4.6 | S9-4 | `claude-sonnet-4-6` alias i CustomerInsight + VoiceInterpretation |
| Confirm-route migrering till withApiHandler | S17 | `withApiHandler` i confirm/route.ts |
| Due-for-service iOS | S4 | KLAR |
| Staging-databas / schema-isolation | S9-7 | Schema-isolation bekraftad |
| Preview-miljo ANTHROPIC_API_KEY | S17 | Konfigurerat |
| Supabase Auth full migrering (Fas 0-3) | S10-S13 | PoC, dual-auth, route-migrering, NextAuth borttagen, iOS Swift SDK |
| Stripe webhook idempotens + SubscriptionService guards | S21-1 | StripeWebhookEvent dedup-tabell, TERMINAL_STATES guards |
| Auth pa /api/routing + blockera test-endpoints | S21-2 | getAuthUser + ALLOW_TEST_ENDPOINTS env guard |
| Auth-routes cleanup (getClientIP, .strict(), 503) | S21-3 | 6 auth-routes uppgraderade |
| Uptime-monitoring + Stripe webhook alerting | S21-4 | Betterstack setup-guide + Stripe alerts docs |
| CSP pinning + HSTS preload + rate limiting | S21-5 | Pinnad CSP, preload, rate limit pa 2 endpoints |
| native-session-exchange Zod-validering | S21-3 | refreshToken valideras med Zod |
| Onboarding-wizard (welcome-vy + tom-states) | S22-1/2 | Ny leverantör guidas genom setup, tydliga tom-states |
| Branch protection på GitHub | S22-4 | PR-krav + CI obligatoriskt för merge till main |
| Backup RPO/RTO-dokumentation | S22-4 | `docs/operations/backup-policy.md` |
| Incident response-plan | S22-4 | `docs/operations/incident-runbook.md` |
| Smoke-test registreringsflödet | S22-5 | 25/25 gröna, hela flödet verifierat |

## Research

| Amne | Status |
|------|--------|
| RLS med Prisma + Supabase | Klar (docs/research/rls-spike.md) |
| Voice logging AI-koppling | Klar (docs/research/voice-logging-spike.md) |
| Swish integration | Klar -- Stripe + Swish rekommenderat |
| Parallella sessioner | Guide klar (docs/guides/parallel-sessions.md) |
| Supabase Auth (ersatta NextAuth) | Klar -- PoC (S10), migrering (S11-S13), allt klart |
