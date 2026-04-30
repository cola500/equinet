---
title: "Produktbacklog"
description: "Alla kända stories och uppgifter, speglar roadmap.md. Plockas in i sprintar vid behov."
category: sprint
status: active
last_updated: 2026-04-30
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

## Sökning och discovery

| Story | Effort | Beskrivning |
|-------|--------|-------------|
| **providerCategory på Provider** | 1-2 dagar | Schemaändring: lägg till `providerCategory String?` på `Provider`-modellen (t.ex. "hovslagare", "veterinär", "tränare"). Leverantören väljer kategori i profilformuläret. `serviceType`-filtret i `ProviderRepository` söker primärt i det fältet — inte synonymhack mot tjänstenamn. Löser rotorsaken till att "Alingsås Hovservice" inte hittades. Kräver: Prisma-migration + profilformulär-UI + seed-data + ProviderRepository-filter. |

## Kritiskt

| Story | Effort | Varför kritiskt |
|-------|--------|----------------|
| GDPR data retention policy | Mellanlång sikt | Radering av gammal data |

## Kvalitet och säkerhet

| Story | Effort | Prioritet |
|-------|--------|-----------|
| Leaflet CSS lazy-load (licensrisk) | 15 min | `leaflet.css` importeras i layout.tsx (alltid). Flytta till RouteMapVisualization.tsx (lazy). Eliminerar Hippocratic-licenserad kod från alla sidor som inte använder ruttplanering. Se `docs/security/license-audit-2026-04-15.md`. |
| E-postverifiering Resend (S17-5) | 0.5 dag | **Blockerad** -- kräver domänverifiering eller Resend Pro. Gratis-konto tillåter bara eget e-post. |
| E2E: fixa 77 skippade tester | 1-2 veckor | Låg prioritet |
| recurring_bookings E2E-verifiering | 1 dag | Medel |
| group_bookings E2E + UX-review | 2-3 dagar | Medel |
| withApiHandler resterande routes (131 st) | Löpande | Opportunistiskt |
| console.* i legacy docs | 0.5 dag | Låg prioritet |
| **BDD integrationstester — horses, booking-series, bookings POST, group-bookings join** | 1 dag | Kärndomäner saknar integration: Horses (8 routes, noll integration), Booking-series (3 routes, precis releasad), `POST /api/bookings` (viktigaste CREATE-routen), `POST /api/group-bookings/join` (Serializable-transaktion). 18/181 routes har integration totalt. Audit: [bdd-coverage-audit-2026-04-25.md](../research/bdd-coverage-audit-2026-04-25.md). |
| **Hårdkodad fel domän i `data-retention-warning.ts`** | 10 min | `src/lib/email/templates/data-retention-warning.ts:4` har fallback `https://equinet.vercel.app` (utan `-app`) — fungerar inte. Bör använda samma logik som övriga email-templates: `process.env.APP_URL \|\| 'http://localhost:3000'`. Hittad 2026-04-30 vid felsökning av password reset till localhost. |
| **CI-guard: kräv APP_URL i prod-build** | 1-2h | `APP_URL` saknades i Vercel prod-env i månader → alla email-länkar pekade på `http://localhost:3000` (password reset, bokningsbekräftelser, route-announcements m.fl.). Lägg till build-time-validering som faller om kritiska env-variabler saknas i prod (APP_URL, DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, RESEND_API_KEY, STRIPE_SECRET_KEY). Förslag: `scripts/check-prod-env.ts` körs i `prebuild` när `VERCEL_ENV=production`. |
| **Fixa fire-and-forget i AuthService och övriga notifiers (HÖG PRIO)** | 1-2h | `AuthService.requestPasswordReset` (rad 396-401) skickar `emailService.sendPasswordReset(...).catch(() => {})` och returnerar response omedelbart. I Vercel/Fluid Compute kan function-instansen termineras innan fetch-anropet mot Resend slutförs → mail skickas aldrig. **Bevis 2026-04-30**: Tre password reset-försök, mail #1 vann racen mot termination, mail #2 och #3 hann ALDRIG fram till Resend (token i DB, inget i Resend dashboard). Tyst leveransbortfall i prod. **Påverkan**: Kan drabba alla fire-and-forget i kodbasen — `RouteAnnouncementNotifier` och fler. **Fix**: ersätt `.catch(() => {})` med `await waitUntil(...)` från `@vercel/functions`, eller blockerande `await`. Audit alla fire-and-forget i kodbasen (`grep -rn "\.catch(() => {})" src/`). |

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

**Hypotes:** Agenter sparar 3-5 sökningar per uppgift med en domänkarta i `.claude/rules/code-map.md`. Testat med "lägg till fält på hästar": 10 tool calls -> 3 tool calls (70% reduktion). Största vinsten: agenten missar inte filer (t.ex. native-routes, provider-routes).

**Steg 0 (klart):** Manuellt genererad kodkarta i `.claude/rules/code-map.md` -- 20 domäner, 169 routes, alla UI-sidor.

| Story | Effort | Beskrivning |
|-------|--------|-------------|
| Feature flag -> fil-mapping | 1h | Utöka kodkartan: vilka filer berörs av varje feature flag. Grep-baserat. Hjälper vid "slå på/av feature X". |
| Domän-metadata i koden | 2h | JSDoc överst i varje Service: vilka routes konsumerar den, vilka repos den använder, vilken feature flag. Agenter läser vid `Read` utan att behöva kartan. |

## Pattern-katalog (djupdokumentera guldkorn)

Identifierade mönster (2026-04-17) som är smartare än vanligt men bara finns som kod eller korta noteringar. Lyfta som return-och-ta-igen-stories.

### Hög prioritet (djupdok)

| Story | Effort | Varför det ger värde |
|-------|--------|----------------------|
| Dubbelt skyddslager (auth + RLS) som pattern | 1h | Defense in depth konkret. Kärna i er säkerhetsmodell. Fortnox/framtida integrationer ska följa samma tänk. |
| AI Service-mönster (generic) | 1h | Ni har 2 AI-features (voice logging + customer insights) med samma struktur -- Zod på output, prompt injection-skydd, rate limiting på kostnad. Nästa AI-feature (t.ex. "förslå bokningstid") ska följa mallen. |
| Gateway abstraction (Payment/Accounting/...) | 1h | Interface + impl-mönster för utbytbara tredjeparter. Konkret behov vid Fortnox-bygget. |

### Medel prioritet (kortare rad-entry räcker)

| Story | Effort | Varför det ger värde |
|-------|--------|----------------------|
| Circuit breaker (generaliserat) | 30 min | Finns i sync-engine, kan generaliseras för retry-logik. Ny rad i patterns.md. |
| Feature flag prioritet (env > DB > code) | 30 min | Missförstås ofta. Kort djupdok hjälper. |
| Optimistic UI med revert (iOS + webb-port) | 30 min | Pattern från iOS som kan porteras till webb när vi gör snabbare UX. |
| Fire-and-forget notifier (utöka existerande rad) | 15 min | Kort förklaring av varför pattern existerar. |
| E2E-spec-taggning för cleanup | 15 min | Rad i patterns.md som länkar till e2e.md. |

**Bakgrund:** Identifierade under Stripe webhook-idempotens-lektionen (2026-04-17). Lista med fullständig motivering finns i chat-retro från den sessionen.

**Total effort:** ~5h djup + 2h rader = ~1 dags docs-arbete. Värdet: nästa integration/AI-feature/retry-implementation hittar mönstret och uppfinner inte hjulet.

## Offline PWA-stabilitet (flaky-hantering)

| Story | Effort | Beskrivning |
|-------|--------|-------------|
| Kund-offline (fas 4) | 1-2 dagar | **Parkerad** (2026-04-17) -- fokus på leverantörens upplevelse. Kunder har oftast nät, leverantörer är mobila. Återaktivera om/när kunder rapporterar offline-problem eller vid marknadsexpansion till sämre täckning. Tidigare scope: cachad bokningslista, offline-avbokning, offline-ny-bokning, 8 kundmutationer som idag bara varnar. |

## iOS

*(S29-stories flyttade till sprint 29: iOS Polish + mobile-mcp-verifiering)*

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

## Due-for-service (uppföljning)

| Story | Effort | Beskrivning |
|-------|--------|-------------|
| Proaktiv push-notifikation vid förfallna hästar | 45 min | Daglig cron-route (`/api/cron/due-for-service-notify`) skickar push via `PushDeliveryService` + `DueForServiceLookup` till leverantörer med ≥1 overdue-häst. Infrastrukturen finns, bara kopplingen saknas. Teateranalys 2026-04-25 (GAP 4). |
| UX: "Boka"-knappen i förfallna-listan | 30 min | Action-läget vid bokning av häst i `/provider/due-for-service`-listan är oklart. Förbättra flödet — t.ex. förifylla häst + tjänst i kalendern/manuell-bokningsdialogen istället för bara en länk till kalendern. Sprint 60 review-fynd 2026-04-25. |

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
| Preview deploy-skydd | Privat repo | Vercel Authentication aktiverades automatiskt vid privat GitHub-repo |
| BookingService refactoring (986 -> ~600 rader) | S24-1 | BookingValidation + BookingDependencyFactory extraherade |
| ManualBookingDialog steg-split (752 -> ~300 rader) | S24-2 | Steg-komponenter (StepSelectCustomer, StepSelectTime, etc.) |
| Haiku alias + Cron HMAC + CSP report-to | S24-3 | Snabba säkerhetsfixar |
| Dependabot auto-merge for patch | S24-4 | GitHub Actions workflow |
| CustomerCard.tsx tabs-extraktion (660 -> 202 rader) | S25-1 | HorsesSection, NotesSection, MergeDialog, Actions |
| PrismaBookingRepository gemensamma selects | S25-2 | Inlinade selects ersatta med namngivna konstanter |

## Research

| Amne | Status |
|------|--------|
| RLS med Prisma + Supabase | Klar (docs/research/rls-spike.md) |
| Voice logging AI-koppling | Klar (docs/research/voice-logging-spike.md) |
| Swish integration | Klar -- Stripe + Swish rekommenderat |
| Parallella sessioner | Guide klar (docs/guides/parallel-sessions.md) |
| Supabase Auth (ersatta NextAuth) | Klar -- PoC (S10), migrering (S11-S13), allt klart |
