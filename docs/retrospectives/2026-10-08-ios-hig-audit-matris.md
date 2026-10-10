---
title: "iOS HIG-genomlysning 2026-10-08 -- matriser: skärmar och prioritering"
description: "Skärm- och kontrollområdesmatris samt prioriteringsmatris per fynd efter produktbesluten (iPhone-only, ljust läge, WebView för hästägare)"
category: research
status: draft
last_updated: 2026-10-10
sections:
  - Teckenförklaring
  - Matris
  - Kommentarer till matrisen
  - Prioriteringsmatris per fynd
tags: [ios, hig, accessibility, audit]
related:
  - docs/retrospectives/2026-10-08-ios-hig-audit.md
  - docs/retrospectives/2026-10-08-ios-hig-audit-sammanfattning.md
  - docs/retrospectives/2026-10-08-ios-hig-audit-pr-slices.md
---

# iOS HIG-genomlysning 2026-10-08 -- matris över skärmar och kontrollområden

## Teckenförklaring

| Symbol | Betydelse |
|--------|-----------|
| **V** | Verifierat i körande app (simulator), observerat eller mätt |
| **K** | Verifierat i källkod, inte körd |
| **S** | Uppskattat från skärmbild |
| **-** | Inte möjligt att verifiera eller inte tillämpligt (se `...-ej-verifierat.md`) |
| `OK` | Ingen anmärkning |
| **D-x** | Beslutad avgränsning (inte ett öppet fel): D-1 iPhone-only, D-2 endast ljust läge, D-3 WebView för hästägare |
| `F-xx` | Fynd i den fullständiga rapporten |

Kontrollområden: **DT** = Dynamic Type/stor text; **VO** = VoiceOver (etiketter, ordning, åtgärder); **KO** = kontrast; **TY** = tryckytor; **FÄ** = färg som enda informationsbärare; **RM** = Reduce Motion/Increase Contrast/Reduce Transparency; **NA** = navigation/plattformskonventioner; **LA** = layout/storlekar/orientering/mörkt läge; **IN** = interaktion (laddning, fel, destruktiva åtgärder, tomt); **VI** = visuell kvalitet/innehåll/svensk text.

## Matris

| Skärm / yta | DT | VO | KO | TY | FÄ | RM | NA | LA | IN | VI |
|-------------|----|----|----|----|----|----|----|----|----|----|
| Launch screen / kall start | - | - | OK (V) | - | - | - | F-25 (V) | F-25 (V) | F-25 (V,K) | F-25 (V) |
| Splash (`SplashView`) | OK (K) | OK (K) | 3,08:1 stor fet text OK (V) | - | - | - | - | F-25 (V) | F-25 (K) | F-34 (V) |
| Inloggning (`NativeLoginView`) | ej AX-test (K) | F-27 (K) | F-02 (V) | OK 44 pt (K) | OK | - | F-27 (K) | D-2, tomt utrymme (V) | F-27 (K) | F-12/F-27 (V) |
| Översikt (`NativeDashboardView`) | **F-01 (V,K)** | F-30 (V), F-29 (K) | F-02, F-23 (V) | OK, KPI 100 pt (V) | OK | F-31 (K) | F-15 (V) | D-1, D-2 | F-21 (K), F-24 (V) | F-20 (V) |
| Bokningslistan (`NativeBookingsView`) | **F-01 (V)** | **F-03 (V,K)** | **F-02 (V)** | **F-05 (V)** | **F-03 (V)** | F-31 (K) | **F-06 (V)** | D-2 | **F-07 (K)**, F-21 (K) | F-11, F-23 (V) |
| Bokningsdetalj (`NativeBookingDetailView`) | ej AX-test (K) | OK, förebild (V) | F-02 (statuschip) (V) | OK 44-50 pt (V) | OK (text finns) | - | F-17 (V) | F-16 (V) | F-07 (K) | F-20 (V) |
| Kalender (`NativeCalendarView`) | **F-01 (V, S6-körpass)** | **F-04 (V,K)**, OK för block (V) | F-02 (chips) (V) | F-22 (chips 30 pt) (V) | OK | F-31 (K) | OK | D-2 | OK | F-22 (V,K) |
| Mer-menyn (`NativeMoreView`) | ej AX-test (K) | OK (V) | OK | OK | OK | - | OK (system `List`) | D-2 | F-32 (K) | F-11 (V) |
| Meddelanden (WebView) | - | - | - | - | - | - | F-14 (V) | F-14 (V) | F-14 (V) | F-14 (V) |
| Hästhistorik (WebView) | - | - | - | - | - | - | F-14, F-17 (V) | F-14 (V) | F-14 (V) | F-14 (V) |
| Profil, Tjänster, Kunder, Recensioner, Insikter, Hjälp (nativa) | K: 22 fasta ikonstorlekar F-01 | K: 3-8 etiketter/vy | - | K: ej mätt | - | - | F-18 (K) | - | K: bekräftelser finns | - |
| Sheets (Avboka, Recensera, Anteckning, Profil, Radera konto, Tjänst) | - | - | - | - | - | - | F-18 (K) | - | OK (Avbryt/Handling) (K) | - |
| Offline-läge (`NetworkBannerView`) | - | OK (K) | **F-02 1,66:1 (V)** | - | OK (text+ikon) | - | - | - | F-21 (V) | - |
| Fel-/tom-/laddlägen | F-01 (K) | - | - | - | - | - | - | - | F-21 (V,K) | F-21 (K) |
| Widget (liten, medium) | OK (K) | - (K: inga etiketter) | - | - | F-09 (K) | - | F-09 (K) | F-09 (K) | F-09 (K) | F-09 (K) |
| Notiser (push, åtgärder, behörighet) | - | - | - | - | - | - | F-13 (V) | - | **F-08 (K)**, F-13 (V,K), F-19 (K) | F-19 (K) |
| Appikon | - | - | - | - | - | - | - | F-12 (S) | - | F-12 (K,S) |
| Launch-/appresurser (`LaunchIcon`, `AccentColor`) | - | - | - | - | - | - | - | - | - | F-12, F-25 (K) |
| Kund-/hästägarflödet (`CustomerWebView`, WebView-skal) | - | - | F-02 (banner delas) (K) | - | - | - | **D-3** (valet), F-13 (V) | - | **F-35 (V,K)** | F-25 (K) |
| iPad (alla ovan) | - | - | - | - | - | - | - | **D-1 beslutad avgränsning (V, var F-26)** | - | - |
| Mörkt läge (system) | - | - | - | - | - | - | - | **D-2 beslutad avgränsning (V, var F-10)** | - | - |
| Stor text AX5 | **F-01 (V)** | - | - | - | - | - | - | **F-01 (V)** | - | - |
| Liggande iPhone | - | - | - | - | - | - | - | - (endast stående, K) | - | - |

## Kommentarer till matrisen

- **Beslutade avgränsningar:** iPad, mörkt läge och valet av WebView för hästägare är markerade D-1, D-2 och D-3 och bedöms inte som fel. Fynden i kundskalet (F-35 m.fl.) är funktionsfel i skalet och bedöms separat.
- **Evidensfördelning:** Bokningslistan, Översikt, Kalender, Mer, Meddelanden och bokningsdetaljen är körda i appen. Profil, Tjänster, Kunder, Recensioner, Insikter och Hjälp är endast kod-granskade (stort kodunderlag, inte öppnade i appen); matrisen markerar K där så är fallet.
- **Matrisen visar inte allt**: Skärmar markerade `-` i en kolumn är inte nödvändigtvis felfria, bara ej bedömda.
- **Stor text (AX5)** kördes bara på Översikt och Bokningar. Resten av appen följer samma mönster (noll Dynamic Type-anpassning i koden), så felen är sannolika även där men inte observerade.

## Prioriteringsmatris per fynd

Prioritetsgrupperna följer produktens ordning: **1** blockerande Dynamic Type och tillgänglighet, **2** VoiceOver, fokusordning, etiketter och tryckytor, **3** avgränsningsåtgärder, **4** widgetens verifierade problem, **5** navigation, formulär, sheets samt fel- och offlinelägen, **6** visuell finslipning. "Utanför" = hör inte till de sex kategorierna. Evidens: V-app, V-kod, Ej verifierat. Slices finns i `2026-10-08-ios-hig-audit-pr-slices.md`.

| Fynd | Titel | Allvar | Status | Evidens | Prio | Slice |
|------|-------|--------|--------|---------|------|-------|
| F-01 | Stor text bryter Översikt och Bokningar | Critical | Öppet | V-app + V-kod | 1 | S1, S2, S6 (S0) |
| F-02 | Kontrast: varumärkesgrönt och tonade knappar | Critical | Öppet | V-app | 1 | S3, S4 |
| F-03 | Bokningsstatus bara som färgprick | Critical | Öppet | V-app + V-kod | 1 | S5 |
| F-04 | Ikonknappar utan etikett i kalenderhuvudet | Critical | Öppet | V-app + V-kod | 2 | S7 |
| F-05 | Tryckytor under minimum på bokningskort | Critical | Öppet | V-app | 2 | S8 |
| F-06 | Ett tryck på kortet utlöser två åtgärder | High | Öppet | V-app | 2 | S8 |
| F-07 | Avvisa/Uteblev utan bekräftelse eller ångra | High | Öppet | V-kod | 5 | S17 |
| F-08 | Push: `category` skriver över `aps` | High | Öppet | V-kod | Utanför (placerad i 5) | S16 |
| F-09 | Widget: medium oanvänd, inget datum, ingen djuplänk | High | Öppet | V-kod | 4 | S14, S15 |
| F-10 | Tvingat ljust läge | (var High) | **Beslutad avgränsning D-2** | V-app | 3 | S11, S13 |
| F-11 | Accent- och statusfärger osystematiska | High | Öppet | V-app + V-kod | 1 | S3 |
| F-12 | Appikonen: SF-symbol, platt, identiska varianter | High | Öppet | V-kod + skärmbild | 6 (före App Store-inlämning) | S28 |
| F-13 | Pushbehörighet utan sammanhang, ingen notisinställning | High | Öppet | V-app + V-kod | 5 | S21 |
| F-14 | Leverantörens WebView-skal: dubbla kontroller, flytande knappar | High | Öppet (kunddelen är **D-3**) | V-app | 5 | S19 |
| F-15 | Dagens bokningar på Översikt inte tryckbara | Medium | Öppet | V-app | 2 | S9 |
| F-16 | Primärknapp under glas-tab baren | Medium | Öppet | V-app | 5 | S20 |
| F-17 | Hästlänken byter flik | Medium | Öppet | V-app | 5 | S20 |
| F-18 | Resizable sheets saknar grabber | Medium | Öppet | V-kod | 5 | S23 |
| F-19 | Notisåtgärder och förgrundsvisning | Medium | Öppet | V-kod | 5 | S22 |
| F-20 | Månader och veckodagar med versal | Medium | Öppet | V-app | 6 | S25 |
| F-21 | Fel-, tom- och laddlägen generiska och handbyggda | Medium | Öppet | V-kod + V-app | 5 | S24 |
| F-22 | Kalender: nu-linje över text, 9 pt-text | Medium | Öppet | V-app + V-kod | 6 | S26 |
| F-23 | Kärndata i caption med sekundär färg | Medium | Öppet | V-app | 6 | S26 |
| F-24 | Redundans på Översikt | Medium | Öppet | V-app | 6 | S26 |
| F-25 | Start: vit launch, grön splash, 500 ms fördröjning | Medium | Öppet | V-app + V-kod | 6 | S27 |
| F-26 | iPad: uppsträckt telefonlayout | (var Medium) | **Beslutad avgränsning D-1** | V-app | 3 | S12 |
| F-27 | Inloggningen: etikettmismatch och formulärdetaljer | Medium | Öppet | V-app + V-kod | 2 (etikett), 5 (formulär) | S7, S23 |
| F-28 | Död kod `NativeTabBar.swift` | Low | Öppet | V-kod | 6 | S29 |
| F-29 | Redundanta tillgänglighetshints | Low | Öppet | V-kod | 2 | S7 |
| F-30 | Möjliga dubbla tillgänglighetselement i KPI-kort | Low | Öppet | V-app (träd), Ej verifierat (uppläsning) | 2 | S9 |
| F-31 | Reduce Motion, Increase Contrast, Reduce Transparency | Low | Öppet | V-kod, Ej verifierat | 2 | S10 |
| F-32 | Utloggning med bekräftelsedialog | Low | Öppet | V-kod | 6 | S29 |
| F-33 | Ingen svensk lokalisering av systemtexter | Low | Öppet | V-app (Bedömning) | 6 | S29 |
| F-34 | Statusfältsfärg på splash | Low | Öppet | V-app | 6 | S29 |
| F-35 | Kundskalet: splash täcker felvyn (ny) | High | Öppet | V-app + V-kod | 5 | S18 |
| F-36 | Okänd `userType` ger leverantörsappen (ny, utanför HIG) | Low | Öppet | V-app + V-kod | Utanför | S30 |
| D-3 | Hästägarupplevelsen förblir WebView-baserad | - | **Beslutad avgränsning** | - | 3 | (ingen; skalets fel: S18, S21, S27, S30) |

Sammanräkning: 36 fynd-ID varav 34 öppna (5 Critical, 9 High, 12 Medium, 8 Low) och 2 omklassificerade (F-10, F-26). D-3 är ett beslut ur F-14:s kunddel, inte ett eget fynd-ID.
