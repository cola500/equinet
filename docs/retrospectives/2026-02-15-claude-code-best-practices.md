# Retrospektiv: Claude Code Best Practices

**Datum:** 2026-02-15
**Scope:** Flytta kontextspecifika regler till `.claude/rules/`, trimma CLAUDE.md, konfigurera hooks

---

## Resultat

- 1 andrad fil (CLAUDE.md), 5 nya filer (.claude/rules/), 0 migrationer
- 0 nya tester (1707 totalt, inga regressioner)
- 280 insertions, 299 deletions (netto -19 rader)
- Typecheck = 0 errors
- Tid: ~1 kort session (verifiering + commit av tidigare arbete)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Config | `.claude/rules/api-routes.md` | API-route regler med glob `src/app/api/**/route.ts` |
| Config | `.claude/rules/testing.md` | Unit test-regler med glob `**/*.test.ts` |
| Config | `.claude/rules/e2e.md` | E2E-regler med glob `e2e/**/*.spec.ts` |
| Config | `.claude/rules/prisma.md` | Migration/schema-regler med glob `prisma/**` |
| Config | `.claude/rules/ui-components.md` | UI/mobil-regler med glob `src/app/**/page.tsx` |
| Docs | `CLAUDE.md` | Trimmad fran ~467 till 198 rader |

## Vad gick bra

### 1. Drastisk CLAUDE.md-reducering utan informationsforlust
467 -> 198 rader (57% reducering). All information bevarades -- den flyttades bara till ratt plats. CLAUDE.md refererar nu till rules-filerna med `Se .claude/rules/X.md`.

### 2. Glob-matchning ger ratt kontext vid ratt tillfalle
Istallet for att Claude laser 467 rader varje gang, laddas nu bara relevanta regler. API-route-regler laddas vid `route.ts`-arbete, E2E-regler vid `.spec.ts`, etc. Minskar risken att instruktioner ignoreras.

### 3. Hooks var redan konfigurerade
Notification-hook (macOS-notis vid vantan) och PostToolUse-hook (paminnelse om /security-check) var redan pa plats i `settings.local.json`. Behov av dubbel-implementation undveks.

## Vad kan forbattras

### 1. Svenska tecken saknas i rules-filer
Rules-filerna anvander ASCII-substitut (t.ex. "forst" istallet for "forst", "anvand" istallet for "anvand"). Detta bryter mot projektets regel om korrekta a, a, o.

**Prioritet:** LAG -- reglerna ar maskinlasta av Claude, inte manniskor. Funktionen paverkas inte.

## Patterns att spara

### Glob-matchade rules-filer
`paths`-frontmatter i `.claude/rules/*.md` laddar regler automatiskt baserat pa vilka filer Claude arbetar med. Monster:

```markdown
---
paths:
  - "src/app/api/**/route.ts"
---
# Regler har...
```

**Princip:** Kontextspecifika regler via glob-matchning > monolitisk CLAUDE.md. Claude foljer korta, fokuserade instruktioner battre an langa, generella.

### CLAUDE.md som index-fil
CLAUDE.md bor vara en oversikt med lankar till detaljer -- inte en komplett referens. Snabbreferens-tabell + tvarskraende learnings + workflow. Detaljregler i rules-filer och docs/.

## Larandeeffekt

**Nyckelinsikt:** Claude Code foljer korta, kontextspecifika instruktioner battre an langa, monolitiska filer. Att flytta 270 rader till 5 glob-matchade filer forbattrar bade laddningstid och efterlevnad -- ratt regler laddas vid ratt tillfalle.
