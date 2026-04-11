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

| Story | Effort | Varfor kritiskt |
|-------|--------|----------------|
| Branch protection pa GitHub | 30 min | Direkta commits till main med Stripe live = oacceptabelt |
| Verifiera Stripe webhook-idempotens | 1h | Dubbel-event kan ge dubbelbokningar. Ingen event-ID dedup idag. |
| Onboarding-spike (registrering utan seed) | 1 dag | Förutsättning för leverantör #2. Spike klar, wizard ej byggd. |
| Backup RPO/RTO-dokumentation | 1h | Med finansiell data behovs policy |
| GDPR data retention policy | Mellanlang sikt | Radering av gammal data |

## Kvalitet och sakerhet

| Story | Effort | Prioritet |
|-------|--------|-----------|
| Haiku daterat modell-ID | 5 min | `claude-haiku-4-5-20251001` i VoiceInterpretationService.ts rad 264. Byt till alias `claude-haiku-4-5`. |
| E-postverifiering Resend (S17-5) | 0.5 dag | Verifiera Resend-leverans i prod |
| MFA for admin | 1 dag | Supabase TOTP-enrollment + verifiering |
| CSP report-to | 15 min | Vi har CSP men vet inte nar den blockerar i prod. Skicka till Sentry. |
| Dependabot auto-merge for patch | 15 min | PRs skapas men ingen mergar dem. Patch kan auto-mergas. |
| Migrationstest pa ren DB i CI | 30 min | CI kor migrate deploy, inte reset. Fangar inte trasiga migrationer fran scratch. |
| Legacy docs svenska tecken (325 rader) | 0.5 dag | ASCII-substitut i ~10 filer (onboarding-spike, voice-logging-spike, m.fl.) |
| E2E: fixa 77 skippade tester | 1-2 veckor | Lag prioritet |
| recurring_bookings E2E-verifiering | 1 dag | Medel |
| group_bookings E2E + UX-review | 2-3 dagar | Medel |
| withApiHandler resterande routes (131 st) | Lopande | Opportunistiskt |
| console.* i legacy docs | 0.5 dag | Lag prioritet |

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

## Research

| Amne | Status |
|------|--------|
| RLS med Prisma + Supabase | Klar (docs/research/rls-spike.md) |
| Voice logging AI-koppling | Klar (docs/research/voice-logging-spike.md) |
| Swish integration | Klar -- Stripe + Swish rekommenderat |
| Parallella sessioner | Guide klar (docs/guides/parallel-sessions.md) |
| Supabase Auth (ersatta NextAuth) | Klar -- PoC (S10), migrering (S11-S13), allt klart |
