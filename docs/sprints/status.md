---
title: "Sprint Status -- Live"
description: "Delad statusfil som alla Claude-sessioner uppdaterar vid commit"
category: sprint
status: active
last_updated: 2026-04-10
sections:
  - Aktiv sprint
  - Tidigare sprintar
  - Sessioner
  - Beslut
  - Blockerare
---

# Sprint Status -- Live

> **Instruktion:** Uppdatera denna fil vid varje commit. Tech lead laser den for review och koordinering.

## Aktiv sprint

**Sprint 20** ([sprint-20-process-enforcement.md](sprint-20-process-enforcement.md)):

| Story | Roll | Ansvarig | Status | Branch | Senaste commit |
|-------|------|----------|--------|--------|----------------|
| S20-1 Coverage-gate i CI | fullstack | Dev | pending | - | - |
| S20-2 Supabase .eq() ownership audit-hook | fullstack | Dev | pending | - | - |
| S20-3 Done-fil + status atomisk commit-check | fullstack | Dev | pending | - | - |
| S20-4 Pre-commit repository pattern-varning | fullstack | Dev | pending | - | - |
| S20-5 BDD dual-loop paminnelse | fullstack | Dev | pending | - | - |
| S20-6 Dokumentera och stam av | fullstack | Dev | pending | - | - |

## Tidigare sprintar (alla klara)

| Sprint | Tema | Stories |
|--------|------|---------|
| S19 | E2E-hardening | 9/9 done |
| S18 | iOS native-migrering | 4/5 done (S18-5 bonus pending) |
| S17 | Infra & cleanup | 8/8 done |
| S16 | Supabase cutover | 5/5 done |
| S15 | Supabase cutover | 7/7 done |
| S14 | RLS Live | 6/6 done |
| S13 | Supabase Auth cleanup | 6/6 done |
| S12 | Auth routes | 5/5 done |
| S11 | Dual auth | 4/4 done |
| S10 | RLS + Auth PoC | 2/2 done |
| S9 | Hardening | 10/12 done (S9-3 parkerad, S9-4 pending) |
| S8 | Native + voice | 3/3 done |
| S7 | RLS + voice spike | 2/5 done (S7-2/3 backlog) |
| S2-S6 | Features + cleanup | done |

## Sessioner

| Session | Roll | Arbetar pa | Branch | Startad |
|---------|------|-----------|--------|---------|
| (ingen aktiv) | - | - | - | - |

## Beslut

| Datum | Beslut | Motivering |
|-------|--------|------------|
| 2026-04-10 | seed.sql tom, auth-triggers separat | supabase start kor seed FORE Prisma-tabeller |
| 2026-04-01 | Sekventiellt arbete, en session at gangen | Delad working directory, parallella branches krockar |

## Backlogg

| Item | Prioritet | Effort | Beskrivning |
|------|-----------|--------|-------------|
| Uppgradera till Vercel Pro | BLOCKER vid lansering | $20/man | Hobby tillater inte kommersiellt bruk |
| E-postverifiering Resend (S17-5) | HOG | 0.5 dag | Verifiera Resend-leverans i prod |
| MFA for admin | HOG | 1 dag | Supabase TOTP-enrollment + verifiering |
| Supabase Realtime | MEDEL | 1-2 dagar | Live-uppdatering via WebSocket |
| Zod .strict() pa mobile-token | LAG | 30 min | Saknas pa request body |

## Blockerare

| Blocker | Paverkar | Agare | Status |
|---------|---------|-------|--------|
| Apple Developer Program (99 USD) | Push-lansering | Johan | Ej kopt |
