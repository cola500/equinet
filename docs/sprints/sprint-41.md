---
title: "Sprint 41: Messaging-ordning + review-lärdom"
description: "Fix blocker från S40-3-miss + formalisera review-manifest-spike"
category: sprint
status: planned
last_updated: 2026-04-19
tags: [sprint, messaging, review-process, self-testing]
sections:
  - Sprint Overview
  - Stories
  - Exekveringsplan
---

# Sprint 41: Messaging-ordning + review-lärdom

## Sprint Overview

**Mål:** Fixa chat-konventions-blocker som S40-3 cx-ux-reviewer missade, och formalisera lärdomen så framtida review-misser mot domän-mönster blir sällsynta.

**Bakgrund:** S40-3 cx-ux-reviewer körde before/after-jämförelse av SmartReplyChips och gav "Godkänt för rollout" — men missade att hela tråd-vyn renderar nyast överst (API:t returnerar `orderBy: desc`, klient reversar inte). Bruten chat-metafor. Messaging är `default: true` sen S37 → risk i prod (tur: noll real-användning än).

**Detta är andra reviewer-miss mot domän-mönster:**
- S35-1: security-reviewer missade arkitekturcoverage (→ S36-0/S36-1 löste det)
- S40-3: cx-ux-reviewer missade chat-konvention

Två data-punkter → motiverar formell review-manifest-spike (första bevis att vi behöver det).

---

## Stories

### S41-0: Fix message-ordning (blocker)

**Prioritet:** 0 (blocker — bruten chat-UX i prod)
**Effort:** 20-30 min
**Domän:** webb (`src/app/provider/messages/[bookingId]/page.tsx` + `src/components/customer/bookings/MessagingDialog.tsx`)

Server returnerar meddelanden i DESC-ordning (nyast först) för effektiv cursor-paginering. Klient renderar utan reverse → nyast överst visuellt. Chat-konvention: nyast NEDERST (scrolla upp = bakåt i tiden).

**Aktualitet verifierad:**
- Grep `orderBy.*desc` i `PrismaConversationRepository.ts` → bekräfta att server-logik ska behållas
- Verifiera att både ThreadView (leverantör) OCH MessagingDialog (kund) har samma bug

**Implementation:**

**Steg 1: Klient-reverse i båda render-punkter**

ThreadView (`page.tsx:155` ungefär):
```tsx
{[...messages].reverse().map((msg) => ...)}
```

MessagingDialog: samma pattern — `[...messages].reverse()` före `.map()`.

**Steg 2: scrollIntoView-logik bekräftas**

Efter reverse är `bottomRef` faktiskt vid nyaste meddelandet. Verifiera att `useEffect` fortfarande skrollar till rätt ställe.

**Steg 3: Unit-test**

Lägg till test i lämplig fil: "messages renderas i kronologisk ordning (äldsta överst, nyaste nederst)". Mocka messages-array med 3 meddelanden i desc-ordning, verifiera att DOM renderar i asc.

**Steg 4: Visuell verifiering**

Playwright MCP: öppna tråd med ≥3 meddelanden. Bekräfta att äldsta är längst upp, nyaste är längst ner, scroll-position är vid nyaste vid load.

**Acceptanskriterier:**
- [ ] `[...messages].reverse()` i både ThreadView och MessagingDialog
- [ ] Unit-test "kronologisk ordning" grön
- [ ] Playwright-screenshot bekräftar korrekt ordning (≥3 meddelanden)
- [ ] `scrollIntoView(bottomRef)` fortsätter att skrolla till nyast (nederst)
- [ ] `npm run check:all` grön

**Reviews:** code-reviewer (enkel fix), cx-ux-reviewer — **explicit prompt:** "Verifiera chat-konventioner: nyast nederst, scroll-to-bottom vid nytt meddelande, kronologisk ordning."

**Arkitekturcoverage:** N/A.

---

### S41-1: Retro-miss-analys + review-manifest-spike

**Prioritet:** 1
**Effort:** 30-45 min
**Domän:** docs (`docs/retrospectives/` + `.claude/rules/`)

Dokumentera varför cx-ux-reviewer missade meddelande-ordningen i S40-3 och skissa struktur för review-manifest (från S37-villkorlig-story-idé).

**Aktualitet verifierad:**
- Läs `2026-04-19-smart-replies-ux-review.md` (S40-3 utlåtande) — bekräfta att ordning inte nämns
- Kolla om `review-manifest.md` redan finns i `.claude/rules/` (om ja, story är redan gjord)

**Implementation:**

**Steg 1: Miss-analys (retro-fil)**

Skapa `docs/retrospectives/2026-04-19-review-miss-analysis.md` med:
- **Vad missades:** meddelande-ordning (nyast överst) i S40-3
- **5 Whys:**
  1. Varför missade reviewern? → Fokuserade på chip-UI, inte surrounding context
  2. Varför fokuserade reviewern på chips? → S40-3-briefen handlade om chips before/after
  3. Varför täckte briefen inte chat-konventioner? → Vi har ingen standard "kom-ihåg"-lista per domän
  4. Varför ingen lista? → Domän-specifika review-krav är inte formaliserade
  5. Varför inte formaliserade? → Vi har skissat men inte byggt (S37-villkorlig story)
- **Rotorsak:** review-manifest per story-typ/domän saknas
- **Skillnad mot S35-1-miss:** den var design→implementation coverage (S36-0 löste det). Denna är domän-konventioner (nytt område).
- **Gemensam klass:** "reviewer ser det den uttryckligen kollar mot" — redan adresserat av S36-1 metacognition. Men metacognition räcker inte om reviewern inte vet VAD den ska kolla efter i en viss domän.

**Steg 2: Review-manifest-skiss**

Skapa `.claude/rules/review-manifest.md` (draft) med:
- Syfte: deklarativ lista av vad som ska kollas per story-typ/domän
- Struktur-exempel:
  ```markdown
  ## Messaging-komponent
  Varje messaging-UI-review ska verifiera:
  - [ ] Meddelanden renderas i kronologisk ordning (nyast nederst)
  - [ ] scrollIntoView pekar på nyaste efter nytt meddelande
  - [ ] Keyboard-hantering: tråd skrollar upp när tangentbord öppnas
  - [ ] Read-markering sker vid first load, inte varje revalidering
  - [ ] Svenska å/ä/ö renderas korrekt
  - [ ] Touch-targets ≥44pt
  ```
- Andra story-typer (API-route, iOS-feature, auth) med varsin checklista
- **Integration:** autonomous-sprint.md review-matris pekar på relevant manifest-sektion

**Steg 3: Integration i S41-0**

Under S41-0:s cx-ux-reviewer-run: använd messaging-sektionen från review-manifest-drafted. Första realtidstest av manifestet.

**Acceptanskriterier:**
- [ ] Miss-analys-retro skriven med 5 Whys
- [ ] `review-manifest.md` draft skapat med messaging-sektion
- [ ] Minst 3 story-typer har checklistor (messaging, API-route, iOS-komponent)
- [ ] S41-0:s cx-ux-reviewer-brief refererar till messaging-checklistan
- [ ] Utvärderings-kriterier: efter nästa messaging-story, bekräfta om manifestet förhindrade en miss

**Reviews:** code-reviewer (docs-only, kan skippas)

**Arkitekturcoverage:** N/A.

---

### S41-2: Chat-convention-check hook (valfri)

**Prioritet:** 2 (valfri, beror på tid)
**Effort:** 15-30 min
**Domän:** infra (pre-commit hook eller post-merge-M-rapport)

Programmatic check: om nya messaging-komponenter skapas utan `.reverse()` eller `scroll-to-bottom`-logik, varna. Kan fånga re-introduktioner.

**Aktualitet verifierad:**
- Verifiera att S41-0 är mergad
- Bekräfta att `check-docs-updated.sh` fortfarande aktivt

**Implementation:**

Utöka `scripts/check-docs-updated.sh` eller skapa ny hook:

```bash
# Messaging chat-konvention-check
# Om ny/ändrad file matchar messaging-render-pattern: varna om missing reverse
STAGED=$(git diff --cached --name-only | grep -E "provider/messages|customer/bookings.*Messaging")
if [ -n "$STAGED" ]; then
  for FILE in $STAGED; do
    if git diff --cached "$FILE" | grep -q "messages\.map"; then
      if ! git diff --cached "$FILE" | grep -q "reverse\(\)"; then
        echo "⚠️  Messaging-konvention-varning: $FILE använder messages.map utan .reverse()"
        echo "   Chat-konvention: nyast nederst. Kolla att du reverserar eller"
        echo "   hämtar i asc-ordning. Om avsiktligt (t.ex. unread-preview): fortsätt."
      fi
    fi
  done
fi
```

**Acceptanskriterier:**
- [ ] Hook varnar vid messages.map utan reverse
- [ ] Hook varnar INTE vid andra ändringar
- [ ] `npm run check:all` grön

**Reviews:** code-reviewer (trivial)

**Arkitekturcoverage:** N/A.

---

## Exekveringsplan

```
S41-0 (20-30 min, blocker-fix) -> S41-1 (30-45 min, miss-analys + manifest-draft) -> S41-2 (15-30 min, valfri hook)
```

**Total effort:** ~1-1.5h.

## Definition of Done (sprintnivå)

- [ ] S41-0 merged → message-ordning korrekt i prod (blocker borta)
- [ ] S41-1 merged → miss-analys + review-manifest-draft dokumenterade
- [ ] S41-2 merged ELLER explicit avskriven om tid inte räcker
- [ ] `npm run check:all` grön
- [ ] Playwright-verifiering av fix
- [ ] Metrics-rapport post-sprint
