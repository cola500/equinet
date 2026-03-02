---
title: "Documentation Frontmatter Standard"
description: "YAML frontmatter-schema och valideringsregler for alla markdown-filer"
category: rule
status: active
last_updated: 2026-03-02
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

## Checklista: Ny .md-fil

- [ ] Frontmatter med alla obligatoriska falt
- [ ] `sections` matchar H2-rubriker
- [ ] `category` ar korrekt
- [ ] `depends_on` listar prereqs (om relevant)
- [ ] `related` listar korsreferenser (om relevant)
- [ ] Kor `npm run docs:validate`
