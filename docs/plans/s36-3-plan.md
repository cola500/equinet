---
title: "S36-3 Plan: Tech lead-på-feature-branch-varning"
description: "Hook-varning när tech lead committar lifecycle-docs på dev:s feature branch"
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

# S36-3 Plan: Tech lead-på-feature-branch-varning

## Aktualitet verifierad

**Kommandon körda:**
- `cat .husky/pre-commit` → bekräftar att `bash scripts/check-docs-updated.sh` körs
- `cat scripts/check-docs-updated.sh` → saknar tech lead-varnings-sektion
- `git config user.email` → `johan@jaernfoten.se`

**Resultat:** Hooken exekveras vid pre-commit men saknar den varning som S36-3 kräver.

**Beslut:** Fortsätt — problemet är verifierat.

## User story

Som tech lead vill jag få en tydlig varning om jag råkar committa lifecycle-docs på dev:s feature branch, så att jag undviker att förorena en annan sessions branch.

## Påverkade filer

1. `scripts/check-docs-updated.sh` — ny check-sektion i slutet
2. `.claude/rules/parallel-sessions.md` — referens till hooken

## Approach

### Steg 1: Utöka check-docs-updated.sh

Lägg till ny sektion **sist** i scriptet (efter den befintliga done-fil-logiken, men FÖRE `exit $EXIT_CODE`):

```bash
# Tech lead-på-feature-branch-varning
BRANCH=$(git rev-parse --abbrev-ref HEAD)
AUTHOR_EMAIL=$(git config user.email)

if [[ "$BRANCH" =~ ^feature/s[0-9] ]] && [[ "$AUTHOR_EMAIL" == "johan@jaernfoten.se" ]]; then
  STAGED=$(git diff --cached --name-only)
  TECH_LEAD_PATHS=$(echo "$STAGED" | grep -E "..." || true)
  NON_TECH_LEAD=$(echo "$STAGED" | grep -v -E "..." || true)

  if [ -n "$TECH_LEAD_PATHS" ] && [ -z "$NON_TECH_LEAD" ]; then
    echo "⚠️  Tech lead-varning: ..."
  fi
fi
```

Varningen blockerar INTE — scriptet avslutar med ursprunglig `$EXIT_CODE`.

### Steg 2: Manuell test (tre fall)

- **Positivt:** feature branch + techlead-email + bara status.md → varning visas
- **Negativt 1:** main + techlead-email + status.md → ingen varning
- **Negativt 2:** feature branch + techlead-email + kod i src/ → ingen varning

### Steg 3: Uppdatera parallel-sessions.md

Lägg till en mening under "Tech lead räknas som session"-stycket med referens till hooken.

## Arkitekturcoverage

N/A — ingen tidigare designstory.

## Risker

- **Falsk positiv:** Om tech lead legitimt committar lifecycle-docs på feature branch (t.ex. uppdaterar status.md mitt i review). Acceptabelt — varning är mjuk, blockerar inte.
- **Regex-täckning:** Om lifecycle-docs-listan behöver utökas i framtiden måste den uppdateras på ett ställe (scriptet).
