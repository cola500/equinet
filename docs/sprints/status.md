---
title: "Sprint Status -- Live"
description: "Delad statusfil som alla Claude-sessioner uppdaterar vid commit"
category: sprint
status: active
last_updated: 2026-04-01
sections:
  - Aktiv sprint
  - Sessioner
  - Beslut
  - Blockerare
---

# Sprint Status -- Live

> **Instruktion:** Uppdatera denna fil vid varje commit. Tech lead laser den for review och koordinering.

## Aktiv sprint

**Sprint 4: Demo-Ready Production** (docs/sprints/sprint-4.md)

| Story | Roll | Ansvarig | Status | Branch | Senaste commit |
|-------|------|----------|--------|--------|----------------|
| S4-1 Produktionsdeploy | fullstack | Dev | done | main | - |
| S4-2 Invite live | fullstack | Johan+Lead | done | - | admin DB-override |
| S4-3 Due-for-service native | fullstack | Dev | in_progress | feature/s4-3-due-for-service-native | - |
| S4-4 UX-polish native | fullstack | - | pending | - | - |
| S4-5 Demo-data prod | fullstack | - | backlog | - | - |

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

## Sessioner

| Session | Roll | Arbetar pa | Branch | Startad |
|---------|------|-----------|--------|---------|
| Lead | Tech lead | Review, merge | main | 2026-04-01 |
| Dev | Fullstack | S4-3 due-for-service native | feature/s4-3-due-for-service-native | 2026-04-01 |

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
