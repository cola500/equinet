---
title: "File / Folder Cleanup Discovery"
description: "Praktisk genomlysning av Equinets filstruktur för att hitta lågriskstädning. VS Code-röra vs git-röra särskilt skild på."
category: architecture
status: active
last_updated: 2026-05-06
tags: [cleanup, repo-hygiene, organization, low-risk]
related:
  - refactor-triggers.md
  - domain-boundaries-discovery.md
sections:
  - Sammanfattning
  - 1. Nuläge — toppnivå
  - 2. Cleanup-kandidater
  - 3. Do-not-touch
  - 4. Rekommenderad första cleanup-slice
  - 5. Saker att skjuta upp
---

# File / Folder Cleanup Discovery (2026-05-06)

> Inventering av filer/mappar som kan se rörigt ut i VS Code. Inga ändringar utförda. Mål: identifiera lågrisk-städning.

---

## Sammanfattning

Equinet-repot är **inte rörigt i git** — `.gitignore` täcker det mesta som skapar visuell röra (root-PNG:s, `.DS_Store`, `.tsbuildinfo`, `.worktrees`, `.playwright-mcp`). Men **VS Code visar dessa filer ändå**, vilket ger upplevelsen av röra.

| Kategori | Status |
|----------|--------|
| Git-spårad röra | Mestadels OK. Två huvudkandidater: 35 `docs/`-rotfiler där många är engångsreports, samt små "döda" docs-subfolders. |
| VS Code-visuell röra (gitignored, lokal) | 17 PNG-screenshots på root, en del `.DS_Store`, regenererbara `.tsbuildinfo`. Säker att radera lokalt. |
| Strukturella problem | Inga akuta. Subfoldrar i `docs/` är många men logiskt sorterade. |

**Mest värde per timme:** Lokal cleanup av gitignored junk (5 min, noll git-påverkan). Som andra slice: arkivera 5-10 engångs-review-docs från `docs/`-roten till `docs/archive/`.

---

## 1. Nuläge — toppnivå

### Root — filer (51 stycken)

| Kategori | Antal | Filer | Status |
|----------|-------|-------|--------|
| **Konfig** (måste finnas på root) | 18 | `package.json`, `tsconfig*.json`, `eslint.config.mjs`, `next.config.ts`, `vercel.json`, `vitest.config.ts`, `playwright.config.ts`, `prisma.config.ts`, `postcss.config.mjs`, `docker-compose.yml`, `middleware.ts`, `next-env.d.ts`, `components.json`, `sentry.{client,edge,server}.config.ts`, `package-lock.json`, `.versionrc.json` | ✓ Normalt |
| **Källor av sanning** (root-konvention) | 4 | `README.md`, `CLAUDE.md`, `NFR.md`, `CHANGELOG.md` | ✓ Normalt |
| **Övriga root-md** | 1 | `AGENTS.md` | ✓ Normalt (Codex-konvention) |
| **Env-filer** | 4 | `.env`, `.env.example`, `.env.local`, `.env.supabase` | ✓ Normalt (3 är gitignored) |
| **Dot-config** | 5 | `.gitignore`, `.npmrc`, `.vercelignore`, `skills-lock.json` | ✓ Normalt |
| **Generated/junk (gitignored)** | 3 | `.DS_Store`, `.tsbuildinfo`, `tsconfig.tsbuildinfo` | ⚠ Visuell röra |
| **Lös-PNG-skärmdumpar (gitignored)** | 17 | `admin-system.png`, `messaging-*.png` (8 st), `bookings-*.png` (2 st), `onboarding-spike-*.png` (2 st), m.fl. | ⚠ Visuell röra |

### Root — mappar

| Kategori | Mappar |
|----------|--------|
| **Standard Next.js/Node** | `node_modules/`, `.next/`, `public/`, `src/`, `coverage/` |
| **Konfig-data** | `.git/`, `.github/`, `.husky/`, `.vercel/`, `prisma/`, `supabase/`, `scripts/` |
| **Test** | `__tests__/`, `tests/`, `e2e/`, `playwright-report/`, `test-results/` |
| **Docs** | `docs/` |
| **Externa** | `ios/`, `load-tests/` |
| **Skills/agent-relaterat** | `.claude/`, `.agents/`, `.superpowers/`, `.playwright-mcp/`, `.worktrees/` |
| **Screenshot-dumpar** | `screenshots/`, `s13-6-screenshots/` |

### `docs/` — observation

22 subfolders (väl strukturerat) **plus 35 .md-filer direkt på root** (rörig). Många av root-filerna är engångs-rapporter ("*-review.md", "*-opportunities.md", "*-plan.md") som logiskt hör hemma i `docs/archive/` eller dedikerad subfolder.

| Subfolder | Filcount | Kommentar |
|-----------|----------|-----------|
| `docs/metrics/` | 276 | Mycket — mest dagsdata, OK |
| `docs/done/` | 204 | Story done-filer, historiskt OK |
| `docs/archive/` | 182 | Korrekt destination för engångsrapporter |
| `docs/retrospectives/` | 96 | Aktivt använt, OK |
| `docs/plans/` | 91 | Aktivt + vissa kvar efter implementation |
| `docs/sprints/` | 86 | Sprint-historik, OK |
| `docs/architecture/` | 19 | Inkluderar dagens 5 nya — relevant |
| `docs/operations/` | 17 | Aktivt — OK |
| `docs/api/` | 17 | Domain-API-docs, OK |
| `docs/ux-review/`, `docs/security/`, `docs/research/` | 12-16 vardera | OK |
| `docs/canea/` | 3 | Osäker — vad är detta? |
| `docs/dev/` | 1 | Bara 1 fil — möjlig kandidat för flytt eller arkivering |
| `docs/hackathons/` | 1 | Bara 1 fil — kandidat för arkivering |

---

## 2. Cleanup-kandidater

### A. Lokal junk (lägst risk, ej i git)

| Fil/mapp | Status | Varför rörig | Föreslagen åtgärd | Risk |
|----------|--------|--------------|--------------------|------|
| `.DS_Store` (root + nested) | gitignored | macOS-skräp | Radera lokalt med `find . -name ".DS_Store" -delete` | **Låg** — regenereras automatiskt om macOS vill ha tillbaka |
| `.tsbuildinfo` + `tsconfig.tsbuildinfo` | gitignored | TypeScript-cache | Radera lokalt — regenereras vid nästa `tsc` | **Låg** |
| 17 root-PNG-skärmdumpar | gitignored | Olika sprintars debug-screenshots | Radera lokalt **eller** flytta till `screenshots/` (befintlig mapp) | **Låg** för radering — 5 docs i `docs/archive/`, `docs/sprints/`, `docs/done/`, `docs/reports/` refererar dem (skulle bli broken links i historiska filer) |
| `.worktrees/` | gitignored | Verkar tom | Verifiera + radera om tom | Låg |
| `.playwright-mcp/` | gitignored | Cache från MCP-test | Behåll — används av tools | n/a |

### B. Strukturell — `docs/`-roten (engångs-rapporter)

35 `.md`-filer ligger på `docs/`-roten. Av dessa är några aktiva källor av sanning (INDEX.md, demo-mode.md, decision-log.md, roadmap.md, the-equinet-story.md), och resten är **engångs-rapporter** från olika audit-/review-runor.

#### Aktiva — behåll på root

| Fil | Skäl |
|-----|------|
| `docs/INDEX.md` | Index-doc, hör hemma på root |
| `docs/decision-log.md` | Aktivt referensdokument |
| `docs/roadmap.md` | Aktivt strategidokument |
| `docs/the-equinet-story.md` | Pitch-dokument, aktivt |
| `docs/demo-mode.md` | Aktiv operations-doc (men kunde flyttas till `docs/operations/`) |
| `docs/demo-seed.md` | Aktiv operations-doc |
| `docs/demo-go-no-go.md` | Aktiv för demo-readiness |
| `docs/equinet-technical-reset.md` | Skapad idag, status `superseded` (kan arkiveras senare) |

#### Engångsrapporter — kandidater för `docs/archive/`

| Fil | Karaktär | Föreslagen åtgärd | Risk |
|-----|----------|--------------------|------|
| `docs/api-wrapper-plan.md` | Plan från en sprint | Flytta till `docs/archive/plans/` | Låg |
| `docs/architecture-improvement-plan.md` | Plan | Flytta till `docs/archive/plans/` eller `docs/architecture/` | Låg |
| `docs/architecture-review.md` | Review | Flytta till `docs/archive/` | Låg |
| `docs/booking-domain-review.md` | Review | Flytta till `docs/archive/` | Låg |
| `docs/booking-refactoring-opportunities.md` | Opportunities | Flytta till `docs/archive/` | Låg |
| `docs/changeability-review.md` | Review | Flytta till `docs/archive/` | Låg |
| `docs/ci-decisions.md` | Decisions | Flytta till `docs/operations/` | Låg |
| `docs/code-quality-review.md` | Review | Flytta till `docs/archive/` | Låg |
| `docs/e2e-ci-policy-review.md` | Review | Flytta till `docs/archive/` | Låg |
| `docs/e2e-suite-review.md` | Review | Flytta till `docs/archive/` | Låg |
| `docs/feature-flags-review.md` | Review | Flytta till `docs/archive/` | Låg |
| `docs/ios-architecture-review.md` | Review | Flytta till `docs/archive/` (eller `docs/research/`) | Låg-medel — iOS-relaterat kan ha pekare |
| `docs/ios-code-quality-review.md` | Review | Flytta till `docs/archive/` | Låg |
| `docs/ios-executive-summary.md` | Sammanfattning | Flytta till `docs/archive/` | Låg |
| `docs/ios-refactoring-opportunities.md` | Opportunities | Flytta till `docs/archive/` | Låg |
| `docs/payment-domain-review.md` | Review | Flytta till `docs/archive/` | Låg |
| `docs/payment-refactoring-opportunities.md` | Opportunities | Flytta till `docs/archive/` | Låg |
| `docs/prisma-selects-review.md` | Review | Flytta till `docs/archive/` | Låg |
| `docs/project-structure-review.md` | Review | Flytta till `docs/archive/` | Låg |
| `docs/refactoring-opportunities.md` | Opportunities | Flytta till `docs/archive/` | Låg |
| `docs/repo-cleanup-review.md` | Review (känns relevant idag — meta!) | Flytta till `docs/archive/` om gammal | Låg |
| `docs/roles-migration-progress.md` | Migration progress | Flytta till `docs/archive/` om migration klar | Låg-medel — verifiera status |
| `docs/route-orders-test-review.md` | Review | Flytta till `docs/archive/` | Låg |
| `docs/special-routes-test-review.md` | Review | Flytta till `docs/archive/` | Låg |
| `docs/swiftui-review.md` | Review | Flytta till `docs/archive/` | Låg |
| `docs/technical-improvements-2026-q1.md` | Plan | Flytta till `docs/archive/plans/` om Q1 är passerad | Låg-medel — verifiera om aktivt |
| `docs/API.md` | Aggregerad API-doc — möjligen aktivt? | Behåll för nu, läs först | Medel — kan vara aktiv referens |

**Totalt: ~25 filer kan trolig flyttas till `docs/archive/`.**

### C. Små subfoldrar — möjliga arkiv

| Folder | Filer | Föreslagen åtgärd | Risk |
|--------|-------|--------------------|------|
| `docs/canea/` | 3 | Läs först (vet inte vad det är). Kanske arkivera | Medel — okänt innehåll |
| `docs/hackathons/` | 1 | Arkivera om historiskt | Låg |
| `docs/dev/` | 1 | Konsolidera med `docs/operations/` eller flytta till archive | Låg |

### D. Skärmdumps-mappar

| Mapp | Status | Förslag |
|------|--------|---------|
| `screenshots/` | Befintlig samling | Behåll |
| `s13-6-screenshots/` | Sprint-specifik på root | Flytta till `screenshots/sprint-13/` (rensa root) | Låg

### E. Test-mappar

| Mapp | Status | Förslag |
|------|--------|---------|
| `__tests__/` | gammal Vitest-konvention | Verifiera om används; merge till `src/__tests__/` om dubbelt | Medel — kontrollera vitest-config först |
| `tests/` | osäkert | Verifiera | Medel |
| `playwright-report/` | gitignored auto-output | Behåll, gitignored | n/a |
| `test-results/` | gitignored auto-output | Behåll | n/a |

---

## 3. Do-not-touch

Följande kan se rörigt ut men ska **inte** röras:

| Vad | Varför |
|-----|--------|
| `src/app/` (Next.js App Router) | Routes är konvention — flytt bryter routing |
| `src/components/` (komponentstruktur) | Imports kan brytas |
| `src/domain/` (DDD-Light) | Service-imports kan brytas; ändras enligt refactor-triggers, inte cleanup |
| `prisma/`, `prisma/migrations/` | Migrations är ordnade — flytt bryter migrate-history |
| `vercel.json`, `.vercel/` | Deploy-config — ändras via Vercel UI, inte filsystem |
| `supabase/config.toml`, `supabase/.temp/` | Lokal Supabase-state |
| `e2e/fixtures.ts`, `e2e/setup/` | Test-fixtures — beroende av path |
| `ios/` (hela trädet) | Xcode-projekt har egen path-känslighet |
| Generated files (`.next/`, `node_modules/`, `coverage/`, `tsconfig.tsbuildinfo`) | Regenereras |
| `.husky/` | Git hooks |
| `.claude/`, `.agents/`, `.superpowers/`, `skills-lock.json` | Agent-config |
| `package.json`, `package-lock.json` | NPM-state |

---

## 4. Rekommenderad första cleanup-slice

### Slice "Lokal VS Code visual cleanup" — lägst risk, störst kvalitetsvärde

**Mål:** Rensa endast lokala gitignored junk-filer som regenereras eller är kvarliggande från utvecklingsbeats. Inga git-ändringar, ingen kod, ingen commit.

**Tidsåtgång:** 2 min.

**Steg (du kör manuellt):**

```bash
# 1. Radera macOS-junk
find . -name ".DS_Store" -not -path "./node_modules/*" -not -path "./.git/*" -delete

# 2. Radera TypeScript-cache (regenereras vid nästa typecheck/build)
rm -f .tsbuildinfo tsconfig.tsbuildinfo

# 3. Verifiera tom .worktrees/
[ -z "$(ls -A .worktrees 2>/dev/null)" ] && rmdir .worktrees && echo "removed empty .worktrees" || echo ".worktrees not empty — leave alone"

# 4. Lös-PNG på root: bestäm
#    - Om alla är historiska debug-screenshots: radera lokalt (referenser i historiska sprint-docs blir broken-link, men det är OK för history)
#    - Om någon är aktivt använd i live-doc: flytta till screenshots/
ls *.png 2>/dev/null | head -5
# (manuell bedömning per fil)
```

**Vad som händer:**
- VS Code-explorer blir märkbart mindre rörig
- Inga commits, inga git-ändringar (allt är gitignored)
- Lätt att reverta (dessa filer regenereras eller var bara historisk debug)

**Risk:** **Låg.** Det är gitignored junk + historiska debug-screenshots.

---

## 5. Saker att skjuta upp (separata slices senare)

### Slice 2 — `docs/`-roten arkivering (lågrisk, gitspårat)

Flytta ~25 engångs-review/opportunities-docs till `docs/archive/`. Påverkar inte build/test. Behåll INDEX.md, decision-log.md, roadmap.md, demo-* och the-equinet-story.md på root.

**Innan:** Snabbgrep efter referenser från live-docs till de filer som flyttas. Om ingen referens → flytta. Om referens finns → uppdatera den eller behåll filen.

**Tidsåtgång:** 30 min audit + 30 min flytt + commit.

### Slice 3 — Konsolidera små subfoldrar

`docs/canea/`, `docs/hackathons/`, `docs/dev/` har 1-3 filer var. Antingen arkivera eller konsolidera till befintliga subfoldrar. Läs innehållet först.

**Tidsåtgång:** 15 min.

### Slice 4 — Sprint-13-screenshots-mappen

Flytta `s13-6-screenshots/` → `screenshots/sprint-13/`. Lägg till en README där om värdefullt.

**Tidsåtgång:** 5 min.

### Slice 5 — `__tests__/` vs `src/__tests__/`

Verifiera om root-`__tests__/`-mappen används av Vitest eller är död kod. Konsolidera om dubbel.

**Tidsåtgång:** 15 min audit.

### Inte slice — låt vara

- `src/`-strukturen (kräver Refactor Trigger Policy, inte cleanup)
- `prisma/`
- `ios/`
- Vercel/Supabase-config

---

## STOPP — inväntar Johan innan någon fil flyttas eller raderas

Säg:
- **"kör slice 1"** — jag guidar igenom de lokala radering-stegen (ingen commit, ingen git-impact)
- **"kör slice 2"** — vi planerar `docs/`-roten arkivering med audit av referenser först
- **"vänta, fråga om X"** — annan riktning
- **"committa rapporten"** — rapporten själv committas på `staging`-branch

**Inga ändringar utförda. Ingen kod ändrad. Inga filer flyttade. Inga commits gjorda.**
