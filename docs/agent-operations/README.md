---
title: "Agent Operations"
description: "Hur autonom feature-leverans fungerar i Equinet -- manniskan ager intent, agenter ager execution inom repots granser"
category: guide
status: active
last_updated: 2026-08-09
tags: [agent-operations, orchestrator, autonomy, workflow]
related:
  - CLAUDE.md
  - AGENTS.md
  - .claude/rules/team-workflow.md
  - .claude/rules/review-matrix.md
  - docs/agent-operations/feature-delivery.md
  - docs/agent-operations/feature-prompt.md
sections:
  - Kärnidé
  - Vad människan äger
  - Vad agenter äger
  - Hur du använder det
  - Var mänsklig interaktion sker
  - Relation till befintlig process
  - Dokument i detta lager
---

# Agent Operations

> Detta lager lägger INTE till en ny process. Det är en instruktion till en Claude Code-session
> att köra Equinets befintliga process (`team-workflow.md`, `review-matrix.md`, subagenterna i
> `AGENTS.md`) självständigt, från utfall till verifierad leverans, med tydliga eskaleringspunkter.

## Kärnidé

**Intent är centraliserat. Exekvering är decentraliserad.**

Johan uttrycker vad som ska uppnås. En orchestrator-session tar över från utforskning till
en verifierad, granskningsklar PR -- utan att fråga om beslut som repots konventioner redan
besvarar.

## Vad människan äger

- Produktintention -- vad som ska byggas och varför
- Prioritering -- vad som byggs härnäst
- Meningsfulla produktavvägningar (t.ex. UX-kompromisser utan tydligt facit)
- Högriskarkitekturbeslut
- Säkerhetskänsliga beslut
- Irreversibla beslut

## Vad agenter äger

Inom repots redan dokumenterade gränser:

- Utforskning av befintlig kod, mönster och dokumentation
- Implementationsval inom en avgränsad slice
- Återanvändning av etablerade mönster ([patterns.md](../architecture/patterns.md))
- Testdesign (TDD är obligatoriskt, se [testing.md](../../.claude/rules/testing.md))
- Verifiering (`check:all`, CI)
- Kodgranskning ([review-matrix.md](../../.claude/rules/review-matrix.md))
- Dokumentationsuppdateringar
- Korrigeringsloopar för GREEN-nivå-fynd

Se [feature-delivery.md](feature-delivery.md) för den fullständiga beslutsgränsmodellen
(GREEN / YELLOW / RED).

## Hur du använder det

Starta ny feature genom att öppna en Claude Code-session och klistra in prompten i
[feature-prompt.md](feature-prompt.md).

Beskriv featuren som ett **utfall eller användarbehov** -- inte som en teknisk implementationsplan.
Orchestratorn ansvarar för att härleda hur, inte bara utföra ett redan fattat tekniskt beslut.

Exempel:

- ✅ "Leverantörer ska kunna se vilka kunder som inte bokat på 3+ månader, så att de kan följa upp."
- ❌ "Lägg till en `lastBookingDate`-kolumn och en cron-job som beräknar inaktiva kunder."

Den andra formuleringen tar bort agentens möjlighet att göra ett informerat implementationsval --
och gör dig till flaskhalsen för beslut agenten kunde tagit själv.

## Var mänsklig interaktion sker

Normalt bara vid två punkter:

1. **Definiera intent** -- klistra in prompten med ett tydligt utfall
2. **Granska levererat resultat** -- läsa slutrapporten och den färdiga PR:en

Agenten avbryter och frågar bara när ett genuint YELLOW- eller RED-beslut uppstår
(se [feature-delivery.md](feature-delivery.md#beslutsgränser)) -- inte vid rutinmässiga
tekniska val som repots konventioner redan besvarar.

## Relation till befintlig process

Agent Operations ersätter inte:

- [team-workflow.md](../../.claude/rules/team-workflow.md) -- 4-stegsflödet BRANCH → TDD → CHECK → SHIP körs oförändrat
- [review-matrix.md](../../.claude/rules/review-matrix.md) och [review-manifest.md](../../.claude/rules/review-manifest.md) -- vilka reviewers som krävs, och vad de ska kolla mot
- [commit-strategy.md](../../.claude/rules/commit-strategy.md) -- feature branch + PR för kod, aldrig direkt till main
- De guardrails som redan finns som hooks (TDD-tvång, DoD-checklista, self-merge-block, plan-approval-gate)

Det lägger till **en orkestrerande instruktion ovanpå detta**: hur en session tar en feature
hela vägen från "Johan vill X" till "här är en grön, granskningsklar PR" utan att fråga om
sådant repot redan har svar på.

## Dokument i detta lager

| Dokument | Syfte |
|----------|-------|
| `README.md` (den här filen) | Koncept och hur du använder lagret |
| [feature-delivery.md](feature-delivery.md) | Operativ modell: flöde, roller, beslutsgränser, korrigeringsloop, completion-kriterier |
| [feature-prompt.md](feature-prompt.md) | Klistra-in-prompt för att starta en ny autonom feature-leverans |
