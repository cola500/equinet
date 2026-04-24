---
title: "Produktbacklog"
description: "Alla kända stories och uppgifter, speglar roadmap.md. Plockas in i sprintar vid behov."
category: sprint
status: active
last_updated: 2026-04-24
tags: [backlog, roadmap, planning]
sections:
  - Blockerare
  - Kritiskt
  - Sökning och discovery
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
> Senast genomgången: 2026-04-24

## Blockerare (väntar på Johan)

| Story | Blockerare | Effort |
|-------|-----------|--------|
| Push live (APNs) | Apple Developer 99 USD | Config, 15 min |
| Stripe live-mode | Stripe företagsverifiering | Config, 15 min |
| Swish aktivering | Stripe företagsverifiering | 1 rad kodändring |

## Kritiskt

_(Inga kritiska stories just nu.)_

## Sökning och discovery

| Story | Effort | Beskrivning |
|-------|--------|-------------|
| **providerCategory på Provider** | 1-2 dagar | Schemaändring: lägg till `providerCategory String?` på `Provider`-modellen (t.ex. "hovslagare", "veterinär", "tränare"). Leverantören väljer kategori vid registrering/profilredigering. `serviceType`-filtret i `ProviderRepository` söker i det fältet istället för `service.name`. Löser buggen att "Alingsås Hovservice" inte hittas (businessName "Hovservice" ≠ "hovslagare"). Kräver: Prisma-migration + profilformulär-UI + seed-data + `ProviderRepository`-filter uppdaterat. |

## Kvalitet och säkerhet

| Story | Effort | Prioritet |
|-------|--------|-----------|
| E-postverifiering Resend (S17-5) | 0.5 dag | **Blockerad** — kräver domänverifiering eller Resend Pro. Gratis-konto tillåter bara eget e-post. |
| E2E: fixa skippade tester | 1-2 veckor | Låg prioritet |
| recurring_bookings E2E-verifiering | 1 dag | Medel |
| group_bookings E2E + UX-review | 2-3 dagar | Medel |
| withApiHandler resterande routes | Löpande | Opportunistiskt — migrera vid beröring |
| console.* i legacy docs | 0.5 dag | Låg prioritet |

## Kodeffektivitet (tech debt)

### Content-as-code (~4 000 rader, 4% av prod)

| Fil | Rader | Problem | Lösning | Effort |
|-----|-------|---------|---------|--------|
| `src/lib/help/articles.provider.ts` | 1335 | Hjälpartiklar hårdkodade i TypeScript | Flytta till markdown-filer, läs vid build | 0.5 dag |
| `src/lib/help/articles.customer.ts` | 788 | Samma | Samma | Ingår ovan |

### Stora filer (>500 rader, gräns i CLAUDE.md)

| Fil | Rader | Åtgärd | Effort |
|-----|-------|--------|--------|
| 10+ filer runt 520-620 | - | Gränsfall, åtgärda vid nästa ändring | Löpande |

## Agent-navigering (kodkarta)

| Story | Effort | Beskrivning |
|-------|--------|-------------|
| Domän-metadata i koden | 2h | JSDoc överst i varje Service: vilka routes konsumerar den, vilka repos den använder, vilken feature flag. Agenter läser vid `Read` utan att behöva kartan. |

_(Feature flag → fil-mapping klar: finns i `.claude/rules/code-map.md`.)_

## Pattern-katalog (djupdokumentera guldkorn)

### Hög prioritet (djupdok)

| Story | Effort | Varför det ger värde |
|-------|--------|----------------------|
| Dubbelt skyddslager (auth + RLS) som pattern | 1h | Defense in depth konkret. Kärna i er säkerhetsmodell. Framtida integrationer ska följa samma tänk. |
| AI Service-mönster (generic) | 1h | 2 AI-features (voice logging + customer insights) med samma struktur — Zod på output, prompt injection-skydd, rate limiting. Nästa AI-feature ska följa mallen. |
| Gateway abstraction (Payment/Accounting/...) | 1h | Interface + impl-mönster för utbytbara tredjeparter. Konkret behov vid Fortnox-bygget. |

### Medel prioritet

| Story | Effort | Varför det ger värde |
|-------|--------|----------------------|
| Circuit breaker (generaliserat) | 30 min | Finns i sync-engine, kan generaliseras för retry-logik. |
| Optimistic UI med revert (iOS + webb-port) | 30 min | Pattern från iOS som kan porteras till webb. |

## Offline PWA-stabilitet

| Story | Effort | Beskrivning |
|-------|--------|-------------|
| Kund-offline (fas 4) | 1-2 dagar | **Parkerad** (2026-04-17) — fokus på leverantörens upplevelse. Kunder har oftast nät, leverantörer är mobila. Återaktivera om/när kunder rapporterar offline-problem. Scope: cachad bokningslista, offline-avbokning, offline-ny-bokning. |

## iOS

### iOS-migrering (6 kvarvarande provider WebView-skärmar)

Dashboard, Bokningar, Kunder, Tjänster, Mer-flik och Profil är klara (native SwiftUI sedan session 99–107).

| Skärm | Bakom flagga | Komplexitet | Beroende |
|-------|-------------|-------------|----------|
| Röstloggning | voice_logging | Hög (Speech + AI) | Inget (fungerar) |
| Annonsering | route_announcements | Medel | Inget |
| Business insights | business_insights | Medel (Recharts) | Inget |
| Ruttplanering | route_planning | Hög (Mapbox/OSRM) | Mapbox-token |
| Gruppbokningar | group_bookings | Hög | Inget |
| Hjälpcentral | help_center | Låg | Inget |

**Kundskärmar (alla WebView):** Bokningar, hästar, gruppbokningar, profil, FAQ, hjälp, export.

## Betalning

| Story | Effort | Beroende |
|-------|--------|----------|
| Swish i Payment Element | 1 rad + test | Stripe företagsverifiering |
| Provider subscription (monetarisering) | 1-2 veckor | Prisbeslut |
| Fortnox-integration (fakturering) | 2-3 veckor | Fortnox API-access |

## Features som kräver arbete innan lansering

| Flagga | Problem | Effort |
|--------|---------|--------|
| route_planning | Kräver Mapbox-token | Mapbox-konto + token + verifiering 1-2 dagar |
| route_announcements | Beroende av route_planning | Löses med route_planning |
| business_insights | Behöver realistisk data | Polish + seed-data 1-2 dagar |
| offline_mode | Komplex, inga E2E-tester | E2E + stabilisering 1-2 veckor |
| follow_provider | Värde vid volym | Verifiering vid skalning |
| municipality_watch | Värde vid volym | Verifiering vid skalning |
| stable_profiles | Aldrig testad i prod | Beslut: behålla eller ta bort? |

## Vid lansering

| Item | Effort | Motivering |
|------|--------|------------|
| Uppgradera till Vercel Pro | $20/mån | Hobby tillåter inte kommersiellt bruk |
| Rate limit alerting | 30 min | Skicka 429-hits till Sentry |
| Log aggregation (Axiom/Logtail) | 0.5 dag | Strukturerade loggar för felsökning i prod |
| Skew protection / rolling releases | 15 min | Kräver Vercel Pro |
| CORS headers | 15 min | Inga externa klienter ännu |
| A11y-testning (axe-core) | 1 dag | Playwright axe-integration |
| Supabase Realtime | 1-2 dagar | Live-uppdatering via WebSocket, ersätter SWR-polling |

## Genomfört (arkiv)

> Items borttagna från aktiv backlog vid genomgång 2026-04-24.

| Item | När | Bevis |
|------|-----|-------|
| Leaflet CSS lazy-load (licensrisk) | S27 | Importeras bara i `RouteMapVisualization.tsx`, inte i `layout.tsx` |
| GDPR data retention policy | S27 | `DataRetentionService.ts` + cron-route |
| Feature flag → fil-mapping (kodkarta) | S36 | Finns i `.claude/rules/code-map.md` |
| iOS Dashboard | Session 99 | `NativeDashboardView.swift` |
| iOS Bokningar | Session 99b | `NativeBookingsView.swift` |
| iOS Kunder | Session 100 | `NativeCustomersView.swift` |
| iOS Tjänster | Session 101 | `NativeServicesView.swift` |
| iOS Mer-flik | Session 104 | `NativeMoreView.swift` (11 menyalternativ + feature flags) |
| iOS Profil | Session 107 | `NativeProfileView.swift` (2-tab Profil/Inställningar) |
| Vercel Analytics | S9 | `@vercel/analytics` i package.json |
| Dependabot | S17 | `.github/dependabot.yml` konfigurerad |
| Supabase Auth PoC (Fas 0) | S10-1 | Hela kedjan bevisad (login, claims, RLS) |
| RLS-migrering slice 1-6 | S14 | 28 policies, 7 domäner, 24 bevistester |
| Voice logging polish | S8-3 | Done-fil finns |
| customer_insights AI-spike | S8-2 | Riktig Anthropic API, inte mock |
| Sonnet 4.5 → 4.6 | S9-4 | `claude-sonnet-4-6` alias i CustomerInsight + VoiceInterpretation |
| Confirm-route migrering till withApiHandler | S17 | `withApiHandler` i confirm/route.ts |
| Due-for-service iOS | S4 | Klar |
| Staging-databas / schema-isolation | S9-7 | Schema-isolation bekräftad |
| Preview-miljö ANTHROPIC_API_KEY | S17 | Konfigurerat |
| Supabase Auth full migrering (Fas 0-3) | S10-S13 | PoC, dual-auth, route-migrering, NextAuth borttagen, iOS Swift SDK |
| Stripe webhook idempotens + SubscriptionService guards | S21-1 | StripeWebhookEvent dedup-tabell, TERMINAL_STATES guards |
| Auth på /api/routing + blockera test-endpoints | S21-2 | getAuthUser + ALLOW_TEST_ENDPOINTS env guard |
| Auth-routes cleanup (getClientIP, .strict(), 503) | S21-3 | 6 auth-routes uppgraderade |
| Uptime-monitoring + Stripe webhook alerting | S21-4 | Betterstack setup-guide + Stripe alerts docs |
| CSP pinning + HSTS preload + rate limiting | S21-5 | Pinnad CSP, preload, rate limit på 2 endpoints |
| native-session-exchange Zod-validering | S21-3 | refreshToken valideras med Zod |
| Onboarding-wizard (welcome-vy + tom-states) | S22-1/2 | Ny leverantör guidas genom setup, tydliga tom-states |
| Branch protection på GitHub | S22-4 | PR-krav + CI obligatoriskt för merge till main |
| Backup RPO/RTO-dokumentation | S22-4 | `docs/operations/backup-policy.md` |
| Incident response-plan | S22-4 | `docs/operations/incident-runbook.md` |
| Smoke-test registreringsflödet | S22-5 | 25/25 gröna, hela flödet verifierat |
| Preview deploy-skydd | Privat repo | Vercel Authentication aktiverades automatiskt |
| BookingService refactoring | S24-1 | BookingValidation + BookingDependencyFactory extraherade |
| ManualBookingDialog steg-split | S24-2 | Steg-komponenter (StepSelectCustomer, StepSelectTime, etc.) |
| Haiku alias + Cron HMAC + CSP report-to | S24-3 | Snabba säkerhetsfixar |
| Dependabot auto-merge for patch | S24-4 | GitHub Actions workflow |
| CustomerCard.tsx tabs-extraktion | S25-1 | HorsesSection, NotesSection, MergeDialog, Actions |
| PrismaBookingRepository gemensamma selects | S25-2 | Inlinade selects ersatta med namngivna konstanter |

## Research

| Ämne | Status |
|------|--------|
| RLS med Prisma + Supabase | Klar (docs/research/rls-spike.md) |
| Voice logging AI-koppling | Klar (docs/research/voice-logging-spike.md) |
| Swish integration | Klar — Stripe + Swish rekommenderat |
| Parallella sessioner | Guide klar (docs/guides/parallel-sessions.md) |
| Supabase Auth (ersätta NextAuth) | Klar — PoC (S10), migrering (S11-S13), allt klart |
