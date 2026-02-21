# Retrospektiv: Rate limiting for /api/health GET endpoint

**Datum:** 2026-02-21
**Scope:** Lade till rate limiting pa GET-handlern i /api/health for att forhindra databasmissbruk

---

## Resultat

- 1 andrad fil, 1 ny fil (+29/-2 rader)
- 5 nya tester (alla TDD, alla grona)
- 2165 totala tester (inga regressioner)
- Typecheck = 0 errors
- Tid: ~15 min

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| API | `src/app/api/health/route.ts` | Rate limiting med `rateLimiters.api` (100 req/min) pa GET, HEAD oforandrad |
| Test | `src/app/api/health/route.test.ts` | 5 tester: GET 200/503/429, HEAD 200/no-rate-limit |

## Vad gick bra

### 1. Kirurgisk precision
Sessionen var extremt fokuserad: 1 sak att gora, 2 filer, 15 minuter. Inget scope creep. Sakerhetsgranskaren flaggade problemet, vi fixade exakt det.

### 2. TDD-cykeln var kristallklar
RED-fasen visade exakt ett test som failade (429), ovriga 4 passerade direkt. GREEN-fasen krande bara tillagget av 3 imports + 8 rader rate-limiting-kod. Ingen refactor behovdes.

### 3. Befintlig infrastruktur atervandes
`rateLimiters.api` och `getClientIP` fanns redan. Noll ny infrastruktur, noll nya beroenden. Monstret kopierades rakt av fran ovriga API-routes.

## Vad kan forbattras

### 1. Health-endpoint saknade tester sedan start
Att `/api/health` var den enda API-routen utan bade rate limiting OCH tester visar att "enkel" kod tenderar att hoppa over quality gates. Nu har den 5 tester och rate limiting.

**Prioritet:** LAG -- nu fixat, men bra paminnelse att inkludera alla routes i test-coverage fran start.

## Patterns att spara

### Rate limiting pa publika GET-endpoints
Oautentiserade GET-endpoints som gor databasanrop MASTE rate-limitas aven om de verkar ofarliga. `/api/health` gor `SELECT 1` -- 100 req/min fran en angripare = 100 DB-roundtrips/min. Anvand `rateLimiters.api` + `getClientIP` som standard for alla publika endpoints.

### Separera HEAD fran GET for connectivity-probes
HEAD-handlers som returnerar `new Response(null, { status: 200 })` behover INTE rate limiting -- noll berakning, noll DB. Att lagga till Redis-lookup pa HEAD gor connectivity-proben langsammare utan sakerhetsvinst.

## Larandeeffekt

**Nyckelinsikt:** "Enkla" endpoints som saknar auth ar sarskilt viktiga att rate-limita -- just for att de ar publika och narbara utan credentials ar de enklast att missbruka.
