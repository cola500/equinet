---
title: "Plan S39-1: Claude-hook paths → $CLAUDE_PROJECT_DIR"
description: "Uppdatera .claude/settings.json så alla hooks använder $CLAUDE_PROJECT_DIR"
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Aktualitet verifierad
  - Approach
  - Filer som ändras
  - Risker
---

# Plan S39-1: Claude-hook paths → $CLAUDE_PROJECT_DIR

## Aktualitet verifierad

**Kommandon körda:**
- Läst `.claude/settings.json` → bekräftat att alla 10 hook-kommandon använder relativ path `bash .claude/hooks/X.sh`
- `.claude/` är spårat i git (inte i .gitignore) → borde finnas i worktrees

**Resultat:** Relativ path används i alla hooks. `$CLAUDE_PROJECT_DIR` sätts av Claude Code-runtime (inte i vanligt shell). Ändringen behövs för att hooks ska fungera oavsett Claude Codes cwd-kontext.

**Beslut:** Fortsätt — implementera med `$CLAUDE_PROJECT_DIR`.

## Approach

Ersätt `bash .claude/hooks/X.sh` med `bash $CLAUDE_PROJECT_DIR/.claude/hooks/X.sh` i alla 10 hook-kommandon i `.claude/settings.json`.

`$CLAUDE_PROJECT_DIR` sätts av Claude Code-runtime och pekar på projektets rot oavsett var sessionen körs ifrån.

## Filer som ändras

1. `.claude/settings.json` — alla hook-kommandon uppdateras

## Risker

- Om `$CLAUDE_PROJECT_DIR` inte sätts i Claude Codes hook-runtime → hooks failar. Men detta är dokumenterat beteende i Claude Code.
- Ingen risk för regression i normala sessioner (variabeln sätts alltid i projekt-kontext).
