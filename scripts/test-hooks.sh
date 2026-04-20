#!/usr/bin/env bash
# scripts/test-hooks.sh — Kör alla pre-commit hooks mot kända scenarier.
# Usage: npm run test:hooks
#
# Hur man lägger till test för ny hook:
# 1. Skapa test_<hooknamn>() funktion nedan
# 2. Anropa setup_repo (ej via $()) — ändrar CWD till isolerat temp-repo
# 3. Skapa fixtures, git add, kör bash "$SCRIPT_DIR/<hook>.sh"
# 4. assert_pass / assert_fail med beskrivande text
# 5. Anropa teardown_repo i slutet av funktionen
# 6. Lägg till anrop i run_all_tests() längst ner
# 7. Minst 3 scenarier per hook: pass + fail + edge case/override
#
# VIKTIGT: Anropa alltid setup_repo och teardown_repo DIREKT (inte via $())
# annars körs cd i en subshell och CWD ändras inte i outer shell.

set -uo pipefail  # Inte -e: vi fångar exit-koder manuellt med $?

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORIG_DIR="$(pwd)"
TMPTEST=""   # Globalt — sätts av setup_repo, används av teardown_repo
PASS=0
FAIL=0
ERRORS=()

# Säkerställ cleanup om skriptet avbryts oväntat (pipefail, SIGINT, etc.)
cleanup_on_exit() {
  [[ -n "$TMPTEST" ]] && rm -rf "$TMPTEST"
  cd "$ORIG_DIR" 2>/dev/null || true
}
trap cleanup_on_exit EXIT

GREEN='\033[0;32m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

assert_pass() {
  local desc="$1"
  local actual_exit="${2:-}"
  if [[ -z "$actual_exit" ]]; then
    echo -e "  ${RED}FAIL${NC}: $desc (inget exit-värde angivet)"
    FAIL=$((FAIL + 1)); ERRORS+=("$desc"); return
  fi
  if [[ "$actual_exit" -eq 0 ]]; then
    echo -e "  ${GREEN}PASS${NC}: $desc"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC}: $desc (förväntade exit 0, fick $actual_exit)"
    FAIL=$((FAIL + 1)); ERRORS+=("$desc")
  fi
}

assert_fail() {
  local desc="$1"
  local actual_exit="${2:-}"
  if [[ -z "$actual_exit" ]]; then
    echo -e "  ${RED}FAIL${NC}: $desc (inget exit-värde angivet)"
    FAIL=$((FAIL + 1)); ERRORS+=("$desc"); return
  fi
  if [[ "$actual_exit" -ne 0 ]]; then
    echo -e "  ${GREEN}PASS${NC}: $desc"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC}: $desc (förväntade exit !=0, fick 0)"
    FAIL=$((FAIL + 1)); ERRORS+=("$desc")
  fi
}

# Skapar isolerat git-repo och byter CWD till det.
# Anropa DIREKT (inte via $()) — annars körs cd i subshell utan effekt.
setup_repo() {
  TMPTEST=$(mktemp -d)
  cd "$TMPTEST"
  git init -q
  git config user.email "test@test.com"
  git config user.name "Test"
  git config commit.gpgsign false 2>/dev/null || true
  mkdir -p docs/sprints docs/plans docs/done docs/retrospectives scripts src/app/api
  echo "placeholder" > README.md
  git add README.md
  git commit -q -m "initial"
}

# Återgår till ORIG_DIR och tar bort temp-repot.
teardown_repo() {
  cd "$ORIG_DIR"
  rm -rf "$TMPTEST"
  TMPTEST=""
}

# ─────────────────────────────────────────────────────────────
# 1. check-sprint-closure.sh
#    BLOCKERAR commit när alla stories done men retro saknas.
#    Override: [override: <motivering>] i commit-meddelandet.
# ─────────────────────────────────────────────────────────────
test_sprint_closure() {
  echo ""
  echo "── check-sprint-closure.sh ──"
  setup_repo

  # Scenario 1: Ingen status.md → passerar
  rm -f docs/sprints/status.md
  bash "$SCRIPT_DIR/check-sprint-closure.sh" > /dev/null 2>&1; local e=$?
  assert_pass "ingen status.md → passerar (exit 0)" $e

  # Scenario 2: Stories pending → passerar
  printf '**Sprint 99: test**\n| S99-0: teststory | 0 | pending | 30 min |\n' \
    > docs/sprints/status.md
  bash "$SCRIPT_DIR/check-sprint-closure.sh" > /dev/null 2>&1; e=$?
  assert_pass "pending stories → passerar" $e

  # Scenario 3: Alla done + retro finns → passerar
  printf '**Sprint 99: test**\n| S99-0: teststory | 0 | done | 30 min |\n' \
    > docs/sprints/status.md
  touch docs/retrospectives/2026-04-20-sprint-99.md
  bash "$SCRIPT_DIR/check-sprint-closure.sh" > /dev/null 2>&1; e=$?
  assert_pass "alla done + retro finns → passerar" $e

  # Scenario 4: Alla done, INGEN retro → BLOCKERAR (exit 1)
  rm -f docs/retrospectives/2026-04-20-sprint-99.md
  local gitdir; gitdir=$(git rev-parse --git-dir)
  echo "" > "${gitdir}/COMMIT_EDITMSG"
  bash "$SCRIPT_DIR/check-sprint-closure.sh" > /dev/null 2>&1; e=$?
  assert_fail "alla done, ingen retro → blockerar (exit 1)" $e

  # Scenario 5: Alla done, ingen retro + override → passerar
  echo "docs: done [override: retro skrivs separat idag]" > "${gitdir}/COMMIT_EDITMSG"
  bash "$SCRIPT_DIR/check-sprint-closure.sh" > /dev/null 2>&1; e=$?
  assert_pass "alla done, ingen retro + override → passerar" $e
  echo "" > "${gitdir}/COMMIT_EDITMSG"

  teardown_repo
}

# ─────────────────────────────────────────────────────────────
# 2. check-plan-commit.sh
#    BLOCKERAR commit när story in_progress men plan saknas.
#    Override: [override: <motivering>] i commit-meddelandet.
# ─────────────────────────────────────────────────────────────
test_plan_commit() {
  echo ""
  echo "── check-plan-commit.sh ──"
  setup_repo

  # Scenario 1: Ingen in_progress → passerar
  printf '**Sprint 99: test**\n| S99-0: teststory | 0 | pending | 30 min |\n' \
    > docs/sprints/status.md
  git add docs/sprints/status.md
  bash "$SCRIPT_DIR/check-plan-commit.sh" > /dev/null 2>&1; local e=$?
  assert_pass "ingen in_progress → passerar" $e
  git restore --staged docs/sprints/status.md 2>/dev/null || true

  # Scenario 2: in_progress + lifecycle-only staged → passerar
  printf '**Sprint 99: test**\n| S99-0: teststory | 0 | in_progress | 30 min |\n' \
    > docs/sprints/status.md
  git add docs/sprints/status.md
  bash "$SCRIPT_DIR/check-plan-commit.sh" > /dev/null 2>&1; e=$?
  assert_pass "in_progress + lifecycle-only staged → passerar" $e
  git restore --staged docs/sprints/status.md 2>/dev/null || true

  # Scenario 3: in_progress + kod staged + plan saknas → BLOCKERAR (exit 1)
  printf '**Sprint 99: test**\n| S99-0: teststory | 0 | in_progress | 30 min |\n' \
    > docs/sprints/status.md
  printf '#!/bin/bash\necho test\n' > scripts/code.sh
  git add scripts/code.sh
  local gitdir; gitdir=$(git rev-parse --git-dir)
  echo "" > "${gitdir}/COMMIT_EDITMSG"
  bash "$SCRIPT_DIR/check-plan-commit.sh" > /dev/null 2>&1; e=$?
  assert_fail "in_progress + plan saknas → blockerar (exit 1)" $e
  git restore --staged scripts/code.sh 2>/dev/null || true; rm -f scripts/code.sh

  # Scenario 4: in_progress + plan committad → passerar
  echo "# plan" > docs/plans/s99-0-plan.md
  git add docs/plans/s99-0-plan.md
  git commit -q -m "add plan"
  printf '#!/bin/bash\necho code\n' > scripts/code2.sh
  git add scripts/code2.sh
  bash "$SCRIPT_DIR/check-plan-commit.sh" > /dev/null 2>&1; e=$?
  assert_pass "in_progress + plan committad → passerar" $e
  git restore --staged scripts/code2.sh 2>/dev/null || true; rm -f scripts/code2.sh

  # Scenario 5: in_progress + plan saknas + override → passerar
  printf '#!/bin/bash\necho override\n' > scripts/code3.sh
  git add scripts/code3.sh
  echo "feat: hotfix [override: plan skrivs i efterhand, akut fix]" > "${gitdir}/COMMIT_EDITMSG"
  bash "$SCRIPT_DIR/check-plan-commit.sh" > /dev/null 2>&1; e=$?
  assert_pass "in_progress + plan saknas + override → passerar" $e
  git restore --staged scripts/code3.sh 2>/dev/null || true; rm -f scripts/code3.sh
  echo "" > "${gitdir}/COMMIT_EDITMSG"

  teardown_repo
}

# ─────────────────────────────────────────────────────────────
# 3. check-branch-for-story.sh
#    BLOCKERAR commit på main när story in_progress + kod staged.
# ─────────────────────────────────────────────────────────────
test_branch_check() {
  echo ""
  echo "── check-branch-for-story.sh ──"
  setup_repo

  # Grundfixtur: status.md med in_progress story, committad
  printf '**Sprint 99: test**\n| S99-0: teststory | 0 | in_progress | 30 min |\n' \
    > docs/sprints/status.md
  git add docs/sprints/status.md
  git commit -q -m "status"

  # Scenario 1: Feature branch → passerar alltid
  git checkout -q -b feature/s99-0-test
  printf '#!/bin/bash\necho code\n' > scripts/code.sh
  git add scripts/code.sh
  bash "$SCRIPT_DIR/check-branch-for-story.sh" > /dev/null 2>&1; local e=$?
  assert_pass "feature branch + kod staged → passerar" $e
  git restore --staged scripts/code.sh 2>/dev/null || true; rm -f scripts/code.sh
  git checkout -q main

  # Scenario 2: main + ingen in_progress → passerar
  printf '**Sprint 99: test**\n| S99-0: teststory | 0 | done | 30 min |\n' \
    > docs/sprints/status.md
  git add docs/sprints/status.md
  git commit -q -m "all done"
  printf '#!/bin/bash\necho code\n' > scripts/code.sh
  git add scripts/code.sh
  bash "$SCRIPT_DIR/check-branch-for-story.sh" > /dev/null 2>&1; e=$?
  assert_pass "main + ingen in_progress → passerar" $e
  git restore --staged scripts/code.sh 2>/dev/null || true; rm -f scripts/code.sh

  # Återställ in_progress
  printf '**Sprint 99: test**\n| S99-0: teststory | 0 | in_progress | 30 min |\n' \
    > docs/sprints/status.md
  git add docs/sprints/status.md
  git commit -q -m "in_progress again"

  # Scenario 3: main + lifecycle-docs only → passerar
  echo "update" >> docs/sprints/status.md
  git add docs/sprints/status.md
  bash "$SCRIPT_DIR/check-branch-for-story.sh" > /dev/null 2>&1; e=$?
  assert_pass "main + lifecycle-only staged → passerar" $e
  git restore --staged docs/sprints/status.md 2>/dev/null || true

  # Scenario 4: main + in_progress + kod staged → BLOCKERAR
  printf '#!/bin/bash\necho blocker\n' > scripts/blocker.sh
  git add scripts/blocker.sh
  bash "$SCRIPT_DIR/check-branch-for-story.sh" > /dev/null 2>&1; e=$?
  assert_fail "main + in_progress + kod staged → blockerar" $e
  git restore --staged scripts/blocker.sh 2>/dev/null || true; rm -f scripts/blocker.sh

  # Scenario 5: override med motivering → passerar
  printf '#!/bin/bash\necho override\n' > scripts/override.sh
  git add scripts/override.sh
  local gitdir; gitdir=$(git rev-parse --git-dir)
  echo "fix: hotfix [override: nödvändig direkt på main]" > "${gitdir}/COMMIT_EDITMSG"
  bash "$SCRIPT_DIR/check-branch-for-story.sh" > /dev/null 2>&1; e=$?
  assert_pass "override med motivering → passerar" $e
  git restore --staged scripts/override.sh 2>/dev/null || true; rm -f scripts/override.sh
  echo "" > "${gitdir}/COMMIT_EDITMSG"

  teardown_repo
}

# ─────────────────────────────────────────────────────────────
# 4. check-reviews-done.sh
#    BLOCKERAR done-fil-commit om obligatoriska reviews saknas.
# ─────────────────────────────────────────────────────────────
test_reviews_done() {
  echo ""
  echo "── check-reviews-done.sh ──"
  setup_repo

  # Scenario 1: Ingen done-fil staged → passerar
  bash "$SCRIPT_DIR/check-reviews-done.sh" > /dev/null 2>&1; local e=$?
  assert_pass "ingen done-fil staged → passerar" $e

  # Scenario 2: Docs-only/trivial story → passerar
  git checkout -q -b feature/s99-0-docs
  echo "# doc" > docs/test-doc.md
  git add docs/test-doc.md
  git commit -q -m "add doc"
  cat > docs/done/s99-0-done.md << 'DONEFILE'
## Reviews körda
- [ ] code-reviewer — ej tillämplig (trivial story: docs only)
DONEFILE
  git add docs/done/s99-0-done.md
  bash "$SCRIPT_DIR/check-reviews-done.sh" > /dev/null 2>&1; e=$?
  assert_pass "trivial/docs-only story → passerar" $e
  git restore --staged docs/done/s99-0-done.md 2>/dev/null || true
  git checkout -q main

  # Scenario 3: api-route ändrad + code-reviewer + security-reviewer → passerar
  git checkout -q -b feature/s99-1-api
  mkdir -p src/app/api/test
  echo "export async function GET() {}" > src/app/api/test/route.ts
  git add src/app/api/test/route.ts
  git commit -q -m "add api route"
  cat > docs/done/s99-1-done.md << 'DONEFILE'
## Reviews körda
- [x] code-reviewer — inga problem
- [x] security-reviewer — auth-check ok
DONEFILE
  git add docs/done/s99-1-done.md
  bash "$SCRIPT_DIR/check-reviews-done.sh" > /dev/null 2>&1; e=$?
  assert_pass "api-route + code+security-reviewer → passerar" $e
  git restore --staged docs/done/s99-1-done.md 2>/dev/null || true

  # Scenario 4: api-route ändrad + saknar security-reviewer → BLOCKERAR
  cat > docs/done/s99-1-done.md << 'DONEFILE'
## Reviews körda
- [x] code-reviewer — inga problem
- [ ] security-reviewer — ej körd
DONEFILE
  git add docs/done/s99-1-done.md
  bash "$SCRIPT_DIR/check-reviews-done.sh" > /dev/null 2>&1; e=$?
  assert_fail "api-route + saknar security-reviewer → blockerar" $e
  git restore --staged docs/done/s99-1-done.md 2>/dev/null || true

  # Scenario 5: Trivial story (explicit) → passerar
  cat > docs/done/s99-1-done.md << 'DONEFILE'
## Reviews körda
- [ ] code-reviewer — ej tillämplig (trivial story: mekanisk ändring, <15 min)
DONEFILE
  git add docs/done/s99-1-done.md
  bash "$SCRIPT_DIR/check-reviews-done.sh" > /dev/null 2>&1; e=$?
  assert_pass "trivial story explicit → passerar" $e
  git restore --staged docs/done/s99-1-done.md 2>/dev/null || true

  # Scenario 6: Override → passerar
  cat > docs/done/s99-1-done.md << 'DONEFILE'
## Reviews körda
- [x] code-reviewer — ok
- [ ] security-reviewer — saknas medvetet
DONEFILE
  git add docs/done/s99-1-done.md
  local gitdir; gitdir=$(git rev-parse --git-dir)
  echo "docs: done [override: security kördes utanför done-fil]" > "${gitdir}/COMMIT_EDITMSG"
  bash "$SCRIPT_DIR/check-reviews-done.sh" > /dev/null 2>&1; e=$?
  assert_pass "override med motivering → passerar" $e
  git restore --staged docs/done/s99-1-done.md 2>/dev/null || true
  echo "" > "${gitdir}/COMMIT_EDITMSG"

  git checkout -q main
  teardown_repo
}

# ─────────────────────────────────────────────────────────────
# 5. check-docs-updated.sh
#    Validerar att done-filer har Docs-sektion,
#    plan-filer har Aktualitet-sektion.
# ─────────────────────────────────────────────────────────────
test_docs_updated() {
  echo ""
  echo "── check-docs-updated.sh ──"
  # OBS: Testar bara plan-aktualitet och done-docs-sektion (de blockerande kontrollerna).
  # Hookens varningsblock (tech lead-branch, Seven Dimensions, ProviderNav, messaging)
  # testas inte — de kräver specifik user.email/filstruktur och är icke-blockerande.
  setup_repo

  # Scenario 1: Ingenting staged → passerar
  bash "$SCRIPT_DIR/check-docs-updated.sh" > /dev/null 2>&1; local e=$?
  assert_pass "ingenting staged → passerar" $e

  # Scenario 2: Plan med aktualitetssektion → passerar
  cat > docs/plans/s99-0-plan.md << 'PLANFILE'
# Plan

## Aktualitet verifierad
**Kommandon körda:** grep -r "X" src/
**Resultat:** inga träffar
**Beslut:** Fortsätt
PLANFILE
  git add docs/plans/s99-0-plan.md
  bash "$SCRIPT_DIR/check-docs-updated.sh" > /dev/null 2>&1; e=$?
  assert_pass "plan med aktualitetssektion → passerar" $e
  git restore --staged docs/plans/s99-0-plan.md 2>/dev/null || true

  # Scenario 3: Plan UTAN aktualitetssektion → blockerar
  cat > docs/plans/s99-0-plan.md << 'PLANFILE'
# Plan
Beskrivning utan aktualitetssektion.
PLANFILE
  git add docs/plans/s99-0-plan.md
  bash "$SCRIPT_DIR/check-docs-updated.sh" > /dev/null 2>&1; e=$?
  assert_fail "plan utan aktualitetssektion → blockerar" $e
  git restore --staged docs/plans/s99-0-plan.md 2>/dev/null || true

  # Scenario 4: Done-fil med Docs-sektion → passerar
  cat > docs/done/s99-0-done.md << 'DONEFILE'
# Done
## Docs uppdaterade
Ingen docs-uppdatering (intern refactoring)
DONEFILE
  git add docs/done/s99-0-done.md
  bash "$SCRIPT_DIR/check-docs-updated.sh" > /dev/null 2>&1; e=$?
  assert_pass "done-fil med docs-sektion → passerar" $e
  git restore --staged docs/done/s99-0-done.md 2>/dev/null || true

  # Scenario 5: Done-fil UTAN Docs-sektion → blockerar
  cat > docs/done/s99-0-done.md << 'DONEFILE'
# Done
Ingen docs-sektion här.
DONEFILE
  git add docs/done/s99-0-done.md
  bash "$SCRIPT_DIR/check-docs-updated.sh" > /dev/null 2>&1; e=$?
  assert_fail "done-fil utan docs-sektion → blockerar" $e
  git restore --staged docs/done/s99-0-done.md 2>/dev/null || true

  teardown_repo
}

# ─────────────────────────────────────────────────────────────
# 6. check-multi-commit.sh
#    BLOCKERAR push från feature branch om < 2 commits.
#    Override: [override: <motivering>] i senaste commit-msg.
# ─────────────────────────────────────────────────────────────
test_multi_commit() {
  echo ""
  echo "── check-multi-commit.sh ──"
  setup_repo

  # Scenario 1: main branch → passerar alltid
  bash "$SCRIPT_DIR/check-multi-commit.sh" > /dev/null 2>&1; local e=$?
  assert_pass "main branch → passerar" $e

  # Scenario 2: feature branch + 2 commits → passerar
  git checkout -q -b feature/s99-0-multi
  echo "a" > file_a.txt; git add file_a.txt; git commit -q -m "commit 1"
  echo "b" > file_b.txt; git add file_b.txt; git commit -q -m "commit 2"
  bash "$SCRIPT_DIR/check-multi-commit.sh" > /dev/null 2>&1; e=$?
  assert_pass "feature branch + 2 commits → passerar" $e

  # Scenario 3: feature branch + 1 commit + ingen override → BLOCKERAR
  git checkout -q -b feature/s99-0-single main
  echo "a" > file_a.txt; git add file_a.txt; git commit -q -m "only commit"
  bash "$SCRIPT_DIR/check-multi-commit.sh" > /dev/null 2>&1; e=$?
  assert_fail "feature branch + 1 commit → blockerar" $e
  git checkout -q main

  # Scenario 4: feature branch + 1 commit + override → passerar
  git checkout -q -b feature/s99-0-override main
  echo "x" > file_x.txt; git add file_x.txt
  git commit -q -m "hotfix: direktfix [override: ett commit avsiktligt]"
  bash "$SCRIPT_DIR/check-multi-commit.sh" > /dev/null 2>&1; e=$?
  assert_pass "feature branch + 1 commit + override → passerar" $e
  git checkout -q main

  teardown_repo
}

# ─────────────────────────────────────────────────────────────
# 7. check-own-pr-merge.sh
#    Validerar argument och blockerar self-merge i non-interaktivt läge.
#    Testar argument-validering + non-interactive BLOCK + --override.
# ─────────────────────────────────────────────────────────────
test_own_pr_merge() {
  echo ""
  echo "── check-own-pr-merge.sh ──"
  setup_repo

  # Scenario 1: Inget PR-nummer → exit 1 (usage error)
  bash "$SCRIPT_DIR/check-own-pr-merge.sh" > /dev/null 2>&1; local e=$?
  assert_fail "inget PR-nummer → exit 1 (usage error)" $e

  # Scenario 2: Ogiltigt PR-nummer (text) → exit 1
  bash "$SCRIPT_DIR/check-own-pr-merge.sh" "abc" > /dev/null 2>&1; e=$?
  assert_fail "ogiltigt PR-nummer (text) → exit 1" $e

  # Scenario 3: Giltigt nummer + gh CLI saknas → exit 0 (INFO, fortsätter)
  local original_path="$PATH"
  local gh_path; gh_path=$(command -v gh 2>/dev/null || true)
  if [[ -n "$gh_path" ]]; then
    local gh_dir; gh_dir=$(dirname "$gh_path")
    local new_path
    new_path=$(echo "$PATH" | tr ':' '\n' | grep -vxF "$gh_dir" | tr '\n' ':' | sed 's/:$//')
    PATH="$new_path" bash "$SCRIPT_DIR/check-own-pr-merge.sh" "123" < /dev/null > /dev/null 2>&1; e=$?
    assert_pass "gh CLI ej synlig i PATH → exit 0 (INFO)" $e
    PATH="$original_path"
  else
    bash "$SCRIPT_DIR/check-own-pr-merge.sh" "123" < /dev/null > /dev/null 2>&1; e=$?
    assert_pass "gh CLI ej installerad → exit 0 (INFO)" $e
  fi

  teardown_repo
}

# ─────────────────────────────────────────────────────────────
# 8. check-sprint-retro.sh
#    BLOCKERAR retro-commit direkt på main utan feature branch.
#    Override: [override: <motivering>] i commit-message.
# ─────────────────────────────────────────────────────────────
test_sprint_retro() {
  echo ""
  echo "── check-sprint-retro.sh ──"
  setup_repo

  # Scenario 1: Ingen retro staged → passerar
  bash "$SCRIPT_DIR/check-sprint-retro.sh" > /dev/null 2>&1; local e=$?
  assert_pass "ingen retro staged → passerar" $e

  # Scenario 2: Retro staged på feature branch → passerar
  git checkout -q -b feature/s99-avslut
  touch docs/retrospectives/2026-04-20-sprint-99.md
  git add docs/retrospectives/2026-04-20-sprint-99.md
  bash "$SCRIPT_DIR/check-sprint-retro.sh" > /dev/null 2>&1; e=$?
  assert_pass "retro staged på feature branch → passerar" $e
  git restore --staged docs/retrospectives/2026-04-20-sprint-99.md 2>/dev/null || true
  git checkout -q main

  # Scenario 3: Retro staged på main → BLOCKERAR
  git add docs/retrospectives/2026-04-20-sprint-99.md
  local gitdir; gitdir=$(git rev-parse --git-dir)
  echo "" > "${gitdir}/COMMIT_EDITMSG"
  bash "$SCRIPT_DIR/check-sprint-retro.sh" > /dev/null 2>&1; e=$?
  assert_fail "retro staged på main → blockerar" $e
  git restore --staged docs/retrospectives/2026-04-20-sprint-99.md 2>/dev/null || true

  # Scenario 4: Retro staged på main + override → passerar
  git add docs/retrospectives/2026-04-20-sprint-99.md
  echo "docs: retro [override: tech lead self-review, sprint-avslut]" > "${gitdir}/COMMIT_EDITMSG"
  bash "$SCRIPT_DIR/check-sprint-retro.sh" > /dev/null 2>&1; e=$?
  assert_pass "retro staged på main + override → passerar" $e
  git restore --staged docs/retrospectives/2026-04-20-sprint-99.md 2>/dev/null || true
  echo "" > "${gitdir}/COMMIT_EDITMSG"

  teardown_repo
}

# ─────────────────────────────────────────────────────────────
# Kör alla tester
# ─────────────────────────────────────────────────────────────
run_all_tests() {
  echo ""
  echo -e "${BOLD}Hook-tester${NC}"
  echo "══════════════════════════════════════════"

  test_sprint_closure
  test_plan_commit
  test_branch_check
  test_reviews_done
  test_docs_updated
  test_multi_commit
  test_own_pr_merge
  test_sprint_retro

  echo ""
  echo "══════════════════════════════════════════"
  local total=$((PASS + FAIL))
  if [[ $FAIL -eq 0 ]]; then
    echo -e "  ${GREEN}${BOLD}${PASS}/${total} tester gröna${NC}"
  else
    echo -e "  ${RED}${BOLD}${FAIL} misslyckade av ${total} tester${NC}"
    for err in "${ERRORS[@]}"; do
      echo -e "  ${RED}•${NC} $err"
    done
    exit 1
  fi
  echo ""
}

run_all_tests
