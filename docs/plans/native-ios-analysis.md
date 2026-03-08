---
title: "Analys: Native iOS vs Hybrid"
description: "Teknisk och UX-analys av att bygga om Equinet som native iOS-app vs behålla hybrid WKWebView"
category: plan
status: active
last_updated: 2026-03-08
tags: [ios, native, hybrid, arkitektur]
sections:
  - Kontext
  - Webapp-scope
  - Tre approaches
  - Tech-arkitektens analys
  - UX-agentens analys
  - Teamaspekt
  - Rekommendation
---

# Analys: Native iOS vs Hybrid -- Vad innebär det?

## Kontext

Equinet har idag en hybrid iOS-app (WKWebView) som laddar webbappen med native bridge för push, offline-detektion och haptics. Frågan är: vad skulle det innebära att bygga om hela eller delar av appen som native SwiftUI?

## Webapp-scope (det som finns idag)

| Dimension | Antal |
|-----------|-------|
| Sidor (pages) | 69 |
| API routes | 127 |
| React-komponenter | 164 |
| Custom hooks | 44 |
| Domäntjänster | 93 filer i 19 domäner |
| Prisma-modeller | 36 |
| Unit-tester | 3063 |
| E2E-tester | 34 specs |
| Offline-infrastruktur | IndexedDB + mutation queue + sync engine + service worker |

---

## Tre approaches

### A) Full native omskrivning (alla 69 sidor)

**Tid:** 7-10 månader (1 utvecklare)
**Vad som krävs:**
- APIClient + 60-80 Codable-structs
- Ny auth-lösning (Keychain + `/api/auth/mobile-token`)
- SwiftData offline-stack (ersätter IndexedDB)
- BGTaskScheduler (ersätter Service Worker)
- 69 SwiftUI-vyer + navigationskoordinatorer
- Alla formulär, kalendrar, kartor från scratch
- 0% av React-koden kan återanvändas
- MVVM + @Observable (iOS 17+)

**Vinner:** 60/120fps animationer, fullständig iOS-API-access (Widgets, Live Activities, Siri, Spotlight), offline fungerar utan server vid app-start, lägre minnesanvändning
**Förlorar:** Dubbelt underhåll permanent, App Store review-cykler (1-3 dagar per release), 3063 tester irrelevanta, försvårar framtida Android-app

### B) Native kärnflöden + WebView för resten ("hybrid shell")

**Tid:** 4-5 månader (1 utvecklare)
**Vad som krävs:**
- APIClient + Keychain auth (2-3v)
- Native login-vy (1v)
- Native kalender + bokningar (5-7v)
- Native kundlista (3-4v)
- WebView-wrapper för alla andra sidor
- Hybrid navigationskoordinator (deeplinks -> native ELLER webview)

**Vinner:** Native-känsla där det räknas mest (dagliga leverantörsflöden), WebView för sällanflöden
**Förlorar:** Komplex gränsyta (bridge + native + web), varje ny feature kräver beslut "native eller web?"

### C) Behåll hybrid, native-ifiera kritiska delar (rekommenderat)

**Tid:** 6-10 veckor
**Vad som krävs (steg för steg):**

| Steg | Vad | Tid | UX-lyft |
|------|-----|-----|---------|
| 0 | UX Polish (KLART) | - | Splash, progress, haptic, offline-banner |
| 1 | Native röstloggning (SFSpeechRecognizer) | 2-3v | Offline-tal, streaming, Action Button |
| 2 | WidgetKit (Today Widget) | 2-3v | "Nästa bokning" på hemskärmen |
| 3 | Push notification actions | 1v | Bekräfta/avvisa direkt från notis |
| 4 | Native auth/login (valfritt) | 2-3v | Snabbare start, Face ID |

**Vinner:** Mest value per investerad timme, ingen dubbel kodbas, webbappens 3063 tester behålls, enkel Android-expansion
**Förlorar:** Kalender/karta förblir WebView (men nuvarande polish är bra)

---

## Tech-arkitektens analys: Nyckelinsikter

**Auth är blockeraren.** Ingen native approach (B eller C steg 4) fungerar utan en `/api/auth/mobile-token`-endpoint. NextAuth HTTP-only cookies fungerar i WKWebView men inte i native URLSession.

**Android-frågan.** Hybrid-approachen är redan plattformsoberoende. Full native iOS försvårar Android-expansion.

**App Store-risk.** Apple kräver "substantiellt native-värde" utöver en webbsida. Nuvarande app med push, offline, haptics bör klara granskning -- men det är en risk att bevaka.

**Inkrementell migration är möjlig** (skärm för skärm) men kräver att auth-infrastrukturen löses först + hybrid navigationskoordinator.

**Arkitektur vid full native:** MVVM + koordinatorer (inte TCA -- överkonstruerat utan djup Swift-kompetens). Struktureras per roll:
```
App -> AuthCoordinator -> ProviderCoordinator / CustomerCoordinator / AdminCoordinator
```

**API-lager:** 36 Prisma-modeller = realistiskt 60-80 Codable-structs (nested typer). JWT via Keychain, AuthInterceptor för 401-hantering.

**State management:** React hooks -> @Observable ViewModels. SWR (caching + revalidering) är det mest arbetsintensiva att porta.

**Offline iOS-ekvivalenter:**
| Web | iOS Native |
|-----|-----------|
| IndexedDB (Dexie) | SwiftData (iOS 17+) |
| Mutation Queue | SwiftData + BackgroundActor |
| Sync Engine | BGTaskScheduler |
| Service Worker precache | URLCache |
| Tab Coordinator | Behövs inte (en process) |

---

## UX-agentens analys: Nyckelinsikter

**Leverantören är power user.** Använder appen 5-10 ggr/dag, ibland med handskar/smutsiga händer, dålig signal. Native-investeringen bör vara 100% leverantörsfokuserad.

**Kunden är sporadisk.** Bokar varannan månad. WebView räcker.

**Topp 5 native UX-lyft (om man väljer selektiv nativeifiering):**
1. Röstloggning (SFSpeechRecognizer) -- kan inte göras bra i WebView
2. Dagkalender (UICollectionView) -- gestures, drag, haptics
3. Ruttkarta (MapKit) -- offline-cache, Apple Maps-integration
4. WidgetKit -- nästa bokning på hemskärmen
5. Push-actions -- bekräfta/avvisa utan att öppna appen

**Flöden där WebView räcker:**
- Admin-panelen (desktop-användare)
- Inställningssidor (låg frekvens)
- FAQ/hjälp (statiskt innehåll)
- Auth-flöden (sällan)
- Kundflöden generellt

**Native iOS-features som hybrid saknar:**
- Live Activities (Dynamic Island) -- pågående rutt "Stopp 3/7"
- Siri Shortcuts -- "Hej Siri, logga arbete"
- Spotlight-indexering -- sök hästar/kunder från iOS-sökfältet
- Kontaktintegration -- ring kund direkt
- Apple Wallet -- bokningspass

**Risker med native:**
- Feature parity-problem (varje ny feature: "native, web, eller båda?")
- Underhållsbörda skalas icke-linjärt (3 lager: Next.js + SwiftUI + bridge)
- Bridge-protokollet är inte typsäkert (JSON via messageHandlers)
- SwiftUI-kompetens som flaskhals

---

## Teamaspekt

**Kan en Next.js-utvecklare lära sig SwiftUI?**
- Ja, produktiv på 4-6 veckor för grundläggande saker
- SwiftUI-koncept mappar bra: @State = useState, @Observable = hooks, async/await identiskt
- MEN: offline-stack (SwiftData/CoreData), bakgrundssynk (BGTaskScheduler), App Store-submission kräver 3-4 månaders fördjupning
- Risk: bygger saker på fel sätt utan iOS-erfarenhet

**Dedikerad iOS-utvecklare?**
- Approach A eller B kräver det (eller konsult)
- Approach C kan drivas av befintligt team med selektiv inlärning

**Dubbelt underhåll = dubbelt team?**
- Varje ändring i datakontrakt (nytt fält på Booking) måste speglas i alla lager
- Ny feature kräver aktivt beslut: native, web, eller båda
- I ett litet team (1-2 pers) är detta en reell risk

---

## Rekommendation

**Approach C i närtid, utvärdera B baserat på data.**

1. **Nu:** Steg 0 (UX polish) är klart
2. **Nästa:** Native röstloggning (störst UX-lyft, kan inte göras i WebView)
3. **Sedan:** WidgetKit + push-actions (hög synlighet, låg komplexitet)
4. **Strategisk punkt:** Om mätdata visar att leverantörer spenderar 60%+ i kalendervyn -> motiverar native dagkalender (approach B lite)
5. **Långsiktigt:** Beslut om full native baseras på användardata, teamstorlek och Android-planer
