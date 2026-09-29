---
title: "Documentation Frontmatter Standard"
description: "YAML frontmatter-schema och valideringsregler for alla markdown-filer"
category: rule
status: active
last_updated: 2026-09-29
tags: [documentation, frontmatter, yaml, validation]
paths:
  - "docs/**/*.md"
  - "*.md"
  - "e2e/*.md"
sections:
  - YAML Frontmatter Schema
  - Validerade varden
  - Validering
  - "Checklista: Ny .md-fil"
  - Docs-matris
---

# Documentation Frontmatter Standard

## YAML Frontmatter Schema

Alla .md-filer i scope MASTE ha YAML frontmatter langst upp i filen.

### Obligatoriska falt

```yaml
---
title: "Dokumenttitel"
description: "En rads sammanfattning for snabb scanning"
category: architecture | operations | security | testing | guide | api | plan | retro | rule | idea | research | sprint | root
status: active | draft | archived | wip
last_updated: 2026-03-02
sections:
  - Rubrik 1
  - Rubrik 2
---
```

### Valfria falt

```yaml
tags: [offline, booking, pwa, prisma]
depends_on:
  - docs/architecture/database.md
related:
  - docs/guides/gotchas.md
```

### Specialfall

- `.claude/rules/*.md` behalter befintligt `paths`-falt och lagger till de nya falten
- `sections` listar H2-rubriker (## headings) i dokumentet

## Validerade varden

| Falt | Tillagna varden |
|------|----------------|
| `category` | `architecture`, `operations`, `security`, `testing`, `guide`, `api`, `plan`, `retro`, `rule`, `idea`, `research`, `sprint`, `root` |
| `status` | `active`, `draft`, `archived`, `wip` |
| `last_updated` | ISO-datum (YYYY-MM-DD) |

## Validering

Kor `npm run docs:validate` for att validera alla filer.

`npm run metrics:report` identifierar docs-matris-gap retroaktivt via M7-sektionen (se `scripts/check-docs-compliance.sh`).

## Checklista: Ny .md-fil

- [ ] Frontmatter med alla obligatoriska falt
- [ ] `sections` matchar H2-rubriker
- [ ] `category` ar korrekt
- [ ] `depends_on` listar prereqs (om relevant)
- [ ] `related` listar korsreferenser (om relevant)
- [ ] Kor `npm run docs:validate`

## Docs-matris

Vilka docs som MÅSTE uppdateras per story-typ. Återinförd 2026-09-29 (togs bort i `0772fdc9` men refererades fortfarande från Definition of Done i CLAUDE.md).

| Story-typ | Docs som MÅSTE uppdateras |
|-----------|----------------------------|
| Ny säkerhetsfunktion (MFA, auth, härdning) | README.md (Säkerhet), NFR.md (relevant NFR-rad), `docs/security/<feature>.md`, `docs/operations/incident-runbook.md` (om operativa implikationer), **hjälpartikel** om det påverkar slutanvändare |
| Ny feature med användarvänd UI | README.md (Implementerade Funktioner), `docs/guides/feature-docs.md`, **hjälpartikel** för relevant roll, **testing-guide** med test-scenario |
| Schema-ändring | `docs/architecture/database.md` |
| Ny ops-procedur (CI, deploy, monitoring) | `docs/operations/<procedur>.md` |
| Ny arkitekturkomponent | `docs/architecture/<komponent>.md`, CLAUDE.md snabbreferens |
| Ny gotcha eller mönster | CLAUDE.md Key Learnings eller `.claude/rules/<domän>-learnings.md` |
| Beteendeändring i befintlig feature | README.md + relevant feature-doc + **hjälpartikel** (om beteendet ändras synligt) + **testing-guide** (uppdatera relevant scenario) |
| Testantal ändrat med 50+ | README.md (Testning), NFR.md (Testning) |
| Borttagen feature | README.md (ta bort rad), `docs/guides/feature-docs.md`, **hjälpartikel** (ta bort), **testing-guide** (ta bort scenario) |

- **Hjälpartikel** = `src/lib/help/articles/<roll>/<slug>.md` (roll: `admin`, `customer`, `provider`)
- **Testing-guide** = `docs/testing/testing-guide.md`

**Regel:** PR-beskrivningen listar vilka docs som uppdaterats. Om inga -- motivera varför ("ren intern refactoring, ingen användarvänd ändring").

**Content ska matcha kod:** När en feature påverkar vad användaren ser eller gör är hjälpartiklar och testing-guide INTE valfria -- samma nivå som tester för ny logik.
