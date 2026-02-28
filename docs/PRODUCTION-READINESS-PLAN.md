# Production Readiness Plan

> Sammanställd 2026-02-28. Övergripande poäng: ~65% (40/62 krav i NFR.md).

## Nuläge -- Vad som redan är klart

| Område | Status | Poäng |
|--------|--------|-------|
| Säkerhet (auth, CSRF, RLS, rate limiting, CSP) | Penetrationstestat | 75% |
| Databas-schema (24 tabeller, index, constraints) | Produktionsredo | 85% |
| Testning (2679 tester, TDD, E2E) | Stark | 73% |
| Kodkvalitet (0 lint-varningar) | Komplett | 100% |
| Deploy-infrastruktur (Vercel, Sentry, cron) | Redo | 90% |
| Offline/PWA (Service Worker, IndexedDB, sync) | Komplett | 90% |
| Performance (index, connection pooling, select) | Skalbar | 70% |
| Övervakning (Sentry, logger, health endpoint) | Barebones | 43% |
| Tillgänglighet (WCAG) | Delvis | 57% |
| Reliabilitet (error boundaries, retry, offline) | Resilient | 43% |

---

## P0 -- Måste fixas före lansering

### 1. Betalintegration (Stripe/Swish)

**Uppskattning:** 1+ vecka
**Varför:** Intäktsmodellen blockeras utan betalning.

- [ ] Välj provider (Stripe och/eller Swish)
- [ ] Webhook-hantering (success/failure/refund)
- [ ] Kvitto-generering (redan finns `generateReceiptHtml`)
- [ ] PCI-DSS compliance (Stripe hanterar detta vid hosted checkout)
- [ ] Testläge + produktionsnycklar
- [ ] Feature flag: `payment_enabled`

### ~~2. Integritetspolicy + Cookie-consent~~ KLART

Redan implementerat:
- [x] Cookie-consent banner (`src/components/layout/CookieNotice.tsx`, inkluderad i `layout.tsx`)
- [x] Användarvillkor-sida (`/anvandarvillkor`)
- [x] Länk i Footer + CookieNotice

### 3. Radera konto (GDPR Art. 17)

**Uppskattning:** 3-8h
**Varför:** Rätten att bli glömd. Juridiskt krav.

- [ ] API: `DELETE /api/account` -- anonymiserar/raderar användardata
- [ ] Bevara bokningshistorik för leverantörsstatistik (anonymisera kunddata)
- [ ] Grace period (14 dagar innan permanent radering?)
- [ ] E-postbekräftelse innan radering
- [ ] UI: Knapp i profilinställningar

### 4. Separata databas-miljöer

**Uppskattning:** 1-3 dagar
**Varför:** Dev och prod delar idag samma Supabase-instans. En felaktig query kan radera all kunddata.

- [ ] Skapa 3 Supabase-projekt: `equinet-dev`, `equinet-staging`, `equinet-prod`
- [ ] Miljöspecifika `DATABASE_URL` i Vercel (per environment)
- [ ] Migrationsstrategi: applicera migrationer per miljö
- [ ] Verifiera att `.env.local` pekar på dev, inte prod
- [ ] Seed-data för dev/staging

### 5. Uptime-övervakning (ops-konfiguration)

**Uppskattning:** 30 min
**Varför:** Health endpoint finns (`/api/health` med DB-check + tester). Kvarstår att konfigurera extern monitor.

- [x] Health endpoint med DB-connectivity check (`src/app/api/health/`)
- [x] Lightweight HEAD-probe för offline-detektion
- [ ] Konfigurera UptimeRobot (gratis: 50 monitors) mot `GET /api/health`
- [ ] E-postvarning vid >3 min nertid

### 6. Sentry-alertregler

**Uppskattning:** 1-2h
**Varför:** Sentry samlar fel men notifierar ingen.

- [ ] Alert: error rate >5% under 5 min
- [ ] Alert: nya unhandled exceptions
- [ ] Notifiering via e-post (+ Slack om det finns)
- [ ] Verifiera att source maps laddas upp vid deploy

---

## P1 -- Bör fixas inom 2 veckor efter lansering

### 7. Lasttest-baseline mot prod build

**Uppskattning:** 1-3 dagar

- [ ] Kör `npm run build && npm start` + k6 (inte dev-server)
- [ ] Etablera realistisk baseline (p50, p95, p99)
- [ ] Kör mot Vercel staging med `LOAD_TEST_BASE_URL`
- [ ] Dokumentera i `docs/LOAD-TEST-BASELINE.md`

### 8. Automatisk beroendeuppdatering

**Uppskattning:** 1-2h

- [ ] Aktivera Dependabot eller Renovate på GitHub
- [ ] Automatisk PR för säkerhetsuppdateringar
- [ ] Gruppera minor/patch-uppdateringar

### 9. Cron-job-övervakning

**Uppskattning:** 3-8h

- [ ] Logga varje cron-körning (start, slut, antal behandlade)
- [ ] Alert vid misslyckad körning (send-reminders, booking-reminders)
- [ ] Healthcheck-endpoint per cron (`/api/cron/status`)

### 10. Test-coverage till 70%

**Uppskattning:** 3-8h
**Nuläge:** 69.26% (strax under tröskeln)

- [ ] Identifiera lågtäckta filer (`npm run test:run -- --coverage`)
- [ ] Fokus: email notifications (6.75%), auth validation
- [ ] 5-10 riktade tester bör räcka

---

## P2 -- Bra att ha (inom 1 månad)

| Vad | Uppskattning | Kommentar |
|-----|-------------|-----------|
| 2FA för leverantörskonton | 1-3 dagar | Högvärdeskonton med kunddata |
| Automatiserad tillgänglighetstest (axe-core) | 1-2h | Integration i CI |
| Core Web Vitals-dashboard | 1-2h | LCP/FID/CLS-spårning |
| Response time-dashboards | 3-8h | p50/p95/p99 metrics |
| Post-deployment runbook | 3-8h | "Vad gör jag om X går sönder?" |
| Incidenthanteringsplan | 3-8h | Eskaleringsrutiner |

---

## Kända risker i produktion

| Risk | Konsekvens | Befintlig mitigation |
|------|-----------|---------------------|
| Deploy utan migration | 500-fel på alla requests | Dokumenterat i GOTCHAS.md #25. `npm run deploy` påminner. |
| In-memory state på Vercel | Feature flags nollställs | Löst: PostgreSQL-backed feature flags |
| NEXTAUTH_URL-mismatch | CSRF-token failure | Dokumenterat i GOTCHAS.md #23 |
| Connection pool-utmattning | Timeouts under last | PgBouncer Session Pooler via Supabase |
| Service Worker cache-korruption | Gammal JS körs | Serwist auto-uppdatering + skipWaiting |

---

## Uppskattad tidslinje

```
Vecka 1:  P0 #2-6 (integritetspolicy, GDPR, miljöseparation, övervakning)
Vecka 2-3: P0 #1 (betalintegration)
Vecka 3-4: P1 (lasttest, Dependabot, cron-övervakning, coverage)
Vecka 5+:  P2 (2FA, tillgänglighet, dashboards)
```

**Realistisk lanseringsdatum:** ~3 veckor från nu (beroende på betalintegration).

---

**Senast uppdaterad:** 2026-02-28
