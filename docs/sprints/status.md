---
title: "Sprint Status -- Live"
description: "Delad statusfil som alla Claude-sessioner uppdaterar vid commit"
category: sprint
status: active
last_updated: 2026-04-02
sections:
  - Aktiv sprint
  - Sessioner
  - Beslut
  - Blockerare
---

# Sprint Status -- Live

> **Instruktion:** Uppdatera denna fil vid varje commit. Tech lead laser den for review och koordinering.

## Aktiv sprint

**Sprint 8: iOS native-migrering** (docs/sprints/sprint-8.md)

| Story | Roll | Ansvarig | Status | Branch | Senaste commit |
|-------|------|----------|--------|--------|----------------|
| S8-1 Annonsering native | fullstack | Dev | done | feature/s8-1-announcements-native | e58dee30 |
| S8-2 Business insights native | fullstack | Dev | done | feature/s8-2-business-insights-native | ca247001 |
| S8-3 Voice logging polish | fullstack | Dev | in_progress | feature/s8-3-voice-logging-polish | - |

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
| Dev | Fullstack | S8-2 Business insights native | feature/s8-2-business-insights-native | 2026-04-02 |

## Beslut (loggas har, diskuteras i sprint-doc)

| Datum | Beslut | Motivering |
|-------|--------|------------|
| 2026-04-01 | NextAuth beta.30 -- stanna kvar | Senaste version, ingen GA, inga CVE:er |
| 2026-04-01 | Stoppa withApiHandler-batch | 28/159 klart, resten opportunistiskt |
| 2026-04-01 | Sprint 3: invite + push + demo | Activation-lager for leverantorsdemo |
| 2026-04-01 | Apple Developer kraves for push | Johan koper, push-kod forbereds utan APNs |
| 2026-04-01 | Sekventiellt arbete, en session at gangen | Delad working directory, parallella branches krockar |
| 2026-04-01 | S3-2 otaggad fran ios till fullstack | Push-prep ar mest server-side TS, kan koras av fullstack |

## Blockerare

| Blocker | Paverkar | Agare | Status |
|---------|---------|-------|--------|
| Apple Developer Program (99 USD) | S3-2 push-lansering | Johan | Ej kopt |
| Resend API-nyckel | S3-1 invite-email | - | Konfigurerad (verifierad) |
