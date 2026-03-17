---
title: Native iOS Profilsida
description: Retrospektiv for WebView->SwiftUI-migrering av profilsidan
category: retrospective
status: complete
last_updated: 2026-03-17
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan forbattras
  - Patterns att spara
  - 5 Whys
  - Larandeeffekt
---

# Retrospektiv: Native iOS Profilsida (WebView -> SwiftUI)

**Datum:** 2026-03-17
**Scope:** Migrering av leverantorsprofilen fran WebView till native SwiftUI med 2-tab layout (Profil + Installningar), feature-flaggade sektioner, och aggregerat API.

---

## Resultat

- 8 nya filer, 4 andrade filer, 0 nya migrationer
- 29 nya tester (16 Vitest + 13 XCTest), alla grona
- 3676 Vitest-tester + 158 iOS-tester (inga regressioner)
- Typecheck = 0 errors, Lint = 0 errors
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| API | `src/app/api/native/provider/profile/route.ts` | GET+PUT med Bearer JWT, rate limit, Zod .strict(), $transaction |
| API Test | `src/app/api/native/provider/profile/route.test.ts` | 16 tester: auth, rate limit, validation, CRUD |
| iOS Models | `ios/.../ProfileModels.swift` | ProviderProfile (computed profileCompletion), ProfileUser, GeocodeResult |
| iOS ViewModel | `ios/.../ProfileViewModel.swift` | @Observable @MainActor, DI via ProfileDataFetching, load/update/delete |
| iOS Test | `ios/.../ProfileViewModelTests.swift` | 13 tester: loading, personal/business/settings update, delete, completion |
| iOS Views | `ios/.../NativeProfileView.swift` | Segmented Picker (Profil/Installningar), feature-flaggade sektioner |
| iOS Views | `ios/.../ProfileFormSheet.swift` | Redigeringsformular med segmented picker (Personligt/Foretag) |
| iOS Views | `ios/.../DeleteAccountSheet.swift` | GDPR-bekraftelsedialog (skapad men oanvand, offloadad till WebView) |
| iOS Integration | `APIClient.swift` | fetchProfile, updateProfile, deleteAccount metoder |
| iOS Integration | `AppCoordinator.swift` | profileViewModel agare med DI |
| iOS Integration | `NativeMoreView.swift` | Native routing /provider/profile, reset vid logout |
| iOS Integration | `AuthenticatedView.swift` | Skickar profileViewModel till NativeMoreView |

## Vad gick bra

### 1. Fas-for-fas med verifieringsgates
Varje fas verifierades med tester + typecheck/build innan nasta fas paborrjades. Inga regressioner uppstod i slutverifieringen.

### 2. Befintliga monster atervands konsekvent
ServicesViewModel/ServiceModels/ServiceFormSheet var perfekta forlagor. Kodstrukturen ar nastan identisk vilket gor framtida underhall lattare.

### 3. Agent-granskning fangade kritisk bugg
Code-reviewer-agenten identifierade att `/api/account` anvander session auth (cookies), inte Bearer JWT. Delete account fran native app skulle alltid ge 401. Fixades genom att offloada till WebView.

### 4. Parallella agenter sparade tid
Fas 0 (ios-expert + cx-ux-reviewer) och Fas 6 (code-reviewer + security-reviewer) korde parallellt utan konflikter. Total agentgranskningstid: ~3 min per par, men med noll vantetid tack vare bakgrundskörning.

## Vad kan forbattras

### 1. DeleteAccountSheet skapades i onodan
Filen skapades innan auth-kompatibiliteten verifierades. Code review avslojjade att den inte kan anvandas. Filen finns kvar som dead code.

**Prioritet:** LAG -- kan ateranvandas nar/om `/api/native/account` skapas med Bearer auth.

### 2. GeocodeResult ar dead code
Modellen skapades enligt planen men geocoding-funktionalitet implementerades inte (webbens adress-geocoding ar komplex). Borde ha tagits bort fran planen.

**Prioritet:** LAG -- skadar inte, kan anvandas vid framtida geocoding-implementation.

### 3. TDD RED-steg svart pa iOS
Kompilerade sprak (Swift) kraver att tester och implementation kompilerar tillsammans. Det ar omojligt att se testet "faila av ratt anledning" separat. Varde av TDD pa iOS-sidan ar mer i designdrivning (DI-protokoll, mock) an i red-green-cykeln.

**Prioritet:** MEDEL -- acceptera att iOS TDD ar "design-first TDD" snarare an strikt red-green.

## Patterns att spara

### Native Profile Pattern
Profil-vyer med blandade lager (provider + user) anvander `$transaction` i API:t for atomisk uppdatering. Zod-schemat har bade provider-falt och user-falt, API:t separerar dem i transaktionen:

```typescript
const { firstName, lastName, phone, ...providerFields } = parsed.data
await prisma.$transaction(async (tx) => {
  if (hasUserFields) await tx.user.update(...)
  if (hasProviderFields) await tx.provider.update(...)
  return tx.provider.findUnique({ select: profileSelect })
})
```

### Segmented Picker i Sheet
ProfileFormSheet anvander `Picker(.segmented)` for att vaxla mellan "Personligt" och "Foretag" inne i ett sheet. Undviker ett overladdat scrollformular och ger fokuserade redigeringsupplevelser per sektion.

### Auth-kompatibilitetskontroll for native endpoints
Innan du lagger till native-anrop till befintliga web-routes, kontrollera alltid om routen anvander `auth()` (session/cookie) eller `authFromMobileToken()` (Bearer JWT). Native app har bara Bearer JWT.

## 5 Whys (Root-Cause Analysis)

### Problem: DeleteAccountSheet skapades men kan inte anvandas (auth mismatch)
1. Varfor? `/api/account` anvander session-cookie auth, inte Bearer JWT
2. Varfor? Routen skapades for webben (NextAuth session) innan native-appen existerade
3. Varfor? Planen antog att alla befintliga routes var kompatibla med native
4. Varfor? Feature inventory kontrollerade UI-features men inte auth-mekanism per endpoint
5. Varfor? Checklistan for native screen pattern saknar "auth-kompatibilitetskontroll"

**Atgard:** Lagg till "Verifiera auth-mekanism per endpoint (session vs Bearer)" i CLAUDE.md native screen pattern steg 0.
**Status:** Att gora

## Larandeeffekt

**Nyckelinsikt:** Vid native-konvertering: verifiera alltid att underliggande API-routes stodjer Bearer JWT-auth innan du bygger native UI som anropar dem. Befintliga web-routes anvander session-cookies som inte finns i native-appen.
