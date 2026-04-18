---
title: "Story Refinement -- Seven Dimensions"
description: "Hur vi slicear feature-idéer till värde-drivna stories med Richard Lawrence's Seven Dimensions-ramverk"
category: rule
status: active
last_updated: 2026-04-18
tags: [process, business-analysis, seven-dimensions, story-splitting, refinement]
sections:
  - När använda
  - När INTE använda
  - De sju dimensionerna
  - Processen (6 steg)
  - Dokumentation
  - Exempel
  - Antipatterns
---

# Story Refinement -- Seven Dimensions

Detta är vårt ramverk för att ta feature-idéer från "vi borde ha X" till en välslicad MVP-story med tydligt värde. Bygger på Richard Lawrence's **Seven Dimensions of Story Splitting**, anpassat till Equinet-kontext.

## När använda

Applicera processen när en av följande gäller:

- **Ny feature-idé** som inte är uppenbart liten (>1 dag uppskattad effort)
- **Epic-nivå tankar** ("vi ska ha meddelanden", "vi behöver analytics")
- **Stories som känns luddiga** -- om du inte kan beskriva värdet i en mening är det för stort
- **Backlog-rader utan tydlig första-slice** -- omgör till slicad struktur

## När INTE använda

Hoppa över Seven Dimensions när:

- **Process-stories och tekniska tweaks** (rule-ändringar, refactoring, infra)
- **Bugfixar** -- fixa, inte slicea
- **Mekaniska migreringar** -- hela eller inget
- **Stories under 1 dags effort där värdet är uppenbart** -- overkill

## De sju dimensionerna

| # | Dimension | Fråga |
|---|-----------|-------|
| 1 | **Workflow Steps** | Vilka steg tar användaren? Kan vi leverera ETT steg först? |
| 2 | **Business Rule Variations** | Finns flera regler (premium vs basic, typ A vs typ B)? Börja med enklaste. |
| 3 | **Major Effort** | Vilken del är svårast? Leverera den som egen slice eller skjut upp. |
| 4 | **Simple/Complex** | Happy path först, edge cases senare. |
| 5 | **Variations in Data** | Olika datatyper (text, bild, video)? Börja med en. |
| 6 | **Data Entry Methods** | Olika input-kanaler (tangentbord, röst, foto, API)? Börja med en. |
| 7 | **Defer Performance** | Funktion först, optimering sedan (polling före realtime). |

**Regel:** Inte alla sju dimensioner är relevanta för varje feature. Välj de 3-5 som faktiskt ger meningsfull värdeuppdelning. Tvinga inte en dimension där den inte passar.

## Processen (6 steg)

Dialog mellan Johan (product owner) och tech lead (Claude):

### Steg 1: Johan skisserar behovet

Kort beskrivning med fokus på USER VALUE, inte lösning:
- Vem har problemet?
- Vad är smärtan idag?
- Varför nu?

### Steg 2: Tech lead ställer 2-3 värdefrågor

Innan någon slicing -- förstå värdet. Exempel:
- **"Vems smärta är störst idag?"** (isolera primär persona)
- **"Vad händer idag när behovet finns?"** (baseline att jämföra mot)
- **"Hur mäter vi framgång?"** (success-kriterium)

En fråga i taget är OK, eller 2-3 buntade. Vänta på svar.

### Steg 3: Landa en epic-formulering

"Som [persona] vill jag [handling] så att [värde]." Får plats på EN rad. Undvik lösnings-ord ("chat", "formulär", "meddelanden") -- beskriv värdet, inte implementationen.

### Steg 4: Tech lead föreslår 3-5 slices

Välj relevanta dimensioner. Beskriv varje slice med:
- **Dimensioner kombinerade** (vilka dimensioner använde du?)
- **Leverans** (vad användaren får)
- **Effort** (ungefärlig tid)
- **Värde-andel** (Slice 1 bör leverera 60-80% av värdet)

Markera MVP-kandidat tydligt.

### Steg 5: Johan väljer

- MVP-kandidat OK som den är? → bekräfta
- Något måste vara med? → lägg till och motivera
- Något ska bort? → skjut till senare slice

### Steg 6: Formalisera

- **Epic-dokument** i `docs/ideas/epic-<namn>.md` (se Dokumentation nedan)
- **Slice 1 som backlog-rad** i `docs/sprints/status.md`
- **Slice 2-N som kommande slices** i samma backlog-sektion (prioritet enligt värde)

## Dokumentation

### Epic-dokument (`docs/ideas/epic-<namn>.md`)

Obligatoriska sektioner:
1. **Epic-formulering** (en mening)
2. **Personas och värde** (tabell: primär/sekundär + smärta/värde)
3. **Success-mått**
4. **Slicing enligt Seven Dimensions** (slice-för-slice med effort-uppskattning)
5. **Beslut** (datum, vem bestämde, vad blev MVP)
6. **Nästa steg** (när ska detta implementeras)

Frontmatter: `category: idea`, `status: draft` (tills Slice 1 är implementerad, sedan `status: active`).

### Backlog-rader (`docs/sprints/status.md`)

Format:
```markdown
| **Epic: <namn>** ([epic-<namn>.md](../ideas/epic-<namn>.md)) | -- | Kort sammanfattning + slicing-datum. |
| <Epic> Slice 1 (MVP): <beskrivning> | <effort> | Kort värde + tekniska noteringar. |
| <Epic> Slice 2: <beskrivning> | <effort> | Varför denna prioritet. |
```

Placera epic + slices tillsammans i relevant prioritet-bucket.

## Exempel

Se `docs/ideas/epic-messaging.md` -- första testkörningen av processen (2026-04-18). Resulterade i:
- Epic formulerad kring kognitiv belastning (inte "chat-funktion")
- 5 slices med MVP tydligt markerad
- Leverantör↔leverantör separerad till egen epic (felklumpad tidigare)

## Antipatterns

Undvik:

- **Tekniskt-driven slicing** ("först API, sedan UI") -- det är inte värde-slices, det är lager. Varje slice ska leverera användarvärde.
- **Slice 1 som spike** -- första slicen ska leverera användbar funktionalitet, inte bara prototyp.
- **Kopiera dimensionerna mekaniskt** -- välj de 3-5 som faktiskt delar värde för just denna feature.
- **Skippa värdefrågorna** -- utan personaförståelse blir slicingen gissning.
- **Bundla flera epics** -- om två grupper användare har olika värde = två epics. Messaging-epic lärde oss detta (kund↔leverantör vs leverantör↔leverantör).
- **Lösa det med fler dimensioner** -- om inget av de sju passar, kanske featuren är så liten att slicing inte behövs.

## Resurser

- Richard Lawrence, "Patterns for Splitting User Stories" -- originaltextens sju mönster
- `docs/ideas/epic-messaging.md` -- första Equinet-tillämpningen
