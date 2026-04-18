---
title: "S36-4 Plan: Docs-matris compliance-check post-merge"
description: "Script som retroaktivt flaggar done-filer där påstådda docs-uppdateringar avviker från Docs-matrisen"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Aktualitet verifierad
  - User story
  - Påverkade filer
  - Approach
  - Arkitekturcoverage
  - Risker
---

# S36-4 Plan: Docs-matris compliance-check post-merge

## Aktualitet verifierad

**Kommandon körda:**
- `ls scripts/` → `generate-metrics.sh` finns, inga M7 ännu
- `grep -l "Docs uppdaterade\|Ingen docs-uppdatering" docs/done/*.md | wc -l` → 50 done-filer har sektionen
- `ls docs/done/ | wc -l` → 144 done-filer totalt

**Resultat:** generate-metrics.sh finns och kan utökas. 50 done-filer har Docs-sektion, resten saknar (äldre stories). Scriptet bör köras på filer med sektionen och skippa äldre.

**Beslut:** Fortsätt.

## User story

Som tech lead vill jag se en retroaktiv rapport över stories där "Ingen docs-uppdatering" påstods men typen borde ha krävt docs, så att jag kan se om Docs-matrisen följs.

## Påverkade filer

1. `scripts/check-docs-compliance.sh` — nytt script (fristående körning)
2. `scripts/generate-metrics.sh` — ny M7-sektion
3. `.claude/rules/documentation.md` — not om retroaktiv check

## Approach

### Story-typ-detektion (pragmatisk)

Keyword-matching i done-filens titel + innehåll:

| Nyckelord | Story-typ | Förväntade docs |
|-----------|-----------|-----------------|
| API route / endpoint / ny route | api-route | security-review kördes ELLER explicit motivering |
| UI / komponent / sida / vy / flöde | ui-feature | hjälpartikel OCH/ELLER testing-guide ELLER motivering |
| auth / MFA / RLS / säkerhet / security | security | NFR.md ELLER docs/security/ ELLER motivering |
| schema / migration / prisma | schema | docs/architecture/database.md ELLER motivering |
| audit / UX-audit / verifiering | audit | retrospecktiv-fil förväntas |
| docs / process / regel / config | docs-only | N/A (skip) |

### Gap-detektion

1. Läs done-fil → extrahera "Uppdaterade:"-rad ELLER "Ingen docs-uppdatering"-rad
2. Om "Ingen docs-uppdatering" OCH story-typ = ui-feature → flagga GAP
3. Om "Ingen docs-uppdatering" OCH story-typ = security → flagga GAP
4. Om story-typ = docs-only → SKIP

**Notering:** Perfekt precision inte krävt. Falska positiver OK om ≤50%.

### Integration i generate-metrics.sh

Lägg till `m7_docs_compliance()` anrop + sektion i rapporten, precis som M6 → M7.

## Arkitekturcoverage

N/A — ingen tidigare designstory.

## Risker

- **Regex för bred:** Många stories nämner "UI" i broad terms (t.ex. "ingen UI-ändring"). Risk för falska positiver. Mildring: kräv konkret keyword-kombination, inte ensamma ord.
- **Äldre done-filer:** Pre-S31 done-filer saknar Docs-sektion. Skip dem säkert.
