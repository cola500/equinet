---
title: "Sprint 3 Retro: Launch Readiness + Team Foundation"
description: "Första sprint med teamstruktur. 4 stories levererade, 6 processiterationer."
category: retro
status: active
last_updated: 2026-04-01
tags: [retro, sprint-3, team, process, launch]
sections:
  - Levererat
  - Processevolution
  - Vad fungerade bra
  - Vad som inte fungerade
  - Processartefakter
  - Lärdomar
  - Processändring till nästa sprint
  - Appen efter sprint 3
---

# Sprint 3 Retro: Launch Readiness + Team Foundation

**Sprint:** 3 -- Launch Readiness
**Datum:** 2026-04-01
**Roller:** Lead (tech lead), Dev (fullstack), Johan (produktägare)

## Levererat

| Story | Filer | Tester | Kommentar |
|-------|-------|--------|-----------|
| S3-1 Invite hardening | 5 | +1 | clientVisible fix, self-merge test, E2E |
| S3-2 Push prep | 5 (iOS) | +1 | Permission vid login, token cleanup, AppLogger |
| S3-3 Demo polish | 1 | 0 | 3/4 redan klart, footer fix |
| S3-4 Review seed | 1 | 0 | 3 recensioner i demo-seed |

Totalt: 12 filer, 2 nya tester, 3757 tester gröna, 0 regressioner.

Även levererat: S2-1 (10 routes migrerade till withApiHandler), S2-2 (69 console.* ersatta med clientLogger).

## Processevolution

Byggde teamworkflow från scratch och itererade 6 gånger under en session:

| Iteration | Vad vi testade | Resultat | Fix |
|-----------|---------------|----------|-----|
| v1 | Parallella sessioner | Krockar på branches | En session åt gången |
| v2 | Push direkt till main | Ingen review-gate | Feature branches + Lead mergar |
| v3 | Autonom merge utan Lead | För riskabelt | `LEAD_MERGE=1` i pre-push hook |
| v4 | Plan bara i terminalen | Lead kan inte läsa | Plan committas i `docs/plans/` |
| v5 | Dev startar utan plan-OK | Implementerar före godkännande | Stopp-regler i auto-assign |
| v6 | Status.md mjuk påminnelse | Dev skippar uppdatering | Skarpare "STOPP"-språk i hook |

## Vad fungerade bra

- **Auto-assign**: Dev skriver "kör" och plockar rätt story automatiskt
- **Plan-fil**: S3-2 hade utmärkt plan som Lead kunde granska före implementation
- **Done-fil**: S3-4 hade bockade acceptanskriterier -- bra kvalitetscheck
- **Feature branch + review**: S3-1 och S3-2 granskades ordentligt
- **Pre-push hook**: `LEAD_MERGE=1` blockerar Dev från main -- hård gate som fungerar
- **Test-slicing**: 3 nivåer (under arbete, innan push, E2E) dokumenterade i workflow
- **Sekventiellt arbete**: Enklare och mer förutsägbart än parallella sessioner

## Vad som inte fungerade

- **Parallella sessioner**: Delar working directory, branches krockar. Avskaffat direkt.
- **Dev pushade till main**: Hände 2 gånger (S2-2, S3-3) innan pre-push hook
- **Status.md uppdaterades inte**: Hook påminner men kan inte blockera
- **Dev implementerade före plan-godkännande**: Johan stoppade manuellt
- **Lead committade till andras branch**: Svenska-fixen hamnade på feature branch
- **Överdesignade processen**: Byggde rollbaserad auto-assign innan vi testat grundflödet
- **Lead kollade remote innan lokal branch**: Sessioner delar working directory

## Processartefakter skapade

| Fil | Syfte |
|-----|-------|
| `AGENTS.md` | Roller, stationsflöde, regler, processevolutions-princip |
| `.claude/rules/auto-assign.md` | Auto-tilldelning med stopp-regler |
| `.claude/rules/team-workflow.md` | 7 stationer med 3-nivå test-slicing |
| `.claude/rules/tech-lead.md` | Hur Lead arbetar (lokal-först, review, merge) |
| `.claude/rules/code-review-checklist.md` | 40+ review-kriterier |
| `docs/sprints/status.md` | Live-status mellan sessioner |
| `docs/plans/` | Plan-filer per story |
| `docs/done/` | Done-filer med acceptanskriterier och lärdomar |
| `.claude/hooks/sprint-status-update.sh` | Påminnelse vid commit |
| `.claude/hooks/auto-review.sh` | Review-påminnelse vid push |
| `.claude/settings.json` | Delad hook-config (committat) |
| `.husky/pre-push` | Blockerar push till main utan `LEAD_MERGE=1` |

## Lärdomar

1. **Starta enkelt, trimma efter verkligheten.** Vi överdesignade (parallella roller, rollfilter) innan vi testat grundflödet.
2. **En session åt gången.** Delad working directory = sekventiellt arbete. Inget alternativ.
3. **Hårda gates > mjuka påminnelser.** Pre-push hook (blockerar) funkar. Status-hook (påminner) ignoreras ibland.
4. **Git är kommunikationskanalen.** Plan och done-filer på branchen. Lead läser lokalt.
5. **Tech lead bör inte committa medan Dev jobbar.** Skapar merge-konflikter.
6. **Processen evolverar varje sprint.** Inget arbetssätt är permanent.

## Processändring till nästa sprint

Genomförda under sprinten:
- Pre-push hook blockerar main
- Plan-review innan implementation (stopp-regel)
- Done-fil med acceptanskriterier + lärdomar
- Test-slicing i 3 nivåer i workflow
- Tech lead-regler dokumenterade
- Processevolution som grundprincip

Kvarvarande:
- Status.md-uppdatering fortfarande mjuk gate
- Dev-retro/lärdomar i done-filen -- inte testat ännu (infördes efter sista storyn)

## Appen efter sprint 3

- Kundinbjudningar redo att slå på (`customer_invite` clientVisible fixat, Resend konfigurerat)
- Push end-to-end redo (saknar bara APNs-credentials från Apple Developer-konto)
- Demo polerad (footer, login-länkar, delete-knappar dolda i demo-läge)
- Recensioner i seed-data (3 st, betyg 4-5)
- **Redo att visa för en leverantör**

## Nästa steg

1. Johan köper Apple Developer-konto (99 USD) -> plugga in APNs-credentials -> push live
2. Slå på `customer_invite` i produktion
3. Visa demo för en riktig leverantör
4. Feedback från demon styr sprint 4
