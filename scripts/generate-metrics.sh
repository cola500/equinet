#!/usr/bin/env bash
# Genererar en markdown-rapport med 6 baseline-metrics för Equinet.
# Kör: npm run metrics:report (eller bash scripts/generate-metrics.sh)
#
# Output: docs/metrics/<YYYY-MM-DD>-report.md + docs/metrics/latest.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

TODAY=$(date +%Y-%m-%d)
METRICS_DIR="docs/metrics"
OUTPUT_FILE="$METRICS_DIR/$TODAY-report.md"
LATEST_FILE="$METRICS_DIR/latest.md"

mkdir -p "$METRICS_DIR"

log() { echo "[metrics] $*" >&2; }

# --- M1: Deployment frequency ---
# Commits till main per ISO-vecka, senaste 4 veckor
m1_deployment_frequency() {
  local raw
  raw=$(git log main --since='4 weeks ago' --pretty=format:"%ci" 2>/dev/null)
  if [[ -z "$raw" ]]; then
    echo "Inga commits hittades senaste 4 veckor."
    return
  fi
  # Extrahera datum (YYYY-MM-DD) och gruppera per vecka (kronologisk ordning)
  echo "$raw" | awk '{print substr($1,1,10)}' | while IFS= read -r date_str; do
    date -j -f "%Y-%m-%d" "$date_str" "+%Y-W%V" 2>/dev/null || echo "okänd"
  done | sort | uniq -c | sort -k2 | while read -r count week; do
    echo "- $week: $count commits"
  done
}

# --- M2: Lead time for changes (median + p90) ---
# Tid från första commit på feature-branch till merge-commit (i timmar)
m2_lead_time() {
  local merge_lines
  merge_lines=$(git log --merges --first-parent main --since='8 weeks ago' \
    --pretty=format:"%H %ct" 2>/dev/null)

  if [[ -z "$merge_lines" ]]; then
    echo "Inga merge-commits hittades senaste 8 veckor."
    return
  fi

  local durations=()
  while IFS=' ' read -r merge_sha merge_ts; do
    # Hämta main-sidan (parent 1) och branch-sidan (parent 2)
    local all_parents
    all_parents=$(git log --no-walk --pretty=format:"%P" "$merge_sha" 2>/dev/null)
    local main_parent branch_parent
    main_parent=$(echo "$all_parents" | awk '{print $1}')
    branch_parent=$(echo "$all_parents" | awk '{print $2}')
    [[ -z "$branch_parent" || -z "$main_parent" ]] && continue

    # Äldsta commit på feature-branchen = commits som är i branch_parent men inte i main_parent
    local first_commit_ts
    first_commit_ts=$(git log --pretty=format:"%ct" "$main_parent..$branch_parent" 2>/dev/null \
      | tail -1)

    # Om branchen bara hade en commit (branch_parent == merge-base), ta branch_parent timestamp
    if [[ -z "$first_commit_ts" ]]; then
      first_commit_ts=$(git log --no-walk --pretty=format:"%ct" "$branch_parent" 2>/dev/null)
    fi
    [[ -z "$first_commit_ts" ]] && continue

    local diff_hours=$(( (merge_ts - first_commit_ts) / 3600 ))
    [[ $diff_hours -lt 0 ]] && diff_hours=0
    durations+=("$diff_hours")
  done <<< "$merge_lines"

  local count=${#durations[@]}
  if [[ $count -eq 0 ]]; then
    echo "Kunde inte beräkna lead time (inga mätbara merges)."
    return
  fi

  # Sortera och beräkna median + p90
  local sorted
  sorted=$(printf '%s\n' "${durations[@]}" | sort -n)
  local median_idx=$(( count / 2 ))
  local p90_idx=$(( count * 90 / 100 ))
  local median_val
  median_val=$(echo "$sorted" | sed -n "$((median_idx + 1))p")
  local p90_val
  p90_val=$(echo "$sorted" | sed -n "$((p90_idx + 1))p")

  echo "- Antal merges analyserade: $count"
  echo "- Median lead time: ${median_val}h"
  echo "- p90 lead time: ${p90_val}h"
}

# --- M3: "Redan fixat"-rate ---
m3_redan_fixat_rate() {
  local done_dir="docs/done"
  local total
  total=$(find "$done_dir" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$total" -eq 0 ]]; then
    echo "Inga done-filer hittades."
    return
  fi

  local hits
  hits=$(grep -rli \
    "redan fixat\|redan åtgärdat\|redan implementerat\|Skipped\|no-op\|Ingen kodändring" \
    "$done_dir"/ 2>/dev/null | wc -l | tr -d ' ')

  local pct=0
  if [[ $total -gt 0 ]]; then
    pct=$(awk "BEGIN { printf \"%.1f\", $hits / $total * 100 }")
  fi

  echo "- Totalt done-filer: $total"
  echo "- \"Redan fixat\"-filer: $hits"
  echo "- Rate: ${pct}% (mål: <5%)"
}

# --- M4: Subagent hit-rate ---
m4_subagent_hitrate() {
  local done_dir="docs/done"
  local blockers majors minors
  # Räkna unika filer (stories) -- konsekvent stories-granularitet
  blockers=$(grep -rli "blocker" "$done_dir"/ 2>/dev/null \
    | xargs grep -li "code-reviewer\|security-reviewer\|tech-architect\|cx-ux-reviewer\|ios-expert" 2>/dev/null \
    | wc -l | tr -d ' ')
  majors=$(grep -rli "major" "$done_dir"/ 2>/dev/null \
    | xargs grep -li "code-reviewer\|security-reviewer\|tech-architect\|cx-ux-reviewer\|ios-expert" 2>/dev/null \
    | wc -l | tr -d ' ')
  minors=$(grep -rli "minor" "$done_dir"/ 2>/dev/null \
    | xargs grep -li "code-reviewer\|security-reviewer\|tech-architect\|cx-ux-reviewer\|ios-expert" 2>/dev/null \
    | wc -l | tr -d ' ')

  # Räkna stories med minst en agent-review
  local reviewed_stories
  reviewed_stories=$(grep -rli \
    "code-reviewer\|security-reviewer\|tech-architect\|cx-ux-reviewer\|ios-expert" \
    "$done_dir"/ 2>/dev/null | wc -l | tr -d ' ')

  # Stories med minst ett fynd (blocker eller major)
  local stories_with_findings
  stories_with_findings=$(grep -rli "blocker\|major" "$done_dir"/ 2>/dev/null | wc -l | tr -d ' ')

  local hit_pct=0
  if [[ "$reviewed_stories" -gt 0 ]]; then
    hit_pct=$(awk "BEGIN { printf \"%.1f\", $stories_with_findings / $reviewed_stories * 100 }")
  fi

  echo "- Stories med agent-review: $reviewed_stories"
  echo "- Stories med minst ett fynd (blocker/major): $stories_with_findings"
  echo "- Hit-rate: ${hit_pct}% (hur ofta agenter hittar reella problem)"
  echo "- Stories med blocker: $blockers"
  echo "- Stories med major: $majors"
  echo "- Stories med minor: $minors"
}

# --- M5: Cykeltid per story (median) ---
m5_cycle_time() {
  local plans_dir="docs/plans"
  local done_dir="docs/done"
  local durations=()

  # För varje done-fil, hitta matchande plan-fil via story-id
  while IFS= read -r done_file; do
    local basename_done
    basename_done=$(basename "$done_file" .md)
    # Extrahera story-id: s31-1-done -> s31-1
    local story_id="${basename_done%-done}"
    local plan_file="$plans_dir/${story_id}-plan.md"

    [[ ! -f "$plan_file" ]] && continue

    # Hitta commit-timestamp för plan-filen och done-filen
    local plan_ts
    plan_ts=$(git log --diff-filter=A --follow --pretty=format:"%ct" -- "$plan_file" 2>/dev/null \
      | tail -1)
    local done_ts
    done_ts=$(git log --diff-filter=A --follow --pretty=format:"%ct" -- "$done_file" 2>/dev/null \
      | head -1)

    [[ -z "$plan_ts" || -z "$done_ts" ]] && continue
    local diff_hours=$(( (done_ts - plan_ts) / 3600 ))
    [[ $diff_hours -lt 0 ]] && continue
    durations+=("$diff_hours")
  done < <(find "$done_dir" -name "*.md" 2>/dev/null)

  local count=${#durations[@]}
  if [[ $count -eq 0 ]]; then
    echo "Inga stories med matchande plan + done-filer hittades."
    return
  fi

  local sorted
  sorted=$(printf '%s\n' "${durations[@]}" | sort -n)
  local median_idx=$(( count / 2 ))
  local median_val
  median_val=$(echo "$sorted" | sed -n "$((median_idx + 1))p")

  local total_done
  total_done=$(find "$done_dir" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  echo "- Antal stories analyserade: $count av $total_done (kräver matchande plan-fil i docs/plans/)"
  echo "- Median cykeltid: ${median_val}h (från plan-commit till done-commit)"
  echo "- _Notering: 0h = plan och done committade i samma session (korrekt beteende)_"
}

# --- M8: Modellval-avvikelse ---
m8_model_selection() {
  local done_dir="docs/done"
  local total=0
  local mismatches=()

  # Normalisera modellvärde till opus | sonnet | haiku | unknown
  normalize_model() {
    local raw="$1"
    raw=$(echo "$raw" | tr '[:upper:]' '[:lower:]' | tr -d '`()' | xargs)
    case "$raw" in
      *opus*)   echo "opus" ;;
      *sonnet*) echo "sonnet" ;;
      *haiku*)  echo "haiku" ;;
      *)        echo "unknown" ;;
    esac
  }

  # Förväntat modell: opus om arkitekturdesign ELLER säkerhetskritisk cross-cutting
  expected_model() {
    local content="$1"
    # Filtrera bort N/A- och "ingen"-rader för att undvika falska positiver
    local filtered
    filtered=$(echo "$content" | grep -viE "^N/A|^- N/A|ingen.*arkitekturdesign|arkitekturcoverage-gate")

    # Arkitekturdesign: story skapar ny domän-design (inte dokumenterar att annan story bygger på design)
    if echo "$filtered" | grep -qiE "\barkitekturdesign\b|design av domän|domän-design|implementerar S[0-9]+-0|bygger på S[0-9]+-0|ny domain design"; then
      echo "opus"; return
    fi
    # Ny kärndomän (IRepository → MockRepo → PrismaRepo + migration + service + routes)
    if echo "$filtered" | grep -qiE "Ny domän.*IRepository|IRepository.*MockRepo.*PrismaRepo|ny kärndomän|implementerar.*ny.*domän.*service.*migration"; then
      echo "opus"; return
    fi
    # Säkerhetskritisk cross-cutting: RLS + migration + kolumn-grant
    if echo "$filtered" | grep -qiE "kolumn.?nivå.*GRANT|RLS.*(migration|policy).*grant|ny.*RLS-policy.*service"; then
      echo "opus"; return
    fi
    echo "sonnet"
  }

  while IFS= read -r file; do
    # Kräver ## Modell-sektion
    if ! grep -q "^## Modell" "$file" 2>/dev/null; then
      continue
    fi
    total=$(( total + 1 ))

    local story_id
    story_id=$(basename "$file" .md | sed 's/-done$//')
    local content
    content=$(cat "$file")

    # Extrahera modell-värde (raden efter ## Modell)
    local raw_model
    raw_model=$(awk '/^## Modell/{found=1; next} found && NF{print; exit}' "$file")
    local actual
    actual=$(normalize_model "$raw_model")

    local expected
    expected=$(expected_model "$content")

    # Flagga om faktisk=sonnet/haiku men förväntat=opus
    if [[ "$expected" == "opus" && "$actual" != "opus" ]]; then
      mismatches+=("$story_id: typ=arkitektur/säkerhetskritisk, förväntat=opus, faktisk=$actual")
    fi
  done < <(find "$done_dir" -name "*.md" | sort -V)

  echo "- Totalt kontrollerade (stories med Modell-fält): $total"
  echo "- Avvikelser: ${#mismatches[@]}"
  if [[ ${#mismatches[@]} -gt 0 ]]; then
    for m in "${mismatches[@]}"; do
      echo "  - $m"
    done
  fi
}

# --- M7: Docs-compliance ---
m7_docs_compliance() {
  bash "$(dirname "${BASH_SOURCE[0]}")/check-docs-compliance.sh" 2>/dev/null
}

# --- M6: Test-count trend ---
m6_test_count() {
  local count_vitest count_xc total
  # TypeScript/JavaScript: test( eller it( på rad
  count_vitest=$(grep -rE "^\s*(test|it)\(" src/ 2>/dev/null | wc -l | tr -d ' ')
  # Swift XCTest (bara testmetoder med stor bokstav i EquinetTests-mappen)
  count_xc=$(grep -rE "^\s*func test[A-Z]" ios/Equinet/EquinetTests/ 2>/dev/null | wc -l | tr -d ' ')
  total=$(( count_vitest + count_xc ))

  echo "- Vitest (src/): $count_vitest tester"
  echo "- XCTest (ios/): $count_xc tester"
  echo "- Totalt: $total tester"
}

# --- Bygg rapporten ---
log "Genererar metrics-rapport: $OUTPUT_FILE"

cat > "$OUTPUT_FILE" << REPORT
---
title: "Metrics-rapport $TODAY"
description: "Automatgenererad rapport med 8 baseline-metrics"
category: operations
status: active
last_updated: $TODAY
sections:
  - Deployment Frequency
  - Lead Time for Changes
  - Redan fixat-rate
  - Subagent Hit-rate
  - Cykeltid per Story
  - Test-count Trend
  - Docs-compliance
  - Modellval-avvikelse
---

# Metrics-rapport $TODAY

> Genererad av \`npm run metrics:report\` — $(date '+%Y-%m-%d %H:%M:%S')

---

## M1: Commit Frequency (deploy-proxy)

_Commits till \`main\` per vecka, senaste 4 veckor. Proxy för deploy-frekvens -- Vercel deployer automatiskt vid push._

$(m1_deployment_frequency)

---

## M2: Lead Time for Changes

_Tid från första commit på feature-branch till merge-commit. Median + p90. Senaste 8 veckor._

$(m2_lead_time)

---

## M3: "Redan fixat"-rate

_Andel stories där verifiering visade att problemet redan var löst._

$(m3_redan_fixat_rate)

---

## M4: Subagent Hit-rate

_Hur ofta hittar review-agenter faktiska problem (blockers/majors)?_

$(m4_subagent_hitrate)

---

## M5: Cykeltid per Story

_Tid från plan-commit till done-commit. Proxy för "hur lång tar en story?"_

$(m5_cycle_time)

---

## M6: Test-count Trend

_Antal unit-tester idag._

$(m6_test_count)

---

## M7: Docs-compliance

_Stories där förväntade docs enligt Docs-matrisen inte uppdaterats. Retroaktiv check via \`scripts/check-docs-compliance.sh\`._

$(m7_docs_compliance)

---

## M8: Modellval-avvikelse

_Stories där modellval avviker från regeln: Opus för arkitekturdesign och säkerhetskritisk cross-cutting implementation, Sonnet/Haiku för övriga._

$(m8_model_selection)

---

_Se \`docs/metrics/README.md\` för definition av varje metric._
REPORT

# Kopiera till latest.md
cp "$OUTPUT_FILE" "$LATEST_FILE"

log "Klar! Rapport skriven till:"
log "  $OUTPUT_FILE"
log "  $LATEST_FILE"
echo ""
echo "Rapporten: $OUTPUT_FILE"
