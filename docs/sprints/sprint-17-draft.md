---
title: "Sprint 17: Quick Wins + Infrastruktur"
description: "Gratis kapabiliteter från Vercel/Supabase, e-postverifiering, snabbare feature flags"
category: sprint
status: active
last_updated: 2026-04-05
tags: [sprint, vercel, supabase, infrastructure, quick-wins]
sections:
  - Sprint Overview
  - Stories
  - Exekveringsplan
  - Sprint Retro Template
---

# Sprint 17: Quick Wins + Infrastruktur

**Status:** UTKAST -- aktiveras efter sprint 16
**Sprint Goal:** Plocka gratis värde från Vercel/Supabase, stärk infrastrukturen.

---

## Sprint Overview

S16-5 (gapanalys) identifierade kapabiliteter vi betalar noll för men inte använder.
Denna sprint plockar de mest värdefulla.

---

## Stories

### S17-1: Vercel Speed Insights -- READY -- PARALLELL A

**Prioritet:** Hög
**Typ:** Observability
**Beskrivning:** Gratis Real User Monitoring (RUM) för Core Web Vitals.
Ger LCP, FID, CLS, TTFB, INP i Vercel Dashboard utan extra kostnad.

**Uppgifter:**
1. `npm install @vercel/speed-insights`
2. Lägg till `<SpeedInsights />` i root layout
3. Verifiera i Vercel Dashboard efter deploy

**Effort:** 15 min

---

### S17-2: WAF Custom Rules -- READY -- PARALLELL A

**Prioritet:** Hög
**Typ:** Säkerhet
**Beskrivning:** Vercel Hobby inkluderar 3 gratis firewall-regler.
Blockera trafik före funktionen -- sparar compute och skyddar mot kända mönster.

**Uppgifter:**
1. Konfigurera i Vercel Dashboard -> Firewall
2. Regel 1: Blockera kända bot user-agents
3. Regel 2: Rate limit på /api/auth/* (extra lager utöver Upstash)
4. Regel 3: Geo-block utanför Sverige/EU (om relevant)
5. Dokumentera reglerna i `docs/operations/deployment.md`

**Effort:** 30 min

---

### S17-3: robots.txt + sitemap.xml -- READY -- PARALLELL A

**Prioritet:** Medel
**Typ:** SEO / Cleanup
**Beskrivning:** ZAP-scan varnade om 404 på robots.txt. Grundläggande SEO-hygien.

**Uppgifter:**
1. Skapa `public/robots.txt` (tillåt crawling av publika sidor, blockera /api/, /admin/)
2. Skapa `src/app/sitemap.ts` (Next.js sitemap generation)
3. Verifiera att /robots.txt och /sitemap.xml svarar korrekt

**Effort:** 15 min

---

### S17-4: pg_cron för databasunderhåll -- READY -- PARALLELL B

**Prioritet:** Medel
**Typ:** Infrastruktur
**Beskrivning:** Supabase Free inkluderar pg_cron. Schemalägg databasunderhåll
direkt i PostgreSQL utan extern cron-tjänst.

**Uppgifter:**
1. Aktivera pg_cron i Supabase Dashboard (Extensions)
2. Jobb 1: Rensa utgångna rate limit-poster (dagligen)
3. Jobb 2: Rensa gamla NotificationDelivery-poster > 90 dagar (veckovis)
4. Jobb 3: VACUUM ANALYZE på stora tabeller (veckovis)
5. Dokumentera jobb i `docs/operations/deployment.md`
6. Testa: verifiera att jobben körs och loggas

**Effort:** 1h

---

### S17-5: E-postverifiering via Resend -- READY -- SEKVENTIELL

**Prioritet:** Hög
**Typ:** Feature
**Beskrivning:** Säkerställ att Resend levererar verifieringsmail korrekt.
Koden finns (accept-invite, verify-email), men e-postleverans på egen domän
är overifierad i prod.

**Uppgifter:**
1. Verifiera Resend-konfiguration (API-nyckel, avsändardomän)
2. Skicka testmail via prod: registrering -> verifieringsmail -> klicka länk
3. Kontrollera SPF/DKIM/DMARC-poster på domänen
4. Testa: invite-flödet (provider bjuder in kund -> kund får mail -> accepterar)
5. Dokumentera mailkonfiguration i `docs/operations/deployment.md`

**Effort:** 0.5 dag

---

### S17-6: Edge Config för feature flags -- READY -- SEKVENTIELL (efter S17-5)

**Prioritet:** Medel
**Typ:** Performance
**Beskrivning:** Byt feature flag-läsning från PostgreSQL (30s cache, ~50ms) till
Vercel Edge Config (<1ms, global). Skrivning kvar i PostgreSQL via admin.

**Uppgifter:**
1. Skapa Edge Config store i Vercel Dashboard
2. `npm install @vercel/edge-config`
3. Synka flaggor: admin toggle -> PostgreSQL -> Edge Config (webhook eller sync-script)
4. Byt `getFeatureFlags()` att läsa från Edge Config med PostgreSQL som fallback
5. Behåll `useFeatureFlag()` hook oförändrad (transparent byte)
6. Tester: feature flag-tester passerar, latens minskar

**Effort:** 0.5-1 dag

---

### S17-8: Migrera admin-routes till withApiHandler({ auth: "admin" }) -- READY -- PARALLELL B

**Prioritet:** Medel
**Typ:** Cleanup
**Beskrivning:** Sprint 16 introducerade `withApiHandler({ auth: "admin" })` med
automatisk audit-loggning. Men befintliga admin-routes använder fortfarande det
gamla systemet (`admin-auth.ts` med DB-lookup + `roles.ts` med session-check).
Två system för samma sak.

**Uppgifter:**
1. Inventera alla befintliga admin-routes som använder `requireAdmin()` eller `roles.ts`
2. Migrera till `withApiHandler({ auth: "admin" })` -- ger audit log gratis
3. Ta bort `admin-auth.ts` och `roles.ts` om de inte längre används
4. Verifiera: alla admin-operationer loggas i AdminAuditLog

**Effort:** 0.5 dag

---

### S17-7: Byt lokal dev till supabase start -- READY -- SEKVENTIELL (först i fas 2)

**Prioritet:** Hög
**Typ:** DX / Infrastruktur
**Beskrivning:** Sprint 16 retro identifierade tre problem som alla har samma rotorsak:
Docker PostgreSQL saknar triggers, RLS och auth-schema. Lösning: byt till `supabase start`
som lokal dev-miljö.

Löser:
- RLS-divergens lokalt vs Supabase (S16 retro punkt 1)
- Saknade triggers lokalt (S16 retro punkt 2)
- Migrationer ej applicerade lokalt (S16 retro punkt 4)

**Uppgifter:**
1. Uppdatera `npm run db:up` att köra `supabase start` istället för Docker Compose
2. Uppdatera `npm run db:down` -> `supabase stop`
3. Uppdatera `npm run db:nuke` -> `supabase db reset`
4. Uppdatera `.env.example` med lokala Supabase-URL:er (port 54321/54322)
5. Uppdatera README med nya setup-instruktioner
6. Verifiera: triggers fungerar, RLS aktivt, seed-scripts fungerar
7. Behåll Docker Compose som fallback (dokumentera i README)
8. Uppdatera CI om det påverkas

**Effort:** 0.5-1 dag

---

## Exekveringsplan

```
Fas 1 (parallellt):   S17-1 (Speed Insights) | S17-2 (WAF) | S17-3 (robots)  |  S17-4 (pg_cron)
                       15 min                 | 30 min       | 15 min          |  1h
                       worktree A (alla 3)    |              | worktree B
                                    \                           /
Fas 2 (merga + sekventiellt):  merga fas 1 -> S17-7 (supabase start som lokal dev)
                                                    |
Fas 3 (sekventiellt):  S17-5 (Resend) -> S17-6 (Edge Config)
                              |
Fas 4:                 sprint-avslut (E2E + docs + retro)
```

**Fas 1:** S17-1/2/3 är så små att en session kan ta alla tre. S17-4 är oberoende.
**Fas 2:** S17-7 bör köras tidigt -- den påverkar hur alla andra stories testar lokalt.
**Fas 3:** S17-5 och S17-6 rör konfiguration som bör verifieras sekventiellt.

---

## Sprint Retro Template

### Vad gick bra?

### Quick wins -- var det värt det?

### Infrastruktur-status efter sprinten?
