# Retrospektiv: Test Coverage for Sakerhetskritiska Filer (Fas 4)

**Datum:** 2026-02-01
**Agenter:** tech-architect, test-lead
**Scope:** Dedikerade tester for rate-limit.ts, auth-server.ts, logger.ts + luckor i auth route-tester
**Foregaende:** [Auth DDD-Light Migration (Fas 3)](./2026-02-01-ddd-light-auth-migration.md)

---

## Resultat

- 3 nya testfiler, 3 modifierade route-testfiler
- 61 nya tester (21 + 8 + 27 + 5)
- 1089/1089 tester grona, 0 regressioner
- 1 produktionsbugg fixad (register-route JSON-parsing + rate limit-ordning)

| Fil | Fore | Efter |
|-----|------|-------|
| `rate-limit.ts` | ~39% | 90.27% |
| `auth-server.ts` | 0% | 100% |
| `logger.ts` | ~41% | 95.91% |

---

## Tech-architect: Vad gick bra

### 1. TDD avslojade produktionsbugg i register-routen
Att skriva test for "invalid JSON" avslojade att `request.json()` inte hade try-catch -- ogiltig JSON returnerade 500 istallet for 400. Testet hittade ocksa att rate limiting skedde EFTER JSON-parsing, vilket lat angripare spamma utan att triggra rate limit.

### 2. Rate limit-testerna fungerar som levande sakerhetsdokumentation
21 tester dokumenterar: XSS-skydd i IP-validering, IPv6-stod, fail-open vid Upstash-fel, separata raknare per identifier. Framtida utvecklare forstar varfor koden ar skriven som den ar.

### 3. Behavior-based testing for Upstash-mode
Mockar `Ratelimit.limit()` kontraktet (true/false) istallet for in-memory-implementationen. Nar vi byter fran in-memory till Upstash behover inte testerna skrivas om.

### 4. Logger-tester tackte bade production OCH development mode
Separata suites for JSON-output (production) och console.*-output (development). `process.env.NODE_ENV`-toggling med `vi.resetModules()` ar ratt satt att testa miljo-beroende kod.

### 5. Auth-server-tester fangar alla null/undefined-varianter
4 tester tacker: null session, undefined user, null user. Kritiskt for sakerhet -- missad null-check kan autentisera icke-existent anvandare.

---

## Tech-architect: Vad kunde vi gora battre

### 1. Saknar baseline-matning innan Fas 4
Coverage-siffror (39% -> 90%) ar manuellt verifierade. En checkad coverage-baseline.json fore Fas 4 hade gjort framsteg lattare att spara.

### 2. Logger-testet dokumenterar PII-problemet utan att losa det
Test visar att `password: "secret123"` loggas rakt av. Dokumenterar beteendet men skapar ingen riktig fix. Bor bli en issue/tech debt.

---

## Test-lead: Testkvalitet

### 1. Dubbel miljo-testning fungerar val
rate-limit testar bade in-memory och Upstash-mode via env-var toggling + `vi.resetModules()`. Logger testar bade production-mode (JSON) och development-mode (fargkodade console-metoder).

### 2. Class-baserade mocks for Upstash ar robusta
`class MockRatelimit` + `class MockRedis` med `static slidingWindow()` mockar biblioteket korrekt. Exporterar `__mockLimit` for att kontrollera beteende fran testerna.

### 3. Route-tester forblir behavior-based
Auth-route-testerna testar HTTP-kontrakt (status + response shape), inte Prisma-anrop. Overlever refactoring.

---

## Test-lead: Coverage-gap

### 1. Edge cases for rate limiting
Testar "exhaust limit" och "reset after window", men inte concurrent requests eller race conditions vid gransen (request 49, 50, 51 samtidigt).

### 2. getClientIP saknar extrema edge cases
Testar XSS och IPv6, men inte HTTP header injection (newlines, null bytes) eller extremt langa strangar.

### 3. Logger PII-filtrering
Nuvarande implementation loggar kanslig data rakt av. Testet dokumenterar detta men skyddar inte mot det.

---

## Rekommendationer for nasta steg

| Prio | Rekommendation | Motivering |
|------|---------------|------------|
| 1 | Fixa logger PII-filtrering eller dokumentera som policy | Kansliga falt (password, token) ska aldrig loggas |
| 2 | Lagg till security-audit checklist for nya routes | Rate limit fore parsing, try-catch runt JSON, inga losenord i logger |
| 3 | E2E-test for auth-flow (register -> verify -> login) | Unit-tester med mocks missar integrationsfel |

---

## Buggar hittade

| Bugg | Severity | Fix |
|------|----------|-----|
| Register-route: `request.json()` utan try-catch | Medium | Lade till try-catch, returnerar 400 + "Ogiltig JSON" |
| Register-route: Rate limiting efter JSON-parsing | High | Flyttade rate limiting fore `request.json()` |

---

## Nyckeltal

| Metric | Fore | Efter |
|--------|------|-------|
| Testfiler | 82 | 85 |
| Totalt tester | 1028 | 1089 |
| rate-limit.ts coverage | ~39% | 90.27% |
| auth-server.ts coverage | 0% | 100% |
| logger.ts coverage | ~41% | 95.91% |
