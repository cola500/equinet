---
title: Repo cleanup -- inventering
description: Strukturerad inventering av filer och mappar som kan rensas, flyttas eller arkiveras
category: guide
status: current
last_updated: 2026-03-28
sections:
  - Säkert att ta bort
  - Troligen att ta bort
  - Filer att flytta
  - Filer att arkivera
  - Osäkert
  - Bättre rotstruktur
  - Top 10 cleanup-åtgärder
---

# Repo cleanup -- inventering

> Genomförd 2026-03-28. Ingen ändring gjord -- bara inventering.

---

## Säkert att ta bort

| Path | Varför | Risk |
|------|--------|------|
| `.DS_Store` (19 filer) | macOS-metadata, ingen projektfunktion | Ingen |
| `.tsbuildinfo` (3.7 MB) | Genererad TypeScript build-cache, återskapas vid build | Ingen |
| `.worktrees/` (tom mapp med bara .DS_Store) | Övergiven git worktree-mapp, tom | Ingen |
| `.playwright-mcp/*.log` (10 loggfiler) | Playwright MCP-konsolloggar från debugging-sessioner | Ingen |
| `e2e/__snapshots__/` (22 PNG-filer, ej tracked) | Visuella regression-snapshots, ej committade, återskapas | Ingen |

**Rekommendation**: Lägg till `.worktrees/`, `e2e/__snapshots__/` och `.playwright-mcp/` i `.gitignore` om inte redan gjort (`.playwright-mcp/` och `.worktrees/` finns redan). Ta bort `.DS_Store`-filer med `find . -name .DS_Store -delete`.

---

## Troligen att ta bort

| Path | Varför | Risk | Rekommendation |
|------|--------|------|----------------|
| `handoff.json` (root) | Duplicat -- finns även i `docs/handoff.json`. Root-versionen pekar på `feature/ios-feature-polish` branch (gammal) | Låg | TA BORT root-kopian |
| `handoff.md` (root) | Handoff-dokument för bug reports feature. Bör ligga i docs/ | Låg | FLYTTA till `docs/archive/` |
| `docs/project-structure-review.md` | Äldre strukturgenomgång, ersatt av denna review | Låg | ARKIVERA |
| `docs/architecture-improvement-plan.md` | Genomförd plan -- rollmigrering + wrapper nu klara | Låg | FLYTTA till `docs/archive/` |
| `docs/roles-migration-progress.md` | Migrering pausad med slutstatus. Historisk referens. | Låg | FLYTTA till `docs/archive/` |
| `.claude/plans/quiet-wishing-treasure.md` | Gammal plan (ej committed), oklart om aktiv | Låg | GRANSKA, troligen ta bort |
| `.claude/plans/atomic-shimmying-quilt.md` | Committed plan -- kolla om avslutad | Låg | GRANSKA |
| `.claude/plans/delegated-giggling-wirth.md` | Committed plan -- kolla om avslutad | Låg | GRANSKA |
| `skills-lock.json` (ej tracked) | Superpowers skill-lås, oklart om det genereras automatiskt | Låg | OSÄKERT |

---

## Filer att flytta

| Från | Till | Varför |
|------|------|--------|
| `__tests__/` (2 testfiler) | `src/` (co-located med kod) | Inkonsekvent: 99% av tester är co-located i `src/`, men 2 filer ligger i rot-`__tests__/` |
| `handoff.md` | `docs/archive/handoff-bug-reports.md` | Rotfil som borde vara i docs |
| `handoff.json` (root) | Ta bort (duplicat) | `docs/handoff.json` är den rätta |

---

## Filer att arkivera

### docs/ flat files som blivit historiska

Docs-roten har 22 lösa .md-filer. De flesta skapades under Q1 teknikgenomgång och har nu slutstatus. Kandidater att flytta till `docs/archive/`:

| Fil | Varför arkivera |
|-----|----------------|
| `docs/architecture-improvement-plan.md` | Plan genomförd |
| `docs/roles-migration-progress.md` | Migrering pausad med slutstatus |
| `docs/api-wrapper-plan.md` | Wrapper pausad med slutstatus |
| `docs/project-structure-review.md` | Ersatt av denna review |

### docs/ flat files som bör BEHÅLLAS

| Fil | Varför behålla |
|-----|----------------|
| `docs/INDEX.md` | Centralt navigeringsdokument |
| `docs/API.md` | API-dokumentation |
| `docs/architecture-review.md` | Aktuell arkitekturgenomgång |
| `docs/code-quality-review.md` | Aktuell kvalitetsgenomgång |
| `docs/changeability-review.md` | Aktuell förändringsanalys |
| `docs/booking-domain-review.md` | Aktuell domängenomgång |
| `docs/booking-refactoring-opportunities.md` | Aktiva rekommendationer |
| `docs/payment-domain-review.md` | Aktuell domängenomgång |
| `docs/payment-refactoring-opportunities.md` | Aktiva rekommendationer |
| `docs/refactoring-opportunities.md` | Aktiva rekommendationer |
| `docs/prisma-selects-review.md` | Aktuell referens |
| `docs/feature-flags-review.md` | Aktuell referens |
| `docs/special-routes-test-review.md` | Aktuell referens |
| `docs/route-orders-test-review.md` | Aktuell referens |
| `docs/technical-improvements-2026-q1.md` | Q1 sammanfattning |
| `docs/demo-mode.md` | Aktiv feature-dokumentation |
| `docs/demo-seed.md` | Aktiv referens |
| `docs/demo-go-no-go.md` | Demo-utvärdering |

---

## Osäkert / kräver mänskligt beslut

| Path | Fråga |
|------|-------|
| `.agents/skills/swiftui-pro/` (13 filer, ej tracked) | Superpowers skill -- behövs den? Ska den committas? |
| `.claude/skills/swiftui-pro` (symlink, ej tracked) | Relaterat till ovan |
| `.superpowers/brainstorm/` | Superpowers brainstorm-data -- rensas automatiskt? |
| `docs/superpowers/specs/` (2 design-specs) | Brainstorm-output -- ska de arkiveras eller behållas? |
| `docs/plans/` (20 filer) | Vilka planer är genomförda? Bör genomförda planer arkiveras? |
| `docs/ideas/` (4 filer) | Gamla idéer -- fortfarande relevanta? |
| `docs/handoff.json` | Handoff till annan utvecklare -- fortfarande aktuell? |
| `e2e/visual-regression.spec.ts` + `e2e/setup/visual-helpers.ts` (ej tracked) | Experiment? Ska de committas eller tas bort? |
| ~~`src/domain/payment/` (6 filer)~~ | ~~PaymentService -- committade i ff843e67~~ | KLAR |

---

## Förslag på bättre rotstruktur

### Nuvarande problem

1. **22 lösa .md-filer i docs/**: Svårt att navigera. Blandning av genomgångar, planer, reviews och sammanfattningar.

2. **2 testfiler i rot-`__tests__/`**: 99% av tester är co-located i `src/`. Inkonsekvent.

3. **Duplicerade handoff-filer**: `handoff.json` i rot + docs, `handoff.md` i rot.

4. **`middleware.ts` i rot**: Next.js-krav, kan inte flyttas. Men förvirrande bland config-filer.

### Föreslagen docs-struktur

```
docs/
├── INDEX.md                    # Navigering (behåll)
├── API.md                      # API-dokumentation (behåll)
├── architecture/               # Arkitektur (befintlig)
├── guides/                     # Guider (befintlig)
├── operations/                 # Operations (befintlig)
├── security/                   # Säkerhet (befintlig)
├── testing/                    # Testning (befintlig)
├── reviews/                    # NYT: samla genomgångar
│   ├── architecture-review.md
│   ├── code-quality-review.md
│   ├── changeability-review.md
│   ├── booking-domain-review.md
│   ├── payment-domain-review.md
│   ├── feature-flags-review.md
│   ├── prisma-selects-review.md
│   ├── special-routes-test-review.md
│   └── route-orders-test-review.md
├── improvements/               # NYT: förbättringsplaner + status
│   ├── refactoring-opportunities.md
│   ├── booking-refactoring-opportunities.md
│   ├── payment-refactoring-opportunities.md
│   └── technical-improvements-2026-q1.md
├── demo/                       # NYT: demo-relaterat
│   ├── demo-mode.md
│   ├── demo-seed.md
│   └── demo-go-no-go.md
├── plans/                      # Planer (befintlig)
├── retrospectives/             # Retros (befintlig)
├── archive/                    # Arkiv (befintlig)
└── ...
```

### Bedömning

Omstrukturering av docs/ ger ordning men kräver uppdatering av alla interna länkar (INDEX.md, CLAUDE.md, cross-references). **Medel insats, medel effekt.** Kan göras, men inte kritiskt.

---

## Top 10 viktigaste cleanup-åtgärderna

| # | Åtgärd | Effekt | Risk | Status |
|---|--------|--------|------|--------|
| 1 | ~~Committa PaymentService-filer~~ | ~~Aktiv kod~~ | -- | KLAR (ff843e67) |
| 2 | ~~Ta bort .DS_Store + .next/ + Playwright-loggar~~ | ~~Renare repo~~ | -- | KLAR (lokalt) |
| 3 | Committa docs-uppdateringar (testantal, länkar) | Korrekt dokumentation | Ingen | NÄSTA |
| 4 | Flytta 3 handoff-filer till `docs/archive/` | Renare rot + docs | Ingen | NÄSTA |
| 5 | Flytta `__tests__/` till co-located i `src/` | Konsekvent teststruktur | Låg | |
| 6 | Arkivera genomförda planer i docs/ | Tydligare docs-navigering | Låg | |
| 7 | Committa `.claude/hooks/` (6 workflow-skript) | Dela hooks med teamet | Ingen | |
| 8 | Organisera docs/ flat files i undermappar | Bättre navigering | Medel | |

---

## Kvarvarande root-cleanup

### handoff.json (root)

**Innehåll**: iOS feature polish handoff -- JSON med session-status (A-G), branch `feature/ios-feature-polish`, 70/70 tester.
**Duplicat?**: Nej -- `docs/handoff.json` har helt annat innehåll (E2E offline-härdning plan, markdown-format, inte ens giltig JSON).
**Referenser**: 1 retro refererar till "handoff.json" generellt, inte specifikt root-filen.
**Bedömning**: Gammal handoff från avslutad iOS-session. Inte aktivt använd.
**Risk**: Låg
**Rekommendation**: FLYTTA till `docs/archive/handoff-ios-feature-polish.json`

### handoff.md (root)

**Innehåll**: Bug reports feature handoff -- markdown med status, kvarvarande faser, projektkontext. Daterad 2026-03-02, status: wip.
**Duplicat?**: Nej, unikt innehåll.
**Referenser**: Inga aktiva (bara cleanup-docs refererar).
**Bedömning**: Gammal handoff, troligen inte längre aktuell. Bug reports-featuren ser implementerad ut.
**Risk**: Låg
**Rekommendation**: FLYTTA till `docs/archive/handoff-bug-reports.md`

### docs/handoff.json

**Innehåll**: E2E offline-härdning plan (trots .json-extension är det markdown).
**Bedömning**: Felnamnad fil (markdown i .json), gammal plan.
**Risk**: Låg
**Rekommendation**: FLYTTA till `docs/archive/handoff-e2e-offline.md`

### CLAUDE.md, NFR.md, README.md, docs/INDEX.md (modified)

Dessa 4 filer har pending ändringar från `/update-docs`-körningen:

| Fil | Ändring | Hör ihop med |
|-----|---------|-------------|
| CLAUDE.md | +1 rad snabbreferenslänk till teknikförbättringar Q1, uppdaterat datum | Teknikspåret generellt |
| NFR.md | Testantal: 3449 -> 3755, testfiler: 300 -> 311 | Teknikspåret generellt |
| README.md | Testantal: 3703 -> 3755, totalt 4076 -> 4128 | Teknikspåret generellt |
| docs/INDEX.md | +6 rader med nya docs-filer i arkitektur-sektionen | Teknikspåret generellt |

**Bedömning**: Alla 4 är korrekta uppdateringar som reflekterar genomfört arbete. Bör committas.
**Risk**: Ingen
**Rekommendation**: COMMITTA som `docs: update test counts and add Q1 review links`

---

## Rekommenderad nästa cleanup-åtgärd

**Säkert att göra nu (2 steg):**

1. **Committa de 4 doc-uppdateringarna** (CLAUDE.md, NFR.md, README.md, INDEX.md) -- korrekta ändringar som väntat sedan `/update-docs`

2. **Flytta 3 handoff-filer till docs/archive/**:
   - `handoff.json` (root) -> `docs/archive/handoff-ios-feature-polish.json`
   - `handoff.md` (root) -> `docs/archive/handoff-bug-reports.md`
   - `docs/handoff.json` -> `docs/archive/handoff-e2e-offline.md`

**Bör lämnas orört:**
- `.worktrees/` -- tom men gitignorerad, skadar inte
- Untracked hooks (`.claude/hooks/`) -- kräver separat beslut om de ska committas
- Untracked retros -- kräver separat beslut
- `skills-lock.json` -- oklart om genererad automatiskt

---

## Vilka 3 ger mest effekt först

1. **Committa docs-uppdateringar** -- testantal och Q1-länkar väntar på commit
2. **Flytta 3 handoff-filer till docs/archive/** -- renare rot, inga aktiva referenser
3. **Arkivera genomförda planer** -- minskar brus i docs/
