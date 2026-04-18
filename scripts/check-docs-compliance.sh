#!/usr/bin/env bash
# Retroaktiv docs-matris compliance-check.
# Loopar över done-filer, detekterar story-typ via keyword-matching,
# och flaggar gap där docs-matrisen borde ha krävt uppdateringar.
#
# Kör: bash scripts/check-docs-compliance.sh
# Eller via: npm run metrics:report (integreras som M7)

set -euo pipefail

DONE_DIR="${1:-docs/done}"
TOTAL=0
GAPS=()
SKIPPED=0

# Detekterar story-typ. Returnerar: api-route | ui-feature | security | schema | audit | docs-only | unknown
detect_story_type() {
  local file="$1"
  local content
  content=$(cat "$file")

  # docs/process/config: hoppa över
  if echo "$content" | grep -qiE "process-story|trivial.*docs|mekanisk.*docs|docs-only|process.*(tweak|regel|config)|sprint-dokument|plan-mall|arkivera|docs.*matris|metrics.*rapport|hook.*infra|compliance.*check|modellval|slicing.trigger"; then
    echo "docs-only"; return
  fi
  # Filer som ENBART är docs/config/infra-stories (baserat på titeln)
  local title
  title=$(head -5 "$file" | grep -i "title:" | head -1 || true)
  if echo "$title" | grep -qiE "(process|hook|infra|script|docs|metrics|compliance|plan-mall|arkiv|slicing|modellval|sprint)"; then
    echo "docs-only"; return
  fi

  # Audit/verifiering (kolla FÖRE security – mer specifikt)
  if echo "$content" | grep -qiE "ux.?audit|visuell verifiering|audit-rapport|playwright.*audit"; then
    echo "audit"; return
  fi

  # Säkerhet – matchar AKTIV implementation, inte DoD-boilerplate
  # Undviker: "inga nya routes eller auth-ändringar", "Säker (inga ...)"
  if echo "$content" | grep -qiE "\bMFA\b|ny RLS|ny.*RLS-policy|RLS.*migration|ENABLE ROW LEVEL|ny auth.{0,20}(funktion|feature|hantering|flow)|supabase auth.*implement|login.*error.*enum|ny.*token.*auth|rate.?limiting.*impl|GDPR.*implementer|härdning|säkerhetsfunktion"; then
    echo "security"; return
  fi

  # Schema/migration
  if echo "$content" | grep -qiE "prisma.*schema|schema.*ändring|migration.*ny|ny.*migration|\bdbschema\b|databasschema"; then
    echo "schema"; return
  fi

  # UI-feature (ny UI, komponenter, native vyer)
  if echo "$content" | grep -qiE "ny.*komponent|native.*vy|ny.*sida|ny.*flöde|ny.*UI|messaging.*UI|booking.*UI|onboarding|ny feature.*UI"; then
    echo "ui-feature"; return
  fi

  # API route
  if echo "$content" | grep -qiE "ny.*API.*route|ny.*route|ny.*endpoint|POST /api|GET /api|PATCH /api|DELETE /api"; then
    echo "api-route"; return
  fi

  echo "unknown"
}

# Kontrollerar docs-sektionen i done-filen
get_docs_claim() {
  local file="$1"
  # Format 1: "Uppdaterade: ..." eller "Ingen docs-uppdatering"
  local docs_line
  docs_line=$(grep -iE "^[[:space:]]*(Uppdaterade:|Ingen docs-uppdatering)" "$file" 2>/dev/null | head -1 || true)
  if [[ -n "$docs_line" ]]; then
    echo "$docs_line"; return
  fi
  # Format 2: bullet-lista under "## Docs uppdaterade" — kolla om retro/readme/nfr nämns
  if grep -qiE "docs/retrospectives/|docs/security/|NFR\.md|README\.md|docs/architecture/|docs/testing/" "$file" 2>/dev/null; then
    echo "Uppdaterade: (bullet-lista hittad)"; return
  fi
  echo ""
}

# Returnerar 1 om "Ingen docs-uppdatering" (eller tomt), 0 om docs faktiskt listades
claimed_no_docs() {
  local claim="$1"
  if [[ -z "$claim" ]] || echo "$claim" | grep -qi "Ingen docs-uppdatering"; then
    return 0  # ingen/tom docs-claim
  fi
  return 1  # docs listades
}

# Loopar över done-filer
while IFS= read -r file; do
  # Skippa filer utan Docs-sektion (pre-S31 äldre stories)
  if ! grep -qiE "Docs uppdaterade|Uppdaterade:|Ingen docs-uppdatering" "$file" 2>/dev/null; then
    SKIPPED=$(( SKIPPED + 1 ))
    continue
  fi

  TOTAL=$(( TOTAL + 1 ))
  story_id=$(basename "$file" .md | sed 's/-done$//')
  story_type=$(detect_story_type "$file")
  docs_claim=$(get_docs_claim "$file")

  # Skip docs-only stories – de förväntas inte uppdatera docs-matrisen
  [[ "$story_type" == "docs-only" ]] && continue

  # Flagga gap baserat på story-typ + docs-claim
  case "$story_type" in
    ui-feature)
      if claimed_no_docs "$docs_claim"; then
        GAPS+=("$story_id: typ=ui-feature, förväntat=hjälpartikel+testing-guide, faktisk='Ingen docs-uppdatering'")
      fi
      ;;
    security)
      if claimed_no_docs "$docs_claim"; then
        GAPS+=("$story_id: typ=security, förväntat=NFR.md+docs/security/, faktisk='Ingen docs-uppdatering'")
      elif ! echo "$docs_claim" | grep -qiE "NFR|docs/security|incident-runbook"; then
        GAPS+=("$story_id: typ=security, förväntat=NFR.md eller docs/security/, faktisk='$docs_claim' (ingen säkerhetsdoc)")
      fi
      ;;
    schema)
      if claimed_no_docs "$docs_claim"; then
        GAPS+=("$story_id: typ=schema, förväntat=docs/architecture/database.md, faktisk='Ingen docs-uppdatering'")
      fi
      ;;
    audit)
      if claimed_no_docs "$docs_claim"; then
        GAPS+=("$story_id: typ=audit, förväntat=docs/retrospectives/, faktisk='Ingen docs-uppdatering'")
      fi
      ;;
    api-route)
      # API routes: kontrollera bara om security-review inte kördes
      if ! grep -qi "security-reviewer" "$file" 2>/dev/null; then
        GAPS+=("$story_id: typ=api-route, förväntat=security-reviewer körd, faktisk=security-review ej nämnd")
      fi
      ;;
  esac
done < <(find "$DONE_DIR" -name "*.md" | sort -V)

# Output
echo "- Totalt kontrollerade (med Docs-sektion): $TOTAL"
echo "- Äldre stories utan Docs-sektion (skippad): $SKIPPED"
echo "- Gap identifierade: ${#GAPS[@]}"

if [[ ${#GAPS[@]} -gt 0 ]]; then
  for gap in "${GAPS[@]}"; do
    echo "  - $gap"
  done
fi
