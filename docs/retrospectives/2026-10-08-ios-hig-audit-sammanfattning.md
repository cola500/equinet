---
title: "iOS HIG-genomlysning 2026-10-08 -- prioriterad sammanfattning (reviderad efter produktbeslut)"
description: "Reviderad topp-10, beslutade avgränsningar (iPhone-only, ljust läge, WebView för hästägare), prioritering per kategori och väg vidare"
category: research
status: draft
last_updated: 2026-10-08
sections:
  - Läge efter produktbesluten
  - Beslutade avgränsningar
  - Reviderad topp-10
  - Prioritering per kategori
  - Väg vidare
  - Vad som ändrades lokalt under granskningen
tags: [ios, hig, accessibility, audit]
related:
  - docs/retrospectives/2026-10-08-ios-hig-audit.md
  - docs/retrospectives/2026-10-08-ios-hig-audit-matris.md
  - docs/retrospectives/2026-10-08-ios-hig-audit-ej-verifierat.md
  - docs/retrospectives/2026-10-08-ios-hig-audit-pr-slices.md
  - docs/retrospectives/2026-04-18-ios-ux-audit.md
---

# iOS HIG-genomlysning 2026-10-08 -- prioriterad sammanfattning

## Läge efter produktbesluten

Helhetsbetyg: **Critical issues**. Efter produktbesluten återstår **34 öppna fynd**: 5 Critical (alla tillgänglighet), 9 High, 12 Medium och 8 Low. Två fynd (F-10, F-26) och en del av ett tredje (kundflödets WebView i F-14) är omklassificerade till beslutade avgränsningar och räknas inte längre som HIG-fel. Fullständig evidens finns i `2026-10-08-ios-hig-audit.md`; fynd-ID (F-xx) hänvisar dit och slices (Sxx) till `2026-10-08-ios-hig-audit-pr-slices.md`.

Granskningen ändrade ingen produktkod. Dokumenten och 17 skärmbilder (`docs/metrics/ios-audit-2026-10-08/`) versionshanteras i en ren dokumentations-PR.

## Beslutade avgränsningar

| ID | Beslut | Tidigare fynd | Åtgärd som kvarstår | Slice |
|----|--------|---------------|----------------------|-------|
| **D-1** | Appen är iPhone-only tills vidare (iPad-stödet tas bort) | F-26 (Medium): uppsträckt telefonlayout på iPad (V-app) | Ta bort iPad ur projektinställningar och `Info.plist`; kontrollera distributionsläget | S12 |
| **D-2** | Appen använder endast ljust läge tills vidare, uttryckligt och dokumenterat | F-10 (High): tvingat ljust läge (V-app) | Beslutspost; `UIUserInterfaceStyle = Light`; verifiera systemytor och att widgeten förblir systemanpassad | S11, S13 |
| **D-3** | Hästägarupplevelsen förblir WebView-baserad (informerat arkitekturbeslut; ingen omskrivning föreslås) | Kunddelen av F-14 | Inget; valet bedöms inte som fel. Skalets funktionsfel är separata fynd (F-35, F-02 i banner, F-13, F-25, F-36) | S18, S21, S27, S30 |

Besluten minskar inte kraven på tillgänglighet inom det som finns kvar: stor text, kontrast, etiketter och tryckytor gäller fortfarande på iPhone, i ljust läge och i WebView-skalet. Varje beslut har ett omprövningsvillkor i auditrapporten.

## Reviderad topp-10

Ordnad enligt produktens prioritering (kategori 1-6). Avgränsningsåtgärderna (kategori 3) räknas inte som fynd och ligger i tabellen ovan.

| # | Fynd | Allvar | Evidens | Kategori | Slice |
|---|------|--------|---------|----------|-------|
| 1 | **Stor text bryter Översikt och Bokningar** (F-01). Klockslaget `14:00` blir `1/4:/0/0` vid AX5 (fast bredd 44 pt); noll `dynamicTypeSize`/`ViewThatFits` i appen | Critical | V-app + V-kod | 1 | S1, S2, S6 |
| 2 | **Kontrast och färgsystem** (F-02, F-11). Brandgrönt `#29A678` = 3,08:1 mot vitt; tonade knappar 1,81-2,54:1; offline-banner 1,66:1; statuschip 2,09:1; `AccentColor` tom, grönt/blått/orange blandas | Critical + High | V-app (pixelmätt) | 1 | S3, S4 |
| 3 | **Bokningsstatus är bara en 8 pt färgprick** i listan; saknas i VoiceOver-etiketten (F-03) | Critical | V-app + V-kod | 1 | S5 |
| 4 | **Tryckytor 12-14 pt** på hästlänk, telefon och "Visa detaljer"; knappar 28 pt med 8 pt mellanrum (F-05) | Critical | V-app (mätt) | 2 | S8 |
| 5 | **Kalenderns ikonknappar läses som "Back", "Forward", "Snooze"** (F-04) | Critical | V-app + V-kod | 2 | S7 |
| 6 | **Ett tryck på ett bokningskort utlöser två åtgärder** (detalj + hopp till Mer med WebView) (F-06) | High | V-app | 2 | S8 |
| 7 | **Widget: mellanstor layout oanvänd, inget datum i den lilla, ingen djuplänk** (F-09) | High | V-kod | 4 | S14, S15 |
| 8 | **Kundskalet: splash täcker felvyn** när första laddningen misslyckas; över 45 s utan felmeddelande eller omförsök (F-35, nytt i andra passet) | High | V-app + V-kod | 5 | S18 |
| 9 | **Push-payload: `category` skrivs in i `data.aps` och ersätter `alert/sound/badge`** i `apns2` (F-08). Fristående serverfel utanför de sex kategorierna; bör vara klart före push blir skarp | High | V-kod (bibliotekets källa läst) | utanför, placerad i 5 | S16 |
| 10 | **Avvisa och Uteblev utan bekräftelse eller ångra** (F-07) | High | V-kod | 5 | S17 |

Medvetet utanför topp-10 men High: F-12 (appikonen liknar SF-symbolen `figure.equestrian.sports`, platt enkelskikt; kategori 6, men bör vara klar före första App Store-inlämning, S28), F-13 (pushbehörighet utan sammanhang, S21) och F-14 (leverantörens WebView-skal, S19).

## Prioritering per kategori

| Kategori (produktens ordning) | Fynd | Slices |
|-------------------------------|------|--------|
| **1. Blockerande Dynamic Type och tillgänglighet** | F-01, F-02, F-03, F-11 | S1-S6 (S0 valfri) |
| **2. VoiceOver, fokusordning, etiketter och tryckytor** | F-04, F-05, F-06, F-15, F-27 (etikett), F-29, F-30, F-31 | S7-S10 |
| **3. Avgränsningsåtgärder** | D-1 (F-26), D-2 (F-10), D-3 | S11-S13 |
| **4. Widgetens verifierade problem** | F-09 | S14, S15 |
| **5. Navigation, formulär, sheets samt fel- och offlinelägen** | F-07, F-08 (placerad här), F-13, F-14, F-16, F-17, F-18, F-19, F-21, F-27 (formulär), F-35 | S16-S24 |
| **6. Visuell finslipning** | F-12, F-20, F-22, F-23, F-24, F-25, F-28, F-32, F-33, F-34 | S25-S29 |
| Utanför kategorierna | F-36 (okänd `userType` ger leverantörsappen, utanför HIG) | S30 |

Den fullständiga prioriteringsmatrisen per fynd finns i `2026-10-08-ios-hig-audit-matris.md`.

## Väg vidare

Föreslagna små, fristående PR-slices (30 st, S0 valfri) med problem, evidensklass, nytta, tester och acceptans, docs, beroenden och risker samt HIG-källor finns i `2026-10-08-ios-hig-audit-pr-slices.md`. Inget av det är påbörjat. Viktiga beroenden: bokningskortet tas i ordningen S2, S5, S8, S17; paletten (S3) före kontrastslicen (S4); push-payloaden (S16) före notisåtgärderna (S22); besluten (S11) före avgränsningsåtgärderna (S12, S13).

Det som kräver beslut av dig innan respektive slice: ny nyans på varumärkesgrönt (S3), mönster för Avvisa/Uteblev (S17), tidpunkt för pushbehörighet (S21), appikonens design (S28).

Kontrastverktyget (`contrast.swift`) från granskningen är medvetet inte versionshanterat. Mätvärdena i rapporten är reproducerbara med Accessibility Inspector eller samma WCAG-formel.

## Vad som ändrades lokalt under granskningen

- **Repot:** orört fram till dokumentations-PR:n, som bara lägger till filer under `docs/` (plus en rad i `docs/INDEX.md`). Ingen produktkod, inga tester, inga Xcode-inställningar, entitlements eller assets ändrades.
- **Lokalt (utanför repot):** lokal Supabase och lokal Next-dev-server startades och stoppades (två gånger); appen byggdes till en separat derived-data-mapp utanför repot; lokala testlösenord och `app_metadata.userType = customer` sattes på de fiktiva lokala användarna `erik.jarnfot@demo.equinet.se` respektive `test@example.com` i den lokala auth-databasen; appen installerades på iPhone 17 och iPad Air 11-inch (iOS 27.0-simulatorer), som nu är avstängda.
- **Ingenting** skrevs mot staging eller produktion.
