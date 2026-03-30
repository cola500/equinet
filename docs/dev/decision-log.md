---
title: Decision Log
description: Logg över tekniska beslut i utvecklingsprocessen
category: dev
status: active
last_updated: 2026-03-30
sections:
  - Beslut
---

# Decision Log

## 2026-03-30: Infört equinet-review som lokal review-grindvakt

**Context:** Vi arbetar med små, iterativa iOS UI-slices och behöver snabb feedback på om en diff följer våra kodstandarder innan commit. Manuell granskning tar tid och är inkonsekvent för mekaniska ändringar.

**Change:** Skapat `scripts/equinet-review` (Python, OpenAI API) som läser en git diff och returnerar APPROVE/FIX med strukturerade exit-koder. Integrerat som standardsteg i arbetsflödet: ändra -> stage -> review -> build -> commit.

**Verified outcome:**
- 7 commits på `fix/ios-accessibility-button-semantics` med review-loopen aktiv
- APPROVE på 4 slices (Button-semantik, tab bar caption, ContentUnavailableView, appending(path:))
- FIX på 2 slices (TextEditor->TextField reverterad, scrollIndicators override med motivering)
- Exit-koder fungerar (0=APPROVE, 10=FIX, 20=usage, 30=API)

**Limitations:**
- Kräver `OPENAI_API_KEY` i miljön
- Diff trunkeras vid 12000 tecken -- passar inte stora refaktoreringar
- Modellen kan ge false positives (generisk osäkerhet vid kända API-byten)
- Ersätter inte manuell granskning för säkerhetskritiska ändringar

**Decision:** Använda review-loopen som standard för små UI/CI/dev-tool-slices. Human override tillåtet med motivering.

**Not doing now:**
- Auto-fix baserat på FIX-resultat
- Integration som git hook (pre-commit)
- Mer avancerade review-modes (multi-file, arkitekturnivå)

**Future option:**
- Koppla som valfri pre-commit hook
- Byta till Anthropic API om vi föredrar det
- Lägga till `--fix`-mode som föreslår konkreta ändringar

## 2026-03-30: Förbättrad review-prompt för mekaniska API-migreringar

**Context:** Review-prompten gav FIX på scrollIndicators-slicen (`showsIndicators: false` -> `.scrollIndicators(.hidden)`) trots att det är ett rent 1:1 API-byte utan beteendeändring. Modellen uttryckte generisk osäkerhet.

**Change:** Lade till sektion "Mechanical API migrations" i SYSTEM_PROMPT som instruerar modellen att känna igen deprecated->modern API-byten och luta mot APPROVE när diffen är liten, mekanisk och beteendebevarande.

**Verified outcome:** Prompt-ändringen passerade egen review (APPROVE) och syntax-check. Framtida mekaniska migreringar bör få färre false-FIX.

**Decision:** Human override är fortfarande tillåten -- prompten styr bara modellens default-bedömning, inte slutbeslutet.
