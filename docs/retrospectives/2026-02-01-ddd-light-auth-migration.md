# Retrospektiv: Auth DDD-Light Migration (Fas 3)

**Datum:** 2026-02-01
**Agenter:** tech-architect, test-lead
**Scope:** Auth migrerad till repository + service + factory pattern (3 routes + NextAuth credentials)
**Föregående:** [Booking DDD-Light - BookingStatus VO + Factory (Fas 2)](./2026-02-01-ddd-light-booking-status-vo.md)

---

## Resultat

- 7 nya filer (IAuthRepository, PrismaAuthRepository, MockAuthRepository, index.ts, AuthService, AuthService.test.ts, mapAuthErrorToStatus)
- 7 ändrade filer (3 routes, 3 route-tester, auth.ts)
- 1028/1028 tester gröna, 0 TypeScript-fel
- 21 nya service-tester med MockAuthRepository
- 18 route-tester migrerade från Prisma-mockar till service-mockar
- Totalt: 39 auth-specifika tester
- Säkerhetsfix: verify-email `include: { user: true }` -> `select` (passwordHash-exponering eliminerad)

---

## Tech-architect: Vad gick bra

### 1. Auth-domänen bevisade att "inget IRepository<T>" kan vara rätt val
Auth utökade INTE `IRepository<T>` base interface. Istället specialiserade metoder: `findUserByEmail()` returnerar bara `{ id }`, `findUserWithCredentials()` är enda metoden med passwordHash, `findUserForResend()` ger minimal projektion. Auth är inte ett "aggregat med CRUD" -- det är specialiserade operationer. Att tvinga in den i IRepository hade gett felaktig abstraktion.

### 2. Projection-driven security direkt från repository-design
Dedikerade select-objekt (`authUserSelect`, `credentialsSelect`, `resendSelect`, `verificationTokenSelect`) gör det explicit vilken data varje metod returnerar. `passwordHash` exponeras av EXAKT EN metod: `findUserWithCredentials()`. Arkitektonisk säkerhet -- omöjligt att låta passwordHash igenom via fel kodflöde.

verify-email fixades under migrering: `include: { user: true }` -> `verificationTokenSelect` med nested select. Buggen hittades passivt -- inte via manuell granskning.

### 3. Factory-pattern med injicerbara dependencies från start
`createAuthService()` injicerar: hashPassword, comparePassword, generateToken (deterministisk i tester), emailService. Ger 100% isolerade service-tester utan Prisma, bcrypt eller email-API. Direkt lärdom från Review-piloten (som saknade factory).

### 4. Centraliserad error-mapping från början
`mapAuthErrorToStatus.ts` (24 rader) definierar ALLA error -> HTTP status. Säkerhetskritiskt: token-fel returnerar 400 (inte 404) så angripare inte kan lista giltiga tokens. EN fil, använd av 3 routes.

### 5. $transaction abstraktion i repository
`verifyEmail(userId, tokenId)` använder `$transaction` för atomisk update av user + token. Service-lagret anropar en enda metod -- vet inget om Prisma transactions.

### 6. NextAuth använder AuthService -- konsistent DI
`src/lib/auth.ts` anropar `createAuthService().verifyCredentials()`. NextAuth Credentials provider är nu en adapter -- samma service som routes. Konsistent security, testbar auth-logik, noll duplicering. Unikt för Auth -- inga andra domäner integrerar med NextAuth.

### 7. Routes blev minimala
- register: 136 -> 86 rader (-37%)
- verify-email: 85 -> 51 rader (-40%)
- resend-verification: 87 -> 55 rader (-37%)

Routes är nu HTTP-adapters. Business logic bor i service.

---

## Tech-architect: Förbättringsförslag

### 1. Felmeddelanden hårdkodade i service-lagret
`verifyEmail()` returnerar svenska strängkonstanter ("Ogiltig eller utgången verifieringslänk"). Om vi bygger en engelsk version måste vi duplicera felmeddelanden. Result bör bara returnera error-typer -- routes kan mappa till lokaliserade strängar.

**Prioritet:** Medium. Fungerar för MVP men blockar internationalisering.

### 2. Fire-and-forget email ger ingen feedback vid fel
`register()` och `resendVerification()` använder `.catch(() => {})`. Om email-service är nere lyckas registreringen men inget mail skickas. Resend-funktionen finns som fallback, men ett `emailSent: boolean` i `RegisterResult` vore bättre.

**Prioritet:** Låg. Email-fel är ovanliga.

### 3. Token expiry duplicerad (24h på 2 ställen)
`register()` och `resendVerification()` har båda `new Date(Date.now() + 24 * 60 * 60 * 1000)`. Bör vara en konstant: `private readonly TOKEN_TTL_MS = 24 * 60 * 60 * 1000`.

**Prioritet:** Låg. Kod-kvalitet.

---

## Test-lead: Styrkor

### 1. DI-baserad mock-isolation -- mognad över tidigare migreringar
Dependency injection av bcrypt (`hashPassword: async (pw) => "hashed:" + pw`) och crypto (`generateToken: () => "test-token-1"`) är en arkitektonisk uppgradering. Inga fragila bcrypt/crypto-mockar. Alla 21 domain-tester är oberoende och körar på <1s.

### 2. Säkerhetstestning på rätt nivå
- **Enumeration prevention**: `resendVerification` returnerar `Result.ok()` oavsett om email finns/verifierad. Testat i domänen (inte bara routes).
- **passwordHash-exkludering**: Explicit test (`expect('passwordHash' in result.value.user).toBe(false)`) förhindrar regressioner.
- **Credential timing-attack**: `verifyCredentials` returnerar samma `INVALID_CREDENTIALS`-fel för unknown email och wrong password.

### 3. Token-hantering -- komplett livscykel
5 tester täcker alla states: valid, not found, already used, expired, atomic update. `verifyEmail` verifierar att både `token.usedAt` OCH `user.emailVerified` uppdateras.

### 4. Route-testernas evolution
Single mock point (`vi.mock("@/domain/auth/AuthService")`) ersätter 18 Prisma/bcrypt-mockar. HTTP-kontrakt-fokus bevarad: Zod-fel (400), rate limiting (429), JSON parse-fel (400) testas fortfarande.

### 5. Seedable MockRepository
`seedUser()`, `seedProvider()`, `seedToken()` för att sätta upp komplexa scenarion utan att gå via register-flödet. `getUsers()`, `getProviders()`, `getTokens()` för verifikation.

---

## Test-lead: Gaps och förbättringar

### 1. Concurrency-tester saknas

| Scenario | Testat? | Risk |
|----------|---------|------|
| Samtidiga register med samma email | Nej | Hög - kan skapa duplicerade users vid race |
| Samtidig verifyEmail för samma token | Nej | Medium - dubbel token-användning |
| Rate limiting per-IP vs global | Bara basic | Medium |

**Rekommendation:** Lägg till 2-3 concurrency-tester med `Promise.all()`.

### 2. Error-propagering från repository
Domäntesterna antar att repository returnerar data eller null. Vad händer om Prisma kastar databasfel? Lägg till 1-2 tester där MockRepository kastar fel.

### 3. Email-service felhantering
Mock emailService kastar aldrig fel. Explicit test: emailService.sendVerification kastar -> register hanterar gracefully.

### 4. Provider-registrering edge case
Saknas test för `register` med `userType: "provider"` + `businessName: undefined`. Valideras av Zod i routes men inte i domänen.

---

## Test Quality Scorecard

| Metrik | Betyg | Kommentar |
|--------|-------|-----------|
| Coverage (Domain) | 9/10 | 21 tester täcker alla publika metoder. -1 för saknad concurrency. |
| Coverage (Routes) | 8/10 | 18 tester, HTTP-kontrakt-fokus. -2 för begränsad rate limit edge cases. |
| Mock Strategy | 10/10 | DI-baserade mocks för bcrypt/crypto/email. Zero external dependencies. |
| Security Testing | 8/10 | Enumeration, passwordHash, credential timing testat. -2 för saknad concurrency. |
| Test Maintainability | 10/10 | Zero Prisma-mockar i domain-tester, seedable MockRepository. |
| Error Handling | 6/10 | Happy path + kända fel. Saknas: DB-fel, email-fel, concurrency. |
| Performance | 10/10 | 39 tester på <1s. Inga DB/bcrypt/network-calls. |
| **Totalt** | **8.7/10** | Solid -- högst betyg av alla migreringar hittills. |

---

## Konkreta actions

### Gjort (i denna session)
- [x] IAuthRepository interface + typer med strikta projektioner
- [x] PrismaAuthRepository med `select` överallt
- [x] MockAuthRepository med seed-helpers
- [x] AuthService med TDD (21 tester)
- [x] mapAuthErrorToStatus centraliserad
- [x] 3 routes migrerade till AuthService
- [x] 3 route-tester migrerade till service-mockar
- [x] auth.ts migrerad till verifyCredentials()
- [x] verify-email fixad: `include` -> `select`
- [x] 1028/1028 tester gröna, 0 TypeScript-fel

### Gör snart (medium)
- [ ] Extrahera token TTL till konstant (duplicerad 24h)
- [ ] Lägg till concurrency-tester (Promise.all register)
- [ ] Lägg till error-propagering-tester (repository kastar)

### Gör vid nästa fas (Fas 4: Test-coverage)
- [ ] rate-limit.ts tester (säkerhetskritisk)
- [ ] auth-server.ts tester
- [ ] Flytta felmeddelanden från service till routes (i18n-förberedelse)

---

## Learnings

Dessa learnings propageras till CLAUDE.md:

- **Specialized repository > generic IRepository för auth**: Auth är inte CRUD -- det är specialiserade operationer (register, verify, login). Att skippa IRepository<T> och definiera precis de metoder som behövs ger bättre typsäkerhet och tydligare security boundaries.
- **Projection-driven security hittar buggar passivt**: verify-email använde `include: { user: true }` (exponerade passwordHash). Migrering till `select` i repository fixade buggen utan separat säkerhetsgranskning.
- **DI för bcrypt/crypto eliminerar fragila mocks**: Injicera `hashPassword`/`comparePassword`/`generateToken` istället för att mocka moduler. Ger deterministiska, snabba tester utan `vi.mock('bcrypt')`.
- **Factory pattern fungerar utanför routes**: `createAuthService()` används både i routes OCH i NextAuth authorize-callback. Bevisar att factory-pattern är generellt användbart, inte route-specifikt.
- **Error-kontrakt före implementation (bekräftat 3:e gången)**: TOKEN_NOT_FOUND -> 400 (inte 404 -- säkerhet), INVALID_CREDENTIALS -> 401, EMAIL_NOT_VERIFIED -> 403. Bestämdes i planen, noll förvirring under implementation.
- **Migrering som säkerhetsgranskning**: Att systematiskt gå igenom varje route avslöjar `include`-buggar, saknad `select`, och inkonsekvent felhantering. DDD-Light-migrering fungerar som passiv security audit.

---

## Jämförelse med tidigare migreringar

| Metrik | Review (1.1) | Horse (1.2) | GroupBooking (1.3) | Booking VO (2) | Auth (3) |
|--------|-------------|-------------|-------------------|----------------|----------|
| Nya filer | 5 | 4 | 5 | 2 | 7 |
| Ändrade filer | 6 | 6 | 14 | 5 | 7 |
| Nya tester | 14 | 17 | 25 | 41 | 21 |
| Totala tester | 915 | 940 | 968 | 1007 | 1028 |
| Pattern | Repo + Service | Repo + Service | Repo + Service + Factory | VO + Service + Factory | Repo + Service + Factory |
| Scope | 3 routes | 7 routes | 8 routes | 2 routes | 3 routes + auth.ts |
| Unique | Pilot | mapErrorToStatus | Aggregate, 5 deps | Value object | Specialized repo, NextAuth |

**Trend:** 5 migreringar genomförda. Varje migrering applicerar lärdomar från föregående. Auth hade högst test quality scorecard (8.7/10) och introducerade nytt mönster (specialized repo utan IRepository base).

---

*Skapad: 2026-02-01*
*Föregående retrospektiv: [Booking DDD-Light - BookingStatus VO](./2026-02-01-ddd-light-booking-status-vo.md)*
*Refaktoreringsplan: [DDD-TDD-REFACTORING-PLAN.md](../DDD-TDD-REFACTORING-PLAN.md)*
