---
title: "Sprint Status -- Live"
description: "Delad statusfil som alla Claude-sessioner uppdaterar vid commit"
category: sprint
status: active
last_updated: 2026-04-09
sections:
  - Aktiv sprint
  - Sessioner
  - Beslut
  - Blockerare
---

# Sprint Status -- Live

> **Instruktion:** Uppdatera denna fil vid varje commit. Tech lead laser den for review och koordinering.

## Aktiv sprint

**Sprint 19** ([sprint-19-e2e-hardening.md](sprint-19-e2e-hardening.md)):

| Story | Roll | Ansvarig | Status | Branch | Senaste commit |
|-------|------|----------|--------|--------|----------------|
| S19-1 Ta bort stripe-payment.spec.ts | fullstack | Dev | done | feature/s19-1-remove-stripe-e2e | 8f461aa0 |
| S19-2 Slå ihop flexible-booking | fullstack | Dev | done | feature/s19-2-merge-flexible-booking | 01a3f998 |
| S19-3 Fixa waitForTimeout calendar | fullstack | Dev | done | feature/s19-3-calendar-waits | 503cc2e2 |
| S19-4 Fixa waitForTimeout route-planning | fullstack | Dev | pending | - | - |
| S19-5 Fixa waitForTimeout announcements | fullstack | Dev | pending | - | - |
| S19-6 Separera externa beroenden | fullstack | Dev | pending | - | - |
| S19-7 Lokal Supabase E2E bootstrap | fullstack | Dev | done | feature/s19-7-e2e-bootstrap | d5349b77 |
| S19-8 Baseline och retro | fullstack | Dev | pending | - | - |

**Sprint 18** ([sprint-18-draft.md](sprint-18-draft.md)):

| Story | Roll | Ansvarig | Status | Branch | Senaste commit |
|-------|------|----------|--------|--------|----------------|
| S18-1 Gruppbokningar native | ios | Dev | done | feature/s18-1-group-bookings-native | de45d53b |
| S18-2 Hjälpcenter native | ios | Dev | done | feature/s18-2-help-center-native | 093b8163 |
| S18-3 Annonsering CRUD native | ios | Dev | done | feature/s18-3-announcements-crud-native | f13d5bf3 |
| S18-4 Profilbild native | ios | Dev | done | feature/s18-4-profile-image-native | e42269e1 |
| S18-5 Tillgänglighetsschema (bonus) | ios | - | pending | - | - |

**Sprint 17** (klar, S17-5 flyttad till backlog):

| Story | Roll | Ansvarig | Status | Branch | Senaste commit |
|-------|------|----------|--------|--------|----------------|
| S17-1 Vercel Speed Insights | fullstack | Dev | done | feature/s17-1-2-3-quick-wins | 92a4bb23 |
| S17-2 WAF Custom Rules | fullstack | Dev | done | feature/s17-1-2-3-quick-wins | 92a4bb23 |
| S17-3 robots.txt + sitemap | fullstack | Dev | done | feature/s17-1-2-3-quick-wins | 92a4bb23 |
| S17-4 pg_cron | fullstack | Dev | done | feature/s17-4-pg-cron | 2e5c172e |
| S17-6 Edge Config feature flags | fullstack | Dev | done | feature/s17-6-edge-config | fafe44ee |
| S17-7 Lokal dev -> supabase start | fullstack | Dev | done | feature/s17-7-supabase-local-dev | 092e8263 |
| S17-8 Migrera admin-routes | fullstack | Dev | done | feature/s17-8-admin-routes-migration | c15cd2fb |
| S17-9 iOS -> Supabase staging | ios | Dev | done | feature/s17-9-ios-supabase-staging | 88a132f4 |

**Sprint 16** (klar):

| Story | Roll | Ansvarig | Status |
|-------|------|----------|--------|
| S16-1 -- S16-5 (5 stories) | fullstack | Dev | done |

**Sprint 15** (klar):

| Story | Roll | Ansvarig | Status |
|-------|------|----------|--------|
| S15-0 -- S15-6 (7 stories) | fullstack | Dev | done |

**Sprint 14** (klar):

| Story | Roll | Ansvarig | Status |
|-------|------|----------|--------|
| S14-0 -- S14-5 (6 stories) | fullstack | Dev | done |

**Sprint 13** (klar):

| Story | Roll | Ansvarig | Status |
|-------|------|----------|--------|
| S13-1 -- S13-6 | fullstack | Dev | done |

**Sprint 12** (klar):

| Story | Roll | Ansvarig | Status |
|-------|------|----------|--------|
| S12-1 -- S12-5 | fullstack | Dev + Dev-2 | done |

**Sprint 11** (klar):

| Story | Roll | Ansvarig | Status |
|-------|------|----------|--------|
| S11-1 -- S11-4 | fullstack | Dev | done |

**Sprint 11** (klar):

| Story | Roll | Ansvarig | Status |
|-------|------|----------|--------|
| S11-1 -- S11-4 | fullstack | Dev | done |

**Sprint 10** (klar):

| Story | Roll | Ansvarig | Status |
|-------|------|----------|--------|
| S10-1 RLS Prisma spike | fullstack | Dev | done (Go lokalt, Supabase blockerare) |
| S10-5 Supabase Auth PoC | fullstack | Dev | done (GO) |

**Sprint 9** (klar):

| Story | Roll | Ansvarig | Status |
|-------|------|----------|--------|
| S9-1 -- S9-10 (12 stories) | fullstack | Dev | done |
| S9-4 customer_insights spike | fullstack | - | pending | - | - |
| S9-3 Staging-databas | fullstack | - | parkerad | - | - |

**Sprint 8** (klar):

| Story | Roll | Ansvarig | Status |
|-------|------|----------|--------|
| S8-1 -- S8-3 | fullstack | Dev | done |

**Sprint 7** (klar, blockerare -> backlog):

| Story | Roll | Ansvarig | Status |
|-------|------|----------|--------|
| S7-1 RLS Fas 1 | fullstack | Dev | done |
| S7-4 Voice logging spike | fullstack | Dev | done |
| S7-2 Push live | - | - | backlog (Apple Dev) |
| S7-3 Stripe live-mode | - | - | backlog (Stripe) |
| S7-5 Voice logging polish | - | - | flyttad till S8-3 |

**Sprint 6** (klar):

| Story | Roll | Ansvarig | Status |
|-------|------|----------|--------|
| S6-1 -- S6-4 | fullstack | Dev | done (S6-3 blockerad) |

**Sprint 5** (klar):

| Story | Roll | Ansvarig | Status |
|-------|------|----------|--------|
| S5-1 -- S5-5 | fullstack | Dev+Johan | done |

**Sprint 4** (klar):

| Story | Roll | Ansvarig | Status |
|-------|------|----------|--------|
| S4-1 -- S4-7 | fullstack | Dev+Lead+Johan | done |

**Sprint 3** (klar):

| Story | Roll | Ansvarig | Status | Branch | Senaste commit |
|-------|------|----------|--------|--------|----------------|
| S3-1 Kundinbjudningar | fullstack | Dev | done | feature/s3-1-customer-invite | a7050a2e |
| S3-2 Push-forberedelse | fullstack | Dev | done | feature/s3-2-push-preparation | f3e14809 |
| S3-3 Demo-polish | fullstack | Dev | done | feature/s3-3-demo-polish | 3682adb5 |
| S3-4 Recensioner seed | fullstack | Dev | done | feature/s3-4-reviews-seed | 4fbf007b |

**Sprint 2** (klar):

| Story | Roll | Ansvarig | Status | Branch | Senaste commit |
|-------|------|----------|--------|--------|----------------|
| S2-1 withApiHandler | fullstack | Fullstack | done | fix/critical-security-sweep | 6404358a |
| S2-2 console.* cleanup | fullstack | Fullstack | done | main | 5cef0ca8 |

## Sessioner (PARALLELLT -- filbaserad uppdelning)

| Session | Roll | Arbetar pa | Branch | Startad |
|---------|------|-----------|--------|---------|
| Dev | Fullstack | S19-1 Remove stripe E2E | feature/s19-1-remove-stripe-e2e | 2026-04-10 |

## Beslut (loggas har, diskuteras i sprint-doc)

| Datum | Beslut | Motivering |
|-------|--------|------------|
| 2026-04-01 | NextAuth beta.30 -- stanna kvar | Senaste version, ingen GA, inga CVE:er |
| 2026-04-01 | Stoppa withApiHandler-batch | 28/159 klart, resten opportunistiskt |
| 2026-04-01 | Sprint 3: invite + push + demo | Activation-lager for leverantorsdemo |
| 2026-04-01 | Apple Developer kraves for push | Johan koper, push-kod forbereds utan APNs |
| 2026-04-01 | Sekventiellt arbete, en session at gangen | Delad working directory, parallella branches krockar |
| 2026-04-01 | S3-2 otaggad fran ios till fullstack | Push-prep ar mest server-side TS, kan koras av fullstack |

## Att pusha (tech lead)

| Commit | Branch | Beskrivning | Instruktion |
|--------|--------|-------------|-------------|
| f3d12999 | main (lokal) | CI E2E fix: skip DATABASE_URL override i CI | `LEAD_MERGE=1 git push origin main` |

**Bakgrund:** `playwright.config.ts` hardkodade `DATABASE_URL=equinet` som overskrev CI:s `equinet_test`. Lagt till `if (!process.env.CI)` guard. Senast grona CI: `7a1388ac`. Brot i `c977d2b8` (Stripe E2E cleanup).

## Backlogg (fran pentest S15-5)

**3 HIGH verifierade som ej tillampliga (2026-04-04):**
- ~~NextAuth-endpoint~~ -- borttagen i S13-2
- ~~Geocode utan auth~~ -- har auth + rate limiting sedan tidigare
- ~~user_metadata for rolldata~~ -- anvands bara for profildata

**Kvarstaende:**

| Item | Prioritet | Effort | Beskrivning |
|------|-----------|--------|-------------|
| Vercel Speed Insights | MEDEL | 5 min | Installera `@vercel/speed-insights`, gratis RUM (Core Web Vitals) |
| Supabase Realtime | MEDEL | 1-2 dagar | Live-uppdatering av bokningar via WebSocket, ersatter SWR-polling |
| WAF Custom Rules | MEDEL | 30 min | 3 gratis firewall-regler i Vercel, blockera trafik fore funktionen |
| pg_cron | LAG | 1h | Databasunderhall (rensa tokens, aggregera statistik) direkt i Supabase |
| Edge Config for feature flags | LAG | 0.5-1 dag | Ultra-snabb key-value (<1ms), ersatter PostgreSQL-baserade flags |
| robots.txt + sitemap.xml | LAG | 15 min | ZAP varnar om 404 |
| Cross-Origin-Embedder-Policy | LAG | 15 min | Lagg till header via vercel.json |
| Zod .strict() pa mobile-token | LAG | 30 min | Saknas pa request body |
| E-postverifiering Resend (S17-5) | HOG | 0.5 dag | Verifiera Resend-leverans i prod, SPF/DKIM/DMARC, invite-flöde |
| MFA för admin | HOG | 1 dag | Supabase TOTP-enrollment + verifiering vid admin-login |
| Uppgradera till Vercel Pro | BLOCKER vid lansering | $20/man | Hobby tillater inte kommersiellt bruk |

## Blockerare

| Blocker | Paverkar | Agare | Status |
|---------|---------|-------|--------|
| Apple Developer Program (99 USD) | S3-2 push-lansering | Johan | Ej kopt |
| Resend API-nyckel | S3-1 invite-email | - | Konfigurerad (verifierad) |
