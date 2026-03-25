---
title: Recent Changes
description: Förändringsinventering baserad på git-historik jan-mär 2026
category: product-audit
status: active
last_updated: 2026-03-25
sections:
  - Översikt
  - Januari 2026 -- Grundläggning
  - Februari 2026 -- Utbyggnad och polering
  - Mars 2026 -- iOS native och DX
  - Kärnan i produkten just nu
  - Sidospår eller ofärdigt
---

# Recent Changes -- Förändringsinventering

> Baserad på git-historik 2026-01-21 till 2026-03-20. 562 commits, varav 192 feat, 162 fix, 21 refactor, 113 docs.
> Intentioner hämtas från commit-meddelanden och dokumentation. Där det är oklart stär "oklart syfte".

---

## Översikt

| Månad | Commits | Fokus |
|-------|---------|-------|
| Januari | 142 | Grundläggning: migrering till PostgreSQL, Next.js 16, kärnfeatures (bokningar, recensioner, hästar, betalning) |
| Februari | 313 | Utbyggnad: offline/PWA, feature flags, säkerhet, UX-polering, E2E-tester, nya features (stall, prenumeration, buggrapporter) |
| Mars | 107 | iOS native-rebuild: WebView -> SwiftUI för 7 skarmar, E2E-fixar, DX-förbättringar |

---

## Januari 2026 -- Grundläggning

### Nya features

| Feature | Commit | Användarvärde | Status |
|---------|--------|---------------|--------|
| **Migrering SQLite -> PostgreSQL** | `875b4ae3` | Möjliggör deploy på Vercel/Supabase | Komplett |
| **Uppgradering Next.js 16 + React 19 + NextAuth v5** | `aef67f9e` | Modern stack, serverkomponenter | Komplett |
| **Recensioner & betyg** | `3a302d2f` | Kunder kan betygsätta leverantörer | Komplett |
| **Hästregister med bokningsintegration** | `a83e3f09` | Kunder kan skapa hästprofiler | Komplett |
| **In-app notiser + påminnelser** | `e67c4f0d` | Användare får meddelanden om bokningar | Komplett |
| **Hästhälsotidslinje + leverantörsverifiering** | `96fe7bb2` | Spara hästens servicehistorik | Komplett |
| **Gruppbokningar** | `83b87c0f` | Flera kunder bokar tillsammans | Komplett |
| **Mock-betalning + kvitton** | `12:38:01` | Betalningsflöde med faktura | Delvis (mock-only) |
| **Kalendervy för leverantörer** | `17:39:27` | Visuell schemavy | Komplett |
| **Restidesvalidering mellan bokningar** | `ccfd5335` | Förhindra omöjliga scheman | Komplett |
| **Tillgänglighetsundantag med plats** | `19:51:26` | Leverantör markerar lediga dagar | Komplett |
| **Rate limiting på publika endpoints** | `03:06:52` | Skydd mot missbruk | Komplett |
| **Skaloptimering (bounding box, pooling)** | `11:50:13` | Stöd för 500 användare | Komplett |
| **Onboarding-checklista** | `16:10:46` | Guida nya leverantörer | Komplett |
| **Export, bilduppladdning, Fortnox-integration** | `9fc46a08` | Ekosystem-integrationer | Delvis |

**Sammanfattning januari**: Massiv utbyggnad av kärnprodukten på 3 veckor. Från SQLite till PostgreSQL, från grundläggande CRUD till fullständig bokningsplattform. Hög takt, många features per dag.

**Risk**: Många features lades till snabbt. Oklart hur val de är testade individuellt. Commit-meddelanden antyder "add X" snarare an iterativ utveckling.

---

### Bugfixar (januari)

| Fix | Commit | Koppling |
|-----|--------|----------|
| Separera Edge-kompatibel auth-config | `f5ea0494` | Next.js 16-migrering |
| TypeScript memory issues | `513a0122` | Byggsystem |
| Timezone-fält + unique constraint för bokningar | `ca4a6a87` | Dataintegritiet |
| legacy-peer-deps för Vercel-build | `f46742a2` | Deploy |

---

## Februari 2026 -- Utbyggnad och polering

### Nya features

| Feature | Commit(s) | Användarvärde | Status |
|---------|-----------|---------------|--------|
| **Manuell bokning (leverantör)** | `12:08:12` | Leverantör bokar at kund | Komplett |
| **DDD-refactoring (BookingStatus, domain events)** | `16:05:01`, `19:01:33` | Kodkvalitet, inte direkt användarvärde | Teknisk förbättring |
| **Kompetenser & certifikat** | `16:53:30` | Leverantör laddar upp legitimationer | Komplett |
| **Admin-roll + admin-nav** | `21:54:58` | Plattformsadmin | Komplett |
| **Följa leverantör + ruttnotiser** | `10:17:17` | Kunder får besked när leverantör annonserar | Komplett |
| **Favoritfilter på leverantörssök** | `10:46:31` | Snabbare återsökning | Komplett |
| **Per-service besöksintervall** | `19:29:30`, `13:30:57` | Individuella påmintelseintervall per hast+tjänst | Komplett |
| **Besöksplanering (due-for-service)** | `14:10:36` | Leverantör ser vilka hästar som behöver service | Komplett |
| **Personaliserade ruttannonser** | `14:43:44` | Notis baserad på overdue + följa | Komplett |
| **Kommun-bevakning** | `13:47:25` | Kund bevakar kommun för notiser | Komplett |
| **Feature flags -> PostgreSQL** | `11:12:32` | Ersätter Redis-baserad flägghantering | Teknisk förbättring |
| **Feature flags default-on** | `16:20:01` | Alla fläggör på som default | Komplett |
| **Interaktiv testguide (admin)** | `12:32:30` | Admin testar features | Intern |
| **Bokningsflödes-refactoring** | `9000c7fe` | BookingFlowContext | Teknisk förbättring |
| **Refactoring: hooks, komponenter, 1200 rader borttagna** | `48221929`, `3b4ee9d7` | Kodkvalitet | Teknisk förbättring |
| **59 nya API-tester** | `8de5a1d2` | Testtäckning | Teknisk förbättring |
| **Elimminera alla 1187 ESLint-varningar** | `197eaea8` | Kodkvalitet | Teknisk förbättring |
| **Penetrationstest + härdning** | `a02c4cf4` | 5 säkerhetsfynd fixade | Säkerhet |
| **CSP-härdning + SRI** | `88d81ec7` | Innehållssäkerhet | Säkerhet (SRI bortagen session 68) |
| **Kognitiv belastning (Sprint 1-4)** | `1146065d`-`b067c2da` | Enklare UI för användare | UX-förbättring |
| **Lasttestning + prestandaoptimering** | `8c8cd882` | Skalbarhet verifierad | Teknisk förbättring |
| **GDPR-kontoborttagning** | `a493148f` | Lagkrav | Komplett |
| **Stripe prenumeration (backend)** | `dec9280b`, `358fbb4d` | Leverantörsavgift | Delvis (ingen betalflödestest) |
| **Landningssida omskriven** | `645c864c` | Första intrycket för besökare | Komplett |
| **Grafisk profil** | `31a3d81f` | Brand identity | Komplett |
| **Buggrapport-system** | `feee74ed`-`ad034f5d` | Användare rapporterar buggar | Komplett |
| **Ghost-user upgrade (bjud in manuella kunder)** | `f29a3107` | Konvertera "spök-kunder" till riktiga konton | Komplett |
| **Hjalpcentral** | `c8beb1ba` | In-app FAQ | Komplett |
| **Offline CRUD-expansion** | `634c0a2b`, `81583d80` | Leverantör jobbar offline | Delvis |
| **Offline UX-förbättring** | `f0f68c60` | Battre feedback vid offline | UX-förbättring |
| **Offline mutation queue** | `16:26:20` | Offlineändringår koas och synkas | Teknisk förbättring |
| **Error boundaries för offline** | `12:06:16` | Graceful degradation | Komplett |

**Sammanfattning februari**: Produkten breddar ut sig kraftigt. Många parallella spar: offline/PWA, säkerhet, UX-polering, nya features (stall, prenumeration), refactoring. 313 commits på en månad är extremt högt tempo.

**Risk**: Februari har flest commits men också mest spridning. Offline-spatret är komplext (sync-engine, mutation queue, circuit breaker). Stallhantering påbörjas men är feature-fläggad OFF. Stripe-prep är halvfärdig.

---

### E2E-testarbete (februari)

Många commits för E2E-infrastruktur och fixar:
- E2E för kundflöden, ruttnotiser, följa-leverantör
- Lasttestning med k6
- Feature flåg E2E-mönster etablerat

---

## Mars 2026 -- iOS native och DX

### Nya features

| Feature | Commit(s) | Användarvärde | Status |
|---------|-----------|---------------|--------|
| **iOS native-app (WKWebView + bridge)** | `18:06:59`-`12:01:06` | iOS-app för leverantörer | Komplett (hybrid) |
| **iOS XCTest-infrastruktur (24 tester)** | `12:40:46` | Testtäckning iOS | Komplett |
| **iOS native auth (Face ID + push)** | `08:34:42` | Säker inloggning på iOS | Komplett |
| **Stallprofiler + platser (6 faser)** | `13:43:15`-`19:08:57` | Stallägare publicerar lediga platser | Delvis (OFF) |
| **Stall-UX-polering** (4-5 commits) | `19:49:19`-`07:44:54` | Navigation, a11y, skelett | UX-förbättring |
| **iOS native dashboard** | `16:09:33` | SwiftUI-dashboard | Komplett |
| **iOS native bokningslista** | `16:53:05` | SwiftUI-kalender med bokningar | Komplett |
| **iOS native kundhantering** | `11:53:29` | SwiftUI CRUD för kunder | Komplett |
| **iOS native tjänstehantering** | `16:27:34` | SwiftUI CRUD för tjänster | Komplett |
| **iOS native recensioner** | `13:41:57` | SwiftUI-recensionsvy | Komplett |
| **iOS native profilvy** | `15:42:21`, `10:50:40` | SwiftUI profil med 2 tabbar | Komplett |
| **iOS app-ikon** | `11:36:25` | Brand identity | Komplett |
| **Landningssida UX-uppdatering** | `08:28:23` | Forbattrat förstaintryck | Komplett |
| **Kalender omdesignad (compact action card)** | `18:02:30` | Battre mobil UX | Komplett |
| **BookingNotesSection (ateranvandbar)** | `12:52:49` | Komponentextraktion | Teknisk förbättring |
| **DX-förbättringar (hooks, check:all, flags:validate)** | `648f3a78` | Utvecklarproduktivitet | Teknisk förbättring |

**Sammanfattning mars**: Fokuserat på iOS native-rebuild (WebView -> SwiftUI för 7 skarmor) och stall-feature. 107 commits, lägre tempo an februari men mer fokuserat.

---

### Bugfixar (mars, urval)

| Fix | Commit | Koppling |
|-----|--------|----------|
| **Auth null-check i 87 API routes** | `b995b416` | Säkerhet: 78% av auth-routes saknade null-check |
| **E2E Batch 1-6** (6 commits) | `c872a7a5`-`6db6eaec` | Stabilisera E2E-sviten |
| **Manual recurring booking 400-fel** | `620f9a45` | Bokning |
| **iOS QuickNoteSheet save-deadlock** | `1da188e4` | iOS UX |
| **iOS WebView retain cycle** | `619a306b` | iOS minneslacka |
| **iOS pendingMorePath routing** | `f59df0b5` | iOS navigering |
| **CalendarHeader form-submit bugg** | `8a3bf7b8` | HTML-spec: Button utan type=button submittar form |
| **Swift 6 concurrency-varningar (34 st)** | `9016701e` | iOS kodkvalitet |
| **Pentest-fixar (IDOR, admin auth)** | `4524b58c` | Säkerhet |

---

## Gruppering efter typ

### Nya features (användarvärde)

| Kategori | Antal commits (approx) | Användarvärde |
|----------|----------------------|---------------|
| Karnbokning (skapa, hantera, kalender) | ~25 | **Högt** -- detta är produktens hjarta |
| Hästhantering + tidslinje | ~10 | **Högt** -- kärndomänen |
| Recensioner + betyg | ~5 | **Medel** -- socialt bevis |
| Leverantörshantering (profil, kunder, tjänster) | ~15 | **Högt** -- leverantörens dagliga verktyg |
| Ruttplanering + annonser | ~10 | **Medel** -- nischfunktion, Mapbox-beroende |
| Gruppbokningar | ~5 | **Medel** -- stallgemenskap |
| Notiser + påminnelser | ~8 | **Medel** -- engagement |
| Follow + kommun-bevakning | ~5 | **Låg-medel** -- discovery |
| iOS native (7 skarmor) | ~25 | **Högt** för iOS-användare, **noll** för webben |
| Stallhantering (6 faser) | ~10 | **Oklart** -- feature OFF, oklar affärsmodell |
| Offline/PWA | ~15 | **Låg just nu** -- komplex, ej verifierad |
| Betalning (mock + Stripe-prep) | ~5 | **Högt potentiellt**, men mock-only idag |
| Buggrapporter | ~5 | **Lag** -- intern quality-of-life |
| Hjalpcentral | ~3 | **Lag** -- nice-to-have |

### Bugfixar

| Kategori | Antal commits (approx) | Kommentar |
|----------|----------------------|----------|
| E2E-fixar | ~12 | Stabilisera testsviten |
| iOS-buggar | ~15 | Retain cycles, navigering, deadlocks |
| Auth-fixar | ~5 | Null-checks, session-hantering |
| Säkerhet | ~5 | Pentest-fixar, CSP |
| UI/UX-fixar | ~10 | Formularbuggar, navigering |
| Build/deploy | ~8 | TypeScript, Vercel, CI |

### Tekniska förbättringar

| Kategori | Antal commits (approx) | Demo-värde |
|----------|----------------------|------------|
| DDD-refactoring (domain services, value objects) | ~10 | Noll direkt, förbättrar kodkvalitet |
| Komponentextrahering + hooks | ~8 | Noll direkt |
| Feature flag-system | ~5 | Noll direkt, möjliggör gradvis utrullning |
| Testinfrastruktur | ~15 | Noll direkt |
| DX-förbättringar (hooks, check:all) | ~3 | Noll direkt |
| ESLint-rensning | ~3 | Noll direkt |
| Prestandaoptimering | ~3 | Indirekt -- snabbare svar |

### Experiment / prototyper

| Sak | Commits | Kommentar |
|-----|---------|----------|
| SRI (Subresource Integrity) | ~2 | **Borttagen** -- fungerade inte på Vercel CDN |
| DDD strict -> DDD-Light | ~3 docs | Nedskallat ambition -- klokt beslut |
| Offline PWA (sync-engine, circuit breaker) | ~15 | Avancerad men **ej verifierad** i praktiken |
| Stallhantering (6 faser) | ~10 | Feature OFF, oklart om det är kärnprodukt |
| Stripe-prenumeration | ~3 | Backend klar, inget UI-flöde |
| Kundinsikter (AI) | ~3 | Oklart om AI-integration är kopplad |
| Rostloggning | ~5 | Oklart om AI-tolkning fungerar |

---

## Tempo och fokus över tid

```
Jan:  [==========] 142 commits -- Bygga från grunden. Allt på en gång.
Feb:  [==========================] 313 commits -- Bredda, polera, härda. Många spär parallellt.
Mar:  [=========] 107 commits -- iOS native + stall. Mer fokuserat.
```

**Observation**: Februari har nästan lika många commits som januari och mars TILLSAMMANS. Det vär den mest intensiva perioden men också den med störst spridning (offline, säkerhet, UX, nya features, refactoring, E2E -- allt samtidigt).

---

## Det här verkar vara kärnan i produkten just nu

1. **Bokningshantering** (leverantör + kund) -- skapad, bekräftad, slutförd, avbokad, ombokad. Robust med överlappskontroll, restidesvalidering, statusmaskin. **Mest komplett.**

2. **Leverantorens dagliga verktyg** -- kundregister, tjänster, schema, kalender, manuell bokning. **Fullt fungerande.**

3. **Hästhantering** -- profiler, tidslinje, serviceintervall. **Komplett.**

4. **Recensioner** -- kund -> leverantör + leverantör -> kund. **Komplett.**

5. **iOS native-app för leverantörer** -- 7 skarmor i SwiftUI (dashboard, bokningar, kunder, tjänster, recensioner, profil, mer-flik). **Nyligen omskrivet, troligen mest aktuellt.**

6. **Auth-system** -- registrering, inloggning, email-verifiering, lösenordsåterställning, dual-auth (session + JWT). **Komplett men email-leverans oklart.**

7. **Admin-panel** -- användarhantering, bokningsövervakning, feature flags, recensionsmoderation, buggrapporter. **Komplett.**

---

## Det här verkar vara sidospår eller ofärdigt

1. **Offline/PWA** (~15 commits, komplex implementering) -- Sync-engine med circuit breaker, mutation queue, tab-koordinering. **Ingen E2E-test. Ingen manual verifiering. Extremt komplex för någon som sannolikt har bra mobilnät.** Risk: ökär kodkomplexiteten avsevärt utan bevisad nytta.

2. **Stallhantering** (~10 commits, 6 faser) -- Feature-fläggad OFF. Komplett backend men oklart användarbehov. 4-5 extra commits för UX-polering av en feature som är avstängd. **Risk: tid lagd på något som kanske aldrig släpps pa.**

3. **Ruttplanering + ruttannonser** (~10 commits) -- Kräver Mapbox + OSRM. Komplext flöde med många beroenden. **Risk: svårt att demonstrera utan externa tjänster.**

4. **Stripe-prenumeration** (~3 commits) -- Backend-infrastruktur (gateway, webhook) men feature-fläggad OFF. Inget komplett betalflöde. **Halvfärdigt.**

5. **Kundinsikter (AI)** (~3 commits) -- Service finns men oklart om AI-integration är kopplad. Tester mockar bort externa anrop. **Oklart syfte -- är det statistik eller riktig AI?**

6. **Rostloggning** (~5 commits) -- iOS SpeechRecognizer + backend VoiceInterpretationService. **Oklart om AI-tolkning fungerar. Imponerande koncept men oklart om det ger värde idag.**

7. **Kommun-bevakning + Följa leverantor** (~5+5 commits) -- Fungerar tekniskt men ger värde forst när det finns många användare. **Trevligt för MVP men inte kritiskt.**

8. **DX-förbättringar (hooks, check:all, flags:validate)** (~3 commits) -- Förbättrar utvecklarupplevelsen men noll användarvärde. **Ratt för ett team, överflödigt för en ensam utvecklare.**

9. **Dokumentation** (113 commits!) -- 20% av alla commits är docs. Retrospektiver, guider, planer, index. **Värdefull för framtida utvecklare men ökär inte demo-barhet.**

---

## Observationer

### Mönstret "bygg forst, fråga sedan"

Git-historiken visar ett mönster där features byggs snabbt och sedan poleras/fixas över många commits:
- Stallhantering: 6 faser + 4-5 poleringscommits + UX-polering -- för en feature som är OFF
- iOS native: 7 skarmor på 5 dagar, sedan 15+ bugfixar
- Offline: 15+ commits för ett system som aldrig är verifierat end-to-end

### Hög andel fixar relativt features

192 feat vs 162 fix (1.2:1 ratio). För ett projekt i tidigt skede är detta högt. Varje ny feature drär med sig nästan lika många fixar. Detta antyder att features läggs till snabbare an de hinner stabiliseras.

### Dokumentation som produkt

113 docs-commits (20% av alla). Retrospektiver, planer, guider. Värdefull för framtida utvecklare och kontextöverlämning, men representerar tid som kunde ha gått till att verifiera att features faktiskt fungerar.

### Starkaste signalen

Det som **faktiskt fungerar** är det som har flest tester, lägst fix-ratio, och är enklast: bokningshantering, hästhantering, recensioner, leverantörsprofil. Dessa är också det som är mest demo-bart.
