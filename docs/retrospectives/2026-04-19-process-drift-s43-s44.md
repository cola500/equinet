---
title: "Process drift S43-S44 — 8 procedurbrott på 2 timmar"
description: "Ärlig analys av processavvikelser under testpyramid-migreringen. Rotorsak: reglerna uppdaterade men automatiseringen släpar."
category: retro
status: active
last_updated: 2026-04-19
tags: [retro, process, discipline, automation, parallel-sessions]
sections:
  - Bakgrund
  - De 8 brotten
  - 5 Whys-analys
  - Vad som INTE gick fel
  - Åtgärder
  - Lärdom
---

# Process drift S43-S44 — 8 procedurbrott på 2 timmar

**Datum:** 2026-04-19
**Kontext:** Testpyramid-migrering (S43 + S44). Hög tempo, mekaniska migreringar, både Dev- och tech-lead-session aktiva parallellt.

---

## Bakgrund

S43 körde Discovery + Pilot + Batch 1 (7 E2E-specs migrerade). S44 körde TA BORT-batch + Batch 2 (7 till — 3 raderade, 4 migrerade). Sammanlagt 14 stories i snabbt tempo.

Kvalitet på kod: 4268 tester grönt, check:all grönt, inga regressioner. **Men** processkvaliteten sjönk stadigt under 2 timmar.

Detta dokument fångar avvikelserna innan vi glömmer dem.

---

## De 8 brotten

### Dev-sidan

1. **S43-1: Plan-commit hoppad** — 0 commits under hela storyn. Arbetet gjordes men committades aldrig förrän vid slutet. Bröt `auto-assign.md` steg 7 och `team-workflow.md` Station 1.
2. **S43-1 + S43-2: Code-reviewer skippad** — båda klassades "trivial" trots 0.5-1 dag effort och 5-10 filer ändrade. Bröt `team-workflow.md` Station 4 trivial-gating. Fixades mitt i sprinten via PR #227, men Dev hade redan skippat två gånger.
3. **S43→S44: Sprint-avslut hoppat** — Dev gick direkt till S44-0 utan retro-check, NFR-uppdatering, CLAUDE.md-uppdatering, status.md-flyttning, eller sprint-gates. Bröt `autonomous-sprint.md` "Sprint-avslut (OBLIGATORISKT)".
4. **S44-0 + S44-1: Mergade via PR utan tech-lead-review** — Dev skapade PR `#228` och `#229` och mergade själv. Bröt `team-workflow.md` Station 7 ("Vem: Tech lead (triggas via 'kör review')").
5. **Rebase av feature branch utan flaggning** — S44-0-branchen fick nya SHAs (`a760d4cb` → `c8bdca4d`). Legitimt men osignalerat → förvirrade parallell tech-lead-session.

### Tech lead-sidan (mig)

6. **Committade på Dev's feature branch** — trodde jag var på main, committade tech-lead-admin-arbete ovanpå Dev's ostaged ändringar. Bröt `parallel-sessions.md`: "Committa aldrig till en annan sessions branch".
7. **Parallell working-directory-redigering** — försökte göra sprint-avslut-admin medan Dev körde S44-0. Rule-doc-ändringar (NFR, gotchas, testing.md) försvann någonstans under branch-byten. Bröt `parallel-sessions.md`: "Tech lead räknas som session när den rör working tree".
8. **Missade att S44-0 + S44-1 mergades utan mig** — följde inte upp, upptäckte först vid status-kontroll. Bröt tech-lead-ansvaret i `tech-lead.md`.

---

## 5 Whys-analys

1. **Varför så många brott?**
   Tempo över disciplin. 14 stories på 2h.

2. **Varför pressas tempo?**
   Testpyramid-migreringen känns mekanisk → "detta är trivialt" blir standardtänkande.

3. **Varför känns det trivialt?**
   Ingen enskild story har ny affärslogik. Men yta-risken skalar (5-10 filer per story, nya test-filer räknas som ny kod).

4. **Varför varnar inget?**
   Vi har precis fixat trivial-gating (PR #227) men ingen hook enforcear det. Plan-commit-gate och sprint-avslut-gate är backlog, inte byggda.

5. **Rotorsak:**
   **Reglerna är uppdaterade men automatiseringen släpar efter.** Vi förlitar oss på mänsklig disciplin i en situation där vi bevisligen har nedsatt disciplin pga tempo.

**Sekundär rotorsak:** Tech lead + Dev parallellt på samma working directory är högrisk. Reglerna säger "tech lead räknas som session" — vi följde inte det.

---

## Vad som INTE gick fel

Viktigt att notera för balans:

- **Kodkvalitet bevarad**: 4268 tester grönt, check:all grönt, inga regressioner i produktion
- **S43-0 Discovery följde processen rätt** (tech-architect-review, 3 invändningar bekräftade + 3 nya fynd)
- **S43-2 Batch 1 följde processen perfekt** efter S43-1-lärdomen (plan-commit först, commit-per-spec, coverage-gap per spec) — bevisar att Dev kan följa processen
- **PR #227 (trivial-gating-förtydligande) kördes korrekt** — feature branch, PR, merge via `gh pr merge`
- **Review-manifest (S41) fungerar** — inte urblåst trots tempohets

Processproblemet är inte "Dev är sloppy" — det är "processerna kräver mer disciplin än tempot tillåter utan automatisering".

---

## Åtgärder

### Omedelbart

- **STOPP på parallellt tech-lead/Dev-arbete** — en session i taget tills vi har bättre koordinering
- **Tech-lead-review är obligatorisk för S44-2** — Dev får inte skapa PR och merga själv
- **Denna retro committad innan vi går vidare** — fånga lärdomen medan den är färsk

### Kort sikt (S45 eller tidigare)

Tre hooks i backlog som ALLA ska byggas nästa sprint:

1. **Plan-commit-gate** (45-60 min) — hook som varnar när story är `in_progress` utan motsvarande `docs/plans/<story-id>-plan.md`. Fångar brott #1.
2. **Sprint-avslut-gate** (30-45 min) — hook som varnar när ny story markeras `in_progress` utan att föregående sprint stängts korrekt i status.md + retro skrevs. Fångar brott #3.
3. **Multi-commit-gate** — pre-push-hook som varnar om feature branch har färre än 2 commits. Fångar "0 commits hela storyn"-mönstret.

### Kultur

- **Dev skapar inte PR själv för icke-triviala stories**. Tech-lead-review är gatekeeper (per `team-workflow.md` Station 7). Dev pushar sin feature branch, väntar på tech-lead-review, tech lead skapar + mergar PR.
- **Rebase på feature branch kräver en "heads-up"-commit** eller tydlig kommunikation så parallell tech-lead-session inte förvirras.

---

## Lärdom

**Processerna fungerar när disciplinen fungerar. Utan automatisering är disciplin en funktion av tempo.**

När tempot är lågt följer vi processerna. När tempot är högt börjar vi "trimma" — och varje enskilt trim verkar försvarligt ("det var ju bara en testmigration"). Kumulativt blir det kaos.

Automatiseringen är inte bara "nice-to-have" — den är skillnaden mellan process och chans.

**Konkret:** PR #227 (trivial-gating-förtydligande) är en regel. Den följs inte förrän den är en hook.

**Mätbart mål till S45:** 3 process-hooks byggda. Efter det: förväntad procedurbrott-frekvens → nära noll även vid högt tempo.
