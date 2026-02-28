# Retrospektiv: Namnbaserad migrationsspårning

**Datum:** 2026-02-28
**Scope:** Byta migrationsskript från COUNT(*)-baserad till namnbaserad jämförelse

---

## Resultat

- 12 ändrade filer, 2 nya filer (scripts/_lib.sh, scripts/migrate-status.sh)
- 0 nya tester (inga kodändringar i src/)
- 2783 totala tester (inga regressioner)
- Typecheck = 0 errors
- Tid: ~1 session (kort)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Scripts | `scripts/_lib.sh` | Ny delad hjälpfil med 6 funktioner (get_direct_url, is_localhost_url, require_docker, query_supabase, get_local_migration_names, get_remote_migration_names) |
| Scripts | `scripts/migrate-status.sh` | Nytt kommando: fullständig namnbaserad jämförelse med comm (pending, drift, misslyckade) |
| Scripts | `scripts/drift-check.sh` | Omskriven: COUNT(*) -> namnbaserad, visar specifika migrationsnamn |
| Scripts | `scripts/migrate-supabase.sh` | Omskriven: sourcar _lib.sh, listar exakt vilka migrationer som appliceras |
| Scripts | `scripts/deploy.sh` | Omskriven: sourcar _lib.sh, namnbaserad pending i post-deploy-guide |
| Scripts | `scripts/migrate-check.sh` | Utökad: sourcar _lib.sh, visar remote-migrationer om tillgängligt |
| Config | `package.json` | Nytt npm script: `migrate:status` |
| Docs | CLAUDE.md, README.md, DATABASE-ARCHITECTURE.md, PRODUCTION-DEPLOYMENT.md | Uppdaterade med nytt kommando och namnbaserad beskrivning |

## Vad gick bra

### 1. Ren extraktion utan regressioner
All duplicerad logik (URL-hämtning, Docker-check, migrationslisting) extraherades till `_lib.sh` utan att ändra beteendet i befintliga skript. Varje skript testades direkt efter omskrivning.

### 2. comm-verktyget för namnbaserad jämförelse
Unix `comm` var perfekt för detta: `comm -23` (pending), `comm -13` (drift), `comm -12` (synkade). Enkelt, robust, inga externa beroenden.

### 3. Snabb session med tydlig plan
Planen var väldefinierad med 7 faser och tydliga beroenden. Alla faser gick rakt igenom utan blockerare.

## Vad kan förbättras

### 1. Migrationsskripten saknar automatiserade tester
Bash-skripten testas bara manuellt (kör + inspektera output). Ett misstag i `_lib.sh` skulle kunna bryta alla 4 skript som sourcar den.

**Prioritet:** LAG -- Skripten körs sällan och verifieras visuellt. Automatiserade bash-tester (bats/shunit2) vore overkill för 6 skript.

## Patterns att spara

### Delad hjälpfil för bash-skript
`scripts/_lib.sh` med `source "$(dirname "$0")/_lib.sh"` i toppen av varje skript. Funktioner returnerar via `echo` (för subshell-capture) eller exit code (för booleaner). Mönstret eliminerar duplicering av URL-hämtning, Docker-check och migrationslistning.

### comm för mängdjämförelse i bash
`comm -23 <(sort a) <(sort b)` ger element som bara finns i a. Kräver sorterad input. Perfekt för att jämföra migrationsnamn, branch-listor, eller liknande set-operationer.

## Lärandeeffekt

**Nyckelinsikt:** COUNT(*)-baserad jämförelse döljer drift när migrationer appliceras utanför Prisma (db push, MCP apply_migration). Namnbaserad jämförelse med `comm` fångar alla avvikelser och är lika enkel att implementera.
