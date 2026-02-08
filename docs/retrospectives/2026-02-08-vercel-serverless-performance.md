# Retrospektiv: Vercel Serverless Performance & Supabase RLS

**Datum:** 2026-02-08
**Scope:** Fixa databas-timeouts i produktion genom region-flytt, connection pooling och dubbel-fetch-bugg

---

## Resultat

- 2 andrade filer, 0 nya filer, 0 nya migrationer (lokalt)
- 1 Supabase-migration (RLS via MCP, inte lokal)
- 0 nya tester (inga regressioner, 1298 totala tester)
- Typecheck = 0 errors
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Infrastruktur | `vercel.json` | Serverless region flytt: `iad1` (Virginia) -> `fra1` (Frankfurt) |
| UI | `src/app/providers/page.tsx` | Fix dubbel-fetch vid sidladdning (2 -> 1 API-anrop) |
| Databas | Supabase migration (remote) | RLS aktiverad pa `HorseServiceInterval` |
| Config | Vercel env vars (manuellt) | `connection_limit` 10 -> 1 for serverless |

## Vad gick bra

### 1. Systematisk rotorsaksanalys
Istallet for att gissa gick vi steg for steg: Supabase-loggar -> connection count -> Vercel deploy-region -> kod-analys. Hittade 3 separata problem som alla bidrog till timeouts.

### 2. Region-mismatch var en stor insikt
Vercel defaultar till `iad1` (Virginia) om man inte satter region explicit. Med Supabase i `eu-central-2` (Zurich) blev varje query ~150ms istallet for ~5ms. Multiplicerat med 3 queries per request + dubbel-fetch = 900ms+ per sidladdning.

### 3. Supabase MCP-verktyg for snabb diagnostik
`get_advisors`, `execute_sql` (pg_stat_activity) och `get_logs` gav snabb insyn i databas-halsa utan att behova logga in i dashboarden.

## Vad kan forbattras

### 1. Deploy utan commit
Deployade till Vercel innan koden var committad. Produktion och git-historik var ur synk. Borde alltid folja: commit -> push -> deploy.

**Prioritet:** HOG -- disciplin i deployment-workflow ar kritisk

### 2. Saknad region-konfiguration fran start
`vercel.json` borde ha haft `regions: ["fra1"]` fran dag 1 nar Supabase-projektet skapades i `eu-central-2`. Latens-problemet hade aldrig behovat uppsta.

**Prioritet:** MEDEL -- checklista for nya projekt behover inkludera region-matchning

## Patterns att spara

### Serverless + Supabase Best Practices
- **Region-matchning**: Vercel functions MASTE vara i samma region som Supabase DB. `fra1` for `eu-central-2`.
- **`connection_limit=1`**: Varje serverless-instans hanterar en request at gangen. Mer an 1 sluser poolern.
- **Undvik dubbel-fetch**: `useEffect` med tom dependency-array + debounce-effect som ocksa triggas pa mount = 2 requests. Lat debounce-effecten hantera initial load med `delay = 0`.

### Supabase RLS-checklista
Vid ny tabell: kontrollera alltid att RLS ar aktiverat. Kor `get_advisors(type: "security")` regelbundet.

## Larandeeffekt

**Nyckelinsikt:** Serverless-performance handlar inte bara om koden -- infrastruktur-konfiguration (region, connection pooling) ar ofta den storsta faktorn. En region-mismatch kan ge 30x hogre latens per query.
