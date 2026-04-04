---
title: "Executive Summary -- 3 april 2026"
description: "Dag 3: 16 stories, 4 sprintar, auth-migrering från NextAuth till Supabase Auth"
category: guide
status: active
last_updated: 2026-04-03
sections:
  - Sammanfattning
  - Outcome
  - Hård data
  - Arkitekturbeslut
  - Processförbättringar
  - Nästa steg
---

# Executive Summary -- 3 april 2026

## Sammanfattning

Dag 3 var auth-migreringsdagen. 16 stories över 4 sprintar (9-12 + start av 13).
Equinet gick från NextAuth v5 beta till Supabase Auth med full RLS-koppling.
Alla API routes (~60+) migrerades till dual-auth. Login-sidan byttes.
Första cleanup-story levererad (S13-1: -385 rader).

**Uppskattad traditionell utvecklingstid: 6-8 veckor.**

---

## Outcome: Vad har förändrats?

### Auth-systemet

| Före dag 3 | Efter dag 3 |
|-----------|-------------|
| NextAuth v5 beta (instabil) | Supabase Auth (stabil, managed) |
| Dual auth: NextAuth cookie + custom JWT | Unified: Supabase Auth (+ legacy NextAuth under avveckling) |
| ~2000 LOC egen auth-kod | Supabase hanterar login, token-refresh, email-verifiering |
| Ingen RLS-koppling | `auth.jwt()->'app_metadata'->>'providerId'` i RLS policies |
| Manuell email-verifiering | Supabase hanterar det |
| Manuell token-rotation (iOS) | Supabase Swift SDK (planerat S13-4) |

### Alla routes migrerade

| Batch | Routes | Story |
|-------|--------|-------|
| Booking routes | 4 filer, 7 handlers | S12-2 |
| withApiHandler (centralt) | 28+ routes automatiskt | S12-3 |
| Native iOS routes | 21 routes | S12-4 |
| Auth routes | 3 routes | S12-5 |
| Onboarding-status (bevis) | 1 route | S11-4 |
| **Totalt** | **~60+ routes** | |

### Säkerhet

| Före dag 3 | Efter dag 3 |
|-----------|-------------|
| providerId från JWT claims (potentiell IDOR) | ALLTID DB-lookup via enrichFromDatabase() |
| Middleware bara NextAuth | Middleware stödjer Supabase-cookies |
| Feature flag-styrd auth-ordning (farligt) | Fast prioritet: Bearer > NextAuth > Supabase |
| Webhook: terminal states delvis skyddade | Succeeded guard inkluderar "failed" |
| userType från user metadata (privilege escalation) | Hårdkodat 'customer' i sync-trigger |

### Onboarding + UX

| Före dag 3 | Efter dag 3 |
|-----------|-------------|
| Ny leverantör: ingen vägledning | 4-stegs onboarding-checklista |
| "Ogiltig email" vid overifierad | "Din e-post är inte verifierad" |
| Tomma listor utan förklaring | Vägledande text + action-knappar |
| customer_insights overifierad | Bekräftad fungerande, modell-ID fixat |

### Arkitekturinsikter

| Spike | Resultat | Konsekvens |
|-------|---------|-----------|
| S10-1 RLS + Prisma | Go lokalt, Supabase-pooler blockerar SET ROLE | Väg A parkerad |
| S10-5 Supabase Auth PoC | GO -- login, claims, RLS fungerar | Väg B vald |
| S9-7 Schema-isolation | Fungerar med PgBouncer | Staging-DB via schemas |
| S9-4 Customer insights | Fungerar, trasigt modell-ID fixat | Flagga förblir på |

---

## Hård data

| Mått | Dag 1 | Dag 2 | Dag 3 | Totalt |
|------|-------|-------|-------|--------|
| Commits | 125 | 83 | 74 | 282 |
| Filer ändrade | 181 | 70 | 169 | 420 |
| Kodrader tillagda | 12 119 | 5 762 | 8 378 | 26 259 |
| Kodrader borttagna | 1 144 | 172 | 1 559 | 2 875 |
| Netto | +10 975 | +5 590 | +6 819 | +23 384 |
| Tester | 3 755→3 876 | 3 876→3 923 | 3 923→3 982 | 3 755→3 982 (+227) |
| Stories done | 21 | 12 | 16 | 49 |
| Sprintar | 5 (2-6) | 3 (7-9) | 4 (9-12 + 13 start) | 12 (2-13) |

---

## Arkitekturbeslut fattade dag 3

| Beslut | Motivering |
|--------|-----------|
| Väg B: Supabase Auth + RLS | Prisma set_config blockeras av Supabase-pooler |
| Dual-auth helper med DB-lookup | Aldrig lita på JWT claims för providerId |
| Fast auth-prioritet (Bearer > NextAuth > Supabase) | Eliminerar session-förvirring |
| withApiHandler-migrering (1 fil = 28+ routes) | Effektivast möjliga migrering |
| Branch protection parkerad | Pre-push hook räcker pre-launch |
| En Dev sekventiellt > två parallellt | Koordineringsoverhead > tidsvinst |
| Autonomt Dev+Lead-flöde | Johan bara för produktbeslut |

---

## Processförbättringar dag 3

| Förbättring | Effekt |
|-------------|--------|
| Autonomt Dev+Lead-flöde | Johan säger "kör" + "godkänd", resten sköts |
| Explicit story-ID vid parallella sessioner | "kör S12-4" istället för "kör" |
| Reviews-sektion obligatorisk i done-filer | Verifierar att subagenter faktiskt körts |
| En Dev sekventiellt (efter worktree-test) | Enklare, förutsägbart |
| Modell-ID alias-regel | Aldrig daterade IDn (claude-sonnet-4-6, inte 4-6-20250514) |

---

## Nästa steg

### Sprint 13 (pågår)

| Story | Status |
|-------|--------|
| S13-1 Byt login | **Done** (-385 rader) |
| S13-2 Ta bort NextAuth | Dev kör |
| S13-3 Ta bort passwordHash | Pending |
| S13-4 iOS Swift SDK | Pending |
| S13-5 Registrering via Supabase | Pending |

### Sprint 14 (planerad)

RLS Live: policies på alla kärndomäner + Supabase-klient för reads.

### Blockerare kvar

| Blocker | Påverkar |
|---------|---------|
| Apple Developer (99 USD) | Push live, App Store, S13-4 |
| Stripe företagsverifiering | Swish, live-betalningar |

---

## 3-dagars sammanfattning

| Dag | Fokus | Stories | Netto LOC |
|-----|-------|---------|-----------|
| 1 | Teamworkflow + produktfeatures | 21 | +10 975 |
| 2 | iOS-migrering + produktionshärdning | 12 | +5 590 |
| 3 | Auth-migrering (NextAuth → Supabase) | 16 | +6 819 |
| **Totalt** | | **49 stories** | **+23 384** |

**49 stories, 282 commits, 420 filer, ~23 000 rader netto, 227 nya tester.**
**Uppskattad traditionell utvecklingstid: ~16-24 veckor (4-6 månader) på 3 dagar.**
