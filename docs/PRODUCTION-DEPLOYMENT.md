# Production Deployment Guide

> **Snabbstart för att deploya Equinet till Vercel med full säkerhet och monitoring.**

**Estimerad tid:** 15-20 minuter
**Förutsättningar:** GitHub repository, Vercel account

---

## 📋 Översikt

Denna guide tar dig genom:
1. ✅ Vercel deployment setup (5 min)
2. ✅ Upstash Redis för rate limiting (5 min)
3. ✅ Sentry för error tracking (5 min)
4. ✅ Supabase PostgreSQL (redan setup)
5. ✅ Environment variables konfiguration
6. ✅ Post-deployment verifiering

**Production Readiness efter denna guide: 8/10 → 9/10**

---

## 🚀 Steg 1: Vercel Deployment (5 min)

### 1.1 Importera Repository

1. Gå till [vercel.com](https://vercel.com)
2. Klicka **"Add New" → "Project"**
3. Välj ditt GitHub repository (equinet)
4. Klicka **"Import"**

### 1.2 Configure Build Settings

Vercel ska automatiskt detektera Next.js. Verifiera:

```
Framework Preset: Next.js
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

**⚠️ Klicka INTE "Deploy" än!** Vi måste lägga till environment variables först.

---

## 🔑 Steg 2: Environment Variables

Lägg till följande i Vercel **Environment Variables** (Project Settings → Environment Variables):

### 2.1 Database (REQUIRED)

```bash
# Supabase PostgreSQL
DATABASE_URL="postgresql://user:pass@db.xxx.supabase.co:5432/postgres?pgbouncer=true"
```

**Var hittar jag detta?**
- Supabase Dashboard → Project Settings → Database
- Välj **Session Pooler (IPv4)** connection string

### 2.2 Authentication (REQUIRED)

```bash
# NextAuth Secret (generera ny för production)
NEXTAUTH_SECRET="your-production-secret-here"

# NextAuth URL (din Vercel domain)
NEXTAUTH_URL="https://your-app.vercel.app"
```

**Generera NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
# Kopiera output till NEXTAUTH_SECRET
```

**NEXTAUTH_URL:**
- Tillfälligt: `https://your-project.vercel.app` (Vercel ger dig denna)
- Custom domain: `https://equinet.se` (konfigurera under Domains)

---

## ⚡ Steg 3: Upstash Redis Setup (5 min)

**Varför:** Rate limiting fungerar INTE utan Redis i serverless (Vercel).

### 3.1 Skapa Upstash Account

1. Gå till [upstash.com](https://upstash.com)
2. Sign up (gratis tier: 10,000 requests/dag)
3. Verifiera email

### 3.2 Skapa Redis Database

1. **Dashboard** → **Create Database**
2. Konfigurera:
   ```
   Name: equinet-rate-limiting
   Type: Regional
   Region: EU-WEST-1 (välj närmaste din användarbas)
   TLS: Enabled
   ```
3. Klicka **"Create"**

### 3.3 Kopiera Credentials

1. På database dashboard, hitta **"REST API"** sektion
2. Kopiera:
   - **UPSTASH_REDIS_REST_URL**
   - **UPSTASH_REDIS_REST_TOKEN**

### 3.4 Lägg till i Vercel

Tillbaka i Vercel Environment Variables:

```bash
UPSTASH_REDIS_REST_URL="https://your-db.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token-here"
```

**✅ Sätt för:** Production, Preview, Development

---

## 📊 Steg 4: Sentry Setup (5 min)

**Varför:** Error tracking och performance monitoring för production.

### 4.1 Skapa Sentry Account

1. Gå till [sentry.io](https://sentry.io)
2. Sign up (gratis tier: 5,000 errors/månad)
3. Verifiera email

### 4.2 Skapa Project

1. **Create Project**
2. Välj platform: **"Next.js"**
3. Konfigurera:
   ```
   Project name: equinet
   Team: Personal (eller skapa nytt team)
   Alert frequency: Default
   ```
4. Klicka **"Create Project"**

### 4.3 Kopiera DSN

1. Efter project creation, hitta **"DSN"** (Data Source Name)
2. Kopiera hela URL:en (börjar med `https://`)

Exempel:
```
https://abc123xyz@o123456.ingest.sentry.io/7891234
```

### 4.4 Lägg till i Vercel

```bash
# Required
NEXT_PUBLIC_SENTRY_DSN="https://your-dsn@sentry.io/project-id"

# Optional (för source maps upload)
SENTRY_ORG="your-org-slug"
SENTRY_PROJECT="equinet"
```

**⚠️ NEXT_PUBLIC_SENTRY_DSN** är **public** (syns i browser), det är OK!

**Hitta org slug:** Sentry Dashboard → Organization Settings → Organization Slug

---

## 🎯 Steg 5: Deploy! (2 min)

Nu är allt konfigurerat. Dags att deploya:

### 5.1 Vid schemaandringar: Migrera FORST!

**KRITISKT:** Om du har andrat `prisma/schema.prisma`, applicera migrationer INNAN deploy:

```bash
# 1. Kolla pending migrationer (namnbaserad jamforelse)
npm run migrate:status

# 2. Applicera till Supabase (via MCP, SQL Editor, eller CLI)
# Vercel-koden SELECT:ar ALLA kolumner utan explicit select-block.
# Om DB saknar kolumner -> 500-fel pa ALLA endpoints.

# 3. Forst EFTER migration: deploya
```

> Se [GOTCHAS.md #25](GOTCHAS.md#25-deploy-utan-migration--500-fel-i-produktion) for detaljer.

### 5.2 Trigger Deployment

1. Vercel Dashboard → **"Deploy"**
2. Vänta ~2-3 minuter (first deploy tar längre tid)
3. ✅ Deployment successful!

### 5.2 Verifiera Domain

Vercel ger dig automatiskt:
```
https://your-project.vercel.app
```

**Custom Domain (optional):**
1. Project Settings → Domains
2. Lägg till din domain (t.ex. `equinet.se`)
3. Följ DNS-instruktioner från Vercel

---

## ✅ Steg 6: Post-Deployment Verification (5 min)

### 6.1 Health Check

Verifiera att applikationen körs:

```bash
curl https://your-app.vercel.app/api/health
```

**Förväntat response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-21T...",
  "checks": {
    "database": "connected"
  }
}
```

**Om du får 503:**
- Kolla `DATABASE_URL` i Vercel environment variables
- Verifiera Supabase connection string

### 6.2 Test Rate Limiting

Verifiera att Upstash Redis fungerar:

1. Öppna applikationen i browser
2. Försök logga in med fel lösenord **6 gånger**
3. Vid 6:e försöket → förväntat:
   ```
   "För många inloggningsförsök. Försök igen om 15 minuter."
   ```

**Om rate limiting inte fungerar:**
- Kolla `UPSTASH_REDIS_REST_URL` och `UPSTASH_REDIS_REST_TOKEN`
- Kolla Vercel logs: Dashboard → Deployments → [Latest] → Function Logs

### 6.3 Test Sentry Error Tracking

Verifiera att Sentry fångar errors:

1. Navigera till: `https://your-app.vercel.app/test-error` (kommer kasta error)
2. Gå till [sentry.io](https://sentry.io) → Projects → equinet
3. Du ska se ett nytt error inom 1-2 minuter

**Om inget error syns:**
- Kolla `NEXT_PUBLIC_SENTRY_DSN` i Vercel
- Kolla browser console för Sentry-relaterade fel

### 6.4 Test Core Functionality

**Smoke Tests:**
- [ ] Registrera ny användare (customer)
- [ ] Logga in
- [ ] Sök efter providers
- [ ] Skapa bokning
- [ ] Logga ut

**Om något failar:**
- Kolla Vercel Function Logs
- Kolla Sentry för error details
- Verifiera alla environment variables är satta

---

## 🔒 Steg 7: Security Checklist

Innan du öppnar för publik trafik:

### 7.1 Environment Variables Review

```bash
# REQUIRED i Vercel:
✅ DATABASE_URL
✅ NEXTAUTH_SECRET
✅ NEXTAUTH_URL
✅ UPSTASH_REDIS_REST_URL
✅ UPSTASH_REDIS_REST_TOKEN

# RECOMMENDED:
✅ NEXT_PUBLIC_SENTRY_DSN
✅ SENTRY_ORG
✅ SENTRY_PROJECT
```

### 7.2 Security Headers

Verifiera security headers fungerar:

```bash
curl -I https://your-app.vercel.app
```

**Förväntat (ska inkludera):**
```
strict-transport-security: max-age=31536000; includeSubDomains
x-frame-options: DENY
x-content-type-options: nosniff
referrer-policy: strict-origin-when-cross-origin
```

### 7.3 HTTPS Only

- [ ] Vercel serves automatiskt HTTPS
- [ ] HTTP redirects till HTTPS (automatiskt)
- [ ] Custom domain har SSL certificate (automatiskt från Vercel)

---

## 📊 Steg 8: Setup Monitoring (10 min)

### 8.1 Uptime Monitoring (UptimeRobot)

**Tjänst:** [UptimeRobot](https://uptimerobot.com) (gratis tier: 50 monitors)

1. Skapa konto på uptimerobot.com
2. **Add New Monitor:**
   ```
   Monitor Type: HTTP(s)
   Friendly Name: Equinet Health Check
   URL: https://your-app.vercel.app/api/health
   Monitoring Interval: 5 minutes
   ```
3. **Alert Contacts:** Lägg till din email
4. **Advanced Settings:**
   - Monitor Timeout: 30 seconds
   - Alert after: 3 failed checks (= 15 min nertid)
   - Aktivera "Alert When Up" (notis när sidan är uppe igen)
5. Verifiera att monitorn visar grön status efter setup

**Vad den overvakar:**
- `GET /api/health` returnerar HTTP 200 med `{ status: "ok" }`
- Databas-anslutning (inkluderad i health check)
- Om status inte ar 200 efter 3 kontroller -> email-alert

### 8.2 Sentry Alerts

Konfigurera tva alertregler i Sentry Dashboard -> **Alerts** -> **Create Alert**:

**Alert 1 -- Hog felfrekvens (Metric Alert):**
```
Alert Name: High Error Rate
Type: Metric Alert
Metric: count()
Threshold: > 50 per 5 minutes
Action: Send email to your-email@example.com
```

**Alert 2 -- Nya exceptions (Issue Alert):**
```
Alert Name: New Unhandled Exceptions
Type: Issue Alert
Condition: A new issue is created
Category: Error
Action: Send email to your-email@example.com
```

**Source maps (for readable stack traces):**

Verifiera att dessa environment variables finns i Vercel:
```bash
SENTRY_AUTH_TOKEN="sntrys_..."    # Sentry Settings -> Auth Tokens -> Create New Token
SENTRY_ORG="your-org-slug"        # Sentry -> Organization Settings -> Organization Slug
SENTRY_PROJECT="equinet"          # Sentry -> Project Settings -> Project Slug
```

Source maps laddas upp automatiskt vid build (konfigurerat i `next.config.ts`).

### 8.3 Vercel Monitoring

Vercel Pro tier ger:
- Real User Monitoring (RUM)
- Web Vitals tracking
- Function execution metrics

**Free tier:**
- Basic analytics
- Deployment logs (1h retention)

---

## 🎯 Production Readiness Checklist

Efter denna guide är klar:

### Must-Have ✅
- [x] Deployed to Vercel
- [x] PostgreSQL database (Supabase)
- [x] Redis rate limiting (Upstash)
- [x] Error tracking (Sentry)
- [x] Health check endpoint
- [x] HTTPS enabled
- [x] Security headers configured

### Should-Have 🟡
- [x] Uptime monitoring (UptimeRobot) -- se steg 8.1
- [ ] Custom domain configured
- [x] Email alerts för downtime -- se steg 8.1
- [x] Sentry alert rules -- se steg 8.2

### Nice-to-Have ⚪
- [ ] Vercel Pro (för better analytics)
- [ ] CDN cache optimization
- [ ] Database connection pooling tuning

**Production Readiness Score: 9/10** ✅

---

## 🐛 Troubleshooting

### Problem: "Internal Server Error" på deployment

**Diagnos:**
```bash
# Kolla Vercel logs
vercel logs [deployment-url]
```

**Vanliga orsaker:**
1. Saknad `DATABASE_URL` → lägg till i environment variables
2. Fel connection string format → verifiera från Supabase
3. Prisma schema inte genererad → Vercel kör `npm run build` som inkluderar `prisma generate`

---

### Problem: Rate limiting fungerar inte

**Symptom:** Kan logga in 100 gånger med fel lösenord utan rate limit

**Diagnos:**
```bash
# Kolla om Upstash är konfigurerad
# I Vercel function logs ska du se:
"Using Upstash Redis for rate limiting"

# INTE:
"⚠️  Using in-memory rate limiting (NOT suitable for production)"
```

**Fix:**
1. Verifiera `UPSTASH_REDIS_REST_URL` och `UPSTASH_REDIS_REST_TOKEN` är satta
2. Verifiera URL börjar med `https://`
3. Redeploy applikationen (environment variables kräver redeploy)

---

### Problem: Sentry errors syns inte

**Symptom:** Kastar errors i production men inget syns i Sentry

**Diagnos:**
```bash
# Browser console (F12):
# Leta efter Sentry-relaterade meddelanden
```

**Vanliga orsaker:**
1. `NEXT_PUBLIC_SENTRY_DSN` saknas eller felaktig
2. DSN är för wrong project
3. Sentry quota (5k errors/månad) är uppnådd

**Fix:**
1. Verifiera DSN i Sentry Dashboard → Project Settings → Client Keys (DSN)
2. Kolla Sentry quota: Settings → Subscription
3. Redeploy efter DSN-ändring

---

### Problem: Database connection timeout

**Symptom:**
```
Error: Can't reach database server at `db.xxx.supabase.co`
```

**Vanliga orsaker:**
1. Supabase project är paused (free tier pauses after 7 days inaktivitet)
2. Fel connection string (Direct Connection istället för Session Pooler)
3. IP allowlist configured i Supabase (Vercel IPs blockerade)

**Fix:**
1. Supabase Dashboard → Resume project
2. Använd **Session Pooler (IPv4)** connection string
3. Supabase Settings → Database → Disable IP restrictions (eller allowlist Vercel IPs)

---

## 🚀 Next Steps

Efter lyckad deployment:

### Immediate (< 1 dag)
1. **Test grundligt** i production
   - Registrera test-användare
   - Skapa bokningar
   - Testa alla user flows
2. **Monitor errors** i Sentry första 24h
3. **Verifiera uptime** monitoring fungerar

### Short-term (1 vecka)
1. **Custom domain** setup (om du har)
2. **Email notifications** konfigurerade
3. **Analytics** tracking (Google Analytics, Plausible, etc.)

### Medium-term (1 månad)
1. **Performance optimization** baserat på Sentry metrics
2. **Database query optimization** (kolla slow queries i Supabase)
3. **Caching strategy** för ofta hämtade data

---

## 📞 Support & Resources

**Vercel:**
- Docs: https://vercel.com/docs
- Status: https://vercel-status.com

**Upstash:**
- Docs: https://upstash.com/docs
- Dashboard: https://console.upstash.com

**Sentry:**
- Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs
- Dashboard: https://sentry.io

**Supabase:**
- Docs: https://supabase.com/docs
- Dashboard: https://supabase.com/dashboard

---

**Guide skapad:** 2026-01-21
**Senast uppdaterad:** 2026-02-28
**Version:** 1.0
**Production Readiness Score:** 9/10
