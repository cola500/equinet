---
title: "Feature Delivery -- operativ modell"
description: "Flodet en orchestrator foljer for autonom feature-leverans: fran utfall till verifierad, granskningsklar PR"
category: guide
status: active
last_updated: 2026-08-09
tags: [agent-operations, orchestrator, workflow, decision-boundaries]
related:
  - docs/agent-operations/README.md
  - docs/agent-operations/feature-prompt.md
  - .claude/rules/team-workflow.md
  - .claude/rules/review-matrix.md
  - .claude/rules/review-manifest.md
  - .claude/rules/tech-lead.md
  - .claude/rules/commit-strategy.md
  - .claude/rules/autonomous-sprint.md
  - .claude/rules/testing.md
  - .claude/rules/code-review-checklist.md
  - .claude/rules/story-refinement.md
  - docs/architecture/patterns.md
  - docs/architecture/refactor-triggers.md
  - docs/guides/agents.md
sections:
  - Syfte
  - Flödet
  - Roller -- använd befintliga agenter
  - Parallellisering
  - Beslutsgränser
  - Autonom korrigeringsloop
  - Scope-disciplin
  - Verifieringsmekanismer per ändringstyp
  - Oberoende/adversarial granskning
  - Completion-kriterier
  - Relaterade dokument
---

# Feature Delivery -- operativ modell

## Syfte

Detta dokument definierar hur en orchestrator-session tar ett utfall ("Johan vill X") hela
vägen till en verifierad, granskningsklar PR -- med minsta möjliga mänskliga inblandning som
fortfarande är säkert. Det återanvänder Equinets befintliga stationsflöde, review-matris och
subagenter. Det introducerar **inga** nya roller, stationer eller kvalitetsgrindar.

## Flödet

```
UTFALL
  → förstå befintligt beteende
  → avgör scope och risker
  → avgör om subagenter tillför värde
  → utforska
  → implementera minsta användbara vertikala slice
  → verifiera oberoende
  → granska mot ursprungligt utfall
  → korrigera GREEN-fynd
  → re-verifiera
  → rapportera till människa
```

Varje steg mappar mot en befintlig mekanism -- inget av detta är nytt:

| Steg | Vad orchestratorn gör | Befintlig mekanism den använder |
|------|------------------------|----------------------------------|
| **Förstå befintligt beteende** | Läs relevant kod, `code-map.md`, `patterns.md`, `gotchas.md` för domänen | [code-map.md](../../.claude/rules/code-map.md), [patterns.md](../architecture/patterns.md), [gotchas.md](../guides/gotchas.md) |
| **Avgör scope och risker** | Klassificera utfallet mot GREEN/YELLOW/RED (nedan). Om utfallet är episkt och luddigt -- kör Seven Dimensions-processen INNAN implementation | [Beslutsgränser](#beslutsgränser), [story-refinement.md](../../.claude/rules/story-refinement.md) |
| **Avgör om subagenter tillför värde** | Kör INTE agenter för det som redan är automatiserat (lint, typecheck, svenska, coverage). Kör INTE tech-architect för enkel CRUD | [agents.md](../guides/agents.md) DO/DON'T |
| **Utforska** | Bred, läs-bara utforskning över flera filer/domäner | `Explore`-agenten (Task-verktyget) |
| **Implementera minsta användbara vertikala slice** | BRANCH → TDD (RED → GREEN → REFACTOR), återanvänd mönster, ingen orelaterad refactor | [team-workflow.md](../../.claude/rules/team-workflow.md) Steg 1-2, [testing.md](../../.claude/rules/testing.md) |
| **Verifiera oberoende** | `npm run check:all` (typecheck + test + lint + svenska) | [team-workflow.md](../../.claude/rules/team-workflow.md) Steg 3 |
| **Granska mot ursprungligt utfall** | Obligatoriska reviewers per filmönster, domänspecifika checklistor | [review-matrix.md](../../.claude/rules/review-matrix.md), [review-manifest.md](../../.claude/rules/review-manifest.md) |
| **Korrigera GREEN-fynd** | Se [Autonom korrigeringsloop](#autonom-korrigeringsloop) | -- |
| **Re-verifiera** | Kör om `check:all` + berörda reviewers | -- |
| **Rapportera till människa** | Se [Completion-kriterier](#completion-kriterier) och slutrapport-formatet i `feature-prompt.md` | -- |

**Var flödet stannar:** Orchestratorn tar featuren till en grön, granskningsklar PR (`team-workflow.md`
Steg 4 SHIP: push + `gh pr create`) -- inte till merge. Merge kräver antingen tech lead-granskning
(`tech-lead.md`) eller ett explicit "kör sprint autonomt"-läge (`autonomous-sprint.md`). Se
[Anpassningar](#completion-kriterier) för varför detta är den säkra defaulten.

## Roller -- använd befintliga agenter

Skapa **inga** nya permanenta roller. Använd de agenter/mekanismer som redan finns:

| Roll | Mekanism | När |
|------|----------|-----|
| Bred, läs-bar utforskning | `Explore`-agenten | Innan scope/plan bestäms, vid utforskning över flera filer eller domäner |
| Arkitekturbeslut, schemadesign | `tech-architect`-subagenten | Före implementation vid arkitekturpåverkande ändringar |
| Kodgranskning | `code-reviewer`-subagenten (fallback: `/code-review`-skillen) | Alltid obligatorisk -- station 4 i `team-workflow.md` |
| Säkerhetsgranskning | `security-reviewer`-subagenten (fallback: `/security-review`-skillen) | Nya/ändrade API-routes, auth-ändringar -- se `review-matrix.md` |
| UX-granskning | `cx-ux-reviewer`-subagenten | Nya sidor eller väsentligt ändrade UI-flöden -- se `review-matrix.md` |
| iOS-granskning | `ios-expert`-subagenten | Swift/SwiftUI-ändringar -- se `review-matrix.md` |
| Oberoende "vad missade jag?" | `general-purpose`-agent, briefad enligt tech-lead.md:s djävulens-advokat-mönster | Se [Oberoende/adversarial granskning](#oberoendeadversarial-granskning) |

> **Om `code-reviewer`/`security-reviewer` inte är tillgängliga som namngivna subagenter i
> sessionen:** använd `/code-review`- respektive `/security-review`-skillen som täcker samma
> checklistor (`code-review-checklist.md` respektive säkerhetssektionen i `api-routes.md`).
> `AGENTS.md` listar dem som etablerade specialistagenter -- namnet i briefen till
> `Agent`-verktyget är det som avgör om de är tillgängliga i en given session.

Om en uppgift kräver kompetens som inte täcks ovan: briefa `general-purpose` tydligt i den
enskilda sessionen. Skapa inte en ny fil i `.claude/agents/` för en enstaka feature.

**Kör reviewers seriellt, inte parallellt** (samma disciplin som `review-matrix.md` redan
definierar): code-reviewer först. Kör bara specialist-reviewers om code-reviewer flaggar
Blocker/Major eller fynd inom deras domän. Detta är redan Equinets etablerade sätt att hålla
`verifierad framdrift / mänsklig uppmärksamhet` högt.

## Parallellisering

Parallellisera bara genuint oberoende arbete. Innan du spawnar mer än en agent samtidigt:
kör snabbtestet i [parallel-sessions.md](../../.claude/rules/parallel-sessions.md#snabbtest-kan-dessa-köras-parallellt):

1. Vilka filer rör respektive del?
2. Finns överlapp i domän, routes eller components (`code-map.md`)?
3. Rör någon del `prisma/schema.prisma`, `package.json`, `src/lib/*`? Om ja -- sekventiellt.

En enskild feature är oftast en sammanhållen slice och bör köras sekventiellt i en session.
Spawn av en worktree-agent (`autonomous-sprint.md`s worktree-mönster) är motiverat bara när
utfallet genuint spänner över två icke-överlappande domäner (t.ex. webb + iOS).

## Beslutsgränser

### GREEN -- agenten avgör och fortsätter autonomt

- Implementationsdetaljer inom den valda slicen
- Namngivning som följer befintliga konventioner
- Återanvändning av etablerade komponenter/mönster ([patterns.md](../architecture/patterns.md))
- Lokal refaktorering som featuren kräver (inte fristående refactor -- se non-triggers N1-N12 i [refactor-triggers.md](../architecture/refactor-triggers.md))
- Tester (TDD är obligatoriskt, BDD dual-loop för API-routes/domain services per [testing.md](../../.claude/rules/testing.md))
- Mindre buggfixar inom scope
- Ändringar som uppfyller trivial-gating-kriterierna i [team-workflow.md](../../.claude/rules/team-workflow.md#review-gating)

### YELLOW -- agenten rekommenderar, fortsätter autonomt bara om repo-praxis tydligt stödjer beslutet

- Tvetydigt produktbeteende
- Meningsfulla UX-avvägningar utan tydligt facit
- Nytt arkitekturmönster ([patterns.md](../architecture/patterns.md) är explicit: nya mönster
  introduceras inte utan diskussion)
- Ändringar som spänner över flera produktområden
- En refactor-trigger som fyrar (T1-T12 i [refactor-triggers.md](../architecture/refactor-triggers.md)) --
  namnge triggern, beskriv smärtan konkret, och vänta på godkännande innan refactorn påbörjas
- Utfall som känns episkt eller där värdet är luddigt -- kör [story-refinement.md](../../.claude/rules/story-refinement.md)s
  Seven Dimensions-process och föreslå en Slice 1 istället för att gissa scope

**Regel:** fortsätt autonomt endast om ett befintligt dokument (pattern, gotcha, retro,
decision-log) redan ger ett tydligt svar. Annars eskalera med en konkret rekommendation --
fråga inte öppet, föreslå.

### RED -- mänskligt beslut krävs

- Destruktiva dataoperationer (`db:nuke`, `db:reset` mot delad miljö, force-push)
- Auth-/auktoriseringsmodellen (`src/lib/*auth*`, `middleware.ts`) -- kräver alltid
  security-reviewer + Johan
- Väsentliga säkerhetsändringar
- Produktionsinfrastruktur (deploy, Vercel-/Supabase-konfiguration)
- Irreversibla migrationer (`prisma/schema.prisma` -- kräver alltid tech-architect + PR,
  aldrig direkt till main)
- Större arkitekturriktningsändringar
- Produktkrav som inte säkert kan härledas -- fråga Johan istället för att gissa
  (CLAUDE.md: "Osäkerhet: Fråga ALLTID istället för att gissa")
- Produktbeslut som redan är explicit frusna i repots dokumentation (t.ex. prismodeller
  som väntar på PO-beslut)

## Autonom korrigeringsloop

```
failat test/review-fynd
  → undersök rotorsak
  → fixa GREEN-nivå-fynd
  → kör om verifiering
  → upprepa tills löst
```

Eskalera **inte** rutinmässiga implementationsproblem -- ett failande test eller ett Minor/Major
review-fynd inom den redan avgränsade slicen är GREEN-arbete tills motsatsen bevisas.

**Undantag (redan Equinets regel):** samma typ av fel misslyckas 3 gånger i rad --
`autonomous-sprint.md`s "Max 3 försök, sedan STOPP" gäller oförändrat. Vid tredje misslyckandet:
eskalera som en blockerare, inte ett fjärde autonomt försök.

## Scope-disciplin

- **Kan detta lösas genom att ta bort kod?** Fråga alltid det innan ny abstraktion övervägs
  (CLAUDE.md Refactoring, `refactor-triggers.md` fråga 4: "Kan vi lösa med mindre ändring?")
- Använd befintliga mönster innan nya introduceras ([patterns.md](../architecture/patterns.md))
- Undvik orelaterad städning -- Boy Scout Rule (CLAUDE.md) gäller proportionellt, inte som
  svepskäl för en större refactor
- **Registrera sidoupptäckter separat, agera inte på dem i samma slice.** Notera i PR-beskrivningen
  under en egen rubrik, och/eller lägg till en rad i `docs/sprints/backlog.md`. En upptäckt
  refactor-kandidat dokumenteras som "bevaka" (jf. `refactor-triggers.md` sektion 6) -- den
  åtgärdas bara om en trigger faktiskt fyrar i en senare, egen slice

## Verifieringsmekanismer per ändringstyp

Använd den starkaste relevanta feedback-loopen -- inte alla vid varje ändring:

| Ändringstyp | Verifiering |
|-------------|-------------|
| Domänlogik / API-route | Vitest unit + integration (BDD dual-loop) + `check:all` |
| UI-flöde | `cx-ux-reviewer` + visuell verifiering med Playwright MCP ([agents.md](../guides/agents.md)) |
| Schemaändring | `npm run migrate:check` + `migration-from-scratch`-CI-jobbet + `tech-architect`-review |
| Säkerhetskänslig kod | `security-reviewer` + säkerhetssektionen i [code-review-checklist.md](../../.claude/rules/code-review-checklist.md) |
| iOS/Swift | `xcodebuild test` + `ios-expert` |
| Offline/PWA | `npm run test:e2e:offline` |

## Oberoende/adversarial granskning

Ingen ny "Tester"-roll skapas. Återanvänd tech-lead.md:s **djävulens-advokat-review**-mönster:
briefa en `general-purpose`-agent med "vad missade implementeraren?" -- explicit, inte underförstått.

**Kör det** när minst ett gäller (samma gating som `tech-lead.md` redan definierar):

- Auth-/säkerhetskod ändrades
- Schemaändring
- Payment-kod
- Egen review hittade Blocker eller Major
- Utfallet är pre-launch-kritiskt

**Kör det inte** vid docs-only, trivial-gated ändringar, ren refactoring utan ny logik, eller
när egen review bara hittade Minors. Källa till gatingen: `review-matrix.md`s
"Seriell körning"-sektion (S53-1: oberoende parallell granskning utan gating kostade 117k
tokens för 1 verklig bugg) och `tech-lead.md`s Djävulens-advokat-sektion (S51-0: ~300k tokens
för 2 buggar utan launch-impact). Seriell, villkorad granskning är den bevisade
kostnadseffektiva vägen i det här repot.

## Completion-kriterier

Featuren är redo för mänsklig granskning när:

- [ ] `npm run check:all` (eller `xcodebuild test` för iOS) är grönt
- [ ] Obligatoriska reviewers per `review-matrix.md` är klara utan olösta Blocker/Major
- [ ] PR är skapad med Summary + Test plan ([team-workflow.md](../../.claude/rules/team-workflow.md) Steg 4)
- [ ] Täckning och Gap är dokumenterat av reviewers ([review-matrix.md](../../.claude/rules/review-matrix.md))
- [ ] Inga olösta RED-frågor kvarstår
- [ ] Slutrapport levererad till Johan (format: se [feature-prompt.md](feature-prompt.md))

**Anpassning från källmodellen:** flödet stannar vid en grön, granskningsklar PR -- inte vid
merge. `autonomous-sprint.md` tillåter self-merge i ett explicit påslaget autonomt sprint-läge,
men Agent Operations defaultar till att invänta mänsklig granskning innan merge, eftersom
completion-kriteriet i `feature-prompt.md` uttryckligen är "redo för mänsklig granskning".
Vill du att orchestratorn även mergar: säg det explicit i utfallsprompten -- Steg 4 SHIP i
`team-workflow.md` gäller då oförändrat, inklusive `git merge-pr`-wrappern som skyddar mot
oavsiktlig self-merge.

Optimera för: **verifierad användbar framdrift / mänsklig uppmärksamhet**.

## Relaterade dokument

- [README.md](README.md) -- koncept och användning
- [feature-prompt.md](feature-prompt.md) -- klistra-in-prompt
- [team-workflow.md](../../.claude/rules/team-workflow.md)
- [review-matrix.md](../../.claude/rules/review-matrix.md)
- [review-manifest.md](../../.claude/rules/review-manifest.md)
- [tech-lead.md](../../.claude/rules/tech-lead.md)
- [commit-strategy.md](../../.claude/rules/commit-strategy.md)
- [autonomous-sprint.md](../../.claude/rules/autonomous-sprint.md)
- [refactor-triggers.md](../architecture/refactor-triggers.md)
- [patterns.md](../architecture/patterns.md)
- [story-refinement.md](../../.claude/rules/story-refinement.md)
