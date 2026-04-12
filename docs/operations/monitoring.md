---
title: "Monitoring & Loggning"
description: "Oversikt av overvakningsverktyg, loggning, viktiga metrics och kanda begransningar"
category: operations
tags: [monitoring, logging, vercel, supabase, sentry, cron]
status: active
last_updated: 2026-04-11
related:
  - deployment.md
  - incident-runbook.md
  - ../../NFR.md
sections:
  - Overvakning idag
  - Loggning
  - Viktiga metrics att folja
  - Cron-jobb
  - Kanda begransningar
---

# Monitoring & Loggning

> Relaterat: [NFR.md](../../NFR.md) (43% monitoring-tacking), [deployment.md](deployment.md)

---

## Overvakning idag

### Vercel

| Vad | Hur |
|-----|-----|
| Deploy-status | Vercel Dashboard -> Deployments |
| Serverless-loggar | Vercel Dashboard -> Logs (realtid + historik) |
| Web Analytics | Vercel Analytics (speed insights, web vitals) |
| Funktionsanrop | Vercel Dashboard -> Functions (invocations, duration, errors) |

### Supabase

| Vad | Hur |
|-----|-----|
| Databas-hälsa | Supabase Dashboard -> Database Health |
| Aktiva connections | Supabase Dashboard -> Database -> Connections |
| Slow queries | Supabase Dashboard -> Database -> Query Performance |
| Storage-anvandning | Supabase Dashboard -> Storage |

### Uptime-monitoring (Betterstack)

| Vad | Hur |
|-----|-----|
| Endpoint | `https://equinet.vercel.app/api/health` |
| Intervall | 5 minuter |
| Alert-kanal | E-post till Johan |

**Setup-steg:**
1. Skapa konto pa [betterstack.com](https://betterstack.com) (gratis plan)
2. Lagg till monitor: URL = `https://equinet.vercel.app/api/health`, intervall = 5 min
3. Konfigurera alert-kanal (e-post)
4. Verifiera att monitorn ar gron

### Stripe webhook alerting

| Vad | Hur |
|-----|-----|
| Dashboard | Stripe Dashboard -> Developers -> Webhooks -> webhook-endpoint |
| Alerts | Aktivera e-post-alerts for misslyckade webhooks |

**Setup-steg:**
1. Ga till Stripe Dashboard -> Developers -> Webhooks
2. Valj webhook-endpointen (`/api/webhooks/stripe`)
3. Klicka "Edit" -> aktivera "Email alerts for failed deliveries"
4. Verifiera att alerts ar aktiva

### Sentry (konfigurerat, ej fullt aktiverat)

Miljovariabler ar forberedda (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`). Nar Sentry aktiveras fangas:
- Ohanterade undantag (server + klient)
- Performance traces
- Source maps (kraver `SENTRY_AUTH_TOKEN`)

### Upstash Redis

| Vad | Hur |
|-----|-----|
| Rate limit-traffar | Upstash Console -> Data Browser |
| Kommandon/sekund | Upstash Console -> Metrics |

---

## Loggning

### Server-side

All loggning gar genom `src/lib/logger.ts`:

```typescript
logger.info("Booking created", { bookingId, customerId })
logger.warn("Rate limit near threshold", { ip, remaining })
logger.error("Failed to send email", error)
logger.security("CSRF state mismatch", "high", { userId })
```

**Loggniva-hierarki:** `error` > `warn` > `info` > `debug`

I produktion (Vercel) visas loggar i:
- **Vercel Dashboard -> Logs** (realtid)
- **Vercel CLI:** `vercel logs <deployment-url>`

### Klient-side

Klient-errors fangas av React Error Boundaries (`error.tsx`). Offline-relaterade fel hanteras i `OfflineBanner` och `useOnlineStatus`.

---

## Viktiga metrics att folja

### Prestanda

| Metric | Mal | Hur |
|--------|-----|-----|
| API-svarstid (p95) | < 500ms | Vercel Functions |
| Databas-svarstid | < 100ms | Supabase Query Performance |
| Web Vitals (LCP) | < 2.5s | Vercel Analytics |
| Web Vitals (FID) | < 100ms | Vercel Analytics |

### Tillforlitlighet

| Metric | Mal | Hur |
|--------|-----|-----|
| Serverfel (5xx) | < 0.1% | Vercel Logs (filter: status >= 500) |
| Databas-connections | < 80% av pool | Supabase Connections |
| Rate limit-avslag | Trend | Upstash Metrics |
| Cron-jobbstatus | Alla OK | Vercel Crons |

### Affar

| Metric | Hur |
|--------|-----|
| Aktiva bokningar/dag | SQL-query eller Admin Dashboard |
| Nya registreringar/vecka | Admin Dashboard |
| Stripe webhook-status | Stripe Dashboard |

---

## Cron-jobb

Konfigurerade i `vercel.json`:

| Jobb | Schema | Beskrivning |
|------|--------|-------------|
| `/api/cron/send-reminders` | Varje dag 08:00 UTC | Paminnelser |
| `/api/cron/booking-reminders` | Varje dag 06:00 UTC | Bokningspaminnelser |

Cron-jobb autentiseras med `CRON_SECRET` (Bearer token).

---

## Kanda begransningar

1. **Ingen centraliserad logg-aggregering** -- loggar lever i Vercel och forsvinner efter 24h-7d beroende pa plan
2. **Uptime-alerting via Betterstack** -- grundlaggande, men saknar anpassade troskelvarningar
3. **Sentry ar forberett men inte fullt aktiverat** -- DSN konfigurerad men klientintegration behover slutforas
4. **Ingen APM (Application Performance Monitoring)** -- saknar distribuerade traces over tjanstgranser

> Se [NFR.md](../../NFR.md) for planerade forbattringar (P1/P2).

---

*Senast uppdaterad: 2026-04-11*
