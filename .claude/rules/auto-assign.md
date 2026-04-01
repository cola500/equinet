---
title: "Auto-assign vid sessionsstart"
description: "Automatisk tilldelning av nasta story nar ingen explicit uppgift ges"
category: rule
status: active
last_updated: 2026-04-01
tags: [workflow, team, automation]
sections:
  - Regel
  - Steg
---

# Auto-assign vid sessionsstart

## Regel

Nar en session startar utan en specifik uppgift (t.ex. "kor", "fortsatt", "nasta"):

## Steg

1. Las `docs/sprints/status.md` -- vilka stories ar pending?
2. Las det aktiva sprint-dokumentet (lankat i status.md) -- vad ar detaljerna?
3. Valj nasta story enligt prioritetsordningen i sprint-dokumentet
4. Registrera dig i status.md Sessioner-tabell (roll, branch, story)
5. Skapa feature branch: `feature/<story-id>-<kort-beskrivning>`
6. Borja arbeta enligt stationsfloden (.claude/rules/team-workflow.md)

**Om alla stories ar klara eller blockerade:**
Rapportera till Johan: "Alla stories i [sprint] ar klara/blockerade. Vad vill du prioritera?"

**Om en story redan ar in_progress av en annan session:**
Hoppa over den. Ta nasta pending story. Rask ALDRIG en story fran en aktiv session.

**Om du ar osaker pa scope eller arkitektur:**
Las sprint-dokumentets detaljerade uppgifter. Om det inte racker -- fraga Johan.
