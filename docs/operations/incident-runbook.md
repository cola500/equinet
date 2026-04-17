---
title: "Incident Runbook"
description: "Vanliga driftstorningar och steg-for-steg-losningar for databas, Stripe, rate limiting, e-post och cron"
category: operations
tags: [incidents, runbook, troubleshooting, rollback, escalation]
status: active
last_updated: 2026-04-11
related:
  - deployment.md
  - environments.md
  - monitoring.md
sections:
  - 1. Databasanslutningsfel
  - 2. Misslyckade migrationer
  - 3. Stripe webhook-problem
  - 4. Rate limiting-problem
  - 5. E-postleveransproblem
  - 6. Cron-jobb kor inte
  - Rollback-procedurer
  - Eskalering
---

# Incident Runbook

Vanliga driftstorningar och hur de loses.

---

## 1. Databasanslutningsfel

### Symptom
- `500`-fel pa alla API-endpoints
- Vercel-loggar visar `PrismaClientInitializationError` eller `P1001`

### Diagnos
```bash
npm run env:status        # Vilken databas ar aktiv?
npm run migrate:status    # Finns det pending migrationer?
```

### Losning

**Supabase:**
1. Kontrollera Supabase Dashboard -> Database Health
2. Kontrollera att `connection_limit=1` finns i DATABASE_URL (serverless-krav)
3. Om connection pool ar full: Vanta 5 min eller pausa/aterstall projektet i Supabase Dashboard

**Lokalt:**
1. `npm run db:up` (starta Docker-containern)
2. `docker ps` (verifiera "healthy")
3. `npx prisma migrate dev` (om tabeller saknas)

---

## 2. Misslyckade migrationer

### Symptom
- `npm run migrate:status` visar migrationer med `finished_at: null`
- Nya deploy-ar ger 500-fel pa andrade tabeller

### Diagnos
```bash
npm run migrate:status    # Visar pending, drift och misslyckade
npm run migrate:check     # Snabb oversikt av senaste 5
```

### Losning
1. Logga in pa Supabase SQL Editor
2. Kontrollera `_prisma_migrations`:
   ```sql
   SELECT * FROM _prisma_migrations WHERE finished_at IS NULL;
   ```
3. Ta bort misslyckade poster:
   ```sql
   DELETE FROM _prisma_migrations WHERE finished_at IS NULL;
   ```
4. Kor migrationen pa nytt:
   ```bash
   npm run migrate:supabase
   ```

> **Viktigt:** Applicera ALLTID migrationer INNAN deploy till Vercel. Saknade migrationer ger 500-fel i produktion.

---

## 3. Stripe webhook-problem

### Symptom
- Prenumerationer uppdateras inte efter betalning
- Stripe Dashboard visar misslyckade webhook-leveranser

### Diagnos
1. Stripe Dashboard -> Developers -> Webhooks -> Event log
2. Vercel-loggar for `/api/webhooks/stripe`

### Losning

**Signaturfel:**
- Kontrollera att `STRIPE_WEBHOOK_SECRET` i Vercel matchar webhook-konfigurationen i Stripe Dashboard
- Stripe roterar ibland secrets -- regenerera vid behov

**Endpoint nere:**
- Kontrollera att Vercel-deployen ar aktiv
- Stripe forsaker automatiskt i 3 dagar med exponentiell backoff

**Manuell retry:**
1. Hitta misslyckat event i Stripe Dashboard
2. Klicka "Resend" for att skicka om

---

## 4. Rate limiting-problem

### Symptom
- Anvandare rapporterar `429`-fel
- Legitim trafik blockeras

### Diagnos
1. Upstash Console -> Data Browser (sok pa anvandarnyckel)
2. Vercel-loggar (filtrera pa status 429)

### Losning

**Enstaka anvandare:**
- Rate limits aterstalls automatiskt (sliding window)
- Login: 15 min, API: 1 min, Booking: 1 h

**Bred blockering (alla anvandare):**
1. Kontrollera om det ar en DDoS-attack (traffikmonster i Vercel)
2. Om legitimt: oka limits temporart i Upstash

> Rate limit-granser definieras i `src/lib/rate-limit.ts`.

---

## 5. E-postleveransproblem

### Symptom
- Kunder far inte bokningsbekraftelser
- Leverantorer far inte paminnelser

### Diagnos
1. Kontrollera `RESEND_API_KEY` i Vercel miljovariabler
2. Resend Dashboard -> Logs
3. Vercel-loggar (sok pa "email" eller "resend")

### Losning
- **`DISABLE_EMAILS="true"`**: E-post ar medvetet avaktiverat. Ta bort eller satt till `false`.
- **API-nyckelfel**: Regenerera nyckel i Resend Dashboard, uppdatera i Vercel
- **Bounce/spam**: Kontrollera avsandaradress (`FROM_EMAIL`) och DNS (SPF/DKIM)

---

## 6. Cron-jobb kor inte

### Symptom
- Bokningspaminnelser skickas inte
- Vercel Dashboard -> Crons visar misslyckade kor

### Diagnos
1. Vercel Dashboard -> Crons -> Execution log
2. Kontrollera att `CRON_SECRET` matchar i Vercel miljovariabler

### Losning
- **401-fel**: `CRON_SECRET` saknas eller ar fel. Uppdatera i Vercel Project Settings.
- **500-fel**: Las Vercel-loggarna for det specifika cron-jobbet
- **Manuell korning**: Anropa endpointen direkt med `Authorization: Bearer <CRON_SECRET>`

---

## Rollback-procedurer

### Vercel-deploy

1. Ga till Vercel Dashboard -> Deployments
2. Hitta senaste fungerande deployment
3. Klicka "..." -> "Promote to Production"

### Databasandringar

Prisma stodjer inte automatisk rollback. Vid problematisk migration:

1. Skriv en ny migration som ateroverar andringar
2. Applicera med `npm run migrate:supabase`
3. Deploya ny version

> **Rekommendation:** Ta alltid backup fore stora schemaandringar: `npm run db:backup`

---

## Eskalering

| Niva | Atgard |
|------|--------|
| P1 (Sidan nere) | Rollback deploy + kontrollera databas |
| P2 (Feature trasig) | Avaktivera feature flag via Admin -> System |
| P3 (Prestandaproblem) | Kontrollera Supabase queries + Vercel functions |

> Feature flags kan anvandas for att snabbt avaktivera problematiska features utan deploy.

---

## Kontaktinfo och eskalering

| Tjanst | Kontakt | Notering |
|--------|---------|----------|
| **Supabase** | Dashboard + support@supabase.io | Status: status.supabase.com |
| **Stripe** | Dashboard + support.stripe.com | Status: status.stripe.com |
| **Vercel** | Dashboard + vercel.com/help | Status: vercel-status.com |
| **Resend** | Dashboard + resend.com/support | Status: status.resend.com |
| **Upstash (Redis)** | Dashboard + support@upstash.com | Status: status.upstash.com |
| **Sentry** | Dashboard (sentry.io) | - |

### Vid admin-MFA-lockout (admin tappat telefon)

Supabase TOTP stödjer INTE backup-koder. Återställning kräver manuell åtgärd.

**Rekommendation:** Admin bör enrolla TOTP på flera enheter (telefon + iPad/1Password).

**Om admin tappat ALLA factors:**

1. **Annan admin loggar in** i Supabase Dashboard (eller Johan som ägare)
2. Gå till Authentication -> Users -> hitta den låsta användaren
3. Radera MFA-factorn manuellt (Admin API: `admin.mfa.deleteFactor`)
4. Användaren kan nu logga in med lösenord och redirectas till `/admin/mfa/setup`
5. **Logga händelsen** i admin audit log

**Om INGEN admin har access:** Kontakta Supabase Support via console. Kräver verifiering av ägarskap.

Se `docs/security/mfa-admin.md` för fullständig guide.

---

### Vid dataintrang

1. Stang av paverkade API-nycklar omedelbart
2. Kontakta Supabase support for logganalys
3. Dokumentera handelsen (tidpunkt, paverkan, atgard)
4. Meddela paverkade anvandare om persondata berors (GDPR, 72h)

---

*Senast uppdaterad: 2026-04-11*
