---
title: "iOS Demo Parity Audit"
description: "Audit av iOS-app:ens stöd för demo-mode jämfört med local web och staging web. Identifierar tre kritiska gap: AppConfig-URL:er pekar på döda/fel domäner, ingen DemoLoginButton i native UI, ingen Vercel share-link-hantering. Read-only audit, inga ändringar utförda."
category: operations
status: active
last_updated: 2026-05-07
tags: [ios, demo-mode, parity, audit, staging, vercel, demo-readiness]
related:
  - demo-parity-local-staging.md
  - demo-mode.md
  - environments.md
  - staging-environment-setup.md
  - url-configuration.md
sections:
  - Sammanfattning
  - 1. Current iOS architecture
  - 2. Environment config — URL-matris
  - 3. Auth/login model
  - 4. Demo mode support
  - 5. Local / Staging / Prod comparison
  - 6. Risker
  - 7. Recommended next slices
  - 8. Do-not-do-lista
  - STOPP — inväntar Johan
---

# iOS Demo Parity Audit (2026-05-07)

> **Read-only audit.** Inga kod-, Xcode-, env-, Vercel-, eller Supabase-ändringar utförda.

---

## Sammanfattning

iOS-appen har grundläggande demo-mode-stöd via feature flag `demo_mode` från `/api/feature-flags`. Däremot finns **tre kritiska gap** som blockerar att iOS kan demo:as mot staging idag:

| # | Gap | Konsekvens | Refererad fil |
|---|-----|------------|---------------|
| **1** | `AppConfig.staging` pekar på **död URL** `https://equinet-git-staging-cola500.vercel.app` (returnerar 404 — gammal cola500-org-URL, inte längre aktiv) | iOS kan inte nå staging alls i `-STAGING`-läge | `ios/Equinet/Equinet/AppConfig.swift:47` |
| **2** | `AppConfig.production` pekar på `https://equinet-app.vercel.app` istället för custom domain `https://equinet.johanlindengard.com` | Fungerar idag (Vercel-default-domain returnerar 429 firewall, inte 401 SSO), men inte den dokumenterade prod-URL:en | `ios/Equinet/Equinet/AppConfig.swift:49` |
| **3** | Ingen Vercel share-link-hantering i WebView (`_vercel_share` query, `_vercel_jwt` cookie) | iOS kan **inte** öppnas via en share-länk om staging är SSO-skyddad. WebView 401-handlern triggar logout vid SSO-challenge | `ios/Equinet/Equinet/WebView.swift:392-400` |

Sekundärt: Ingen `DemoLoginButton` i native UI (Demo-login är bara i webben). iOS-användare kan inte trigga demo-konto med ett klick i native-vy.

---

## 1. Current iOS architecture

iOS-appen är en hybrid-app: native SwiftUI-skärmar (Native*View) drivs av API-anrop till `/api/native/*`, och övriga vyer (Mer-meny → Meddelanden, Hjälp, etc.) embeddar webbsidor i WKWebView.

**Huvudkomponenter:**

- **`AppConfig.swift`** — central environment-konfiguration. Three cases: `.local`, `.staging`, `.production`. Switching via `-STAGING` launch arg (DEBUG only) eller automatiskt `.production` i Release-build.
- **`SupabaseManager`** — Singleton wrapping Supabase Swift SDK. Auth tokens persisterade i App Group Keychain (`group.com.equinet.shared`).
- **`AuthManager`** — Native login via Supabase Swift SDK. Efter inloggning: `exchangeSessionForWebCookies()` POST till `/api/auth/native-session-exchange` med Bearer token → får `Set-Cookie`-svar → cookies lagras i `HTTPCookieStorage.shared` → injiceras i WKWebView för WebView-sessioner.
- **`APIClient.swift`** — REST-klient för `/api/native/*` endpoints. `Authorization: Bearer <Supabase access token>` header. 15s timeout, 401 → single refresh + retry, 429 → throw med `Retry-After`.
- **`WebView.swift`** — WKWebView-wrapper. Lyssnar på Supabase `authStateChanges` för `tokenRefreshed`-event och re-exchange:ar cookies. CSS-injektion döljer webb-chrome (BottomTab + Header) för provider-vyer.
- **`BridgeHandler.swift`** — JS↔Swift-kommunikation: `equinet.postMessage(...)` (JS → Swift) och `equinetNative.onMessage(...)` (Swift → JS). 17 meddelandetyper inkl. push, network, calendar sync, speech recognition, navigation.
- **`AppCoordinator`** — Tab-state, feature-flag-cache (UserDefaults, fetched i bakgrunden från `/api/feature-flags`).

**Native screens med direkt API-anrop:**

| Vy | ViewModel | Endpoint |
|---|---|---|
| NativeDashboardView | DashboardViewModel | `/api/native/dashboard` |
| NativeCalendarView | CalendarViewModel | `/api/native/calendar` |
| NativeBookingsView | BookingsViewModel | `/api/native/bookings`, `/api/bookings/{id}` |
| NativeServicesView | ServicesViewModel | `/api/native/services` |
| NativeCustomersView | CustomersViewModel | `/api/native/customers/*` |
| NativeProfileView | ProfileViewModel | `/api/native/provider/profile` |
| NativeReviewsView | ReviewsViewModel | `/api/native/reviews` |
| NativeDueForServiceView | DueForServiceViewModel | `/api/native/due-for-service` |
| NativeAnnouncementsView | AnnouncementsViewModel | `/api/native/announcements` |
| NativeInsightsView | InsightsViewModel | `/api/native/insights` |
| MoreWebView (Meddelanden, Hjälp, etc.) | — | Web paths (`/provider/*`) — använder cookies efter exchange |

**Build-konfiguration:**

- 2 schemes: `Equinet` + `EquinetWidgetExtension`. Inga separata Staging-schemes.
- 2 configurations: Debug + Release. Inga separata xcconfig-filer.
- `-STAGING` launch arg är ej fördefinierad i `Equinet.xcscheme` — användaren måste manuellt redigera schemen i Xcode (Product → Scheme → Edit → Run → Arguments).

---

## 2. Environment config — URL-matris

### Vad iOS faktiskt pekar på idag

| Environment | iOS `AppConfig.baseURL` | Faktisk live-URL för 2026-05-07 | Status |
|---|---|---|---|
| `.local` | `http://localhost:3000` | localhost:3000 | OK om `npm run dev` körs |
| `.staging` | `https://equinet-git-staging-cola500.vercel.app` | **HTTP 404** (org `cola500` finns inte längre, vi flyttade till `cola500s-projects`) | **BRUTEN** |
| `.production` | `https://equinet-app.vercel.app` | HTTP 429 (firewall) — fungerar för riktiga klienter | Fungerar men inte dokumenterad prod-URL |

### Vad iOS borde peka på

| Environment | Korrekt URL | Verifiering |
|---|---|---|
| `.local` | `http://localhost:3000` | OK — ingen ändring |
| `.staging` | `https://equinet-staging.johanlindengard.com` | HTTP 401 (Vercel SSO) — kräver share-link-flöde eller annan bypass |
| `.production` | `https://equinet.johanlindengard.com` | HTTP 429 (firewall) — fungerar |

### Supabase-konfiguration

| Environment | iOS `AppConfig.supabaseURL` | Status |
|---|---|---|
| `.local` | `http://127.0.0.1:54321` | OK (Supabase CLI) |
| `.staging` | `https://zzdamokfeenencuggjjp.supabase.co` | **OK** — pekar på samma staging Supabase som webb |
| `.production` | `https://zzdamokfeenencuggjjp.supabase.co` (via fallthrough till staging) | **FEL** — kommentar säger "until separate prod project". Detta var medvetet före Apple Developer Program-uppgradering, men nu finns separat prod-Supabase `xybyzflfxnqqyxnvjklv` |

> **Notera:** iOS `.production` använder staging Supabase! Det betyder iOS-prod-användare loggar in mot **staging-DB**, inte prod-DB. Detta är dokumenterat som tillfälligt i kodkommentar (`AppConfig.swift:73`), men betyder att iOS i nuläget inte är produktionsskarp.

---

## 3. Auth/login model

### Native login (default)

```
User → NativeLoginView (TextField + SecureField)
  → AuthManager.login(email:password:)
  → SupabaseManager.client.auth.signIn(email:password:)
  → Session lagras i App Group Keychain
  → exchangeSessionForWebCookies() POST /api/auth/native-session-exchange
  → Set-Cookie response → HTTPCookieStorage.shared
  → WebView konfigureras med cookies + laddas
```

**Filer:**
- `NativeLoginView.swift` — UI
- `AuthManager.swift:115-146` — `login()`
- `AuthManager.swift:226-265` — `exchangeSessionForWebCookies()`
- `AuthManager.swift:299-310` — `buildExchangeRequest()`

### Native API-anrop

```
APIClient.fetchDashboard()
  → URL: AppConfig.baseURL + "/api/native/dashboard"
  → Header: Authorization: Bearer <SupabaseManager.client.auth.currentSession.accessToken>
  → 15s timeout
  → 401 → refresh session, retry once → om misslyckas: throw APIError.unauthorized
  → 429 → throw APIError.rateLimited(retryAfter:)
```

### WebView-anrop

```
WebView laddar URL
  → WKWebView läser HTTPCookieStorage.shared
  → Skickar cookies som vanlig browser
  → 401-svar i WebView → AuthManager.logout() (omedelbart)
```

**Refresh-loop:**
- `WebView.swift:268-284` — observer på `SupabaseManager.client.auth.authStateChanges`
- Vid `tokenRefreshed`-event → re-exchange → cookies uppdaterade

### Token-flöde till `/api/native/*`

iOS skickar **Bearer JWT**, inte cookies. Skillnad från webb-frontend som använder cookies via Next.js Server Components.

```
iOS APIClient → /api/native/dashboard
  Authorization: Bearer eyJhbGc...
  (no Cookie header)
```

### MobileToken-flöde (DEAD CODE)

`KeychainHelper.swift:119-151` har `saveMobileToken()`, `loadMobileToken()`, `clearMobileToken()` — men **anropas aldrig**. Lagrad infrastruktur för en framtida flow där iOS skulle byta Supabase-token mot en längre-livad MobileToken JWT (90d). Inte aktiv idag.

---

## 4. Demo mode support

### Webb (local + staging)

| Komponent | Plats | Funktion |
|---|---|---|
| `NEXT_PUBLIC_DEMO_MODE` env var | Vercel Preview | Sätter `isDemoMode()` runtime |
| `DemoLoginButton.tsx` | `src/components/landing/` | Hardcoded `erik.jarnfot@demo.equinet.se` / `DemoProvider123!`, syns på landing om demo-mode aktivt |
| Demo-tabs filter | Provider-layout | Visar bara `Tjänster` + `Profil` i demo-läge |
| Demo-data | Erik Järnfot seedad i staging-DB | 18 bokningar, 9 kunder, 14 hästar, 1 serie, Smart Reply-konversation |

### iOS

| Komponent | Plats | Funktion |
|---|---|---|
| Feature flag `demo_mode` | `/api/feature-flags` (public endpoint) | Cached i UserDefaults via `AppCoordinator:65-81` |
| `NativeMoreView` filter | `NativeMoreView.swift:73-82` | Om `demo_mode=true`: bara `/provider/services` + `/provider/profile` syns i Mer-menyn (speglar webb-demoTabs) |
| `NativeProfileView` filter | `NativeProfileView.swift:20, 118, 332-345` | `isDemoMode` döljer länkar-sektion, self-reschedule, recurring bookings, men VISAR booking settings + availability |
| **Demo-login-knapp i native UI** | — | **SAKNAS** |
| **Hardcoded demo-konto i iOS** | — | **SAKNAS** |
| **Build-flagga / scheme för demo** | — | **SAKNAS** |
| **`NEXT_PUBLIC_DEMO_MODE`-läsning i iOS** | — | Ej relevant — iOS läser bara feature flag från servern |

**Praktisk konsekvens:** En användare som öppnar iOS-appen mot staging behöver fortfarande logga in manuellt med `erik.jarnfot@demo.equinet.se` / `DemoProvider123!` via NativeLoginView. Det finns ingen "Demo-login"-knapp att trycka på.

---

## 5. Local / Staging / Prod comparison

| Aspekt | Local web | Staging web | iOS local | iOS staging | iOS production |
|---|---|---|---|---|---|
| **Base URL** | `localhost:3000` | `equinet-staging.johanlindengard.com` (custom) | `localhost:3000` | `equinet-git-staging-cola500.vercel.app` (**404**) | `equinet-app.vercel.app` (Vercel-default) |
| **Auth-mekanism** | Supabase cookies | Supabase cookies | Supabase Swift SDK + cookie-exchange | Supabase Swift SDK + cookie-exchange | Supabase Swift SDK + cookie-exchange |
| **Demo-login (1-klick)** | Ja (DemoLoginButton) | Ja (DemoLoginButton) | Nej (manuell login) | Nej (manuell login) | — |
| **Demo-data** | Lokal seed (Maria-fixture + Anna-testdata) | Erik Järnfot (staging-DB) | Lokal seed | Erik Järnfot (om iOS pekade rätt) | Staging-DB (FEL — iOS prod använder staging Supabase) |
| **Feature flag `demo_mode`** | Toggleable via admin | Aktiv (`NEXT_PUBLIC_DEMO_MODE=true`) | Toggleable | Aktiv | Toggleable |
| **Vercel Authentication** | N/A | SSO 401 (custom domain mappat till preview) | N/A | Skulle få SSO 401 om iOS pekade rätt | Fungerar (Vercel-default-domain) |
| **Vercel share-link-stöd i klient** | N/A | Ja (browser hanterar `_vercel_share` automatiskt) | N/A | **Nej** (WebView ignorerar query-param) | N/A |
| **API endpoints** | `/api/*` | `/api/*` | `/api/native/*` (Bearer) + `/api/*` (cookie) | Samma — om URL fungerade | Samma |
| **iOS bridge** | N/A | N/A | JS↔Swift via `webkit.messageHandlers.equinet` | Samma | Samma |
| **Test Testsson finns kvar** | Beror på lokal DB | Ja (oren staging-DB) | Beror på lokal DB | Ja (om iOS når staging) | I staging-DB pga (5) |

### Known gaps i jämförelsetabell

- iOS staging-URL är **bruten** (404)
- iOS prod-URL är **inte den dokumenterade prod-URL:en**
- iOS prod **använder staging Supabase** (medvetet, men inte produktionsskarpt)
- iOS har **ingen 1-klicks demo-login**
- iOS WebView **kan inte hantera Vercel share-link** för SSO-bypass

---

## 6. Risker

### 6.1 iOS staging är otestbart idag

**Risk:** Den hardkodade staging-URL:en (`equinet-git-staging-cola500.vercel.app`) returnerar 404 — ingen kan sätta `-STAGING`-arg i Xcode och testa appen mot staging utan att först fixa AppConfig.

**Påverkan:** All iOS staging-verifiering blockerad. Nya staging-features kan inte verifieras innan deploy till prod.

**Sannolikhet:** Hög — händer vid första försöket att starta iOS i staging-läge.

### 6.2 iOS production använder staging Supabase

**Risk:** `AppConfig.swift:73` säger explicit "Both [staging+production] use staging project (zzdamokfeenencuggjjp) until Apple Developer Program is purchased and separate prod bundle ID + project is created."

**Påverkan:** iOS-prod-användare loggar in mot staging-DB. All iOS-data hamnar i staging-DB. Prod-Supabase (`xybyzflfxnqqyxnvjklv`) får aldrig iOS-trafik.

**Sannolikhet:** Hög — sker 100% av iOS-prod-anrop idag. Inte ett "fel" eftersom det är dokumenterat och medvetet, men måste fixas innan iOS-app släpps publikt.

### 6.3 iOS WebView fastnar bakom Vercel SSO på staging

**Risk:** Om AppConfig.staging fixas till `equinet-staging.johanlindengard.com`, träffar iOS WebView Vercel SSO-401. WebView.swift:392-400 triggar omedelbart logout vid 401 — detta kommer att se ut som att appen "tappat sessionen" trots att Supabase-tokenen är giltig.

**Påverkan:** iOS staging-läge funktionellt oanvändbart utan SSO-bypass. Native API-anrop (Bearer) kan också få 401 från Vercel SSO innan de når app-lagret — APIClient kan inte skilja mellan "Vercel-SSO-401" och "Supabase-401" och kommer förgäves försöka refresh:a Supabase-tokenen.

**Sannolikhet:** Hög — händer 100% av staging-anrop utan bypass-cookie eller Deployment Protection Exception.

### 6.4 Vercel share-link-cookien följer inte med iOS WebView

**Risk:** `_vercel_jwt`-cookie sätts av Vercel som `HttpOnly; Secure; SameSite=Lax`. WKWebView kan ta emot cookien om användaren först klickar share-länken i Safari och sen öppnar appen — men de delar **inte** cookies. Default WKWebView har egen `WKWebsiteDataStore` som inte läser från Safari.

**Påverkan:** Även om man klickar share-länk i Safari före iOS-appen → cookien gäller inte i appen. Ingen enkel "öppna staging i iOS via share-link"-flöde.

**Sannolikhet:** Hög — naturlig användarförväntan ("jag fick länken, jag öppnar appen") fungerar inte.

### 6.5 Demo-login saknas i iOS

**Risk:** Användare som vill testa iOS mot demo-data behöver känna till Erik:s mejl + lösenord och skriva in dem manuellt i NativeLoginView. För investorer eller tidiga testare är det friktion.

**Påverkan:** iOS-demo har sämre user experience än webb-demo. Kan misstolkas som "iOS är inte färdigt" trots att funktionaliteten finns.

**Sannolikhet:** Medel — bara ett problem om iOS-demos visas externt.

### 6.6 Native API auth kan inte använda Vercel bypass-cookie

**Risk:** Vercel `_vercel_jwt`-bypass-cookie räknas bara för `Cookie:`-header-anrop, inte `Authorization: Bearer`. iOS APIClient skickar bara Bearer — alltså kan share-link aldrig hjälpa native API-anrop att passera SSO.

**Påverkan:** Även om WebView bypass:as via cookie, så får native API-anrop fortfarande 401 från Vercel SSO. iOS skulle behöva separat lösning för native API.

**Sannolikhet:** Hög — strukturell gränssättning.

### 6.7 iOS native staging-test riskerar att skicka data till prod-Supabase i framtiden

**Risk:** Om någon "fixar" `AppConfig.swift:73` till `xybyzflfxnqqyxnvjklv` (prod) utan att samtidigt skapa en separat staging-Supabase-klient, kommer iOS staging-läge att skriva till prod-DB.

**Påverkan:** Datacorruption i prod om bara webb-baseURL fixas och inte Supabase-URL.

**Sannolikhet:** Medel — möjligt vid hastig "fix everything"-PR.

---

## 7. Recommended next slices

Tre alternativ, prioriterade efter värde/risk-förhållande:

### Slice A — Fix AppConfig URL:er (1-2 timmars arbete, låg risk)

**Vad:** Uppdatera `AppConfig.swift` så `.staging` → `equinet-staging.johanlindengard.com` och `.production` → `equinet.johanlindengard.com`. Lägg till separat prod-Supabase-URL (`xybyzflfxnqqyxnvjklv`) för `.production`.

**Tester:** Existing XCTest för auth + APIClient bör fortsätta vara gröna (de använder mock URLSession). Manuell test krävs för att bekräfta att iOS i `-STAGING`-läge träffar nya domänen.

**Värde:** Bara docs-koherens. Funktionellt blockeras fortfarande iOS staging av Vercel SSO efter URL-fix.

**Risk:** Låg. Behöver verifiera att prod-iOS faktiskt fungerar mot custom domain (idag fungerar `equinet-app.vercel.app` mot prod-deployment, custom domain gör samma men officiellt).

**Begränsning:** Ensam slice räcker INTE för demo-mot-staging — kräver också Slice B eller annan SSO-bypass.

### Slice B — iOS staging Deployment Protection-bypass (komplex, hög risk)

**Vad:** Bygg en mekanism i `WebView.swift` + `APIClient.swift` som läser en lokal `STAGING_VERCEL_BYPASS_TOKEN` från Info.plist eller en debug-only källa, och skickar `?x-vercel-protection-bypass=<token>` på första request samt mottar `_vercel_jwt`-cookie för efterföljande WebView-anrop. För native API-anrop: skicka token som query-param på varje request (eftersom Bearer-anrop inte har cookies).

**Tester:** Nya XCTest för bypass-token-injektion. Manuell verifiering att staging fungerar med token, blockeras utan.

**Värde:** Möjliggör iOS staging-test för utvecklare/QA. Skulle inte distribueras till slutanvändare (DEBUG-only).

**Risk:** Hög komplexitet. Token måste lagras säkert (Info.plist är inte säkert — inkluderas i app-bundle synligt). Bypass-tokens roteras periodiskt → kräver rebuild varje gång. Inte ideal lösning.

**Alternativ:** Skapa ett separat staging-Vercel-projekt enligt audit-rekommendationen i `demo-parity-local-staging.md` så att custom-domain-undantaget gäller iOS staging-domain → ingen bypass behövs.

### Slice C — Native DemoLoginButton + dokumentera iOS-mot-staging-flöde (medel arbete, låg risk)

**Vad:** Lägg till en `DemoLoginButton`-equivalent i `NativeLoginView` som visas när feature flag `demo_mode=true`. Auto-fyller email + lösenord och kallar `AuthManager.login()`. Plus: skapa körinstruktion `docs/operations/ios-staging-demo.md` som beskriver hur QA testar iOS mot staging idag.

**Tester:** XCTest för NativeLoginView + AuthManager.login med demo-konto.

**Värde:** Minskar friktion för iOS-demo. Pre-requirement: Slice A + (B eller separat staging-projekt) måste fixas innan demo-login fungerar mot staging.

**Risk:** Låg. Hardcoded-konto är samma säkerhetsrisk som i webben — Erik:s konto är public knowledge i staging.

### Sammansatt rekommendation

**Bästa väg om iOS-demo blir prio:** Slice A → separat staging-Vercel-projekt enligt webb-audit (`demo-parity-local-staging.md`) → Slice C. Tre slices, ~1-2 dagar totalt.

**Bästa väg om iOS-demo INTE är prio:** Notera gap i backlog, prioritera webb-demo. iOS prod-användning fungerar fortfarande (mot staging Supabase) — inte demo-blocker.

**Om iOS staging-test blir akut:** Slice A + Slice B (DEBUG-only bypass). Minst snyggt men snabbast.

---

## 8. Do-not-do-lista

| Vad | Varför |
|-----|--------|
| Fixa bara `AppConfig.production`-URL utan att överväga Supabase-URL | iOS prod använder staging Supabase idag (`AppConfig.swift:73`). Att bara byta webb-URL:en utan att skapa separat prod-Supabase-klient lämnar inkonsistent state. |
| Lägg till `_vercel_share`-cookie-hantering i WKWebView genom att hardcoda token | Bypass-tokens roteras → token i kodbasen blir snabbt inaktuell. Plus säkerhetsrisk om bundle reverse-engineeras. |
| Bygg native demo-login som hardcodar Erik:s mejl + lösenord i Release-build | Production-app ska inte ha demo-konton kompilerade in. Använd `#if DEBUG` eller feature flag-driven så de bara syns i staging. |
| Migrera iOS från Bearer till cookie-auth för `/api/native/*` för att kunna använda share-cookie | Bearer JWT är arkitekturellt rätt för native (separat session-livscykel). Cookie-auth öppnar CORS- och CSRF-frågor som inte finns idag. |
| Försök "tappa bort" iOS staging tills separate staging-projekt skapas | Brukrer som idag pekar på död URL får inget felmeddelande, bara nätverkstimeout. Bättre att fixa AppConfig-URL:en även om SSO fortfarande blockerar. |
| Aktivera iOS-bygge mot prod-Supabase utan separat bundle ID | Apple App Store-process kräver att en specifik bundle ID identifierar appen. Att byta Supabase-URL utan bundle-strategi skapar konflikt med framtida App Store Connect-setup. |
| Bygg en "demo användare slumpas" mekanism i iOS | Staging har bara en demo-persona (Erik). Skulle kräva fler personor i seed + UI-val för att slumpa, vilket är out-of-scope för demo-parity-slice. |
| Köra `seed-demo-provider.ts --reset` mot prod-Supabase | Aldrig. Prod-DB har riktig data. |

---

## STOPP — inväntar Johan innan någon iOS-ändring

Audit klar. Inga ändringar utförda i:

- iOS Swift-kod (AppConfig, AuthManager, WebView, APIClient, etc.)
- Xcode-projekt (schemes, configurations, xcconfig)
- Vercel (deployment protection, exceptions, env vars)
- Supabase (env, RLS, demo-data)
- Webb (DemoLoginButton, layout, middleware)
- Git (inga commits, inga pushes, working tree rent förutom denna nya rapport)

Säg:
- **"plan A — fixa AppConfig URL:er"** — jag bryter ner Slice A i konkreta TDD-steg och skriver branch-prep
- **"plan A + nytt staging-Vercel-projekt"** — Slice A + planera separat staging-projekt enligt webb-audit
- **"plan C — DemoLoginButton native"** — bara native-demo-knapp, lämna URL/SSO för senare
- **"parkera, dokumentera bara"** — committa rapporten, ingen kod-ändring
- **"vänta, fundera"** — annan riktning

Inväntar.
