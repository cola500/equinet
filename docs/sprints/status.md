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

**Sprint 3: Launch Readiness** (docs/sprints/sprint-3.md)

| Story | Ansvarig | Status | Branch | Senaste commit |
|-------|----------|--------|--------|----------------|
| S3-1 Kundinbjudningar | - | pending | - | - |
| S3-2 Push-forberedelse | - | pending | - | - |
| S3-3 Demo-polish | - | pending | - | - |
| S3-4 Recensioner seed | - | backlog | - | - |

**Sprint 2** (avslutad parallellt):

| Story | Ansvarig | Status | Branch | Senaste commit |
|-------|----------|--------|--------|----------------|
| S2-1 withApiHandler | Fullstack | done | fix/critical-security-sweep | 6404358a |

## Sessioner

| Session | Roll | Arbetar pa | Branch | Startad |
|---------|------|-----------|--------|---------|
| Tech lead | Tech lead | Sprint-planering, review | fix/critical-security-sweep | 2026-04-01 |

## Beslut (loggas har, diskuteras i sprint-doc)

| Datum | Beslut | Motivering |
|-------|--------|------------|
| 2026-04-01 | NextAuth beta.30 -- stanna kvar | Senaste version, ingen GA, inga CVE:er |
| 2026-04-01 | Stoppa withApiHandler-batch | 28/159 klart, resten opportunistiskt |
| 2026-04-01 | Sprint 3: invite + push + demo | Activation-lager for leverantorsdemo |
| 2026-04-01 | Apple Developer kraves for push | Johan koper, push-kod forbereds utan APNs |

## Blockerare

| Blocker | Paverkar | Agare | Status |
|---------|---------|-------|--------|
| Apple Developer Program (99 USD) | S3-2 push-lansering | Johan | Ej kopt |
| Resend API-nyckel | S3-1 invite-email | - | Konfigurerad (verifierad) |
