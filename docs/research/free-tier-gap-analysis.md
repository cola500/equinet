---
title: "Free Tier Gapanalys -- Vercel Hobby + Supabase Free"
description: "Inventering av gratis kapabiliteter vi har men inte anvandar"
category: research
status: active
last_updated: 2026-04-04
tags: [vercel, supabase, free-tier, spike, cost]
sections:
  - Sammanfattning
  - Vercel Hobby
  - Supabase Free
  - Top 5 gratis men oanvant
  - Rekommendationer
---

# Free Tier Gapanalys -- Vercel Hobby + Supabase Free

## Sammanfattning

Equinet kor pa Vercel Hobby (gratis) + Supabase Free (gratis). Vi anvandar
en brakdel av det som ingar. Denna spike identifierar oanvanda kapabiliteter
som kan ge varde utan extra kostnad.

---

## Vercel Hobby -- vad ingar vs vad vi anvandar

| Kapabilitet | Ingaende kvot | Equinet anvandar | Status |
|-------------|--------------|-----------------|--------|
| **Functions** | 1 000 000 invocations/man | 162 API routes | Använder |
| **Active CPU** | 4 CPU-hrs/man | Ja | Använder |
| **Build minutes** | 6 000 min/man | Ja (auto-deploy) | Använder |
| **Deployments** | 100/dag | Ja | Använder |
| **Domains** | 50 per projekt | 1 (equinet-app.vercel.app) | Använder |
| **Web Analytics** | 50 000 events/man | `@vercel/analytics` installerad | Använder |
| **Cron Jobs** | 2 st (dagligen) | 2 crons (paminnelser) | Använder |
| **Image Optimization** | 1 000 bilder/man | 3 filer med next/image | Använder |
| **DDoS Mitigation** | Pa som standard | Ja | Använder (passivt) |
| **WAF IP Blocking** | 10 regler | 0 regler | EJ Använt |
| **WAF Custom Rules** | 3 regler | 0 regler | EJ Använt |
| **Speed Insights** | 10 000 datapunkter, 1 projekt | Ej installerad | EJ Använt |
| **Edge Config** | 100 000 laser, 100 skrivningar | Ej använd | EJ Använt |
| **Blob Storage** | Beta, ingaende | Ej använd | EJ Använt |
| **Runtime Logs** | 1h, 4 000 rader | Ej aktivt använt | DELVIS |
| **Deployment Protection** | Vercel Authentication | Ej konfigurerad | EJ Använt |
| **Activity Log** | Tillgänglig | Ej aktivt använt | DELVIS |

### Vercel -- begransningar att kanna till

- **Function duration**: Max 60s (Hobby). Vi kor <10s pa alla routes.
- **Kommersiellt bruk forbjudet**: Hobby ar for personligt bruk. Behover uppgradera
  till Pro ($20/man) vid kommersiell lansering.
- **Inga team-features**: Bara en anvandare.

---

## Supabase Free -- vad ingar vs vad vi anvandar

| Kapabilitet | Ingaende kvot | Equinet anvandar | Status |
|-------------|--------------|-----------------|--------|
| **Auth** | 50 000 MAU | 17 anvandare | Använder (~0.03%) |
| **Database** | 500 MB per projekt | ~50 MB (uppskattning) | Använder (~10%) |
| **Storage** | 1 GB | Bilduppladdning (hästar, profiler) | Använder |
| **RLS** | Obegransat | 30 policies | Använder |
| **Custom Access Token Hook** | Ja | Ja (claims i JWT) | Använder |
| **Egress** | 5 GB/man | Ja | Använder |
| **Realtime** | 200 anslutningar, 2M meddelanden | 0 anvandning | EJ Använt |
| **Edge Functions** | 500 000 invocations | 0 anvandning | EJ Använt |
| **pg_cron** | Tillgänglig | 0 jobb | EJ Använt |
| **Vault** | Tillgänglig | Ej använd | EJ Använt |
| **Projekt** | 2 st | 2 (prod + staging) | FULLT Använt |
| **Branching** | Ej pa Free | -- | EJ Tillgänglig |
| **Log Drain** | Ej pa Free | -- | EJ Tillgänglig |
| **SSO (SAML)** | Ej pa Free | -- | EJ Tillgänglig |
| **Image Transforms** | Ej pa Free | -- | EJ Tillgänglig |

### Supabase -- begransningar att kanna till

- **Max 2 projekt**: Vi anvandar bada (prod + staging). Kan inte skapa fler.
- **Projekt pausas vid inaktivitet**: Free-projekt kan pausas efter 1 veckas inaktivitet.
- **500 MB databas**: Tillrackligt for nu, men behover overvakas vid tillvaxt.

---

## Top 5: Gratis men oanvant -- mest varde

### 1. Vercel Speed Insights (HOG VARDE)

**Vad:** Real User Monitoring (RUM) -- mater Core Web Vitals (LCP, FID, CLS) fran
riktiga anvandare. 10 000 datapunkter/man gratis.

**Varfor:** Vi har Sentry for felspaning men inget for prestanda. Speed Insights
visar vilka sidor som ar langsamma for anvandare. Viktig for mobil UX (hastvardare
i faltet).

**Effort:** 5 minuter. `npm install @vercel/speed-insights` + en rad i layout.tsx.

---

### 2. Supabase Realtime (MEDEL-HOG VARDE)

**Vad:** WebSocket-baserad realtidsuppdatering av databasandringar.
200 anslutningar + 2M meddelanden/man.

**Varfor:** Idag pollar SWR-hooks med intervaller. Realtime kan ge:
- Bokningsbekraftelser som dyker upp direkt (inte efter 30s poll)
- Kalenderuppdateringar i realtid nar kund bokar
- Notifikationer utan sidladdning

**Effort:** 1-2 dagar. Kraver subscribe-logik i SWR-hooks.
Rekommendation: borja med Booking-tabellen, utvardera UX-effekten.

---

### 3. Vercel WAF Custom Rules (MEDEL VARDE)

**Vad:** 3 custom firewall-regler + 10 IP-blockeringsregler. Gratis.

**Varfor:** Vi har Upstash rate limiting i app-lagret, men WAF blockerar
trafik INNAN den nar funktionen. Bra for:
- Blockera kanda bot-IP:n
- Geo-begransning (bara Sverige/EU om onskad)
- Skydda mot specifika angreppsvektorer

**Effort:** 30 minuter. Konfigureras i Vercel Dashboard.

---

### 4. Supabase pg_cron (MEDEL VARDE)

**Vad:** PostgreSQL-baserad cron direkt i databasen. Kors av Supabase automatiskt.

**Varfor:** Vi har 2 Vercel Cron Jobs (paminnelser). pg_cron kan:
- Rensa gammal data (stale mutations, expired tokens)
- Aggregera statistik (nightly dashboard-berakningar)
- Underhallsjobb utan att ga via HTTP

**Effort:** 1h. SQL-definition i Supabase Dashboard.
Nackdel: svarare att testa lokalt an Vercel Crons.

---

### 5. Vercel Edge Config (LAG-MEDEL VARDE)

**Vad:** Ultra-snabb key-value store (laser pa <1ms). 100 000 laser/man.

**Varfor:** Kan ersatta feature flag-polling (idag 30s cache i minnet).
Edge Config laser ar snabbare an databas-query. Potentiellt:
- Feature flags via Edge Config istallet for PostgreSQL
- Runtime-konfiguration utan redeploy

**Effort:** 0.5-1 dag. Kraver omskrivning av feature-flag-logiken.
Nackdel: admin-UI (toggle flags) behover anpassas.

---

## Rekommendationer

### Implementera nu (minimal effort, hog varde)

1. **Speed Insights** -- 5 min, gratis prestanda-data fran riktiga anvandare

### Utvardera i nasta sprint

2. **WAF Custom Rules** -- 30 min, extra sakerhetslager
3. **pg_cron for databasunderhall** -- 1h, minskar manuellt arbete

### Planera for framtiden

4. **Realtime for bokningar** -- 1-2 dagar, markbar UX-forbattring
5. **Edge Config for feature flags** -- 0.5-1 dag, snabbare flags

### Viktig begransning

**Vercel Hobby tillater INTE kommersiellt bruk.** Vid lansering med betalande kunder
behover vi uppgradera till **Vercel Pro ($20/man)**. Pro ger:
- 5 min function duration (nu 60s)
- 100 000 analytics events (nu 50 000)
- Team-features och RBAC
- Email-support
