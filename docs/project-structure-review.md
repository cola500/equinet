---
title: Project Structure Review
description: Inventering av projektstruktur med fokus pa cleanup-mojligheter
category: operations
status: active
last_updated: 2026-03-26
sections:
  - Mappar att ta bort
  - Mappar att sla ihop eller flytta
  - Filer att ta bort
  - Filer att flytta
  - Dokumentation att rensa
  - Forslag pa battre struktur
---

# Project Structure Review

Inventering 2026-03-26. Projektstruktur ar overlag UTMARKT (9/10).
Detta dokument listar mojliga forbattringar.

---

## Mappar att ta bort

### Sakert att ta bort

| Sökväg | Storlek | Varfor | Risk |
|--------|---------|--------|------|
| `build/` | 187 MB | Xcode iOS build-cache. Aterskapas automatiskt. | Lag |
| `.next/` | 864 MB | Next.js build-cache. Aterskapas med `npm run build`. | Lag |
| `test-results/` | 4 KB | Gamla Playwright-testresultat. Aterskapas vid testkörning. | Lag |
| `playwright-report/` | 524 KB | Gammal Playwright HTML-rapport. Aterskapas vid testkörning. | Lag |

**Rekommendation:** TA BORT alla. Sparar ~1 GB. Kommando: `rm -rf build .next test-results playwright-report`

### Behover beslut

| Sökväg | Storlek | Varfor | Risk |
|--------|---------|--------|------|
| `.claude/worktrees/flamboyant-shtern/` | 13 MB | Auto-namngiven Claude Code worktree. Branch `claude/flamboyant-shtern` existerar lokalt men pekar pa samma commit som main. Troligen overgiven. | Medel |
| `.worktrees/ios-native-migration/` | 1.8 GB | Git worktree for iOS-migrering. Branch `feature/ios-native-migration` finns bade lokalt och pa remote. | Medel |

**Rekommendation:**
- `flamboyant-shtern`: Troligen saker att ta bort. Kör `git worktree remove .claude/worktrees/flamboyant-shtern` + `git branch -d claude/flamboyant-shtern`.
- `ios-native-migration`: BEHALL om arbetet fortfarande pagar. Om iOS-migreringen ar klar, kör `git worktree remove .worktrees/ios-native-migration`.

---

## Mappar att sla ihop eller flytta

| Fran | Till | Varfor | Risk |
|------|------|--------|------|
| `genomlysningar/` (2 filer) | `docs/architecture/` | Arkitekt- och UX-genomlysningar hor hemma i docs. `arkitektgenomlysning.md` passar i architecture/, `UX-GENOMLYSNING.md` i en ny `docs/ux/` eller i `docs/product-audit/`. | Lag |
| `ux-review/` (16 PNG) | `docs/ux-review/` | Screenshots fran UX-granskning. Bor ligga under docs/ for konsistens. | Lag |
| `features/` (1 fil) | `docs/plans/` | `rutt-baserad-levering.md` ar en feature-spec. Hor hemma bland planer. | Lag |
| `security-reports/` (5 filer) | `docs/security/` | Pentest-rapport och ZAP-skanningar. docs/security/ finns redan. | Lag |

**Rekommendation:** Flytta vid tillfalle. Inte bråttom men ger renare rotstruktur.

---

## Filer att ta bort

### Sakert att ta bort

| Fil | Varfor | Risk |
|-----|--------|------|
| `.DS_Store` | macOS metadata. Bor vara i .gitignore (ar det redan). | Lag |
| `pw-minimal.config.ts` | Experimentell minimal Playwright-config (562 bytes). Inte refererad i package.json eller scripts. | Lag |

### Behover beslut

| Fil | Varfor | Risk |
|-----|--------|------|
| `handoff.md` + `handoff.json` | Projektoverlämningsdokument. Kan vara relevant om projektet överlämnas, men annars overflödig. | Medel |

**Rekommendation:**
- `pw-minimal.config.ts`: TA BORT
- `.DS_Store`: TA BORT (aterskapas av macOS men bor inte committas)
- `handoff.*`: BEHALL tills vidare -- kan vara varde vid framtida overlamning

---

## Filer att flytta

Inga filer behover flyttas just nu. Alla kodfiler ligger pa ratt plats.

---

## Dokumentation att rensa

### Demo-rapporter (konsolidera)

Vi har 4 demo-rapporter fran samma session:

| Fil | Innehall |
|-----|----------|
| `docs/demo-flow-issues.md` | Round 0 -- utan demo mode |
| `docs/demo-flow-issues-demo-mode.md` | Round 1 -- demo mode utan seed |
| `docs/demo-flow-issues-demo-mode-round-2.md` | Round 2 -- demo mode + seed |
| `docs/demo-go-no-go.md` | Slutgiltig genomgang |

**Rekommendation:** Arkivera round 0-2 till `docs/archive/`. Behall bara `demo-go-no-go.md` som aktuellt dokument. `demo-seed.md` och `demo-mode.md` ar fortsatt relevanta.

### Retrospectives (redan valskott)

41 konsoliderade i `docs/retrospectives/`, 67 rå i `docs/archive/retrospectives-raw/`. Strukturen ar bra. Inget att rensa.

### Plans (kontrollera aktualitet)

13 filer i `docs/plans/`. Nagra kan vara fardiga:

| Fil | Troligen klar? |
|-----|----------------|
| `bdd-payment-refactor.md` | Ja -- payment-kod finns i src/domain/payment/ |
| `e2e-test-review.md` | Kanske -- E2E-infrastruktur ar pa plats |
| `native-ios-analysis.md` | Ja -- iOS native-rebuild ar i gang |

**Rekommendation:** Ga igenom planer vid nasta sprint-planering. Flytta klara planer till `docs/archive/`.

---

## Forslag pa battre struktur

### Nuvarande rotstruktur (30+ poster)

```
equinet/
├── src/          # App-kod
├── prisma/       # Databas
├── docs/         # Dokumentation
├── e2e/          # E2E-tester
├── ios/          # iOS-app
├── scripts/      # Byggskript
├── public/       # Statiska tillgangar
├── load-tests/   # Lasttester
├── genomlysningar/  # <-- bor vara i docs/
├── ux-review/       # <-- bor vara i docs/
├── features/        # <-- bor vara i docs/plans/
├── security-reports/ # <-- bor vara i docs/security/
├── build/           # <-- genererad, ta bort
├── .next/           # <-- genererad, ta bort
├── ...config filer
```

### Föreslagen rotstruktur (renare)

```
equinet/
├── src/          # App-kod
├── prisma/       # Databas
├── docs/         # ALL dokumentation (inkl genomlysningar, ux, security)
├── e2e/          # E2E-tester
├── ios/          # iOS-app
├── scripts/      # Byggskript
├── public/       # Statiska tillgangar
├── load-tests/   # Lasttester
├── ...config filer
```

**Skillnad:** 4 farre mappar i roten genom att konsolidera dokumentation under `docs/`.

### Gitignore-tillagg (forslag)

```gitignore
# Xcode build cache
/build/

# macOS
.DS_Store
```

`build/` och `.DS_Store` bor ignoreras for att förhindra att de committas av misstag.

---

## Sammanfattning

| Kategori | Antal | Åtgärd |
|----------|-------|--------|
| Mappar att ta bort (säkert) | 4 | `rm -rf build .next test-results playwright-report` |
| Mappar att flytta | 4 | genomlysningar, ux-review, features, security-reports -> docs/ |
| Filer att ta bort | 2 | `.DS_Store`, `pw-minimal.config.ts` |
| Worktrees att kontrollera | 2 | flamboyant-shtern (troligen ta bort), ios-native-migration (behall?) |
| Demo-docs att arkivera | 3 | Round 0-2 rapporter -> docs/archive/ |
| Diskbesparing | ~2 GB | Framst build-cachar och worktrees |
