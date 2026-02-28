# Retrospektiv: Test Coverage för Säkerhetskritiska Filer (Fas 4)

**Datum:** 2026-02-01
**Agenter:** tech-architect, test-lead
**Scope:** Dedikerade tester för rate-limit.ts, auth-server.ts, logger.ts + luckor i auth route-tester
**Föregående:** [Auth DDD-Light Migration (Fas 3)](./2026-02-01-ddd-light-auth-migration.md)

---

## Resultat

- 3 nya testfiler, 3 modifierade route-testfiler
- 61 nya tester (21 + 8 + 27 + 5)
- 1089/1089 tester gröna, 0 regressioner
- 1 produktionsbugg fixad (register-route JSON-parsing + rate limit-ordning)

| Fil | Före | Efter |
|-----|------|-------|
| `rate-limit.ts` | ~39% | 90.27% |
| `auth-server.ts` | 0% | 100% |
| `logger.ts` | ~41% | 95.91% |

---

## Tech-architect: Vad gick bra

### 1. TDD avslöjade produktionsbugg i register-routen
Att skriva test för "invalid JSON" avslöjade att `request.json()` inte hade try-catch -- ogiltig JSON returnerade 500 istället för 400. Testet hittade också att rate limiting skedde EFTER JSON-parsing, vilket lät angripare spamma utan att trigga rate limit.

### 2. Rate limit-testerna fungerar som levande säkerhetsdokumentation
21 tester dokumenterar: XSS-skydd i IP-validering, IPv6-stöd, fail-open vid Upstash-fel, separata räknare per identifier. Framtida utvecklare förstår varför koden är skriven som den är.

### 3. Behavior-based testing för Upstash-mode
Mockar `Ratelimit.limit()` kontraktet (true/false) istället för in-memory-implementationen. När vi byter från in-memory till Upstash behöver inte testerna skrivas om.

### 4. Logger-tester täckte både production OCH development mode
Separata suites för JSON-output (production) och console.*-output (development). `process.env.NODE_ENV`-toggling med `vi.resetModules()` är rätt sätt att testa miljö-beroende kod.

### 5. Auth-server-tester fångar alla null/undefined-varianter
4 tester täcker: null session, undefined user, null user. Kritiskt för säkerhet -- missad null-check kan autentisera icke-existent användare.

---

## Tech-architect: Vad kunde vi göra bättre

### 1. Saknar baseline-mätning innan Fas 4
Coverage-siffror (39% -> 90%) är manuellt verifierade. En checkad coverage-baseline.json före Fas 4 hade gjort framsteg lättare att spåra.

### 2. Logger-testet dokumenterar PII-problemet utan att lösa det
Test visar att `password: "secret123"` loggas rakt av. Dokumenterar beteendet men skapar ingen riktig fix. Bör bli en issue/tech debt.

---

## Test-lead: Testkvalitet

### 1. Dubbel miljö-testning fungerar väl
rate-limit testar både in-memory och Upstash-mode via env-var toggling + `vi.resetModules()`. Logger testar både production-mode (JSON) och development-mode (färgkodade console-metoder).

### 2. Class-baserade mocks för Upstash är robusta
`class MockRatelimit` + `class MockRedis` med `static slidingWindow()` mockar biblioteket korrekt. Exporterar `__mockLimit` för att kontrollera beteende från testerna.

### 3. Route-tester förblir behavior-based
Auth-route-testerna testar HTTP-kontrakt (status + response shape), inte Prisma-anrop. Överlever refactoring.

---

## Test-lead: Coverage-gap

### 1. Edge cases för rate limiting
Testar "exhaust limit" och "reset after window", men inte concurrent requests eller race conditions vid gränsen (request 49, 50, 51 samtidigt).

### 2. getClientIP saknar extrema edge cases
Testar XSS och IPv6, men inte HTTP header injection (newlines, null bytes) eller extremt långa strängar.

### 3. Logger PII-filtrering
Nuvarande implementation loggar känslig data rakt av. Testet dokumenterar detta men skyddar inte mot det.

---

## Rekommendationer för nästa steg

| Prio | Rekommendation | Motivering |
|------|---------------|------------|
| 1 | Fixa logger PII-filtrering eller dokumentera som policy | Känsliga fält (password, token) ska aldrig loggas |
| 2 | Lägg till security-audit checklist för nya routes | Rate limit före parsing, try-catch runt JSON, inga lösenord i logger |
| 3 | E2E-test för auth-flow (register -> verify -> login) | Unit-tester med mocks missar integrationsfel |

---

## Buggar hittade

| Bugg | Severity | Fix |
|------|----------|-----|
| Register-route: `request.json()` utan try-catch | Medium | Lade till try-catch, returnerar 400 + "Ogiltig JSON" |
| Register-route: Rate limiting efter JSON-parsing | High | Flyttade rate limiting före `request.json()` |

---

## Nyckeltal

| Metric | Före | Efter |
|--------|------|-------|
| Testfiler | 82 | 85 |
| Totalt tester | 1028 | 1089 |
| rate-limit.ts coverage | ~39% | 90.27% |
| auth-server.ts coverage | 0% | 100% |
| logger.ts coverage | ~41% | 95.91% |
