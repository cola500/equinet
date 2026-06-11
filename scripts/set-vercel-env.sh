#!/usr/bin/env bash
#
# set-vercel-env.sh --project <prod|staging> --key <KEY> [--normalize-db-url] [--go]
#
# Säker DELETE + CREATE av en sensitive/encrypted Vercel env var (PATCH är
# opålitligt på sensitive vars). Dry-run som default — `--go` krävs för att skriva.
#
# Lägen:
#   --normalize-db-url   Läs nuvarande DATABASE_URL, fixa BARA suffixet till
#                        ?pgbouncer=true&connection_limit=1 (host+lösenord bevaras).
#   (utan)               Fråga efter nytt värde (dolt) och recreate:a med det.
#
# Skydd:
#   - Rör bara rader med target EXAKT [production] i valt projekt (delade rader avbryts).
#   - Maskar alltid värden i utskrift. Läser secret färskt, håller i variabel.
#   - CLI-auth (auth.json), ingen VERCEL_TOKEN. Värdet skickas via stdin-pipe (ej 'ps').
#
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/vercel-env-lib.sh
source "$DIR/lib/vercel-env-lib.sh"

PROJSEL=""; KEY=""; NORM=0; GO=0
usage() { echo "Användning: bash scripts/set-vercel-env.sh --project <prod|staging> --key <KEY> [--normalize-db-url] [--go]"; }
while [ $# -gt 0 ]; do
  case "$1" in
    --project) PROJSEL="${2:-}"; shift 2 ;;
    --key)     KEY="${2:-}"; shift 2 ;;
    --normalize-db-url) NORM=1; shift ;;
    --go)      GO=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "✖ Okänd flagga: $1"; usage; exit 1 ;;
  esac
done
[ -n "$PROJSEL" ] && [ -n "$KEY" ] || { usage; exit 1; }
PROJ="$(venv_project_name "$PROJSEL")" || { echo "✖ --project måste vara 'prod' eller 'staging'."; exit 1; }
if [ "$NORM" = 1 ] && [ "$KEY" != "DATABASE_URL" ]; then
  echo "✖ --normalize-db-url gäller endast DATABASE_URL."; exit 1
fi

TEAM="$(venv_team)"; TOKEN="$(venv_token)" || exit 1
PID="$(venv_pid "$PROJ")"; [ -n "$PID" ] || { echo "✖ Kunde inte resolva projekt-id för $PROJ."; exit 1; }
API="https://api.vercel.com"

# Läs nuvarande värde (för normalisering / visning).
F="$(mktemp)"; trap 'rm -f "$F"' EXIT
echo "Hämtar $PROJSEL ($PROJ) env..."
venv_pull "$PROJ" "$F" || { echo "✖ Kunde inte pulla $PROJSEL env (CLI-auth?)."; exit 1; }
CUR="$(venv_getval "$F" "$KEY")"
rm -f "$F"

if [ "$NORM" = 1 ]; then
  [ -n "$CUR" ] || { echo "✖ $KEY saknar nuvarande värde att normalisera."; exit 1; }
  NEW="$(venv_normalize_db_url "$CUR")"
  # Validera i fragment (undviker full URL-literal som secret-scan flaggar):
  if ! { printf '%s' "$NEW" | grep -q 'pooler\.supabase\.com' \
         && printf '%s' "$NEW" | grep -q ':6543/postgres?pgbouncer=true&connection_limit=1'; }; then
    echo "✖ Normaliserat värde matchar inte väntat pooler-format (pooler-host + :6543 + suffix) — avbryter."
    echo "  FÖRE: $(venv_mask "$CUR")"
    exit 1
  fi
  echo "FÖRE:  $(venv_mask "$CUR")"
  echo "EFTER: $(venv_mask "$NEW")"
  if [ "$CUR" = "$NEW" ]; then echo "✓ Redan korrekt — inget att göra."; exit 0; fi
else
  read -rsp "Nytt värde för $KEY ($PROJSEL): " NEW; echo
  [ -n "$NEW" ] || { echo "✖ Tom inmatning."; exit 1; }
  echo "NUVARANDE: $(venv_mask "$CUR")"
  echo "NYTT:      $(venv_mask "$NEW")"
fi

# Hitta env-id med target EXAKT [production] (delad-rad-skydd).
META=$(curl -s "$API/v9/projects/$PID/env?teamId=$TEAM" -H "Authorization: Bearer $TOKEN" \
  | KEY="$KEY" node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const e=(JSON.parse(d).envs||[]).find(x=>x.key===process.env.KEY&&JSON.stringify(x.target||[])==='[\"production\"]');process.stdout.write(e?e.id+'|'+e.type:'')})")
ENVID="${META%%|*}"; TYPE="${META##*|}"
[ -n "$ENVID" ] || { echo "✖ Hittade ingen $KEY-rad med target EXAKT [production] i $PROJ — avbryter (skyddar delade rader)."; exit 1; }
echo
echo "Plan (rör ENDAST denna rad):"
echo "  DELETE id=$ENVID  ($KEY, target=[production], type=$TYPE, projekt=$PROJ)"
echo "  CREATE $KEY [production] type=$TYPE"

if [ "$GO" -ne 1 ]; then
  echo; echo "DRY-RUN — inget skrivet. Lägg till --go för att utföra delete + create."; exit 0
fi

echo; echo "→ DELETE..."
DCODE=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$API/v9/projects/$PID/env/$ENVID?teamId=$TEAM" -H "Authorization: Bearer $TOKEN")
echo "  HTTP $DCODE"; [ "$DCODE" = 200 ] || { echo "✖ DELETE misslyckades — ingen create gjord."; exit 1; }

echo "→ CREATE..."
CCODE=$(NEWVAL="$NEW" KEY="$KEY" TY="$TYPE" node -e "process.stdout.write(JSON.stringify({key:process.env.KEY,value:process.env.NEWVAL,type:process.env.TY,target:['production']}))" \
  | curl -s -o /dev/null -w '%{http_code}' -X POST "$API/v10/projects/$PID/env?teamId=$TEAM" \
      -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' --data @-)
echo "  HTTP $CCODE"
{ [ "$CCODE" = 200 ] || [ "$CCODE" = 201 ]; } || { echo "✖ CREATE misslyckades (HTTP $CCODE). $KEY saknas nu — kör om."; exit 1; }
echo "✓ $KEY satt i $PROJSEL. Redeploy krävs för att gälla."
