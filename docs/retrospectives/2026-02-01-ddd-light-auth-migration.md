# Retrospektiv: Auth DDD-Light Migration (Fas 3)

**Datum:** 2026-02-01
**Agenter:** tech-architect, test-lead
**Scope:** Auth migrerad till repository + service + factory pattern (3 routes + NextAuth credentials)
**Foregaende:** [Booking DDD-Light - BookingStatus VO + Factory (Fas 2)](./2026-02-01-ddd-light-booking-status-vo.md)

---

## Resultat

- 7 nya filer (IAuthRepository, PrismaAuthRepository, MockAuthRepository, index.ts, AuthService, AuthService.test.ts, mapAuthErrorToStatus)
- 7 andrade filer (3 routes, 3 route-tester, auth.ts)
- 1028/1028 tester grona, 0 TypeScript-fel
- 21 nya service-tester med MockAuthRepository
- 18 route-tester migrerade fran Prisma-mockar till service-mockar
- Totalt: 39 auth-specifika tester
- Sakerhetsfix: verify-email `include: { user: true }` -> `select` (passwordHash-exponering eliminerad)

---

## Tech-architect: Vad gick bra

### 1. Auth-domanen bevisade att "inget IRepository<T>" kan vara ratt val
Auth utokade INTE `IRepository<T>` base interface. Istallet specialiserade metoder: `findUserByEmail()` returnerar bara `{ id }`, `findUserWithCredentials()` ar enda metoden med passwordHash, `findUserForResend()` ger minimal projektion. Auth ar inte ett "aggregat med CRUD" -- det ar specialiserade operationer. Att tvinga in den i IRepository hade gett felaktig abstraktion.

### 2. Projection-driven security direkt fran repository-design
Dedikerade select-objekt (`authUserSelect`, `credentialsSelect`, `resendSelect`, `verificationTokenSelect`) gor det explicit vilken data varje metod returnerar. `passwordHash` exponeras av EXAKT EN metod: `findUserWithCredentials()`. Arkitektonisk sakerhet -- omojligt att lata passwordHash igenom via fel kodflode.

verify-email fixades under migrering: `include: { user: true }` -> `verificationTokenSelect` med nested select. Buggen hittades passivt -- inte via manuell granskning.

### 3. Factory-pattern med injicerbara dependencies fran start
`createAuthService()` injicerar: hashPassword, comparePassword, generateToken (deterministisk i tester), emailService. Ger 100% isolerade service-tester utan Prisma, bcrypt eller email-API. Direkt lardom fran Review-piloten (som saknade factory).

### 4. Centraliserad error-mapping fran borjan
`mapAuthErrorToStatus.ts` (24 rader) definierar ALLA error -> HTTP status. Sakerhetskritiskt: token-fel returnerar 400 (inte 404) sa angripare inte kan lista giltiga tokens. EN fil, anvand av 3 routes.

### 5. $transaction abstraktion i repository
`verifyEmail(userId, tokenId)` anvander `$transaction` for atomisk update av user + token. Service-lagret anropar en enda metod -- vet inget om Prisma transactions.

### 6. NextAuth anvander AuthService -- konsistent DI
`src/lib/auth.ts` anropar `createAuthService().verifyCredentials()`. NextAuth Credentials provider ar nu en adapter -- samma service som routes. Konsistent security, testbar auth-logik, noll duplicering. Unikt for Auth -- inga andra domaner integrerar med NextAuth.

### 7. Routes blev minimala
- register: 136 -> 86 rader (-37%)
- verify-email: 85 -> 51 rader (-40%)
- resend-verification: 87 -> 55 rader (-37%)

Routes ar nu HTTP-adapters. Business logic bor i service.

---

## Tech-architect: Forbattringsforslag

### 1. Felmeddelanden hardkodade i service-lagret
`verifyEmail()` returnerar svenska strangkonstanter ("Ogiltig eller utgangen verifieringslank"). Om vi bygger en engelsk version maste vi duplicera felmeddelanden. Result bor bara returnera error-typer -- routes kan mappa till lokaliserade strangar.

**Prioritet:** Medium. Fungerar for MVP men blockar internationalisering.

### 2. Fire-and-forget email ger ingen feedback vid fel
`register()` och `resendVerification()` anvander `.catch(() => {})`. Om email-service ar nere lyckas registreringen men inget mail skickas. Resend-funktionen finns som fallback, men ett `emailSent: boolean` i `RegisterResult` vore battre.

**Prioritet:** Lag. Email-fel ar ovanliga.

### 3. Token expiry duplicerad (24h pa 2 stallen)
`register()` och `resendVerification()` har bada `new Date(Date.now() + 24 * 60 * 60 * 1000)`. Bor vara en konstant: `private readonly TOKEN_TTL_MS = 24 * 60 * 60 * 1000`.

**Prioritet:** Lag. Kod-kvalitet.

---

## Test-lead: Styrkor

### 1. DI-baserad mock-isolation -- mognad over tidigare migreringar
Dependency injection av bcrypt (`hashPassword: async (pw) => "hashed:" + pw`) och crypto (`generateToken: () => "test-token-1"`) ar en arkitektonisk uppgradering. Inga fragila bcrypt/crypto-mockar. Alla 21 domain-tester ar oberoende och korar pa <1s.

### 2. Sakerhetstestning pa ratt niva
- **Enumeration prevention**: `resendVerification` returnerar `Result.ok()` oavsett om email finns/verifierad. Testat i domanen (inte bara routes).
- **passwordHash-exkludering**: Explicit test (`expect('passwordHash' in result.value.user).toBe(false)`) forhindrar regressioner.
- **Credential timing-attack**: `verifyCredentials` returnerar samma `INVALID_CREDENTIALS`-fel for unknown email och wrong password.

### 3. Token-hantering -- komplett livscykel
5 tester tackar alla states: valid, not found, already used, expired, atomic update. `verifyEmail` verifierar att bade `token.usedAt` OCH `user.emailVerified` uppdateras.

### 4. Route-testernas evolution
Single mock point (`vi.mock("@/domain/auth/AuthService")`) ersatter 18 Prisma/bcrypt-mockar. HTTP-kontrakt-fokus bevarad: Zod-fel (400), rate limiting (429), JSON parse-fel (400) testas fortfarande.

### 5. Seedable MockRepository
`seedUser()`, `seedProvider()`, `seedToken()` for att satta upp komplexa scenarion utan att ga via register-flodet. `getUsers()`, `getProviders()`, `getTokens()` for verifikation.

---

## Test-lead: Gaps och forbattringar

### 1. Concurrency-tester saknas

| Scenario | Testat? | Risk |
|----------|---------|------|
| Samtidiga register med samma email | Nej | Hog - kan skapa duplicerade users vid race |
| Samtidig verifyEmail for samma token | Nej | Medium - dubbel token-anvandning |
| Rate limiting per-IP vs global | Bara basic | Medium |

**Rekommendation:** Lagg till 2-3 concurrency-tester med `Promise.all()`.

### 2. Error-propagering fran repository
Domantesterna antar att repository returnerar data eller null. Vad hander om Prisma kastar databasfel? Lagg till 1-2 tester dar MockRepository kastar fel.

### 3. Email-service felhantering
Mock emailService kastar aldrig fel. Explicit test: emailService.sendVerification kastar -> register hanterar gracefully.

### 4. Provider-registrering edge case
Saknas test for `register` med `userType: "provider"` + `businessName: undefined`. Valideras av Zod i routes men inte i domanen.

---

## Test Quality Scorecard

| Metrik | Betyg | Kommentar |
|--------|-------|-----------|
| Coverage (Domain) | 9/10 | 21 tester tackar alla publika metoder. -1 for saknad concurrency. |
| Coverage (Routes) | 8/10 | 18 tester, HTTP-kontrakt-fokus. -2 for begransad rate limit edge cases. |
| Mock Strategy | 10/10 | DI-baserade mocks for bcrypt/crypto/email. Zero external dependencies. |
| Security Testing | 8/10 | Enumeration, passwordHash, credential timing testat. -2 for saknad concurrency. |
| Test Maintainability | 10/10 | Zero Prisma-mockar i domain-tester, seedable MockRepository. |
| Error Handling | 6/10 | Happy path + kanda fel. Saknas: DB-fel, email-fel, concurrency. |
| Performance | 10/10 | 39 tester pa <1s. Inga DB/bcrypt/network-calls. |
| **Totalt** | **8.7/10** | Solid -- hogst betyg av alla migreringar hittills. |

---

## Konkreta actions

### Gjort (i denna session)
- [x] IAuthRepository interface + typer med strikta projektioner
- [x] PrismaAuthRepository med `select` overallt
- [x] MockAuthRepository med seed-helpers
- [x] AuthService med TDD (21 tester)
- [x] mapAuthErrorToStatus centraliserad
- [x] 3 routes migrerade till AuthService
- [x] 3 route-tester migrerade till service-mockar
- [x] auth.ts migrerad till verifyCredentials()
- [x] verify-email fixad: `include` -> `select`
- [x] 1028/1028 tester grona, 0 TypeScript-fel

### Gor snart (medium)
- [ ] Extrahera token TTL till konstant (duplicerad 24h)
- [ ] Lagg till concurrency-tester (Promise.all register)
- [ ] Lagg till error-propagering-tester (repository kastar)

### Gor vid nasta fas (Fas 4: Test-coverage)
- [ ] rate-limit.ts tester (sakerhetskritisk)
- [ ] auth-server.ts tester
- [ ] Flytta felmeddelanden fran service till routes (i18n-forberedelse)

---

## Learnings

Dessa learnings propageras till CLAUDE.md:

- **Specialized repository > generic IRepository for auth**: Auth ar inte CRUD -- det ar specialiserade operationer (register, verify, login). Att skippa IRepository<T> och definiera precis de metoder som behovs ger battre typsakerhet och tydligare security boundaries.
- **Projection-driven security hittar buggar passivt**: verify-email anvande `include: { user: true }` (exponerade passwordHash). Migrering till `select` i repository fixade buggen utan separat sakerhetsgranskning.
- **DI for bcrypt/crypto eliminerar fragila mocks**: Injicera `hashPassword`/`comparePassword`/`generateToken` istallet for att mocka moduler. Ger deterministiska, snabba tester utan `vi.mock('bcrypt')`.
- **Factory pattern fungerar utanfor routes**: `createAuthService()` anvands bade i routes OCH i NextAuth authorize-callback. Bevisar att factory-pattern ar generellt anvandbart, inte route-specifikt.
- **Error-kontrakt fore implementation (bekraftat 3:e gangen)**: TOKEN_NOT_FOUND -> 400 (inte 404 -- sakerhet), INVALID_CREDENTIALS -> 401, EMAIL_NOT_VERIFIED -> 403. Bestamdes i planen, noll forvirring under implementation.
- **Migrering som sakerhetsgranskning**: Att systematiskt ga igenom varje route avslojjar `include`-buggar, saknad `select`, och inkonsekvent felhantering. DDD-Light-migrering fungerar som passiv security audit.

---

## Jamforelse med tidigare migreringar

| Metrik | Review (1.1) | Horse (1.2) | GroupBooking (1.3) | Booking VO (2) | Auth (3) |
|--------|-------------|-------------|-------------------|----------------|----------|
| Nya filer | 5 | 4 | 5 | 2 | 7 |
| Andrade filer | 6 | 6 | 14 | 5 | 7 |
| Nya tester | 14 | 17 | 25 | 41 | 21 |
| Totala tester | 915 | 940 | 968 | 1007 | 1028 |
| Pattern | Repo + Service | Repo + Service | Repo + Service + Factory | VO + Service + Factory | Repo + Service + Factory |
| Scope | 3 routes | 7 routes | 8 routes | 2 routes | 3 routes + auth.ts |
| Unique | Pilot | mapErrorToStatus | Aggregate, 5 deps | Value object | Specialized repo, NextAuth |

**Trend:** 5 migreringar genomforda. Varje migrering applicerar lardommar fran foregaende. Auth hade hogst test quality scorecard (8.7/10) och introducerade nytt monster (specialized repo utan IRepository base).

---

*Skapad: 2026-02-01*
*Foregaende retrospektiv: [Booking DDD-Light - BookingStatus VO](./2026-02-01-ddd-light-booking-status-vo.md)*
*Refaktoreringsplan: [DDD-TDD-REFACTORING-PLAN.md](../DDD-TDD-REFACTORING-PLAN.md)*
