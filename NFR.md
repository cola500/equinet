# Production Readiness Scorecard

**Projekt**: Equinet - Bokningsplattform for hasttjanster
**Version**: v0.3.0+
**Senast uppdaterad**: 2026-02-07
**Syfte**: Levande dokument som visar production readiness-status och gap med story-ready acceptance criteria.

**Relaterade dokument:**
- [DATABASE-ARCHITECTURE.md](docs/DATABASE-ARCHITECTURE.md) -- Schema, RLS, pooling, backup
- [SECURITY-REVIEW-2026-01-21.md](docs/SECURITY-REVIEW-2026-01-21.md) -- Sakerhetsaudit
- [PRODUCTION-DEPLOYMENT.md](docs/PRODUCTION-DEPLOYMENT.md) -- Deploy-guide

---

## Sammanfattning

| Kategori | Klart | Kvar | Score |
|----------|-------|------|-------|
| Performance & Skalbarhet | 7 | 3 | 70% |
| Sakerhet & Privacy | 12 | 5 | 71% |
| Reliability & Availability | 3 | 4 | 43% |
| Kodkvalitet & Testning | 8 | 3 | 73% |
| Tillganglighet | 2 | 5 | 29% |
| Monitoring & Observability | 3 | 4 | 43% |
| **Totalt** | **35** | **24** | **59%** |

**Prioriterade gap:** P0: 4 st (launch blockers) | P1: 6 st (inom 2 veckor) | P2: 6 st (inom 1 manad)

---

## 1. Performance & Skalbarhet

### Response Time Targets

| Endpoint/Page | Target (p95) | Max (p99) | Status |
|---------------|-------------|-----------|--------|
| `/api/providers` (GET) | <200ms | <500ms | Klart -- 97ms (2 providers) |
| `/api/bookings` (GET) | <200ms | <500ms | Ej matt i produktion |
| `/api/services` (GET) | <200ms | <500ms | Ej matt i produktion |
| Provider-lista (render) | <1s | <2s | Klart |
| Dashboard (render) | <1s | <2s | Klart |

### Payload Size Targets

| Endpoint | Target | Max | Status |
|----------|--------|-----|--------|
| `/api/providers` | <50KB | <100KB | Klart -- optimerad med `select` |
| `/api/bookings` | <30KB | <50KB | Ej verifierat |
| JS bundles (total) | <500KB | <1MB | Ej matt |

### Implementerat

- Database indexes pa alla filter/sort-falt (Provider, Service, Booking, Horse, HorseServiceInterval)
- API payload-optimering med Prisma `select` (40-50% reduktion)
- Connection pooling via PgBouncer (10 connections/function). Se [DATABASE-ARCHITECTURE.md](docs/DATABASE-ARCHITECTURE.md)
- Query timeout (10s) och slow query-logging (>2s warn, >500ms info)

### Kvarstar

- Lasttestning och prestandabaseline (se NFR-08)
- Core Web Vitals-matning (se NFR-12)
- Pagination (trigger: 100+ items i listvy)

---

## 2. Sakerhet & Privacy

### Implementerat

| Krav | Status | Detaljer |
|------|--------|----------|
| Losenordshashing | Klart | bcrypt, 10 rounds |
| HTTP-only cookies | Klart | NextAuth sessions |
| CSRF-skydd | Klart | NextAuth inbyggt |
| SQL injection-skydd | Klart | Prisma (parameterized queries) |
| XSS-skydd | Klart | React auto-escaping |
| Input-validering | Klart | Zod pa bade client & server (.strict()) |
| Auktoriseringskontroller | Klart | Session + ownership i WHERE clause |
| GDPR-compliant API | Klart | Email/phone ej exponerat |
| Rate limiting | Klart | Upstash Redis (5/h login, 10/h bookings, 100/h publikt) |
| HTTPS + Security headers | Klart | Vercel + HSTS, CSP, X-Frame-Options DENY, nosniff |
| Losenordskrav | Klart | Styrka-validering |
| Audit logging | Klart | logger.security() for kansliga operationer |
| Row Level Security | Klart | Deny-all pa alla 22 tabeller (migration 20260204120000). Se [DATABASE-ARCHITECTURE.md](docs/DATABASE-ARCHITECTURE.md) |
| GDPR data export | Klart | /api/export/my-data (JSON + CSV), GDPR Art. 20 |
| Horse data export | Klart | /api/horses/[id]/export |

### Kvarstar

- 2FA for leverantorskonton (se NFR-14)
- Automatiserad sakerhetsskanning (se NFR-05)
- Privacy Policy + Cookie consent (se NFR-02)
- Radera konto / right to be forgotten (se NFR-03)
- Data retention policy (se NFR-16)

---

## 3. Reliability & Availability

### Uptime Targets

| Fas | Target | Tillaten downtime |
|-----|--------|-------------------|
| MVP | 99.5% | ~3.6h/manad |
| Produktion | 99.9% | ~43min/manad |

### Error Rate Targets

| Typ | Target | Max | Status |
|-----|--------|-----|--------|
| API 5xx | <0.1% | <1% | Ej matt |
| API 4xx | <5% | <10% | Ej matt |
| Client crashes | <0.1% | <1% | Ej matt |

### Implementerat

- Error handling & retry-logik (useRetry hook, ErrorState component, toast med retry)
- Sentry for error tracking (client + server + edge, session replay)
- Email-notifieringar via Resend (mock-fallback om nyckel saknas)

### Kvarstar

- Uptime-monitorering (se NFR-06)
- Sentry-alertregler (se NFR-07)
- Backup & disaster recovery -- dagliga backups finns pa Supabase free tier (7d retention), men PITR kraver Pro. Se [DATABASE-ARCHITECTURE.md](docs/DATABASE-ARCHITECTURE.md)
- Separera dev/staging/prod-databaser (se NFR-04)

---

## 4. Kodkvalitet & Testning

### Implementerat

| Krav | Status | Detaljer |
|------|--------|----------|
| TypeScript strict mode | Klart | strict, noImplicitAny, strictNullChecks |
| Unit/integration-tester | Klart | 1289+ tester, 101 testfiler (2026-02-07) |
| E2E-tester | Klart | Playwright, kritiska floden |
| ESLint | Klart | Flat config (eslint.config.mjs) |
| Husky pre-commit | Klart | npm test |
| Husky pre-push | Klart | test:run + typecheck + check:swedish + lint |
| DDD-Light arkitektur | Klart | Repository pattern for karndomaner |
| TDD workflow | Klart | Red -> Green -> Refactor |

### Coverage Targets

| Omrade | Target | Min |
|--------|--------|-----|
| Overall | 70% | 60% |
| API Routes | 80% | 70% |
| Utilities | 90% | 80% |
| Components | 60% | 50% |

**OBS:** Coverage-tracking ar inte integrerat i CI annu (se NFR-13).

### Kvarstar

- Branch protection rules (se NFR-09)
- Dependabot/Renovate (se NFR-10)
- Coverage-tracking i CI (se NFR-13)

---

## 5. Tillganglighet

### Mal

**Target:** WCAG 2.1 Level AA

### Implementerat

| Krav | Status |
|------|--------|
| Semantic HTML | Klart -- button, nav, main |
| ARIA live regions | Klart -- screen reader-stod |

### Kvarstar

- ARIA labels pa alla form inputs (partial idag)
- Keyboard navigation-testning (tab order, escape for modals)
- Kontrastverifiering (4.5:1 normal text, 3:1 large text)
- Screen reader-testning (VoiceOver)
- Touch targets >= 44x44px
- Automatiserad tillganglighetstestning (se NFR-11)

---

## 6. Monitoring & Observability

### Implementerat

| Krav | Status | Detaljer |
|------|--------|----------|
| Error tracking | Klart | Sentry (3 config-filer: client, server, edge) |
| Session replay | Klart | Sentry session replay |
| Structured logging | Klart | logger med nivaer (error, warn, info, debug) |

### Kvarstar

- Uptime-monitorering (se NFR-06)
- Sentry-alertregler (se NFR-07)
- Core Web Vitals-matning (se NFR-12)
- Response time-dashboards (p50/p95/p99)

---

## Tekniska Stories -- Production Gaps

Varje gap ar formaterat som en story-ready post med prioritet, effort och acceptance criteria.

### P0: Launch Blockers

#### NFR-01: Integrera betalningsgateway (Stripe/Swish)
**Prioritet:** P0
**Kategori:** Funktionell / Sakerhet
**Effort:** XL (1v+)
**Varfor:** Ingen intakt utan betalning. Sakerhetskritiskt -- PCI DSS-hantering.
**Acceptance Criteria:**
- [ ] Stripe- eller Swish-integration fungerar i produktion
- [ ] Betalning genomfors vid bokning
- [ ] Webhook hanterar betalningsstatus (success/failure/refund)
- [ ] Kvitton skickas via email
- [ ] PCI-compliance verifierad (Stripe Checkout/Elements hanterar kortdata)

#### NFR-02: Privacy Policy + Cookie Consent
**Prioritet:** P0
**Kategori:** Sakerhet & Privacy
**Effort:** M (3-8h)
**Varfor:** Lagkrav (GDPR Art. 13/14, EU Cookie Directive). Kan leda till boter.
**Acceptance Criteria:**
- [ ] Privacy Policy-sida publicerad (Swedish)
- [ ] Cookie consent-banner visas for forstagangsbesokare
- [ ] Samtycke loggas och respekteras
- [ ] Lank till policy fran registreringssida och footer

#### NFR-03: Radera konto (GDPR Art. 17)
**Prioritet:** P0
**Kategori:** Sakerhet & Privacy
**Effort:** M (3-8h)
**Varfor:** Lagkrav -- anvandare har ratt att fa sin data raderad.
**Acceptance Criteria:**
- [ ] Anvandare kan begara kontoradering fran profil
- [ ] Personuppgifter anonymiseras/raderas (email, namn, telefon)
- [ ] Bokningshistorik bevaras anonymiserad (for leverantorsstatistik)
- [ ] Bekraftelse-email skickas fore slutgiltig radering
- [ ] Grace period (t.ex. 30 dagar) fore permanent radering

#### NFR-04: Separera Dev/Staging/Prod-databaser
**Prioritet:** P0
**Kategori:** Reliability
**Effort:** L (1-3d)
**Varfor:** Delad databas innebar att utveckling kan paverka produktionsdata.
**Acceptance Criteria:**
- [ ] Tre separata Supabase-projekt (dev, staging, prod)
- [ ] Environment-specifika DATABASE_URL i varje miljo
- [ ] Migrations kors automatiskt vid deploy
- [ ] Seed-data for dev/staging, ren prod

---

### P1: Inom 2 veckor efter launch

#### NFR-05: Automatiserad sakerhetsskanning
**Prioritet:** P1
**Kategori:** Sakerhet
**Effort:** S (1-2h)
**Varfor:** Kanda sarbarheter i dependencies maste fangas automatiskt.
**Acceptance Criteria:**
- [ ] Dependabot aktiverat pa GitHub-repot
- [ ] Automatiska PR:er for sakerhetspatchar
- [ ] `npm audit` kors i CI-pipeline

#### NFR-06: Uptime-monitorering
**Prioritet:** P1
**Kategori:** Reliability
**Effort:** S (1-2h)
**Varfor:** Utan monitorering upptacks driftstorningar forst nar anvandare klagar.
**Acceptance Criteria:**
- [ ] Extern uptime-monitor konfigurerad (t.ex. UptimeRobot, Checkly)
- [ ] Kontrollerar /api/health var 5:e minut
- [ ] Email/Slack-alert vid downtime
- [ ] Manatlig uptime-rapport tillganglig

#### NFR-07: Sentry-alertregler
**Prioritet:** P1
**Kategori:** Monitoring
**Effort:** S (1-2h)
**Varfor:** Sentry samlar data men notifierar inte vid problem utan konfigurerade regler.
**Acceptance Criteria:**
- [ ] Alert vid error rate >5% under 5 minuter
- [ ] Alert vid nya unhandled exceptions
- [ ] Email-notifiering till teamet
- [ ] Veckovis error digest

#### NFR-08: Lasttestning + prestandabaseline
**Prioritet:** P1
**Kategori:** Performance
**Effort:** L (1-3d)
**Varfor:** Utan baseline vet vi inte om performance forsamras over tid.
**Acceptance Criteria:**
- [ ] Lasttestverktyg uppsatt (k6, Artillery, eller liknande)
- [ ] Baslinjetest for kritiska endpoints (providers, bookings, services)
- [ ] Test med 100 concurrent users utan degradering
- [ ] Resultat dokumenterade som referens

#### NFR-09: Branch protection rules
**Prioritet:** P1
**Kategori:** Kodkvalitet
**Effort:** S (1-2h)
**Varfor:** Direkt-commits till main kan bryta produktion.
**Acceptance Criteria:**
- [ ] Krav pa PR for merge till main
- [ ] CI maste passera fore merge
- [ ] Minst 1 approval kravs (nar teamet vaxer)

#### NFR-10: Dependabot/Renovate
**Prioritet:** P1
**Kategori:** Kodkvalitet
**Effort:** S (1-2h)
**Varfor:** Dependencies som inte uppdateras ackumulerar sakerhetsrisker och teknisk skuld.
**Acceptance Criteria:**
- [ ] Dependabot eller Renovate konfigurerat
- [ ] Veckovisa PR:er for minor/patch-uppdateringar
- [ ] Manatliga PR:er for major-uppdateringar
- [ ] CI kor tester pa dependency-PRs automatiskt

---

### P2: Inom 1 manad efter launch

#### NFR-11: Automatiserad tillganglighetstestning
**Prioritet:** P2
**Kategori:** Tillganglighet
**Effort:** M (3-8h)
**Varfor:** Manuell testning skalas inte -- automatisering fanger regressioner.
**Acceptance Criteria:**
- [ ] @axe-core/playwright integrerat i E2E-sviten
- [ ] Tillganglighetstest for varje kritiskt flade (sok, bokning, profil)
- [ ] CI failar vid WCAG AA-violations

#### NFR-12: Core Web Vitals-matning
**Prioritet:** P2
**Kategori:** Performance
**Effort:** S (1-2h)
**Varfor:** LCP, FID, CLS paverkar SEO-ranking och anvandarupplevelse.
**Acceptance Criteria:**
- [ ] Vercel Analytics eller web-vitals-bibliotek installerat
- [ ] LCP <2.5s, FID <100ms, CLS <0.1 for alla sidor
- [ ] Dashboard for att folja trender

#### NFR-13: Coverage-tracking i CI
**Prioritet:** P2
**Kategori:** Kodkvalitet
**Effort:** S (1-2h)
**Varfor:** Utan matning vet vi inte om coverage sjunker vid nya features.
**Acceptance Criteria:**
- [ ] `npm run test:coverage` kors i CI
- [ ] Coverage-badge i README
- [ ] CI varnar (inte failar) om coverage sjunker >2%

#### NFR-14: 2FA for leverantorskonton
**Prioritet:** P2
**Kategori:** Sakerhet
**Effort:** L (1-3d)
**Varfor:** Leverantorskonton hanterar bokningar och kunddata -- hogre sakerhetskrav.
**Acceptance Criteria:**
- [ ] TOTP-baserad 2FA (Google Authenticator, Authy)
- [ ] Frivilligt vid launch, obligatoriskt efter X manader
- [ ] Backup-koder for aterhamtning
- [ ] 2FA kravs vid kansliga operationer (t.ex. andring av bankuppgifter)

#### NFR-15: Cross-browser-testning
**Prioritet:** P2
**Kategori:** Tillganglighet / UX
**Effort:** M (3-8h)
**Varfor:** Anvandare pa Safari/Firefox kan ha annan upplevelse.
**Acceptance Criteria:**
- [ ] Testade i Chrome, Firefox, Safari (senaste 2 versionerna)
- [ ] E2E-tester kors i minst 2 browsers i CI
- [ ] Kanda inkompatibiliteter dokumenterade och fixade

#### NFR-16: Data retention policy
**Prioritet:** P2
**Kategori:** Sakerhet & Privacy
**Effort:** S (1-2h)
**Varfor:** GDPR kraver definierade lagringsperioder for personuppgifter.
**Acceptance Criteria:**
- [ ] Dokumenterad policy for varje datatyp (anvandare, bokningar, loggar)
- [ ] Automatisk radering av gammal data (t.ex. loggar >1 ar)
- [ ] Policy publicerad i Privacy Policy

---

## Underhallsschema

| Kadens | Aktivitet |
|--------|-----------|
| Daglig | Kolla Sentry-dashboard for nya fel |
| Daglig | Verifiera uptime (nar monitorering ar pa plats) |
| Veckovis | Granska performance-metriker |
| Veckovis | Triagera oppna buggar |
| Manatlig | `npm audit` + dependency-uppdateringar |
| Manatlig | Granska och uppdatera detta dokument |
| Kvartalsvis | Full sakerhetsgenomgang |
| Kvartalsvis | Backup restore-test |
| Kvartalsvis | Tillganglighetsaudit |

---

**Dokumentagare**: Johan Lindengard
**Senast granskad**: 2026-02-07
