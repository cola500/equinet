---
title: "Specifikationslager – pilot"
description: "Syfte, begrepp, ID-namngivning och ändringsregler för Equinets långlivade specifikationslager (pilot: bokning och betalning)"
category: guide
status: draft
last_updated: 2026-10-23
tags: [specification, business-rules, traceability, pilot]
related:
  - docs/specifications/business-rules/booking-payment.md
  - docs/specifications/contracts/booking-payment-scenarios.md
  - docs/specifications/traceability/booking-payment-matrix.md
  - docs/agent-handoffs/README.md
sections:
  - Syfte
  - Tre nivåer
  - ID-namngivning
  - Status och evidens
  - Lineage
  - När en regel ändras
  - Regler för agenter
  - Motsägelser och osäkerhet
  - Pilotutvärdering
---

# Specifikationslager – pilot

> **Pilot (2026-10-23).** Omfattar bara fyra regler om bokning och betalning.
> Strukturen är medvetet liten. Den ska utvärderas innan den byggs ut.

## Syfte

Specifikationen beskriver **vad produkten ska göra och varför**, oberoende av
hur dagens kod gör det. Den ska fungera som ritningar: Johan ska kunna godkänna
reglerna utan att läsa kod, och en agent ska kunna planera en förändring utan
att rekonstruera avsikten ur kod och gamla sprintdokument.

Specifikationen ersätter inte sprintdokument, backlogg eller Git. Den är den
stabila platsen för *gällande* regler; sprintdokumenten är historiken om hur
reglerna kom till.

## Tre nivåer

| Nivå | Fil | Svarar på | Får innehålla |
|---|---|---|---|
| Affärsregel | `business-rules/` | Vad måste alltid gälla, och varför? | Produktspråk. Inga filnamn, ramverk, tabeller eller leverantörers API:er. |
| Beteendekontrakt | `contracts/` | Vad ska en användare eller ett externt system kunna observera? | Given/When/Then i produktspråk, med konkreta tider och statusar. |
| Spårbarhet | `traceability/` | Var finns beslut, tester och implementation – och stämmer de? | Filnamn, testnamn, kända avvikelser. Det enda lagret som får nämna kod. |

Dagens implementation är **evidens** för hur systemet beter sig nu, inte
källan till regeln. Tester är **verifiering**, inte källan till regeln.

## ID-namngivning

- Affärsregel: `BR-<DOMÄN>-<NNN>`, t.ex. `BR-BOOK-001`, `BR-PAY-001`.
- Scenario: `SC-<DOMÄN>-<NNN>`, t.ex. `SC-PAY-004`.
- Öppen fråga: `Q-<DOMÄN>-<NNN>`.
- ID:n återanvänds aldrig. En ersatt regel behåller sitt ID med status
  `ersatt` och en hänvisning till den nya.

## Status och evidens

Regelstatus: `beslutad`, `föreslagen`, `osäker` eller `ersatt`. Bara Johan kan
flytta en regel till `beslutad`.

Påståenden märks med samma evidensmarkörer som i handoff-filerna, plus två till:

| Markör | Betyder |
|---|---|
| `[beslut]` | Uttryckligt produktbeslut med datum och källa |
| `[läst]` | Granskat i dokument eller kod |
| `[körd]` | Faktiskt kört (test, kommando, testpass i miljö) |
| `[tolkning]` | Agentens slutsats som inte står uttryckligen i källan |

## Lineage

Varje regel har en lineage-tabell: datum, vad som ändrades, varför och källa
(PR, commit, sprintdokument eller retro). Även regler som tidigare fanns
*implicit* i kod eller äldre dokument tas med, så att det syns när avsikten
ändrades.

## När en regel ändras

1. Produktbeslut (Johan) dokumenteras, med datum och källa.
2. Regeln uppdateras och får en ny lineage-rad.
3. Berörda scenarier uppdateras eller läggs till.
4. Spårbarhetsmatrisen uppdateras; ny avvikelse markeras om koden inte följer.
5. Först därefter: tester och implementation, i en separat slice.

## Regler för agenter

- Agenter får **inte** skapa, ändra eller skärpa en affärsregel utan
  produktbeslut. Förslag markeras `föreslagen` eller läggs som öppen fråga.
- Agenter får uppdatera spårbarhetsmatrisen när kod eller tester ändras.
- Ett scenario som kräver ett obeslutat svar markeras `obeslutat` och pekar på
  en öppen fråga.

## Motsägelser och osäkerhet

- Uttryckligt produktbeslut går före nuvarande kodbeteende och äldre dokument.
- En motsägelse dokumenteras i regelns lineage och i matrisen, med båda
  källorna. Ingen sida väljs tyst.
- Saknas beslut blir det en `Q-`-fråga till Johan, inte en antagen regel.

## Pilotutvärdering

> Tillfällig sektion. Claude Codes bedömning efter Codex granskning och
> Johans beslut (2026-10-23). Flyttas till en retro när piloten avslutas.

1. **Kan Johan godkänna reglerna utan att läsa kod?** Ja i praktiken: Johan
   fattade fyra beslut direkt från regler och scenarier (ägarskap,
   formulering av BR-PAY-003, klocka och tidszon, exakt sluttid). Den tekniska
   källtexten för BR-PAY-003 är ersatt av en godkänd formulering i
   produktspråk.
2. **Är reglerna separerade från tekniken?** Ja. Filnamn, tester och
   kodobservationer finns bara i matrisen.
3. **Kan en ny agent planera C3 och C2?** Ja. C2: matrisen pekar ut
   statuskontrollen, betalknappen, felmeddelandet, testet som måste vändas och
   dokumentet som beskriver det gamla beteendet. C3: ingångar, tidsdata,
   påverkat test och nu också beslutad tidsbestämning finns, inklusive
   offline-fallet (SC-BOOK-008). Utan piloten hade klocka, tidszon och
   gränsfallet sannolikt avgjorts under implementationen.
4. **Går varje regel att följa hela kedjan?** Beslut → regel → scenario →
   implementation: ja för alla fyra, och alla fyra är nu beslutade. Test:
   saknas helt för BR-BOOK-001 och för flera försök i BR-PAY-003.
5. **Vad saknas?** Tester enligt matrisens testluckor, den E2E-fil som
   arkitekturdokumentet hänvisar till men som inte finns, granskning av
   iOS-appen, samt svar på Q-PAY-002–005.
6. **Vad behövde hämtas ur kod?** Hur tid lagras (sluttid som text, oanvänt
   tidszonsfält), vilka vägar som sätter "utförd", att statusbyten kan köas
   offline, att beloppet hämtas vid betalningstillfället, hur webhooken hittar
   betalningen och hur ägarskapet kontrolleras. Lineage-datum hämtades ur Git.
7. **Minskar modellen gissningar och omarbete?** Preliminärt ja: sju öppna
   frågor och två kodrisker blev synliga före implementation, och tre av
   frågorna kunde beslutas direkt. Om det faktiskt sparar omarbete visar sig
   först när C3 eller C2 genomförs mot specifikationen.
8. **Behålla, förenkla, utöka eller överge?** Behålla i nuvarande lilla
   form och pröva den skarpt på C3 och C2: implementationen ska utgå från
   scenarierna och uppdatera matrisen. Utöka inte till fler domäner förrän
   det är gjort. Om tre filer per område känns tungt kan regler och scenarier
   slås ihop.
