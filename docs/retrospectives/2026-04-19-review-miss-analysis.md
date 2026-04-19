---
title: "Review-miss analys: cx-ux-reviewer missade meddelande-ordning (S40-3)"
description: "5 Whys-analys av andra reviewer-miss mot domänmönster och formalisering av review-manifest"
category: retro
status: active
last_updated: 2026-04-19
sections:
  - Vad missades
  - 5 Whys
  - Jämförelse med S35-1-miss
  - Gemensam klass av miss
  - Rotorsak och åtgärd
  - Utvärderingskriterier
---

# Review-miss analys: cx-ux-reviewer missade meddelande-ordning (S40-3)

## Vad missades

S40-3 körde cx-ux-reviewer på SmartReplyChips med en before/after-jämförelse. Reviewern godkände
ändringen utan att flagga att hela tråd-vyn renderar nyast överst — API returnerar `orderBy: desc`,
klienten reversade inte. Bruten chat-metafor (nyast överst istället för chat-konvention nyast
nederst). Messaging har `default: true` sedan S37.

Källfil: `docs/retrospectives/2026-04-19-smart-replies-ux-review.md` — meddelande-ordning nämns
inte.

## 5 Whys

**1. Varför missade cx-ux-reviewern meddelande-ordningen?**
Reviewern fokuserade på SmartReplyChips — komponentens visuella design, interaktion och before/after.
Omgivande kontext (tråd-vyns scroll-beteende, ordning) låg utanför det som granskades.

**2. Varför fokuserade reviewern på chips och inte surrounding context?**
Briefen till cx-ux-reviewern i S40-3 handlade specifikt om chips: "granska SmartReplyChips before/after
med fokus på UX-kvalitet." Det var inget mandat att granska hela messaging-komponenten.

**3. Varför täckte briefen inte chat-konventioner?**
Vi har ingen standard "kom-ihåg"-lista för messaging-reviews. Varje brief skrivs ad hoc. Reviewern
kollar det den uttryckligen ombeds granska.

**4. Varför finns ingen standard-lista?**
Domänspecifika review-krav är inte formaliserade. Vi har skissat idén om review-manifest (S37-villkorlig
story, aldrig prioriterad) men inte byggt det.

**5. Varför inte prioriterat?**
Första data-punkten (S35-1-miss) löstes med arkitekturcoverage-kravet (S36-0/S36-1). Vi annahm att
det täckte reviewer-missarna. S40-3 visar att det inte räcker — det finns en separat klass av miss
som handlar om domän-konventioner, inte design→implementation coverage.

## Jämförelse med S35-1-miss

| Dimension | S35-1 (security-reviewer) | S40-3 (cx-ux-reviewer) |
|-----------|--------------------------|------------------------|
| Vad missades | Arkitekturcoverage: designbeslut D1-D6 ej verifierade | Domänkonvention: chat nyast nederst |
| Orsak | Briefen täckte inte "verifiera varje designbeslut" | Briefen täckte inte "verifiera chat-metafor" |
| Lösning | Obligatorisk arkitekturcoverage-sektion i done-filer + prompts | Review-manifest med domänspecifika checklistor |
| Implementerat i | S36-0, S36-1 | S41-1 (detta dokument + review-manifest.md) |

## Gemensam klass av miss

**"Reviewern ser det den uttryckligen kollar mot."**

Metacognition (S36-1) adresserar detta generellt: reviewern ska vara medveten om sina blinda
fläckar. Men metacognition räcker inte om reviewern inte VET vad som är viktigt att kolla
i en specifik domän.

Arkitekturcoverage (S36-0) löser "kollade inte mot designdokumentet". Review-manifest löser
"kollade inte mot domänkonventioner". Komplementära lösningar, inte överlappande.

## Rotorsak och åtgärd

**Rotorsak:** Domänspecifika review-krav (konventioner, mönster, gotchas) är inte formaliserade
och kommuniceras inte till reviewern i briefen.

**Åtgärd:** `review-manifest.md` — deklarativ lista per story-typ/domän. Varje brief
refererar till relevant manifest-sektion. Reviewern checkar av listan explicit.

Se `.claude/rules/review-manifest.md` (skapad i S41-1).

## Utvärderingskriterier

Nästa messaging-story: om cx-ux-reviewern använder messaging-sektionen från review-manifest
och inte missar ordning/scroll — manifestet fungerade. Om en miss sker ändå: förbättra
manifest-sektionen.

Tidslinje: utvärdering efter nästa story som berör messaging-UI.
