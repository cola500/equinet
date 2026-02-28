# Production Readiness Scorecard

**Projekt**: Equinet - Bokningsplattform för hästtjänster
**Version**: v0.3.0+
**Senast uppdaterad**: 2026-02-27
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
| Säkerhet & Privacy | 17 | 3 | 85% |
| Reliability & Availability | 5 | 2 | 71% |
| Kodkvalitet & Testning | 8 | 3 | 73% |
| Tillgänglighet | 4 | 3 | 57% |
| Monitoring & Observability | 3 | 4 | 43% |
| **Totalt** | **44** | **18** | **71%** |

**Prioriterade gap:** P0: 2 st (launch blockers) | P1: 4 st (inom 2 veckor) | P2: 6 st (inom 1 månad)

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
| Lösenordshashing | Klart | bcrypt, 10 rounds |
| HTTP-only cookies | Klart | NextAuth sessions |
| CSRF-skydd | Klart | NextAuth + Origin header-validering |
| SQL injection-skydd | Klart | Prisma (parameterized queries) |
| XSS-skydd | Klart | React auto-escaping |
| Input-validering | Klart | Zod på både client & server (.strict()) |
| Auktoriseringskontroller | Klart | Session + ownership i WHERE clause |
| GDPR-compliant API | Klart | Email/phone ej exponerat |
| Rate limiting | Klart | Upstash Redis (5/h login, 10/h bookings, 100/h publikt) |
| HTTPS + Security headers | Klart | HSTS, CSP (SRI, no unsafe-inline), X-Frame-Options DENY, nosniff, COOP, CORP |
| Lösenordskrav | Klart | Styrka-validering |
| Audit logging | Klart | logger.security() för känsliga operationer |
| Row Level Security | Klart | Deny-all på alla 29 tabeller (migration 20260204120000). Se [docs/architecture/database.md](docs/architecture/database.md) |
| GDPR data export | Klart | /api/export/my-data (JSON + CSV), GDPR Art. 20 |
| Horse data export | Klart | /api/horses/[id]/export |
| SRI (Subresource Integrity) | Klart | `integrity="sha256-..."` på alla script-taggar, tar bort `unsafe-inline` från CSP |
| Error sanitering | Klart | Inga stack traces eller interna detaljer läcker till klienter i produktion |
| Penetrationstestning | Klart | ZAP-baserat pentest (2026-02-27), 6/9 fynd åtgärdade, 3 accepterade/falska positiver |

### Kvarstår

- 2FA för leverantörskonton (se NFR-14)
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
- Separera dev/staging/prod-databaser (se NFR-04)

---

## 4. Kodkvalitet & Testning

### Implementerat

| Krav | Status | Detaljer |
|------|--------|----------|
| TypeScript strict mode | Klart | strict, noImplicitAny, strictNullChecks |
| Unit/integration-tester | Klart | 2783+ tester, 241 testfiler (2026-02-28) |
| E2E-tester | Klart | Playwright, kritiska flöden |
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

**OBS:** Coverage-tracking är inte integrerat i CI ännu (se NFR-13).

### Kvarstår

- Branch protection rules (se NFR-09)
- Dependabot/Renovate (se NFR-10)
- Coverage-tracking i CI (se NFR-13)

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

#### NFR-04: Separera Dev/Staging/Prod-databaser
**Prioritet:** P0
**Kategori:** Reliability
**Effort:** L (1-3d)
**Varför:** Delad databas innebär att utveckling kan påverka produktionsdata.
**Acceptance Criteria:**
- [ ] Tre separata Supabase-projekt (dev, staging, prod)
- [ ] Environment-specifika DATABASE_URL i varje miljö
- [ ] Migrations körs automatiskt vid deploy
- [ ] Seed-data för dev/staging, ren prod

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

#### NFR-09: Branch protection rules
**Prioritet:** P1
**Kategori:** Kodkvalitet
**Effort:** S (1-2h)
**Varför:** Direkt-commits till main kan bryta produktion.
**Acceptance Criteria:**
- [ ] Krav på PR för merge till main
- [ ] CI måste passera före merge
- [ ] Minst 1 approval krävs (när teamet växer)

#### NFR-10: Dependabot/Renovate
**Prioritet:** P1
**Kategori:** Kodkvalitet
**Effort:** S (1-2h)
**Varför:** Dependencies som inte uppdateras ackumulerar säkerhetsrisker och teknisk skuld.
**Acceptance Criteria:**
- [ ] Dependabot eller Renovate konfigurerat
- [ ] Veckovisa PR:er för minor/patch-uppdateringar
- [ ] Månatliga PR:er för major-uppdateringar
- [ ] CI kör tester på dependency-PRs automatiskt

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

#### NFR-13: Coverage-tracking i CI
**Prioritet:** P2
**Kategori:** Kodkvalitet
**Effort:** S (1-2h)
**Varför:** Utan mätning vet vi inte om coverage sjunker vid nya features.
**Acceptance Criteria:**
- [ ] `npm run test:coverage` körs i CI
- [ ] Coverage-badge i README
- [ ] CI varnar (inte failar) om coverage sjunker >2%

#### NFR-14: 2FA för leverantörskonton
**Prioritet:** P2
**Kategori:** Säkerhet
**Effort:** L (1-3d)
**Varför:** Leverantörskonton hanterar bokningar och kunddata -- högre säkerhetskrav.
**Acceptance Criteria:**
- [ ] TOTP-baserad 2FA (Google Authenticator, Authy)
- [ ] Frivilligt vid launch, obligatoriskt efter X månader
- [ ] Backup-koder för återhämtning
- [ ] 2FA krävs vid känsliga operationer (t.ex. ändring av bankuppgifter)

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
**Senast granskad**: 2026-02-28
