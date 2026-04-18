---
title: "S23-1: Token-spike rapport"
description: "Audit av automatiskt laddad kontext per session med rekommendationer"
category: plan
status: active
last_updated: 2026-04-12
sections:
  - Baseline
  - Audit per fil
  - Overlapp
  - MEMORY.md
  - Rekommendationer
  - Beraknad besparing
---

# S23-1: Token-spike rapport

## Baseline

| Kategori | Rader | Andel |
|----------|-------|-------|
| CLAUDE.md | 571 | 37% |
| Rules (alltid laddade, 6 st) | 1135 | 55% |
| MEMORY.md | 207 (trunkeras vid 200) | 8% |
| **Total per session** | **1913** | 100% |
| Selektiva rules (8 st) | 591 | Laddas vid matchande paths |

## Audit per fil

### CLAUDE.md (571 rader)

| Sektion | Rader | Rekommendation |
|---------|-------|----------------|
| Snabbreferens + Projekt + Workflow | ~60 | **Behal** -- alltid relevant |
| Testing (BDD dual-loop) | ~50 | **Gor selektiv** -- finns redan i testing.md |
| Arkitektur (DDD-Light) | ~30 | **Behal** -- kort, alltid relevant |
| Refactoring Guidelines | ~10 | **Behal** |
| Gotchas | ~5 (referens) | **Behal** |
| Definition of Done | ~15 | **Behal** |
| Sakerhet | ~10 | **Behal** |
| Key Learnings: Serverless & Deploy | ~25 | **Behal** -- korta, serverless-relevant |
| Key Learnings: Offline & Sync | ~40 | **Gor selektiv** -- bara vid offline-arbete |
| Key Learnings: Domain Patterns | ~20 | **Behal** |
| Key Learnings: Utvecklingsmonster (webb) | ~30 | **Behal** |
| Key Learnings: iOS (33 bullet points) | ~90 | **Flytta till ios-learnings.md** med paths: ["ios/**"] |
| Key Learnings: RLS + Supabase | ~30 | **Behal** |
| Key Learnings: E2E patterns | ~20 | **Gor selektiv** -- bara vid E2E-arbete |
| Testflodet (iOS + Webb + E2E) | ~100 | **Delvis selektiv** -- iOS-delen till ios-learnings |
| Working with Claude playbook | ~60 | **Behal** -- arbetsmetodik |

**Besparing**: ~150 rader genom att flytta iOS-learnings + gora testflodet delvis selektivt + ta bort duplicerad testing-sektion.

### Rules -- alltid laddade (6 filer, 1135 rader)

| Fil | Rader | Behovs nar | Rekommendation |
|-----|-------|------------|----------------|
| auto-assign.md | 107 | "kor" eller "kor sprint" | **Gor selektiv**: paths: ["docs/sprints/*"] |
| autonomous-sprint.md | 216 | "kor sprint X autonomt" | **Gor selektiv**: paths: ["docs/sprints/*"] |
| code-map.md | 218 | Kodnavigering | **Behal** (vardefull for orientering) |
| code-review-checklist.md | 154 | Code review | **Gor selektiv**: paths: ["src/**"] |
| feature-flags.md | 106 | Feature flag-arbete | **Gor selektiv**: paths: ["src/lib/feature-flag*"] |
| team-workflow.md | 256 | Sprint-arbete | **Gor selektiv**: paths: ["docs/sprints/*"] |
| tech-lead.md | 78 | "kor review" | **Gor selektiv**: paths: ["docs/sprints/*"] |

**Besparing**: 917 rader (auto-assign + autonomous-sprint + code-review-checklist + feature-flags + team-workflow + tech-lead) gor selektiva. Laddas bara vid matchande paths.

**Problem**: "kor" och "kor sprint" triggar inte paths-matchning -- de ar chat-kommandon, inte filandringar. Losning:
- auto-assign.md, autonomous-sprint.md, team-workflow.md, tech-lead.md maste FORTFARANDE vara alltid-laddade ELLER triggas pa annat satt
- **Alternativ**: Konsolidera auto-assign + autonomous-sprint + team-workflow till EN fil (~300 rader istallet for 579)

### MEMORY.md (207 rader)

| Sektion | Rader | Rekommendation |
|---------|-------|----------------|
| Projekt-overview | ~30 | **Behal** |
| Feedback (15 poster) | ~15 | **Behal** |
| Arbetsflode | ~5 | **Behal** |
| Patterns att folja | ~25 | **Behal** |
| Karndomaner | ~2 | **Behal** |
| Lokal dev-databas | ~5 | **Behal** |
| Feature Flags | ~15 | **Behal** -- komprimera |
| E2E patterns | ~10 | **Flytta** till memory topic-fil |
| Gotchas | ~15 | **Behal** -- komprimera |
| iOS-app arkitektur | ~30 | **Flytta** till memory topic-fil |
| Senaste sessioner (4 st) | ~40 | **Ta bort** -- gammal historik, tillganglig via git log |

**Besparing**: ~70 rader (ta bort sessionshistorik + komprimera redundant info).

## Overlapp

Tre filer beskriver alla stationsflödet:

| Fil | Fokus | Unik info |
|-----|-------|-----------|
| auto-assign.md | "kor"-kommando, story-plockning, steg 1-11 | Rollspecifika regler, stopp-regler |
| autonomous-sprint.md | Autonom korning utan att stanna | Quality gates, review-matris, sprint-avslut |
| team-workflow.md | Station 1-7 detaljerat | Station-checklista per station |

**Rekommendation**: Konsolidera till 2 filer:
- `sprint-workflow.md` (auto-assign + autonomous-sprint, ~200 rader)
- `team-workflow.md` (behall som referens for stationer, ~200 rader)

Besparing: ~180 rader.

## Rekommendationer (prioritetsordning)

### 1. Gor 5 process-rules selektiva (S23-2)

Lagg `paths:` pa:
- code-review-checklist.md -> `paths: ["src/**"]`
- feature-flags.md -> `paths: ["src/lib/feature-flag*", "src/components/providers/FeatureFlagProvider*"]`
- tech-lead.md -> `paths: ["docs/sprints/*"]`

**Besparing: 338 rader** (dessa triggas aldrig vid vanlig kodning utan bara vid sprint/review)

**OBS**: auto-assign.md, autonomous-sprint.md, team-workflow.md kan INTE goras selektiva -- de behovs vid "kor"-kommandon som inte matchar nagon path.

### 2. Flytta iOS-learnings fran CLAUDE.md (S23-5)

Ny `.claude/rules/ios-learnings.md` med `paths: ["ios/**"]`. 33 bullet points + iOS-testflodet.

**Besparing: ~120 rader fran CLAUDE.md**

### 3. Rensa MEMORY.md sessionshistorik

Ta bort "Senaste sessioner" (session 112-116) -- tillganglig via git log.
Komprimera Feature Flags och iOS-arkitektur-sektionerna.

**Besparing: ~50 rader fran MEMORY.md**

### 4. Ta bort duplicerad Testing-sektion fran CLAUDE.md

BDD dual-loop beskrivs bade i CLAUDE.md och testing.md. CLAUDE.md kan referera testing.md istallet.

**Besparing: ~30 rader**

### 5. Konsolidera sprint-filer (tillval, risk for breakage)

Sla ihop auto-assign + autonomous-sprint. Kvar som forslag -- riskerar att bryta "kor"-flodet om nagot missas.

## Beraknad besparing

| Atgard | Rader sparade | Risk |
|--------|--------------|------|
| Selektiva process-rules (#1) | 338 | Lag |
| iOS-learnings separat (#2) | 120 | Lag |
| Rensa MEMORY.md (#3) | 50 | Lag |
| Dedup Testing-sektion (#4) | 30 | Lag |
| Konsolidera sprint-filer (#5) | 180 | Medel |
| **Total (utan #5)** | **538** | |
| **Total (med #5)** | **718** | |

**Nytt total per session (utan #5): ~1375 rader** (fran 1913, -28%)
**Nytt total per session (med #5): ~1195 rader** (fran 1913, -38%)

**Selektiv andel**: ~62% (fran nuvarande ~31%)

Mall: 1913 -> 1375 (konservativt) eller 1195 (med konsolidering). Bada over 50% selektivt.
