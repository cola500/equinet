---
title: "Sprint Status -- Live"
description: "Delad statusfil som alla Claude-sessioner uppdaterar vid commit"
category: sprint
status: active
last_updated: 2026-04-04
sections:
  - Aktiv sprint
  - Sessioner
  - Beslut
  - Blockerare
---

# Sprint Status -- Live

> **Instruktion:** Uppdatera denna fil vid varje commit. Tech lead laser den for review och koordinering.

## Aktiv sprint

**Sprint 14: RLS Live** (docs/sprints/sprint-14-draft.md)

| Story | Roll | Ansvarig | Status | Branch | Senaste commit |
|-------|------|----------|--------|--------|----------------|
| S14-0 iOS-verifiering Supabase Auth | fullstack | Dev | done | main | 7eaeffb9 |
| S14-1 RLS-policies | fullstack | Dev | done | feature/s14-1-rls-policies | 8f46415e |
| S14-5 RLS-bevistest | fullstack | Dev | done | feature/s14-5-rls-proof-tests | dfa2c28c |
| S14-2 Booking reads via Supabase | fullstack | Dev | done | feature/s14-2-booking-reads-supabase | 072ec279 |
| S14-3 Fler reads (batch) | fullstack | Dev | done | feature/s14-3-supabase-reads-batch | f4a6f946 |

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
| Dev | Fullstack | S14-3 Fler reads (batch) | feature/s14-3-supabase-reads-batch | 2026-04-04 |

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

## Blockerare

| Blocker | Paverkar | Agare | Status |
|---------|---------|-------|--------|
| Apple Developer Program (99 USD) | S3-2 push-lansering | Johan | Ej kopt |
| Resend API-nyckel | S3-1 invite-email | - | Konfigurerad (verifierad) |
