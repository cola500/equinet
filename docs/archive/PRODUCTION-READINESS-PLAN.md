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

### ~~3. Radera konto (GDPR Art. 17)~~ KLART

Implementerat 2026-02-28:
- [x] API: `DELETE /api/account` -- anonymiserar användardata, raderar personliga poster
- [x] Bevara bokningshistorik för leverantörsstatistik (anonymiserad kunddata)
- [x] E-postbekräftelse innan radering (skickas före anonymisering)
- [x] UI: Knapp i profil (kund + leverantör), lösenord + "RADERA"-bekräftelse
- [x] Admin-konton blockeras från radering
- [x] Säkerhetsloggning vid radering

### ~~4. Uptime-övervakning (ops-konfiguration)~~ KLART

- [x] Health endpoint med DB-connectivity check (`src/app/api/health/`)
- [x] Lightweight HEAD-probe för offline-detektion
- [x] Dokumenterat UptimeRobot-setup i `docs/PRODUCTION-DEPLOYMENT.md` steg 8.1
- [x] E-postvarning vid >3 missade kontroller (15 min nertid)

### ~~5. Sentry-alertregler~~ KLART

Dokumenterat i `docs/PRODUCTION-DEPLOYMENT.md` steg 8.2:
- [x] Alert: hög felfrekvens (>50 events per 5 min)
- [x] Alert: nya unhandled exceptions
- [x] Notifiering via e-post
- [x] Source maps: env-variabler dokumenterade (SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT)

---

## P1 -- Bör fixas inom 2 veckor efter lansering

### 6. Lasttest-baseline mot prod build

**Uppskattning:** 1-3 dagar

- [ ] Kör `npm run build && npm start` + k6 (inte dev-server)
- [ ] Etablera realistisk baseline (p50, p95, p99)
- [ ] Kör mot Vercel staging med `LOAD_TEST_BASE_URL`
- [ ] Dokumentera i `docs/LOAD-TEST-BASELINE.md`

### 7. Automatisk beroendeuppdatering

**Uppskattning:** 1-2h

- [ ] Aktivera Dependabot eller Renovate på GitHub
- [ ] Automatisk PR för säkerhetsuppdateringar
- [ ] Gruppera minor/patch-uppdateringar

### 8. Cron-job-övervakning

**Uppskattning:** 3-8h

- [ ] Logga varje cron-körning (start, slut, antal behandlade)
- [ ] Alert vid misslyckad körning (send-reminders, booking-reminders)
- [ ] Healthcheck-endpoint per cron (`/api/cron/status`)

### 9. Test-coverage till 70%

**Uppskattning:** 3-8h
**Nuläge:** 69.26% (strax under tröskeln)

- [ ] Identifiera lågtäckta filer (`npm run test:run -- --coverage`)
- [ ] Fokus: email notifications (6.75%), auth validation
- [ ] 5-10 riktade tester bör räcka

---

## P2 -- Bra att ha (inom 1 månad)

| Vad | Uppskattning | Kommentar |
|-----|-------------|-----------|
| Staging-miljö (Supabase) | 1-2 dagar | Dev (Docker) + prod (Supabase) redan separerade. Kvarstår: dedikerat staging-projekt + verifiera att `.env.local` inte pekar på prod |
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
Vecka 1:  P0 #2-5 (integritetspolicy, GDPR, övervakning, Sentry)
Vecka 2-3: P0 #1 (betalintegration)
Vecka 3-4: P1 (lasttest, Dependabot, cron-övervakning, coverage)
Vecka 5+:  P2 (staging-miljö, 2FA, tillgänglighet, dashboards)
```

**Realistisk lanseringsdatum:** ~3 veckor från nu (beroende på betalintegration).

---

**Senast uppdaterad:** 2026-02-28
