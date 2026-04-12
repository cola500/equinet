---
title: "Retrospektiv: Claude Code Hooks -- Workflow-kontrollpunkter"
description: "6 PreToolUse-hooks som ger realtidspaminnelser vid API-routes, TDD, feature flags, Prisma, commits och E2E"
category: retrospective
status: active
last_updated: 2026-03-20
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan forbattras
  - Patterns att spara
  - Larandeeffekt
---

# Retrospektiv: Claude Code Hooks -- Workflow-kontrollpunkter

**Datum:** 2026-03-20
**Scope:** 6 Claude Code PreToolUse-hooks som ger kontextbaserade checklistor och paminnelser under utveckling

---

## Resultat

- 6 nya filer (`.claude/hooks/*.sh`), 1 andrad fil (`CLAUDE.md`), 1 andrad config (`.claude/settings.local.json`)
- Inga nya tester (shell-scripts, inte TypeScript)
- ~3703 befintliga tester (inga regressioner)
- Typecheck = 0 errors, Swedish check = 0 errors
- Tid: ~1 session (snabb implementation, valdokumenterad plan)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Hook | `.claude/hooks/api-route-check.sh` | Checklista vid API route-redigering (auth, rate limit, Zod, select) |
| Hook | `.claude/hooks/tdd-reminder.sh` | TDD-paminnelse nar testfil saknas (exkluderar UI-filer) |
| Hook | `.claude/hooks/feature-flag-check.sh` | Checklista vid nya feature flags |
| Hook | `.claude/hooks/prisma-migration-check.sh` | Paminnelse vid schemaandringar |
| Hook | `.claude/hooks/definition-of-done.sh` | DoD-checklista vid git commit |
| Hook | `.claude/hooks/e2e-check.sh` | Checklista vid E2E-testandringar |
| Config | `.claude/settings.local.json` | `hooks.PreToolUse` med Edit/Write + Bash matchers |
| Docs | `CLAUDE.md` | Snabbreferens + Automated Quality Gates uppdaterade |

## Vad gick bra

### 1. Valdokumenterad plan gjorde implementationen trivial
Planen specificerade exakt vilka hooks, vilka triggers, och vilka meddelanden. Implementationen blev ren kopiering fran spec till shell-scripts -- inga designbeslut under kodning.

### 2. Tydlig JSON-input-parsing med python3
Alla hooks använder `python3 -c "import sys,json; ..."` for att parsa `$TOOL_INPUT` JSON. Robust, tillgänglig pa macOS utan extra beroenden.

### 3. Smart exkludering i TDD-hooken
TDD-hooken exkluderar UI-filer (page.tsx, layout.tsx, components/*.tsx) och typ-filer -- bara logik-filer som bor ha tester triggar paminnelsen. Minskar brus.

### 4. Omedelbar verifiering med simulerad input
Varje hook testades med `echo '{"tool_input":{...}}' | bash .claude/hooks/X.sh` -- snabb feedback-loop utan att behova starta ny session.

## Vad kan forbattras

### 1. Hooks ar lokala (settings.local.json)
`.claude/settings.local.json` ar per-maskin, inte versionshanterad. Om hooks ska delas maste de in i `.claude/settings.json` istallet.

**Prioritet:** LAG -- Ensam utvecklare, men vart att tanka pa om teamet vaxer.

### 2. Inga automatiska tester for hooks
Shell-scripts har inget testramverk. Verifiering skedde manuellt med simulerad JSON-input. Vid ändring maste man komma ihag att testa manuellt.

**Prioritet:** LAG -- Hookarna ar enkla och andras sallan. Manuell testning racker.

### 3. TDD-hookens glob-matching ar begransad
Bash `[[ ]]` glob-matching klarar inte djupt nestade skvagar perfekt (t.ex. `src/app/api/a/b/c/d/route.ts` med 4+ nivaer). Fungerar for projektets nuvarande struktur men kan missa djupare routes.

**Prioritet:** LAG -- Nuvarande API-routes har max 3 nivaer.

## Patterns att spara

### Claude Code Hook-monster
1. Las `$TOOL_INPUT` JSON via stdin med `INPUT=$(cat)`
2. Extrahera falt med `python3 -c "import sys,json; ..."`
3. Matcha mot pattern med bash `[[ ]]` eller `grep -qE`
4. Skriv checklista till stdout (visas som `additionalContext`)
5. Exit 0 utan output = ingen paminnelse (tyst)

### Registrering i settings.local.json
```json
"hooks": {
  "PreToolUse": [
    { "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "bash .claude/hooks/X.sh" }] },
    { "matcher": "Bash", "hooks": [{ "type": "command", "command": "bash .claude/hooks/Y.sh" }] }
  ]
}
```

## Larandeeffekt

**Nyckelinsikt:** Claude Code hooks ar ett kraftfullt satt att kodifiera projektets arbetsflode som realtidspaminnelser. De fyller gapet mellan "vi vet hur vi borde gora" (CLAUDE.md, rules) och "vi gor det faktiskt" -- utan att blockera arbetsfloden. Nyckeln ar att hookarna ar paminnelser (stdout), inte blockerare (exit code != 0).
