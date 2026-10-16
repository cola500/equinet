---
title: "Agentöverlämningar"
description: "Tillfällig kommunikationsyta mellan Claude Code och Codex"
category: guide
status: active
last_updated: 2026-10-16
tags: [agents, collaboration, handoff]
sections:
  - Kanoniska och tillfälliga källor
  - Regler
  - Sekventiellt och parallellt arbete
  - Obligatoriska rubriker
  - Städning vid sprintavslut
---

# Agentöverlämningar

Den här katalogen är en liten kommunikationsyta mellan Claude Code och Codex.
Den ersätter inte Git, pull requests, `docs/sprints/status.md` eller
`docs/sprints/backlog.md`.

## Kanoniska och tillfälliga källor

| Vad | Var det bor | Typ |
|---|---|---|
| Produktstatus och prioritering | `docs/sprints/status.md`, `docs/sprints/backlog.md` | kanonisk |
| Sprintens upplägg, slutsatser och slutrapport | sprintdokumentet i `docs/sprints/` | kanonisk |
| Kod, beslut och historik | Git och pull requests | kanonisk |
| Överlämning mellan agenter | `claude-code.md`, `codex.md` i den här katalogen | tillfällig |

Agentfilerna får aldrig vara enda platsen för ett beslut eller en slutsats.
Sådant flyttas till sprintens slutrapport innan sprinten avslutas.

## Regler

1. Läs båda överlämningsfilerna innan nytt arbete påbörjas.
2. Claude Code skriver bara i `claude-code.md`.
3. Codex skriver bara i `codex.md`.
4. Håll varje fil på cirka 40 rader. Allt längre hör hemma i sprintdokumentet.
5. Märk verifieringar med evidensmarkör: `[läst]` för det som granskats i
   dokument eller kod, `[körd]` för det som faktiskt körts (test, kommando,
   kontroll i miljö). Omärkt påstående räknas som overifierat.
6. Produktstatus och prioriteringar uppdateras i de kanoniska projektfilerna,
   inte här.
7. Hemligheter, kunduppgifter och känsliga produktionsdata får inte skrivas här.
8. Vid varje stoppunkt där Johan behöver ta ställning ska avsnittet
   "Beslut eller frågor till Johan" innehålla en kort beslutsruta:
   1. Vad är verifierat?
   2. Vad är fortfarande osäkert?
   3. Vilket beslut behövs nu?
   4. Vad rekommenderar agenterna, uttryckt i vanlig svenska?
   5. Vad kan fortsätta utan beslutet?

   Om inget beslut behövs räcker det att skriva det tydligt; skapa inte en tom
   beslutsruta. Claude Code skriver beslutsrutan och Codex kontrollerar den vid
   granskning.

## Sekventiellt och parallellt arbete

- **Standard i samma checkout: sekventiellt.** En agent arbetar åt gången.
  Det följer `AGENTS.md`. Överlämningsfilerna är då synliga för båda direkt,
  även ocommittade.
- **Parallellt arbete är ett undantag** och följer
  `.claude/rules/parallel-sessions.md`: separata worktrees och branches,
  separerade filområden. En worktree ser inte den andras ocommittade filer,
  så en agent läser då den andras överlämning via Git efter commit.

## Obligatoriska rubriker

- Senast uppdaterad
- Aktuell uppgift
- Branch eller worktree
- Status
- Gjort
- Verifierat
- Beslut eller frågor till Johan
- Rekommenderat nästa steg
- Rör inte
- Relaterade filer och PR

## Städning vid sprintavslut

1. Varje agent nollställer sin egen fil: status `ledig`, övriga rubriker tomma
   utom nästa steg. Ingen agent nollställer den andras fil.
2. Innan slutet flyttas allt som ska bevaras (beslut, fynd, retrolärdomar) till
   sprintens slutrapport eller en retro.
3. Slutrapportens ägare verifierar att båda filerna är återställda innan PR:n
   slutförs.
4. Filerna committas på sprintens feature branch som övrig dokumentation.
