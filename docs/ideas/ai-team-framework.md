---
title: "Idé: AI-team framework — skala processen till andra produkter"
description: "Extrahera Equinets process-infrastruktur till återanvändbart ramverk för AI-drivna produktteam. Dokumenterad idé, ej aktiv utveckling."
category: idea
status: draft
last_updated: 2026-04-20
tags: [idea, meta-process, framework, ai-team, skalning]
sections:
  - Vision
  - Nuläge
  - Förutsättningar innan extraktion
  - Generisk vs produktspecifik katalog
  - Vad skulle göra det till en faktisk produkt
  - Risker
  - Beslut och nästa steg
---

# Idé: AI-team framework

## Vision

Vad vi bygger för Equinet — sprint-flöde, hooks, review-matris, retros, process-enforcement — är till ~70% projektoberoende. Hypotesen: processen själv är en produkt som kan skalas till andra AI-drivna team.

**Formulering:** "Som Product Owner med ett nytt AI-drivet produktteam vill jag adoptera en beprövad process-infrastruktur utan att bygga allt själv, så att disciplin finns från dag 1 utan att bromsa tempo."

## Nuläge (2026-04-20)

Insikt uppstod efter S45-S47-process-hardening. Johan (PO): "Jag tycker det är riktigt coolt att vi sätter en grund för högt tempo. Sen tänker jag att nästa nivå är ju att kunna skala det. Men det kanske vi kan göra med en annan produkt om vi har alla processer och steg som vi jobbar med."

**Observation:** Ratio generisk:produktspecifik är ovanligt hög i `.claude/rules/` + `scripts/check-*.sh`. Det är symptom på att vi designat processen som metodik först, implementation sedan.

## Förutsättningar innan extraktion

**Bygg inte framework på obevisad grund.** Följande måste vara uppfyllt först:

1. **S47 klart + mätbar effekt**: procedurbrott ska gå från ~6/sprint (S45) till nära 0. Tills vi sett detta i 2-3 sprintar (S48-S50) vet vi inte om blockers faktiskt stoppar drift.

2. **Override-användning normaliserad**: S47-4-override ska ha en tydlig användningsfrekvens. Om ≤3/sprint = hälsosamt. Om >5 = regeln för strikt eller för lös.

3. **Minst ett kompakt failure-mode upptäckt efter S47**: Dev's "compacting conversation" var insikten som formade S47. Nästa iteration behöver minst en till upptäckt som bevisar att processen är adaptiv.

4. **Retro-disciplin bevarad**: om vi hoppar retros för att "leverera mer" faller hela feedback-loopen. Minst 2 retros efter S47 utan skipp.

**Inga extraktionsarbete förrän alla fyra uppfyllts.**

## Generisk vs produktspecifik katalog

### Generiskt (~70%)

| Fil/katalog | Vad |
|-------------|-----|
| `.claude/rules/team-workflow.md` | 7 stationer (PLAN → RED → GREEN → REVIEW → VERIFY → PUSH → MERGE) |
| `.claude/rules/autonomous-sprint.md` | Sprint-flöde, story-livscykel |
| `.claude/rules/parallel-sessions.md` | Multi-session-koordinering |
| `.claude/rules/commit-strategy.md` | Trunk-based hybrid, path-policys |
| `.claude/rules/review-matrix.md` (S47) | Obligatoriska subagents per filtyp |
| `.claude/rules/story-refinement.md` | Seven Dimensions-slicing |
| `.claude/rules/review-manifest.md` | Domän-checklistor per story-typ |
| `scripts/check-plan-commit.sh` | Plan före implementation |
| `scripts/check-sprint-closure.sh` | Sprint-avslut-enforcement |
| `scripts/check-branch-for-story.sh` | Rätt branch under story |
| `scripts/check-reviews-done.sh` (S47) | Obligatoriska reviews |
| `scripts/check-own-pr-merge.sh` | Self-merge-blocker |
| `.husky/pre-commit` + `pre-push` | Hook-integration |
| `docs/sprints/status.md` | Live sprint-state |
| `docs/plans/<story>-plan.md`-mall | Per-story-planering |
| `docs/done/<story>-done.md`-mall | Strukturerad done-fil |
| `docs/retrospectives/<datum>-sprint-<N>.md`-mall | Retro-format |
| Process-drift-retros | Meta-learning |

### Produktspecifikt (~30%)

| Fil | Varför produktspecifik |
|-----|------------------------|
| `.claude/rules/code-map.md` | Equinet-filstruktur |
| `.claude/rules/prisma.md` | Prisma ORM-regler |
| `.claude/rules/ios-learnings.md` | iOS-specifikt |
| `.claude/rules/testing.md` (delvis) | Vitest-mönster |
| `.claude/rules/api-routes.md` (delvis) | Next.js App Router |
| Review-manifest-sektioner per domän | Messaging, bokning etc |

## Vad skulle göra det till en faktisk produkt

**Steg 1 — Validera (S48-S50):** Kör 2-3 sprintar med S47-blockers live. Mät.

**Steg 2 — Extrahera (hypotetisk S51):**
- Separera `.claude/rules/` i `generic/` + `product/`-kataloger
- Template-repo `ai-team-framework` med generiska regler + hooks
- Placeholders för produktnamn, stack, review-matris
- Setup-script: `npx create-ai-team <namn>` → installerar rules, hooks, status.md-mall

**Steg 3 — Adoption (senare projekt):**
- Testa på sidoprojekt först, inte kritisk produkt
- Upptäck gaps vid annan tech stack (Python, Go, mobile native)
- Iterera

## Möjliga produktfeatures

Om detta någon gång blir faktisk produkt (open source eller intern verktygslåda):

- **Metrics-dashboard**: procedurbrott per sprint over time, override-frekvens, review-skip-ratio
- **Cachelagrade lärdomar**: en fil per "failure mode + solution"
- **Community-patterns**: andra AI-team delar regler + hooks
- **Hook-marketplace**: produkt-team lägger till egna hooks utan att ändra grundramverk
- **Compact-resistant prompts**: instruktioner designade för att överleva context-komprimering

## Risker

| Risk | Mitigering |
|------|-----------|
| "Write once, use everywhere" — framework för rigid | Håll generic/product-separationen tydlig. Product-delen ska vara enkel att ersätta. |
| Extraktion tar tid från produkten | Endast efter validering. Prioritering: produkt > metodik. |
| Nästa produkt har failure mode vi inte sett | Framework måste vara **lätt att iterera**, inte frozen best practices |
| Andra produkter har människor i loopen | Designa för human-in-the-loop-varianter, inte bara AI-only |
| Commit-strategy antaganden (trunk-based hybrid) passar inte alla | Gör commit-strategy pluggable |

## Beslut och nästa steg

**Beslut (2026-04-20):** Dokumentera idén. Inte aktivera utveckling än.

**Trigger för nästa steg:** S48-S50 sprintar körda med S47-enforcement live och procedurbrott nära 0. **Inte innan.**

**Om trigger uppnås:** Öppna ny diskussion "S51: Framework-extraktion — scope-beslut". Seven Dimensions-slicing eftersom det troligen är stort (2-3 dagar minst).

**Om trigger inte uppnås:** Inget framework ännu. Process-hardening-arbetet fortsätter på Equinet tills det faktiskt fungerar.

## Källor och referenser

- `docs/retrospectives/2026-04-19-process-drift-s43-s44.md` — första process-drift-analys
- `docs/retrospectives/2026-04-20-s46-1-direct-main-commit.md` — rotorsak för S47
- `docs/sprints/sprint-45.md` + `sprint-47.md` — process-hardening-sprintar
- Insikten från Johan (2026-04-20) om Dev's compacting — designprincipen "regler i kod, inte i minne"
