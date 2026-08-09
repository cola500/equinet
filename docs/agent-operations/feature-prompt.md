---
title: "Feature-prompt -- klistra in för ny feature"
description: "Återanvändbar prompt for att starta en autonom feature-leverans-session i Claude Code"
category: guide
status: active
last_updated: 2026-08-09
tags: [agent-operations, prompt, orchestrator]
related:
  - docs/agent-operations/README.md
  - docs/agent-operations/feature-delivery.md
sections:
  - Så här använder du prompten
  - Prompt
---

# Feature-prompt -- klistra in för ny feature

## Så här använder du prompten

Öppna en ny Claude Code-session i huvudrepot. Klistra in prompten nedan. Fyll bara i **Utfall**
-- de andra fälten är valfria och kan tas bort om de inte tillför något. Beskriv utfallet som
ett användarbehov eller produktresultat, inte som en teknisk lösning (se exemplet i
[README.md](README.md#hur-du-använder-det)).

Den detaljerade processen ligger redan i repot -- prompten är medvetet kort så att den är
praktisk att använda varje gång du vill ha en ny feature levererad.

---

## Prompt

```
Autonom feature-leverans

Läs och följ:
- docs/agent-operations/README.md
- docs/agent-operations/feature-delivery.md

Agera som orchestrator för denna feature.

Utfall
[BESKRIV DET ÖNSKADE ANVÄNDAR- ELLER PRODUKTUTFALLET]

Varför
[VALFRITT]

Framgång
[VALFRITT]

Viktiga begränsningar
[VALFRITT]

Ta ansvar för arbetet från utforskning till verifierad leverans.

Inspektera befintlig produkt och kodbas innan du bestämmer hur det ska implementeras.

Använd befintliga agenter/subagenter där de materiellt förbättrar utforskning, parallellism,
testning eller oberoende granskning -- se feature-delivery.md för vilka som finns.

Fatta GREEN-beslut autonomt.

Fråga inte människan att välja mellan likvärdiga tekniska lösningar när repots konventioner
ger tillräcklig vägledning.

Eskalera bara genuina YELLOW/RED-beslut (se feature-delivery.md Beslutsgränser).

Föredra den minsta användbara vertikala slicen.

Använd befintliga mönster innan nya introduceras.

Bredda inte scope i onödan.

Verifiera resultatet med de starkaste relevanta feedback-looparna som finns tillgängliga.

Där det är värdefullt: låt en oberoende agent försöka hitta regressioner, felaktiga
antaganden eller saknat beteende.

Fixa GREEN-nivå-fynd autonomt och kör om verifiering.

Fortsätt tills antingen:
1. featuren är verifierad och redo för mänsklig granskning, eller
2. arbetet är blockerat av ett genuint mänskligt beslut.

Slutrapporten ska innehålla:
- Levererat utfall
- Viktiga implementationsbeslut
- Agenter/subagenter som användes
- Verifiering som utfördes och resultat
- Kvarvarande risker eller osäkerheter
- Mänskliga beslut som krävs
- Uppföljningar medvetet hållna utanför scope

Optimera för: verifierad användbar framdrift / mänsklig uppmärksamhet
```
