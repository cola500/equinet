---
title: "Retrospektiv: WidgetKit + Token-baserad API-auth"
description: "MobileToken-modell, JWT-auth, API-endpoints, iOS Keychain/Widget-infra"
category: retrospective
status: complete
last_updated: 2026-03-08
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan forbattras
  - Patterns att spara
  - 5 Whys
  - Larandeeffekt
---

# Retrospektiv: WidgetKit + Token-baserad API-auth

**Datum:** 2026-03-08
**Scope:** MobileToken-modell, JWT-baserad auth for iOS widget, API-endpoints, Keychain/App Group-infra, WidgetKit extension

---

## Resultat

- 7 andrade filer, 27 nya filer, 1 ny migration
- 54 nya tester (alla TDD, alla grona)
- 3113 totala tester (inga regressioner)
- Typecheck = 0 errors, Lint = 0 errors
- Tid: ~1 session (2 context windows)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Schema | `prisma/schema.prisma`, migration | MobileToken-modell med SHA-256 hash, userId, deviceName, expiry |
| Repository | `src/infrastructure/persistence/mobile-token/` (4 filer) | IMobileTokenRepository, PrismaMobileTokenRepository (med `$transaction` for atomisk rotation), MockMobileTokenRepository |
| Domain | `src/domain/auth/MobileTokenService.ts` | JWT-generering (jose/HS256), verifiering, refresh med rotation, revoke. Max 5 aktiva tokens per anvandare. MaxTokensExceededError |
| API | `src/app/api/auth/mobile-token/route.ts` | POST (generera token, session auth, rate limit) + DELETE (revoke, Bearer auth) |
| API | `src/app/api/auth/mobile-token/refresh/route.ts` | POST (refresh med rotation, rate limit) |
| API | `src/app/api/widget/next-booking/route.ts` | GET (nasta bokning, Bearer auth, minimal select) |
| Lib | `src/lib/mobile-auth.ts` | Singleton MobileTokenService factory + `authFromMobileToken()` helper |
| Lib | `src/lib/native-bridge.ts` | `isNativeApp()`, `sendToNative()`, `requestMobileTokenForNative()` |
| Lib | `src/lib/rate-limit.ts` | `mobileToken` rate limiter (5/h Upstash, 50/h in-memory dev) |
| UI | `src/app/(auth)/login/page.tsx` | Fire-and-forget bridge-anrop efter inloggning |
| iOS | `ios/Equinet/Equinet/KeychainHelper.swift` | Keychain CRUD med App Group access |
| iOS | `ios/Equinet/Equinet/SharedDataManager.swift` | App Group UserDefaults for widget-data |
| iOS | `ios/Equinet/Equinet/APIClient.swift` | Actor-baserad HTTP-klient med Bearer auth, refresh-logik |
| iOS | `ios/Equinet/Equinet/WidgetBooking.swift` | Codable structs (delas med widget-target) |
| iOS | `ios/Equinet/Equinet/BridgeHandler.swift` | Nya meddelanden: requestMobileToken, mobileTokenReceived/Error |
| iOS | `ios/Equinet/Equinet/ContentView.swift` | Token-refresh i scenePhase .active |
| iOS | `ios/Equinet/Equinet/Equinet.entitlements` | App Group `group.com.equinet.shared` |
| iOS Widget | `ios/Equinet/EquinetWidget/` (6 filer) | WidgetKit extension: TimelineProvider, Small+Medium views, entitlements |
| Tester | 6 testfiler | MobileTokenService (19), mobile-auth (7), route tests (28) |

## Vad gick bra

### 1. TDD fangade jose v6/jsdom-inkompatibilitet tidigt
jose v6:s `FlattenedSign` kraver `Uint8Array` och fungerar inte i jsdom-miljo. Genom att skriva tester forst upptacktes detta omedelbart. Fix: `@vitest-environment node` directive pa alla JWT-testfiler.

### 2. DDD-Light repository-monster ateranvandes effektivt
Hela MobileToken-domanen foljde Review-monstret (IRepository -> Mock -> Prisma -> Service -> Route). MockMobileTokenRepository anvands i alla domain-tester, Prisma-implementationen i production.

### 3. Sakerhetsagent fangade tre legitima forbattringar
Security-reviewer identifierade: saknad rate limiting pa refresh, inget tak pa aktiva tokens, och icke-atomisk token-rotation. Alla tre fixades med TDD innan sessionen avslutades.

### 4. Feature flag borttogs pa begaran utan friktion
Anvandaren insag att `ios_widget` feature flag var overflod for en app-feature. Borttagningen var ren -- 6 filer andrades, inga regressioner.

## Vad kan forbattras

### 1. Sakerhetsagenten hade hog false-positive-rate
Av 9 fynd var 6 felaktiga (missade befintlig rate limiting, missforstod Bearer-auth i DELETE, pastad PII i JWT som inte fanns, etc). Agenten saknade kontext om redan implementerad kod.

**Prioritet:** MEDEL -- agenten behover battre kontext-insamling fore analys

### 2. Context window tog slut mitt i feature flag-borttagningen
Sessionen delades i tva context windows. Den andra borjade med att lasa filer som redan var lasta. Overhead: ~5 minuter.

**Prioritet:** LAG -- oundvikligt vid stora 6-fas-planer, kompaktificeringen fungerade bra

## Patterns att spara

### MobileToken JWT-monster
- **jose HMAC-SHA256**: `new SignJWT({sub, type, jti}).setProtectedHeader({alg:"HS256"}).sign(key)`
- **SHA-256 hash i DB**: `createHash("sha256").update(jwt).digest("hex")` -- aldrig klartext
- **Token-rotation vid refresh**: Revoke old + create new i `prisma.$transaction([])`
- **Max aktiva tokens**: `countActiveForUser()` + `MaxTokensExceededError` -> 409 i route
- **Bearer-auth helper**: `authFromMobileToken(request)` extraherar + verifierar i ett steg

### Vitest + jose gotcha
`@vitest-environment node` MASTE anges som kommentardirektiv i testfiler som använder jose. jsdom-miljon saknar korrekt Uint8Array-hantering for jose v6.

### Atomisk repository-operation
`revokeAndCreate(revokeId, createData)` wrappat i `prisma.$transaction([])` for operationer som maste lyckas eller misslyckas tillsammans.

## 5 Whys (Root-Cause Analysis)

### Problem: jose v6 TypeError i jsdom-miljo
1. Varfor? `FlattenedSign` kastar `TypeError: payload must be an instance of Uint8Array`
2. Varfor? jsdom laddar jose:s webapi-build som har annan Uint8Array-hantering
3. Varfor? Vitest defaultar till jsdom-miljo for alla tester
4. Varfor? Projektet har `environment: "jsdom"` i vitest.config.ts (for React-komponenter)
5. Varfor? Det finns ingen per-fil override som standard

**Åtgärd:** `@vitest-environment node` som kommentardirektiv i alla server-only testfiler som använder kryptografi
**Status:** Implementerad

### Problem: Sakerhetsagent rapporterade felaktiga fynd
1. Varfor? Agenten sa att rate limiting saknades pa POST /mobile-token (det fanns)
2. Varfor? Agenten laste filerna men missade `rateLimiters.mobileToken`-anropet
3. Varfor? Agenten hade inte kontext om vilka ändringar som gjorts under sessionen
4. Varfor? Background-agenten startades innan feature flag-borttagningen var klar
5. Varfor? Agenten laste originalkoden, inte den uppdaterade versionen

**Åtgärd:** Starta sakerhetsagenten EFTER alla ändringar ar klara, inte parallellt med pågående arbete
**Status:** Lard for framtida sessioner

## Larandeeffekt

**Nyckelinsikt:** Token-baserad auth for iOS-widgets foljer samma DDD-Light-monster som all annan domanlogik i projektet. Det kravde inga nya patterns -- bara tillampning av befintliga (Repository, Service, Route, TDD). Den storsta utmaningen var jose:s jsdom-inkompatibilitet, inte arkitekturen. Sakerhetsagenten ar vardefull men bor startas efter implementationen ar helt klar.
