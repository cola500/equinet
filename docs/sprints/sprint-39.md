---
title: "Sprint 39: Self-Testing v3 + messaging-polish"
description: "3 self-testing-gates från S38-lärdomar + liten messaging-UX-fix"
category: sprint
status: planned
last_updated: 2026-04-19
tags: [sprint, self-testing, ios, messaging, process]
sections:
  - Sprint Overview
  - Stories
  - Exekveringsplan
---

# Sprint 39: Self-Testing v3 + messaging-polish

## Sprint Overview

**Mål:** Stäng 3 process-gaps som S38-0-audit avslöjade, plus en liten messaging-UX-förbättring. Sprint-temat är "fånga incidenter innan de händer igen".

**Bakgrund:** S38 bevisade värdet av audit-first men också att S37-rollout missade iOS-verifiering. S39 åtgärdar processen så samma typ av incident inte återkommer.

**Princip (som S36):** Deklarativ regel → körbar gate. Varje story konverterar en incident-lärdom till en mekanisk check.

---

## Stories

### S39-0: ProviderNav ↔ NativeMoreView sync-gate

**Prioritet:** 0 (hög, direkt lärdom från S38-0)
**Effort:** 30-45 min
**Domän:** infra (`scripts/check-docs-updated.sh` — utöka)

S38-0 avslöjade att messaging lades till i `ProviderNav.tsx` (S35-2) men inte i `NativeMoreView.swift`. iOS-leverantörer kunde inte hitta messaging mellan S37-rollout och S38-2-fix. Gate som fångar sync-gap i commit-läge.

**Aktualitet verifierad:**
- Grep båda filerna för aktuella nav-poster → verifiera att de är synkade NU (post-S38-2)
- Bekräfta att hook-scriptet fortfarande aktivt

**Implementation:**

**Steg 1: Utöka `scripts/check-docs-updated.sh`**

Ny check-sektion:

```bash
# ProviderNav ↔ NativeMoreView sync-varning
# Mönstret: ProviderNav.tsx ändras men NativeMoreView.swift inte → varna
if git diff --cached --name-only | grep -q "^src/components/layout/ProviderNav.tsx$"; then
  NATIVE_CHANGED=$(git diff --cached --name-only | grep -c "^ios/Equinet/Equinet/NativeMoreView.swift$" || true)
  if [ "$NATIVE_CHANGED" = "0" ]; then
    echo "⚠️  Nav-sync-varning: ProviderNav.tsx ändras men NativeMoreView.swift inte."
    echo "   Om du lagt till/tagit bort nav-post i webb, synka till iOS-Mer-flik."
    echo "   Om detta är en intern ändring (badge, styling) som inte påverkar nav-poster: fortsätt."
    echo ""
  fi
fi
```

**Steg 2: Testa**
- Ändra ProviderNav.tsx ensamt → varning visas
- Ändra båda → ingen varning
- Ändra NativeMoreView ensamt → ingen varning (omvända riktningen är OK — iOS kan lägga till först)

**Steg 3: Dokumentera**

Lägg till i `.claude/rules/parallel-sessions.md` under "Delade filer"-sektionen:
- Not om att ProviderNav/NativeMoreView hör ihop och hooken varnar

**Acceptanskriterier:**
- [ ] Hook varnar vid ProviderNav utan NativeMoreView-ändring
- [ ] Hook varnar INTE vid bara NativeMoreView-ändring
- [ ] Hook varnar INTE vid ändring av båda
- [ ] Manuell test genomförd
- [ ] `npm run check:all` grön

**Reviews:** code-reviewer (trivial scripting, kan skippas)

**Arkitekturcoverage:** N/A.

---

### S39-1: Claude-hook paths → `$CLAUDE_PROJECT_DIR`

**Prioritet:** 1
**Effort:** 15 min
**Domän:** infra (`.claude/settings.json`)

Hooks i `.claude/settings.json` använder relativ path (`bash .claude/hooks/...`) och failar med "No such file or directory" när session körs i worktree eller annan cwd. Varningarna är non-blocking men störande.

**Aktualitet verifierad:**
- Läs `.claude/settings.json` → bekräfta relativ path
- Verifiera att `$CLAUDE_PROJECT_DIR` fungerar i hook-kontext

**Implementation:**

**Steg 1: Testa `$CLAUDE_PROJECT_DIR`**
- Skapa en test-hook med `echo "$CLAUDE_PROJECT_DIR"` och verifiera att den expanderas korrekt
- Om variabeln inte fungerar: använd absolut path (t.ex. `/Users/johanlindengard/Development/equinet/.claude/hooks/...`) — men det är fulare

**Steg 2: Uppdatera `.claude/settings.json`**
- Byt alla `bash .claude/hooks/X.sh` → `bash $CLAUDE_PROJECT_DIR/.claude/hooks/X.sh`
- Gäller alla hook-kommandon (sök efter alla förekomster)

**Steg 3: Verifiera**
- Trigga hook från huvudrepo → fortfarande fungerar
- Trigga hook från worktree → fungerar nu (eller: varning försvinner)

**Acceptanskriterier:**
- [ ] Alla hooks i `.claude/settings.json` använder `$CLAUDE_PROJECT_DIR`
- [ ] Hooks fungerar i huvudrepo (ingen regression)
- [ ] Hooks fungerar i worktree (eller varningen försvinner)
- [ ] `npm run check:all` grön

**Reviews:** code-reviewer (trivial config, kan skippas)

**Arkitekturcoverage:** N/A.

---

### S39-2: Rollout-checklista med iOS-audit-krav

**Prioritet:** 2
**Effort:** 30 min
**Domän:** docs (`docs/operations/` + `.claude/rules/autonomous-sprint.md`)

S37-rollout skedde utan iOS-audit → trasig upplevelse i 24h. Ny checklista kräver iOS-audit (likt S38-0) **innan** en feature-flag sätts `defaultEnabled: true`.

**Aktualitet verifierad:**
- Läs existerande `docs/operations/messaging-rollout.md` från S37-3 som mall
- Verifiera att iOS-specifika gaps finns som möjliga risker

**Implementation:**

**Steg 1: Skapa `docs/operations/feature-flag-rollout-checklist.md`**

Generisk mall med frontmatter + sektioner:
- **Pre-rollout** (MÅSTE göras före `defaultEnabled: true`):
  - Webb-audit genomförd (nytt eller befintligt rollout-doc)
  - **iOS-audit via mobile-mcp** eller motsvarande simulator-test
  - Verifiera deep-link-URL:er om push-integration finns
  - Verifiera att feature finns i både `ProviderNav.tsx` (webb) och `NativeMoreView.swift` (iOS) om det är provider-feature
- **Rollout**: flaggan flippas, deploy
- **Post-rollout observation**: Sentry, loggar, support

**Steg 2: Uppdatera `.claude/rules/autonomous-sprint.md`**

Lägg till i Review-matris:

```
| Story sätter feature-flag `defaultEnabled: true` | Obligatorisk rollout-checklista: docs/operations/feature-flag-rollout-checklist.md |
```

**Steg 3: Referera i `docs/operations/messaging-rollout.md`**

Uppdatera den till att peka på den nya generella checklistan som mall.

**Acceptanskriterier:**
- [ ] `feature-flag-rollout-checklist.md` skapad med frontmatter
- [ ] Review-matris uppdaterad
- [ ] `messaging-rollout.md` refererar till checklistan
- [ ] `npm run docs:validate` grön

**Reviews:** code-reviewer (docs-only)

**Arkitekturcoverage:** N/A.

---

### S39-3: Messaging optimistisk uppdatering vid sändning

**Prioritet:** 3
**Effort:** 30 min
**Domän:** webb (`src/components/customer/bookings/MessagingDialog.tsx` + `src/app/provider/messages/[bookingId]/page.tsx`)

MINOR-3 från S36-2-audit: meddelandet visas INTE omedelbart vid "Skicka" — 200ms fördröjning tills SWR revalidering. Känns sluggish. SWR `mutate` med optimistic update löser det.

**Aktualitet verifierad:**
- Bekräfta att MINOR-3 fortfarande finns (ingen annan har fixat det)
- Läs aktuell skicka-flöde i MessagingDialog och ThreadView

**Implementation:**

**Steg 1: Optimistisk uppdatering i MessagingDialog**

Vid skicka:
1. Generera optimistic message med temp-id
2. Uppdatera SWR-cache omedelbart via `mutate(newData, false)`
3. POST till API
4. Vid success: mutate med riktiga svaret (ersätter optimistic med server-versionen)
5. Vid fel: mutate tillbaka till ursprunglig + visa fel-toast

**Steg 2: Samma i ThreadView (leverantör)**

Kopiera mönstret från MessagingDialog. Extrahera gemensam hook om >15 rader duplikation.

**Steg 3: Tester**
- Manuell visuell verifiering: meddelandet visas direkt
- Fel-fallet: nätverksfel → meddelandet försvinner med fel-meddelande

**Acceptanskriterier:**
- [ ] Meddelandet visas omedelbart i UI vid Skicka-klick
- [ ] Vid fel: optimistic message rullas tillbaka + fel-toast visas
- [ ] Visuell verifiering i dev-miljö
- [ ] `npm run check:all` grön

**Reviews:** code-reviewer (UX-fix), cx-ux-reviewer (valfritt — verifiera att fel-feedback är tydlig)

**Arkitekturcoverage:** N/A.

---

## Exekveringsplan

```
S39-0 (30-45 min) -> S39-1 (15 min) -> S39-2 (30 min) -> S39-3 (30 min)
```

**Total effort:** ~2h. Oberoende — kan köras i valfri ordning.

## Definition of Done (sprintnivå)

- [ ] S39-0/1/2/3 merged
- [ ] `npm run check:all` grön
- [ ] Metrics-rapport genererad post-sprint (obligatoriskt per S33-0)
- [ ] Retro skriven
