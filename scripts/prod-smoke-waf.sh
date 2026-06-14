#!/usr/bin/env bash
#
# prod-smoke-waf.sh — skapa/uppdatera Vercel WAF-regeln "prod-smoke bypass" och
# placera den FÖRST (före "Geo-block non-EU traffic"), så att CI:s prod-smoke
# (icke-EU runner) slipper geo-block-challengen NÄR den skickar headern
# x-prod-smoke-bypass med rätt secret. Ingen annan trafik påverkas.
#
# DRY-RUN är default. Skrivande ändring kräver APPLY=1.
# Idempotent: uppdaterar regeln om den finns, annars skapar den. Sätter alltid prio 1.
# Skriver ALDRIG ut secret (maskeras som ***).
#
# Secret läses från env PROD_SMOKE_BYPASS_SECRET (samma som GitHub Secret).
# Token/team/projekt läses från VERCEL_API_TOKEN / .vercel/project.json / CLI-auth.
#
# Användning:
#   bash scripts/prod-smoke-waf.sh           # DRY-RUN (read-only, visar planerad ändring)
#   APPLY=1 bash scripts/prod-smoke-waf.sh    # SKRIVER
#
set -euo pipefail

RULE_NAME="prod-smoke bypass"
HEADER="x-prod-smoke-bypass"
GEO_RULE_NAME="Geo-block non-EU traffic"
APPLY="${APPLY:-0}"

[[ -f .vercel/project.json ]] || { echo "FEL: .vercel/project.json saknas (vercel link?)." >&2; exit 1; }
PID=$(node -e "console.log(require('./.vercel/project.json').projectId)")
TEAM=$(node -e "console.log(require('./.vercel/project.json').orgId)")
TOKEN="${VERCEL_API_TOKEN:-$(node -e "try{console.log(require(process.env.HOME+'/Library/Application Support/com.vercel.cli/auth.json').token)}catch(e){process.exit(0)}")}"
[[ -n "$TOKEN" ]] || { echo "FEL: ingen Vercel-token (VERCEL_API_TOKEN eller CLI-auth)." >&2; exit 1; }

if [[ -z "${PROD_SMOKE_BYPASS_SECRET:-}" ]]; then
  echo "FEL: PROD_SMOKE_BYPASS_SECRET är inte satt i env (samma värde som GitHub Secret)." >&2
  exit 1
fi

API="https://api.vercel.com/v1/security/firewall/config"
auth=(-H "Authorization: Bearer $TOKEN")

# Hämta aktiv config (read-only)
CONFIG=$(curl -s "${API}/active?projectId=${PID}&teamId=${TEAM}" "${auth[@]}")

# Hitta ev. befintlig regel-id + geo-block-id via node
read -r EXISTING_ID GEO_ID < <(node -e '
  const j=JSON.parse(require("fs").readFileSync(0,"utf8"));
  const f=(j.rules||[]);
  const e=f.find(r=>r.name===process.argv[1]); const g=f.find(r=>r.name===process.argv[2]);
  console.log((e&&e.id)||"-", (g&&g.id)||"-");
' "$RULE_NAME" "$GEO_RULE_NAME" <<<"$CONFIG")

# Bygg regel-värdet (secret maskeras vid utskrift, riktigt värde bara i APPLY-payload)
build_value() { # build_value <secret-or-mask>
  node -e '
    const secret=process.argv[1];
    console.log(JSON.stringify({
      name: process.argv[2],
      description: "Bypass geo-block/system challenge for CI prod-smoke (secret header)",
      active: true,
      conditionGroup: [{ conditions: [
        { type:"header", key: process.argv[3], op:"eq", neg:false, value: secret } ]}],
      action: { mitigate: { action:"bypass", bypassSystem:true } }
    }));
  ' "$1" "$RULE_NAME" "$HEADER"
}

echo "== prod-smoke WAF setup =="
echo "  projekt:        $PID  (team $TEAM)"
echo "  regel:          \"$RULE_NAME\"  (header $HEADER == ***)"
echo "  geo-block-id:    $GEO_ID"
if [[ "$EXISTING_ID" != "-" ]]; then
  echo "  åtgärd:         UPPDATERA befintlig regel ($EXISTING_ID) + sätt prio 1 (först)"
else
  echo "  åtgärd:         SKAPA ny regel + sätt prio 1 (först, före geo-block)"
fi
echo "  planerad payload (secret maskerad):"
echo "    $(build_value '***')"

if [[ "$APPLY" != "1" ]]; then
  echo
  echo "DRY-RUN — inget skrivet. Kör med APPLY=1 för att tillämpa."
  exit 0
fi

echo
echo "APPLY=1 — skriver ändring..."
post() { curl -s -X PUT "${API}?projectId=${PID}&teamId=${TEAM}" "${auth[@]}" -H "Content-Type: application/json" --data @-; }

if [[ "$EXISTING_ID" != "-" ]]; then
  node -e 'process.stdout.write(JSON.stringify({action:"rules.update",id:process.argv[1],value:JSON.parse(process.argv[2])}))' \
    "$EXISTING_ID" "$(build_value "$PROD_SMOKE_BYPASS_SECRET")" | post >/dev/null
  RID="$EXISTING_ID"
else
  node -e 'process.stdout.write(JSON.stringify({action:"rules.insert",id:null,value:JSON.parse(process.argv[1])}))' \
    "$(build_value "$PROD_SMOKE_BYPASS_SECRET")" | post >/dev/null
  # Hämta nytt id
  RID=$(curl -s "${API}/active?projectId=${PID}&teamId=${TEAM}" "${auth[@]}" \
        | node -e 'const j=JSON.parse(require("fs").readFileSync(0,"utf8"));const r=(j.rules||[]).find(x=>x.name===process.argv[1]);console.log(r?r.id:"")' "$RULE_NAME")
fi
[[ -n "$RID" ]] || { echo "FEL: kunde inte hitta regel-id efter skrivning." >&2; exit 1; }

# Sätt prioritet 1 (först)
node -e 'process.stdout.write(JSON.stringify({action:"rules.priority",id:process.argv[1],value:1}))' "$RID" | post >/dev/null

echo "Klart. Verifierar ordning:"
curl -s "${API}/active?projectId=${PID}&teamId=${TEAM}" "${auth[@]}" \
 | node -e 'const j=JSON.parse(require("fs").readFileSync(0,"utf8"));(j.rules||[]).forEach((r,i)=>console.log(`  [${i}] ${r.name}`))'
echo "Regeln \"$RULE_NAME\" ska ligga FÖRE \"$GEO_RULE_NAME\"."
