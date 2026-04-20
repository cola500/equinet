---
title: "Production Readiness Scorecard"
description: "Non-functional requirements med status, gap-analys och story-ready acceptance criteria"
category: root
tags: [nfr, production-readiness, security, performance, monitoring]
status: active
last_updated: 2026-04-11
related:
  - docs/architecture/database.md
  - docs/security/pentest-2026-02-15.md
  - docs/operations/deployment.md
  - docs/INDEX.md
  - docs/architecture/offline-pwa.md
sections:
  - Sammanfattning
  - "1. Performance & Skalbarhet"
  - "2. Säkerhet & Privacy"
  - "3. Reliability & Availability"
  - "4. Kodkvalitet & Testning"
  - "5. Tillgänglighet"
  - "6. Monitoring & Observability"
  - "Tekniska Stories -- Production Gaps"
  - Underhållsschema
---

# Production Readiness Scorecard

**Projekt**: Equinet - Bokningsplattform för hästtjänster
**Version**: v0.3.0+
**Senast uppdaterad**: 2026-04-11
**Syfte**: Levande dokument som visar production readiness-status och gap med story-ready acceptance criteria.

**Relaterade dokument:**
- [docs/architecture/database.md](docs/architecture/database.md) -- Schema, RLS, pooling, backup
- [docs/security/pentest-2026-02-15.md](docs/security/pentest-2026-02-15.md) -- Pentest-rapport (feb 2026)
- [docs/operations/deployment.md](docs/operations/deployment.md) -- Deploy-guide
- [docs/INDEX.md](docs/INDEX.md) -- Dokumentationsindex

---

## Sammanfattning

| Kategori | Klart | Kvar | Score |
|----------|-------|------|-------|
| Performance & Skalbarhet | 7 | 3 | 70% |
| Säkerhet & Privacy | 19 | 3 | 86% |
| Reliability & Availability | 6 | 1 | 86% |
| Kodkvalitet & Testning | 11 | 1 | 92% |
| Tillgänglighet | 4 | 3 | 57% |
| Monitoring & Observability | 3 | 4 | 43% |
| **Totalt** | **50** | **13** | **79%** |

**Prioriterade gap:** P0: 1 st (launch blocker) | P1: 2 st (inom 2 veckor) | P2: 5 st (inom 1 månad)

---

## 1. Performance & Skalbarhet

### Response Time Targets

| Endpoint/Page | Target (p95) | Max (p99) | Status |
|---------------|-------------|-----------|--------|
| `/api/providers` (GET) | <200ms | <500ms | Klart -- 97ms (2 providers) |
| `/api/bookings` (GET) | <200ms | <500ms | Ej mätt i produktion |
| `/api/services` (GET) | <200ms | <500ms | Ej mätt i produktion |
| Provider-lista (render) | <1s | <2s | Klart |
| Dashboard (render) | <1s | <2s | Klart |

### Payload Size Targets

| Endpoint | Target | Max | Status |
|----------|--------|-----|--------|
| `/api/providers` | <50KB | <100KB | Klart -- optimerad med `select` |
| `/api/bookings` | <30KB | <50KB | Ej verifierat |
| JS bundles (total) | <500KB | <1MB | Ej mätt |

### Implementerat

- Database indexes på alla filter/sort-fält (Provider, Service, Booking, Horse, HorseServiceInterval)
- API payload-optimering med Prisma `select` (40-50% reduktion)
- Connection pooling via PgBouncer (10 connections/function). Se [docs/architecture/database.md](docs/architecture/database.md)
- Query timeout (10s) och slow query-logging (>2s warn, >500ms info)

### Kvarstår

- Lasttestning och prestandabaseline (se NFR-08)
- Core Web Vitals-mätning (se NFR-12)
- Pagination (trigger: 100+ items i listvy)

---

## 2. Säkerhet & Privacy

### Implementerat

| Krav | Status | Detaljer |
|------|--------|----------|
| Lösenordshashing | Klart | Supabase Auth (bcrypt, managed) |
| HTTP-only cookies | Klart | Supabase Auth SSR cookies |
| CSRF-skydd | Klart | Supabase Auth + SameSite cookies |
| SQL injection-skydd | Klart | Prisma (parameterized queries) |
| XSS-skydd | Klart | React auto-escaping |
| Input-validering | Klart | Zod på både client & server (.strict()) |
| Auktoriseringskontroller | Klart | Supabase Auth + ownership guards + RLS |
| GDPR-compliant API | Klart | Email/phone ej exponerat |
| Rate limiting | Klart | Upstash Redis på alla API-routes (5/h login, 10/h bookings, 100/h publikt) |
| HTTPS + Security headers | Klart | HSTS (preload), CSP (pinnad connect-src), X-Frame-Options DENY, nosniff, COOP, CORP |
| Lösenordskrav | Klart | Styrka-validering |
| Audit logging | Klart | AdminAuditLog-tabell (alla admin-API-operationer), logger.security() för känsliga operationer |
| Admin session-timeout | Klart | 15 min max-ålder på admin-sessioner via JWT iat-check |
| Row Level Security | Klart | 28 policies (13 read + 15 write) på 7 kärndomäner. 24 bevistester mot live Supabase. Se [docs/architecture/database.md](docs/architecture/database.md) |
| Messaging-säkerhet | Klart | Conversation + Message: RLS-policies + kolumn-nivå GRANT på `Message.readAt`. Rate limiting 30/user + 10/conversation per min. Feature flag-gating på route- och service-nivå. Se [docs/security/messaging.md](docs/security/messaging.md) |
| Messaging-bilagor säkerhet (S46) | Klart | Privat Supabase Storage-bucket + signed URLs (1h expiry). Magic bytes-validering via `file-type` (fail-closed, HEIC via ftyp-box-heuristik). Content-Length-guard FÖRE body-läsning (HTTP 413). Rate limit 10 uploads/h per user. IDOR-skydd via `loadBookingForMessaging`. Rollback vid upload-fel (transaktionellt mönster). Se [docs/architecture/messaging-attachments.md](docs/architecture/messaging-attachments.md) |
| GDPR data export | Klart | /api/export/my-data (JSON + CSV), GDPR Art. 20 |
| Horse data export | Klart | /api/horses/[id]/export |
| SRI (Subresource Integrity) | Borttaget | Fungerar inte med Vercels CDN. Använder `unsafe-inline` i CSP istället. |
| Error sanitering | Klart | Inga stack traces eller interna detaljer läcker till klienter i produktion |
| Penetrationstestning | Klart | ZAP-baserat pentest (2026-02-27), 6/9 fynd åtgärdade, 3 accepterade/falska positiver |
| Stripe webhook idempotens | Klart | StripeWebhookEvent dedup-tabell (UNIQUE event_id) + terminal-state-guards i SubscriptionService (S21-1) |
| Test-endpoint-skydd | Klart | `/api/test/*` blockerade i produktion via `ALLOW_TEST_ENDPOINTS` guard (S21-2) |

### Kvarstår

- MFA för leverantörskonton (se NFR-14; admin-MFA klart)
- Automatiserad säkerhetsskanning (se NFR-05)
- Data retention policy (se NFR-16)

---

## 3. Reliability & Availability

### Uptime Targets

| Fas | Target | Tillåten downtime |
|-----|--------|-------------------|
| MVP | 99.5% | ~3.6h/månad |
| Produktion | 99.9% | ~43min/månad |

### Error Rate Targets

| Typ | Target | Max | Status |
|-----|--------|-----|--------|
| API 5xx | <0.1% | <1% | Ej mätt |
| API 4xx | <5% | <10% | Ej mätt |
| Client crashes | <0.1% | <1% | Ej mätt |

### Implementerat

- Error handling & retry-logik (useRetry hook, ErrorState component, toast med retry)
- Sentry för error tracking (client + server + edge, session replay)
- Email-notifieringar via Resend (mock-fallback om nyckel saknas)
- Offline PWA-stöd för leverantörer (service worker, IndexedDB-cache, mutation queue med automatisk sync vid återanslutning). Se [docs/architecture/offline-pwa.md](docs/architecture/offline-pwa.md)

### Kvarstår

- Backup & disaster recovery -- dagliga backups finns på Supabase free tier (7d retention), men PITR kräver Pro. Se [docs/architecture/database.md](docs/architecture/database.md)

---

## 4. Kodkvalitet & Testning

### Implementerat

| Krav | Status | Detaljer |
|------|--------|----------|
| TypeScript strict mode | Klart | strict, noImplicitAny, strictNullChecks |
| Unit/integration-tester | Klart | 4302 tester, 363 testfiler (2026-04-20). Inkl. 20+ integration-testfiler (expanderat från 9 i S43-S44 testpyramid-omfördelning). Magic bytes-validering för bild-upload tillagd i S46 (`file-type`-paketet). |
| iOS XCTest | Klart | 223 tester (APIClient, DashboardViewModel, BookingsModels, CalendarModels, CalendarViewModel, BookingsViewModel, CustomersViewModel, m.fl.) |
| E2E-tester | Klart | Playwright, 22 specs efter S43-S44 (från 36 — 14 migrerade till integration/component-nivå). |
| ESLint | Klart | Flat config (eslint.config.mjs) |
| Husky pre-commit | Klart | npm test |
| Husky pre-push | Klart | test:run + typecheck + check:swedish + lint |
| DDD-Light arkitektur | Klart | Repository pattern för kärndomäner |
| TDD workflow | Klart | Red -> Green -> Refactor |

### Coverage Targets

| Område | Target | Min |
|--------|--------|-----|
| Overall | 70% | 60% |
| API Routes | 80% | 70% |
| Utilities | 90% | 80% |
| Components | 60% | 50% |

**Coverage-gate:** CI failar om coverage < 70% (sedan S20-1).

### Kvarstår

- Dependabot auto-merge för patch (konfigurerad men ingen auto-merge)

---

## 5. Tillgänglighet

### Mål

**Target:** WCAG 2.1 Level AA

### Implementerat

| Krav | Status |
|------|--------|
| Semantic HTML | Klart -- button, nav, main |
| ARIA live regions | Klart -- screen reader-stöd |
| ARIA labels på formulär | Delvis klart -- MunicipalitySelect, HorseSelect, tjänstefilter |
| Touch targets >= 44x44px | Klart -- implementerat i bokningsflöde och BottomTabBar |

### Kvarstår

- ARIA labels på alla form inputs (delvis implementerat, behöver fullständig audit)
- Keyboard navigation-testning (tab order, escape för modals)
- Kontrastverifiering (4.5:1 normal text, 3:1 large text)
- Screen reader-testning (VoiceOver)
- Automatiserad tillgänglighetstestning (se NFR-11)

---

## 6. Monitoring & Observability

### Implementerat

| Krav | Status | Detaljer |
|------|--------|----------|
| Error tracking | Klart | Sentry (3 config-filer: client, server, edge) |
| Session replay | Klart | Sentry session replay |
| Structured logging | Klart | logger med nivåer (error, warn, info, debug) |

### Kvarstår

- Core Web Vitals-mätning (se NFR-12)
- Response time-dashboards (p50/p95/p99)

---

## Tekniska Stories -- Production Gaps

Varje gap är formaterat som en story-ready post med prioritet, effort och acceptance criteria.

### P0: Launch Blockers

#### NFR-01: Integrera betalningsgateway (Stripe/Swish)
**Prioritet:** P0
**Kategori:** Funktionell / Säkerhet
**Effort:** XL (1v+)
**Varför:** Ingen intäkt utan betalning. Säkerhetskritiskt -- PCI DSS-hantering.
**Status:** Pågår -- Stripe subscription-infrastruktur implementerad (domain service, gateway, repository, API routes, webhook, UI). Väntar på Stripe-nycklar och aktivering via feature flag `stripe_subscriptions`.
**Acceptance Criteria:**
- [x] Stripe subscription-infrastruktur (checkout, portal, status, webhook)
- [ ] Stripe- eller Swish-integration fungerar i produktion
- [ ] Betalning genomförs vid bokning
- [ ] Webhook hanterar betalningsstatus (success/failure/refund)
- [ ] Kvitton skickas via email
- [ ] PCI-compliance verifierad (Stripe Checkout/Elements hanterar kortdata)

#### ~~NFR-02: Privacy Policy + Cookie Consent~~ KLART
**Prioritet:** P0
**Kategori:** Säkerhet & Privacy
**Effort:** M (3-8h)
**Varför:** Lagkrav (GDPR Art. 13/14, EU Cookie Directive). Kan leda till böter.
**Acceptance Criteria:**
- [x] Privacy Policy-sida publicerad (Swedish) -- `/anvandarvillkor`
- [x] Cookie consent-banner visas för förstagångsbesökare -- `CookieNotice.tsx`
- [x] Samtycke loggas och respekteras
- [x] Länk till policy från registreringssida och footer

#### ~~NFR-03: Radera konto (GDPR Art. 17)~~ KLART
**Prioritet:** P0
**Kategori:** Säkerhet & Privacy
**Effort:** M (3-8h)
**Varför:** Lagkrav -- användare har rätt att få sin data raderad.
**Acceptance Criteria:**
- [x] Användare kan begära kontoradering från profil -- `DELETE /api/account`
- [x] Personuppgifter anonymiseras/raderas (email, namn, telefon)
- [x] Bokningshistorik bevaras anonymiserad (för leverantörsstatistik)
- [x] Bekräftelse-email skickas före slutgiltig radering
- [x] Grace period (t.ex. 30 dagar) före permanent radering

#### ~~NFR-04: Separera Dev/Staging/Prod-databaser~~ KLART
**Prioritet:** P0
**Kategori:** Reliability
**Effort:** L (1-3d)
**Varför:** Delad databas innebär att utveckling kan påverka produktionsdata.
**Acceptance Criteria:**
- [x] Dev: Lokal Supabase CLI (`supabase start`, isolerad från molnet)
- [x] Environment-specifika DATABASE_URL i varje miljö (lokal port 54322, Vercel env vars för prod)
- [x] Migrations körs automatiskt vid deploy (`prisma migrate deploy`)
- [x] Seed-data för dev (`npm run db:seed`), ren prod

---

### P1: Inom 2 veckor efter launch

#### NFR-05: Automatiserad säkerhetsskanning
**Prioritet:** P1
**Kategori:** Säkerhet
**Effort:** S (1-2h)
**Varför:** Kända sårbarheter i dependencies måste fångas automatiskt.
**Acceptance Criteria:**
- [ ] Dependabot aktiverat på GitHub-repot
- [ ] Automatiska PR:er för säkerhetspatchar
- [ ] `npm audit` körs i CI-pipeline

#### ~~NFR-06: Uptime-monitorering~~ KLART
**Prioritet:** P1
**Kategori:** Reliability
**Effort:** S (1-2h)
**Varför:** Utan monitorering upptäcks driftstörningar först när användare klagar.
**Acceptance Criteria:**
- [x] Extern uptime-monitor konfigurerad (UptimeRobot) -- dokumenterat i deployment.md steg 8.1
- [x] Kontrollerar /api/health var 5:e minut
- [x] Email-alert vid downtime (efter 3 missade kontroller = 15 min)
- [x] Månatlig uptime-rapport tillgänglig

#### ~~NFR-07: Sentry-alertregler~~ KLART
**Prioritet:** P1
**Kategori:** Monitoring
**Effort:** S (1-2h)
**Varför:** Sentry samlar data men notifierar inte vid problem utan konfigurerade regler.
**Acceptance Criteria:**
- [x] Alert vid error rate >50 events per 5 minuter -- dokumenterat i deployment.md steg 8.2
- [x] Alert vid nya unhandled exceptions
- [x] Email-notifiering till teamet
- [x] Veckovis error digest

#### NFR-08: Lasttestning + prestandabaseline
**Prioritet:** P1
**Kategori:** Performance
**Effort:** L (1-3d)
**Varför:** Utan baseline vet vi inte om performance försämras över tid.
**Acceptance Criteria:**
- [ ] Lasttestverktyg uppsatt (k6, Artillery, eller liknande)
- [ ] Baslinjetest för kritiska endpoints (providers, bookings, services)
- [ ] Test med 100 concurrent users utan degradering
- [ ] Resultat dokumenterade som referens

#### ~~NFR-09: Branch protection rules~~ KLART
**Prioritet:** P1
**Kategori:** Kodkvalitet
**Effort:** S (1-2h)
**Varför:** Direkt-commits till main kan bryta produktion.
**Acceptance Criteria:**
- [x] Krav på PR för merge till main -- aktiverat S22-4
- [x] CI måste passera före merge -- quality gates obligatoriska
- [ ] Minst 1 approval krävs (när teamet växer)

#### ~~NFR-10: Dependabot/Renovate~~ KLART
**Prioritet:** P1
**Kategori:** Kodkvalitet
**Effort:** S (1-2h)
**Varför:** Dependencies som inte uppdateras ackumulerar säkerhetsrisker och teknisk skuld.
**Acceptance Criteria:**
- [x] Dependabot eller Renovate konfigurerat -- `.github/dependabot.yml` (S17)
- [x] Veckovisa PR:er för minor/patch-uppdateringar
- [x] Månatliga PR:er för major-uppdateringar
- [x] CI kör tester på dependency-PRs automatiskt

---

### P2: Inom 1 månad efter launch

#### NFR-11: Automatiserad tillgänglighetstestning
**Prioritet:** P2
**Kategori:** Tillgänglighet
**Effort:** M (3-8h)
**Varför:** Manuell testning skalas inte -- automatisering fångar regressioner.
**Acceptance Criteria:**
- [ ] @axe-core/playwright integrerat i E2E-sviten
- [ ] Tillgänglighetstest för varje kritiskt flöde (sök, bokning, profil)
- [ ] CI failar vid WCAG AA-violations

#### NFR-12: Core Web Vitals-mätning
**Prioritet:** P2
**Kategori:** Performance
**Effort:** S (1-2h)
**Varför:** LCP, FID, CLS påverkar SEO-ranking och användarupplevelse.
**Acceptance Criteria:**
- [ ] Vercel Analytics eller web-vitals-bibliotek installerat
- [ ] LCP <2.5s, FID <100ms, CLS <0.1 för alla sidor
- [ ] Dashboard för att följa trender

#### ~~NFR-13: Coverage-tracking i CI~~ KLART
**Prioritet:** P2
**Kategori:** Kodkvalitet
**Effort:** S (1-2h)
**Varför:** Utan mätning vet vi inte om coverage sjunker vid nya features.
**Acceptance Criteria:**
- [x] `npm run test:coverage` körs i CI -- coverage-gate 70% (S20-1)
- [ ] Coverage-badge i README
- [x] CI failar om coverage < 70%

#### NFR-14: MFA (Multi-Factor Authentication)
**Prioritet:** P1 (admin) / P2 (leverantör)
**Kategori:** Säkerhet
**Effort:** L (1-3d)
**Varför:** Admin- och leverantörskonton hanterar bokningar, kunddata och systemkonfiguration -- högre säkerhetskrav.

**Admin-MFA (klart S27-4):**
- [x] TOTP-enrollment via Supabase Auth (QR-kod + Google Authenticator/Authy)
- [x] Admin-sidor kräver aal2 via middleware
- [x] Redirect till /admin/mfa/verify vid aal1
- [x] Non-admin blockeras från MFA-sidor
- [x] Dokumenterad i `docs/security/mfa-admin.md`

**Leverantör-MFA (kvarstår):**
- [ ] TOTP för leverantörskonton (samma mönster som admin)
- [ ] Frivilligt vid launch, obligatoriskt efter X månader
- [ ] Flera faktorer rekommenderas för återhämtning (Supabase stödjer inte backup-koder för TOTP)
- [ ] MFA krävs vid känsliga operationer (t.ex. ändring av bankuppgifter)

#### NFR-15: Cross-browser-testning
**Prioritet:** P2
**Kategori:** Tillgänglighet / UX
**Effort:** M (3-8h)
**Varför:** Användare på Safari/Firefox kan ha annan upplevelse.
**Acceptance Criteria:**
- [ ] Testade i Chrome, Firefox, Safari (senaste 2 versionerna)
- [ ] E2E-tester körs i minst 2 browsers i CI
- [ ] Kända inkompatibiliteter dokumenterade och fixade

#### NFR-16: Data retention policy
**Prioritet:** P2
**Kategori:** Säkerhet & Privacy
**Effort:** S (1-2h)
**Varför:** GDPR kräver definierade lagringsperioder för personuppgifter.
**Acceptance Criteria:**
- [ ] Dokumenterad policy för varje datatyp (användare, bokningar, loggar)
- [ ] Automatisk radering av gammal data (t.ex. loggar >1 år)
- [ ] Policy publicerad i Privacy Policy

---

## Underhållsschema

| Kadens | Aktivitet |
|--------|-----------|
| Daglig | Kolla Sentry-dashboard för nya fel |
| Daglig | Verifiera uptime (när monitorering är på plats) |
| Veckovis | Granska performance-metriker |
| Veckovis | Triagera öppna buggar |
| Månatlig | `npm audit` + dependency-uppdateringar |
| Månatlig | Granska och uppdatera detta dokument |
| Kvartalsvis | Full säkerhetsgenomgång |
| Kvartalsvis | Backup restore-test |
| Kvartalsvis | Tillgänglighetsaudit |

---

**Dokumentägare**: Johan Lindengård
**Senast granskad**: 2026-04-11
