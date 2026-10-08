---
title: "iOS HIG-genomlysning 2026-10-08 -- fullständig rapport (reviderad efter produktbeslut)"
description: "Genomlysning av Equinets iOS-app mot Apples Human Interface Guidelines: 36 fynd-ID, varav 34 öppna och 2 omklassificerade till beslutade avgränsningar, med evidensklass per fynd"
category: research
status: draft
last_updated: 2026-10-08
sections:
  - Sammanfattning
  - Beslutade avgränsningar
  - Omfattning och metod
  - Evidensklasser
  - Referenser som lästs
  - Skärmbilder
  - Critical
  - High
  - Medium
  - Low
  - Vad som fungerar
  - Återanvända backlogpunkter
tags: [ios, hig, accessibility, audit]
related:
  - docs/retrospectives/2026-10-08-ios-hig-audit-sammanfattning.md
  - docs/retrospectives/2026-10-08-ios-hig-audit-matris.md
  - docs/retrospectives/2026-10-08-ios-hig-audit-ej-verifierat.md
  - docs/retrospectives/2026-10-08-ios-hig-audit-pr-slices.md
  - docs/retrospectives/2026-04-18-ios-ux-audit.md
  - docs/sprints/backlog.md
---

# iOS HIG-genomlysning 2026-10-08 -- fullständig rapport

## Sammanfattning

**Helhetsbetyg: Critical issues.** Efter produktbesluten (se nästa avsnitt) återstår 34 öppna fynd: 5 Critical (alla tillgänglighet), 9 High, 12 Medium och 8 Low. Två tidigare fynd (F-10, F-26) och en del av ett tredje (kundflödets WebView i F-14) är omklassificerade till **beslutade avgränsningar** och räknas inte längre som HIG-fel.

Appens ändamål: en leverantörs dagliga arbetsverktyg (godkänn bokning, se dagens rutt, logga arbete). Den är i stort sett byggd på rätt sätt med systemkomponenter (`TabView` med glas-tab bar, `NavigationStack`, `List`, `ContentUnavailableView`, `confirmationDialog`). Det som saknas är ett genomgående tillgänglighets- och färgsystem. Den gröna identiteten är både för ljus för att klara kontrast och inte kopplad till systemets accentfärg (asset-katalogens `AccentColor` är tom), så den blandas med systemets blå, grön och orange.

De tre viktigaste upptäckterna efter besluten:

1. **Stor text bryter huvudskärmarna.** På Översikt blir klockslaget `14:00` till `1 / 4: / 0 / 0` vid tillgänglighetsstorlek AX5 (fast bredd 44 pt). Inga `dynamicTypeSize`, `ScaledMetric` eller `ViewThatFits` finns i koden.
2. **Varumärkesgrönt `#29A678` ger 3,08:1 mot vitt.** Det används som bakgrund för vit text i primärknappar, valda filterchips och som textfärg. Tonade knappar mäter ned till 1,81:1.
3. **Bokningskortet har flera samverkande tillgänglighetsbrister:** status visas bara som en 8 pt färgprick, tryckytor är 12-14 pt och ett tryck på kortet utlöser två åtgärder.

Ny verifiering i andra passet: kundskalet visar splash i över 45 sekunder utan felvy eller omförsök när servern inte svarar (F-35). Det är ett funktionsfel i skalet, inte ett argument mot WebView-valet.

Granskningen är analys; ingen produktkod, inga tester, inga Xcode-inställningar, inga entitlements och inga assets har ändrats. Dokumenten och skärmbilderna versionshanteras i en ren dokumentations-PR.

## Beslutade avgränsningar

Tre produktbeslut har fattats utifrån granskningen (2026-10-08). De ändrar klassificeringen av fynd: de bedöms inte längre som öppna HIG-fel utan som medvetna avgränsningar, med avgränsade följdåtgärder. Inga av besluten minskar kraven på tillgänglighet inom de ytor som finns kvar (stor text, kontrast, etiketter, tryckytor gäller fortfarande på iPhone, i ljust läge och i WebView-skalet).

### D-1 iPhone-only tills vidare (tidigare F-26)

- **Beslut:** Ta bort iPad-stödet tills vidare. Appen ska vara iPhone-only.
- **Bakgrund (V-app):** På iPad Air 11-inch visades en uppsträckt telefonlayout utan sidebar eller maxbredd (`11-ipad-oversikt.png`).
- **Fakta i projektet (V-kod):** `TARGETED_DEVICE_FAMILY = "1,2,7"` för appens båda konfigurationer (iPhone, iPad, Vision), `"1,2"` för widget och tester, `SUPPORTED_PLATFORMS = "iphoneos iphonesimulator macosx xros xrsimulator"`, samt `UISupportedInterfaceOrientations~ipad` med fyra orienteringar i `Info.plist`.
- **Följdåtgärd:** Slice S12 i `...-pr-slices.md`. Att verifiera vid genomförande: om appen redan distribueras med iPad-stöd (TestFlight/App Store) och hur en iPhone-only-app installeras på iPad, Mac och Vision (kompatibilitetsläge). Det är ett distributionsbeslut som inte kunde avgöras i granskningen.
- **Omprövas när:** det finns ett affärsskäl för iPad.
- **HIG-notering:** `layout.md › Adaptability` gäller fortfarande för iPhone-storlekar (kompakt bredd, stor text); beslutet tar bara bort iPad-ytan.

### D-2 Endast ljust läge tills vidare (tidigare F-10)

- **Beslut:** Appen använder endast ljust läge tills vidare. Detta ska vara ett uttryckligt och dokumenterat beslut, inte ett oavsiktligt beteende.
- **Nuläge (V-app, V-kod):** `.preferredColorScheme(.light)` i `EquinetApp.swift:20` med en kodkommentar ("Force light mode until web app supports dark mode"). Med systemets mörka läge aktivt förblir appen ljus (`10-systemets-morka-lage-appen-forblir-ljus.png`). Beslutet finns i dag bara som en kodkommentar; ingen beslutspost, ingen `UIUserInterfaceStyle` i `Info.plist`.
- **Följdåtgärd:** Slice S11 (beslutspost) och S13 (göra det explicit). Att verifiera i S13: om systemytor utanför SwiftUI-roten (behörighetsdialoger, tangentbord, delningsark) följer systemets utseende när bara `.preferredColorScheme` används, och att widgeten (separat extension) förblir systemanpassad.
- **Omprövas när:** webbappen får mörkt läge, eller användare efterfrågar det.
- **HIG-notering:** `dark-mode.md › Best practices` avråder från att inte följa systemets utseende, och `color.md › Best practices` säger att även en app i ett enda utseende bör ge både ljusa och mörka färgvärden. Avvikelsen är därför ett medvetet, dokumenterat beslut. Rekommenderat minimum vid genomförande: definiera färgtokens med både ljust och mörkt värde (billigt, håller dörren öppen) och behåll högkontrastvarianter (`color.md`: "Increase Contrast"). Det tar bort behovet av mörka designer nu men inte kravet på kontrast.

### D-3 Hästägarupplevelsen förblir WebView-baserad (tidigare del av F-14)

- **Beslut:** Hästägarflödet fortsätter vara WebView-baserat. Det är ett informerat arkitekturbeslut för att kunna fokusera på leverantörens inbyggda upplevelse. Ingen omskrivning föreslås.
- **Bedömning:** Valet av WebView bedöms inte som ett fel, och rapporten citerar ingen HIG-rad mot det.
- **Det som ändå gäller i WebView-skalet (separata fynd, oförändrade krav):** skalet ska fungera och vara tillgängligt, till exempel felvy och omförsök (F-35), kontrast i offline-bannern som delas med kundskalet (F-02), pushbehörighet som begärs även för kunder (F-13), splash och launch (F-25), samt `userType`-fallbacken (F-36). Tillgänglighet och kontrast i själva webbinnehållet ligger utanför denna iOS-granskning och bör bedömas som webbgranskning.
- **Omprövas när:** det finns ett produktskäl, inte på grund av denna audit.

### Vad besluten ändrar i klassificeringen

| Fynd | Före | Efter |
|------|------|-------|
| F-10 Tvingat ljust läge | High | **D-2 beslutad avgränsning**; kvarvarande åtgärd: göra det explicit och dokumenterat (S11, S13) |
| F-26 iPad: uppsträckt telefonlayout | Medium | **D-1 beslutad avgränsning**; kvarvarande åtgärd: ta bort iPad-stödet (S12) |
| F-14 WebView-skalet (kunddelen) | High | **D-3 beslutad avgränsning** för valet att använda WebView; leverantörsskalets fel (dubbla titlar och bakåt, flytande knappar) kvarstår som F-14 |
| F-02, F-11 Färg och kontrast | Critical / High | Kvarstår. Mörka designer behövs inte nu (D-2); kontrast och högkontrastvarianter behövs fortfarande |
| F-12 Appikon | High | Kvarstår. Ikonens mörka/tintade varianter styrs av systemet på hemskärmen och påverkas inte av beslutet om appens utseende |
| F-13, F-25, F-35, F-36 | - | Gäller även kundskalet och bedöms som separata fynd, inte som del av WebView-valet |

## Omfattning och metod

- **Miljö:** iPhone 17 (iOS 27.0-simulator), iPad Air 11-inch (M4, iOS 27.0), lokal Supabase + lokal Next-dev-server med fiktiv seed-data. Appen byggd från `main` (07852b72) till en separat derived-data-mapp i scratchpad. Inget skrevs mot staging eller produktion.
- **Inloggning:** leverantören "Erik Järnfot" (demo-seed). För att kunna logga in sattes ett lokalt testlösenord via lokala GoTrue-admin-API. I andra passet sattes dessutom `app_metadata.userType = customer` på den lokala testkunden `test@example.com`, eftersom den saknade claim och därför hamnade i leverantörsappen (se F-36). Endast lokal databas, inget i repot.
- **Skärmar körda i appen:** kall start, inloggning, Översikt, Bokningar (lista + detalj), Kalender, Mer, Meddelanden (WebView), Hästhistorik (WebView), offline-läge, stor text (AX5), systemets mörka läge, iPad. Andra passet (efter besluten): kundskalet med en lokal testkund, samt ett test där webbservern stoppas före omstart för att provocera ett misslyckat första laddningsförsök.
- **Mätning:** kontrast är räknad från faktiska pixelfärger i simulatorns skärmbilder (verktyget `contrast.swift`, WCAG-formeln, bakgrund = vanligaste färg i regionen, förgrund = pixel längst från bakgrunden). Tryckytor är lästa ur simulatorns tillgänglighetsträd (storlek i pt).
- **Kodgranskning:** alla 81 appfiler skannades med mönstersökning; huvudskärmar, widget, notishantering, Info.plist och assets lästes i sin helhet eller i relevanta delar. Server-sidans push-payload (`PushDeliveryService.ts`) och biblioteket `apns2` lästes för notisfynden.
- **Egna bedömningar** är märkta "Bedömning" och är inte Apple-krav.

## Evidensklasser

| Kod | Betydelse |
|-----|-----------|
| **V-app** | Verifierat i körande app (simulator), mätt eller observerat |
| **V-kod** | Verifierat i källkod (och i beroendets källkod där det anges), inte körd |
| **Skärmbild** | Uppskattat från skärmbild |
| **Ej verifierbart** | Se separat lista (`...-ej-verifierat.md`) |

## Referenser som lästs

Följande HIG-filer (i `.claude/skills/apple-design/references/hig/`) har öppnats och är de enda som citeras: `accessibility`, `layout`, `typography` (text, tabeller för Dynamic Type), `color`, `designing-for-ios`, `tab-bars`, `toolbars` (till och med Phone), `sheets`, `alerts`, `loading`, `feedback`, `dark-mode`, `onboarding`, `launching`, `lists-and-tables`, `text-fields`, `entering-data`, `voiceover`, `privacy` (till och med Protecting data), `notifications`, `managing-notifications`, `app-icons`, `widgets` (till och med Using color), `motion`, `modality`, `settings`, `sf-symbols` (inledning), `writing`.

Inte lästa och därför inte citerade: `materials`, `liquid-glass`, `scroll-views`, `buttons`, `menus`, `action-sheets`, `tab-views`, `icons`.

## Skärmbilder

Alla skärmbilder ligger i `docs/metrics/ios-audit-2026-10-08/` (iPhone 17, iOS 27.0-simulator, om inte annat anges; lokal backend med fiktiv data).

| Fil | Visar | Fynd |
|-----|-------|------|
| `01-kallstart-vit-launchskarm.png` | Vit launch-skärm vid kall start | F-25 |
| `02-inloggning.png` | Inloggning (ljus, grön logotyp och länk) | F-02, F-12, F-27 |
| `03-oversikt.png` | Översikt, normal textstorlek | F-20, F-24 |
| `04-bokningar-lista.png` | Bokningslistan med kort och knappar | F-02, F-03, F-05, F-06, F-11, F-23 |
| `05-kalender.png` | Kalender med nu-linje | F-04, F-22 |
| `06-mer.png` | Mer-menyn (grön tint i listan, blå vald flik) | F-11 |
| `07-meddelanden-webview.png` | Meddelanden som WebView (dubbel titel, flytande knappar) | F-14 |
| `08-oversikt-ax5.png` | Översikt vid AX5 (tid bruten, titel trunkerad) | F-01 |
| `09-bokningar-ax5.png` | Bokningskort vid AX5 | F-01 |
| `10-systemets-morka-lage-appen-forblir-ljus.png` | Systemets mörka läge aktivt, appen förblir ljus | D-2 |
| `11-ipad-oversikt.png` | iPad Air 11-inch (iOS 27.0) | D-1 |
| `12-offline-banner.png` | Offline-läge (banner 1,66:1) | F-02, F-21 |
| `13-bokningsdetalj.png` | Bokningsdetalj (förebild, men primärknapp under tab bar) | F-16, F-20 |
| `14-hasthistorik-webview-dubbla-bakatkontroller.png` | Hästhistorik som WebView med nativ och webbaserad bakåtknapp | F-14, F-17 |
| `15-kundskal-webview.png` | Kundskalet (WebView) med pushdialog | D-3, F-13 |
| `16-kundskal-forsta-laddning-misslyckas-splash-kvar.png` | Kundskal med servern nere: splash kvar efter över 45 s | F-35 |
| `17-pushbehorighet-direkt-efter-inloggning.png` | Pushdialogen direkt på Översikt efter inloggning | F-13 |

---

## Critical

### F-01 Stor text bryter Översikt och Bokningar (Dynamic Type)

- **Skärm/komponent:** `NativeDashboardView` (dagens-rad, KPI-rutnät, navigationstitel), `NativeBookingsView` (`BookingCard`).
- **Observation (V-app):** Vid `accessibility-extra-extra-extra-large`:
  - Dagens bokning: tiden `14:00` bryts till fyra rader (`1`, `4:`, `0`, `0`) eftersom kolumnen har fast bredd 44 pt (`NativeDashboardView.swift:246`).
  - Navigationstiteln trunkeras till `Torsdag 8 O…`.
  - KPI-kortet "Kommande" bryts till `Kom-` / `mande`; rutnätet förblir tvåkolumnigt med ojämna höjder.
  - Bokningskortet: tjänstens namn bryts `Hel-` / `sko-` / `ning`, priset `1 450 kr` hamnar bredvid på tre rader, datum och häst radbryts mitt i, och handlingsknapparna hamnar under tab baren.
- **Observation (V-kod):** noll träffar på `dynamicTypeSize`, `ScaledMetric`, `ViewThatFits`, `isAccessibilitySize` i hela appen. 22 dekorativa/tomlägesikoner har fast `.font(.system(size: 48))`.
- **Användarpåverkan:** Den som använder stor text (vanligt hos äldre och i fält med handskar/solljus) kan inte läsa klockslag eller namn på dagens bokningar. Appens huvudflöde blir oanvändbart.
- **HIG:** `accessibility.md › Vision`: "Ideally, give people the option to enlarge text by at least 200 percent". `typography.md › Supporting Dynamic Type`: "Make sure your app’s layout adapts to all font sizes." `layout.md › Adaptability`: "horizontally adjacent views may need to stack vertically ... table rows or other containers may need to grow in height so that text isn’t cropped or doesn’t overlap other content".
- **Mätvärde:** fast kolumnbredd 44 pt; AX5 renderar `14:00` med ~100 pt bredd. Test med 200 % text (`accessibility-large` till `-extra-large`) gjordes inte separat.
- **Rekommendation (SwiftUI):**
  - Byt `.frame(width: 44)` mot `.frame(minWidth: 44, alignment: .leading)` plus `.fixedSize(horizontal: true, vertical: false)` på tiden, eller lägg raden i `ViewThatFits { HStack {...}; VStack(alignment: .leading) {...} }`.
  - Läs `@Environment(\.dynamicTypeSize)` och `if dynamicTypeSize.isAccessibilitySize` för att stapla (`VStack`) kortets sidhuvud (tjänst/pris) och använda en kolumn i `LazyVGrid`.
  - Handlingsknapparna: `ViewThatFits` mellan `HStack` och `VStack` (tre knappar i rad klipps redan vid normal storlek, se F-05).
  - Navigationstitel: `.lineLimit(2)` eller kortare datumformat vid stora storlekar.
  - Ikoner: `@ScaledMetric(relativeTo: .largeTitle) var iconSize = 48`.
- **Verifiering:** `xcrun simctl ui <UDID> content_size accessibility-extra-extra-extra-large`, kör om Översikt/Bokningar/Kalender/Mer; lägg snapshot-test (befintlig backlogpunkt "iOS Snapshot-tester") på AX3 och AX5.

### F-02 Kontrast: varumärkesgrönt och tonade knappar underkänns

- **Skärm/komponent:** Hela appen. Mest synligt: `NativeLoginView` (Logga in, Glömt lösenord), valda filterchips (Bokningar, Kalender), `BookingCard`-knappar, `NetworkBannerView`, statuschip i bokningsdetalj.
- **Observation (V-app, pixelsamplade i simulatorn):**

| Element | Förgrund / bakgrund | Kontrast | Krav |
|---------|----------------------|----------|------|
| Vit text på varumärkesgrönt (Bekräfta, Genomförd, vald chip, Logga in) | `#FFFFFF` på `#29A678` | **3,08:1** | 4,5:1 (text <=17 pt, ej fet) |
| Grön text på vit (Glömt lösenord?, 15 pt) | `#29A678` på `#FFFFFF` | **3,08:1** | 4,5:1 |
| Vald-chips räknare ("18") | `#FFFFFF` på `#69C1A1` | **2,16:1** | 4,5:1 |
| Knappen "Uteblev" (orange text, tonad bakgrund) | `#FF8D28` på `#F4E0D2` | **1,81:1** | 4,5:1 |
| Knappen "Anteckning" (grön text, tonad bakgrund) | `#29A678` på `#CEE4E0` | **2,32:1** | 4,5:1 |
| Knappen "Avvisa" (röd text, tonad bakgrund) | `#FF383C` på `#F4D1D5` | **2,54:1** | 4,5:1 |
| Statuschip "Väntande" i bokningsdetalj | `#FF8D28` på `#FFF1E5` | **2,09:1** | 4,5:1 |
| Offline-banner "Ingen internetanslutning" (12 pt) | `#FFEBD9` på `#FFA75A` | **1,66:1** | 4,5:1 |
| Hästlänk (12 pt, systemblå) | `#0088FF` på `#F2F2F7` | **3,15:1** | 4,5:1 |
| Ras i parentes "(Shetlandsponny)" i detaljvyn | `#7FC3FF` på `#FFFFFF` | **1,88:1** | 4,5:1 |

  Ingen av dessa klarar kraven; endast stora fetstilta texter (rubriken "Equinet", 34 pt bold) når 3:1.
- **Observation (V-kod):** `Color.equinetGreen = Color(red: 0.16, green: 0.65, blue: 0.47)` är en enda ljus/mörk-lös färg. Ingen `colorSchemeContrast`-hantering.
- **Användarpåverkan:** Ljus i dagsljus (stall, ridhus, utomhus) gör primärknappar och status svåra att läsa; personer med nedsatt syn missar knappar helt.
- **HIG:** `accessibility.md › Vision`: tabellen 4,5:1 (<= 17 pt), 3:1 (18 pt / fet). `color.md › Best practices`: "If you define a custom color, make sure to supply light and dark variants, and an increased contrast option".
- **Notering efter beslut D-2:** appen är ljus-only, så mörka värden behövs inte för att uppfylla kontrastkraven nu; ljus och hög kontrast behövs fortfarande. Offline-bannern används även i kundskalet (`NetworkBannerView` delas av `CustomerWebView`).
- **Rekommendation:**
  1. Definiera semantiska färger i asset-katalogen med ljus och hög kontrast (mörkt värde rekommenderas definierat enligt `color.md` men behöver inte vara designat, se D-2). Förslag, med uträknade värden:
     - Accent/fyllning ljus: `#177A58` (5,30:1 mot vitt; 4,75:1 mot `#F2F2F7`).
     - Accent mörk: `#3DBE8E` (8,95:1 mot svart; 7,26:1 mot `#1C1C1E`).
     - Behåll `#29A678` som dekorativ stor yta/ikon (inte som textbärare).
  2. Tonade knappar (`.bordered` + `.tint`): sätt `foregroundStyle` till en mörkare nyans (ex. orange `#B35900`, röd `#C4151C`) eller byt till `.borderedProminent` med vit text på tillräckligt mörk fyllning. Kontrollera varje med verktyget; de exempelvärden som räknats ger 3,7-4,3:1 mot de tonade bakgrunderna, så bakgrunden måste också tonas ner (lägre opacitet) för att nå 4,5:1.
  3. Offline-banner: mörk text på orange (`.black`/`.primary` på `Color.orange`) eller `.regularMaterial` med ikon + `.primary`-text.
- **Verifiering:** köra `contrast`-verktyget igen mot nya skärmbilder (ljus, mörk, Increase Contrast), samt Xcode Accessibility Inspector.

### F-03 Bokningsstatus visas bara med färg i bokningslistan

- **Skärm/komponent:** `NativeBookingsView › BookingCard › statusIndicator`.
- **Observation (V-app + V-kod):** Status visas som en 8 x 8 pt prick (orange = väntande, blå = bekräftad, grön = genomförd, röd = avbokad, grå = uteblev). Tillgänglighetsträdet innehåller ingen status för korten, och kortets `accessibilityDescription` (rad 633) utelämnar status, pris och badges. På filtret "Alla" finns inget annat än punkten (och vilka knappar som visas) som skiljer väntande från bekräftade.
- **Användarpåverkan:** Färgblinda och VoiceOver-användare kan inte se om en bokning är väntande eller bekräftad utan att tolka knapparna. Detaljvyn visar däremot status som text ("Väntande"), vilket visar att texten redan finns.
- **HIG:** `color.md › Inclusive color`: "Avoid relying solely on color to differentiate between objects, indicate interactivity, or communicate essential information." `accessibility.md › Vision`: "Offer visual indicators, like distinct shapes or icons, in addition to color".
- **Mätvärde:** punkt 8 x 8 pt (kod `frame(width: 8, height: 8)`).
- **Rekommendation:** Ersätt punkten med en `Label(statusText, systemImage: statusSymbol)` i chipformat (som i detaljvyns "Väntande"), med olika symboler per status (`clock`, `checkmark.circle`, `flag.checkered`, `xmark.circle`, `person.slash`). Lägg status först i `accessibilityLabel`. Samma chip kan återanvändas i detaljvyn.
- **Verifiering:** VoiceOver ska läsa "Väntande" först; simulera färgblindhet (Accessibility Inspector, "Color filters") och kontrollera att alla fem status går att skilja.

### F-04 Ikonknappar utan etikett i kalenderns datumhuvud

- **Skärm/komponent:** `NativeCalendarView › dateHeader` (föregående dag, nästa dag, "stäng dagen").
- **Observation (V-app, tillgänglighetsträd; V-kod):** Knapparna exponeras som `Back`, `Forward` och `Snooze`. De är bara `Image(systemName:)` utan `accessibilityLabel` (rad ~205-265). "Snooze" är symbolens standardnamn för `moon.zzz`, medan knappen i själva verket hanterar att dagen är stängd/öppen.
- **Användarpåverkan:** VoiceOver-användare hör "Back"/"Forward" (engelska, otydligt vilken riktning/dag) och "Snooze" för en funktion som inte har med snooze att göra.
- **HIG:** `voiceover.md › Descriptions`: "Provide alternative labels for all key interface elements." `toolbars.md › Actions`: "Make sure the meaning of each control is clear."
- **Mätvärde:** knappstorlek 44 x 44 pt (bra).
- **Rekommendation:** `.accessibilityLabel("Föregående dag")`, `.accessibilityLabel("Nästa dag")` och en tillståndsberoende etikett för månknappen ("Markera dagen som stängd" / "Öppna dagen"). Överväg också `accessibilityInputLabels` för Voice Control.
- **Verifiering:** VoiceOver (simulerad via Accessibility Inspector) läser de nya texterna; träd-dump via mobile-mcp visar svenska etiketter.

### F-05 Tryckytor under minimum på bokningskorten

- **Skärm/komponent:** `NativeBookingsView › BookingCard`.
- **Observation (V-app, tillgänglighetsträd):**

| Element | Uppmätt storlek (pt) | Minimum / standard |
|---------|----------------------|--------------------|
| Hästnamnslänk "Stella" | 31 x 14 | 28 / 44 |
| Telefonlänk "0761-889 900" | 82 x 14 | 28 / 44 |
| "Visa detaljer"-chevron (NavigationLink) | 6 x 10 ikon, 12 pt hög element | 28 / 44 |
| Bekräfta / Avvisa / Genomförd / Uteblev / Avboka / Anteckning | 28 pt höga (ett kort har 44 pt, ojämnt) | 28 / 44 |
| Avstånd mellan Bekräfta och Avvisa | 8 pt | cirka 12 pt kring element med kant |
| Filterchips | 34 pt (Bokningar), 30 pt (Kalender) | 28 / 44 |

  Bokningsdetaljen uppfyller däremot kraven: 44 pt länkar och 48-50 pt knappar.
- **Användarpåverkan:** Leverantören arbetar ofta med handskar eller smutsiga händer. Telefonlänken och hästlänken kräver precisionstryck; Bekräfta och Avvisa (olika konsekvens) ligger 8 pt från varandra.
- **HIG:** `accessibility.md › Mobility`: tabellen "iOS, iPadOS: Default control size 44x44 pt, Minimum 28x28 pt" och "In general, it works well to add about 12 points of padding around elements that include a bezel."
- **Rekommendation:** `.controlSize(.large)` på handlingsknapparna (som detaljvyn redan har), `.frame(minHeight: 44)` plus `.contentShape(Rectangle())` på länkar, 12 pt `spacing`, flytta telefon och häst till kontextmeny eller detaljvyn (där de redan är 44 pt).
- **Verifiering:** `mobile_list_elements_on_screen` ska visa >= 44 pt höjd på alla interaktiva element.

---

## High

### F-06 Ett tryck på ett bokningskort utlöser två åtgärder

- **Skärm/komponent:** `NativeBookingsView › BookingCard` i `List`.
- **Observation (V-app):** Ett tryck på en tom yta i ett kort (t.ex. höger om kundnamnet) öppnade **både** bokningsdetaljen (som låg kvar i Bokningar-stacken) **och** hoppade till fliken Mer med hästens hälsohistorik som WebView (`Stella – hälsohistorik`). Detta kan bero på det kända SwiftUI-beteendet att flera `Button`/`NavigationLink` med standardstil i samma `List`-rad aktiveras tillsammans. Orsaken är inte isolerad med ett minimalt test; beteendet (två effekter av ett tryck) är däremot observerat.
- **Användarpåverkan:** Användaren förväntar sig bokningsdetaljen och hamnar i en annan flik med en annan sida; bakåt leder till Mer-menyn, inte tillbaka till bokningen.
- **HIG:** Bedömning (ingen specifik rad): `tab-bars.md` (inledningen: flikar låter människor byta sektion "while preserving the current navigation state within each section") och `lists-and-tables.md › Best practices` ("Provide appropriate feedback when people select a list item").
- **Rekommendation:** Gör hela kortet till en enda `NavigationLink(value:)` och sätt `.buttonStyle(.borderless)` på alla inre knappar/länkar (eller flytta dem ur radens tryckyta med `.onTapGesture`-fri design). Låt hästlänken öppna ett sheet/push i samma stack i stället för att byta flik.
- **Verifiering:** UI-test eller manuellt: ett tryck på kortytan ska bara öppna detaljen; ett tryck på hästnamnet ska bara öppna hästvyn.

### F-07 Avvisa och Uteblev utförs direkt utan bekräftelse eller ångra

- **Skärm/komponent:** `BookingCard` och `NativeBookingDetailView` (`declineBooking`, `markNoShow`).
- **Observation (V-kod):** Knapparna anropar `viewModel.declineBooking` / `markNoShow` direkt. Avbokning (`Avboka`) har en sheet med anledning, men Avvisa och Uteblev saknar bekräftelse och ångra. Avvisa sätter status till avbokad (kunden notifieras via backend). Ingen skrivning utfördes under granskningen.
- **Användarpåverkan:** Felträff (se F-05: 8 pt avstånd) ger en irreversibel kundpåverkan.
- **HIG:** `feedback.md › Best practices`: "Warn people when they initiate a task that can cause data loss that’s unexpected and irreversible." `alerts.md › Best practices`: "Avoid displaying alerts for common, undoable actions" (alltså: erbjud ångra där det går).
- **Rekommendation:** `confirmationDialog` med verbtext ("Avvisa förfrågan", "Markera som uteblev") för åtgärder som notifierar kund, eller en tidsbegränsad ångra-banner (5-8 s) medan serveranropet fördröjs. Gruppera åtgärderna så att de destruktiva ligger i en meny (`Menu` med `Button(role: .destructive)`).
- **Verifiering:** UI-test på bekräftelsedialogen; manuellt test med VoiceOver.

### F-08 Pushnotiser: `category` överskriver hela `aps` (alert, ljud, märke)

- **Skärm/komponent:** `src/domain/notification/PushDeliveryService.ts` (server) + `AppDelegate.swift` (kategorier).
- **Observation (V-kod, beroendets källkod läst):** Servern skickar `data: { ...(category ? { aps: { category } } : {}) }`. I `apns2@12.2.0` (`notification.js`, `buildApnsOptions`) byggs `aps` först och därefter görs `for (const key in this.options.data) result[key] = this.options.data[key]`. När `data` innehåller `aps` ersätts hela `aps`-objektet med `{ category }`; `alert`, `sound` och `badge` försvinner. Det drabbar just de notiser som har kategori: nya bokningsförfrågningar (`BOOKING_REQUEST`) och status-ändring till väntande, dvs de där appen registrerar åtgärderna Bekräfta/Avvisa. Det testfall som finns (`PushDeliveryService.test.ts`) sätter kategorin men verifierar inte den byggda payloaden.
- **Ej verifierat på enhet:** push är inte skarp (backlog: "Push live (APNs)").
- **Användarpåverkan:** Leverantören kan missa nya förfrågningar eftersom notisen saknar synlig text eller ljud.
- **HIG:** `notifications.md › Best practices` och `› Notification actions` (åtgärderna förutsätter en fungerande notis).
- **Rekommendation:** Skicka kategorin via `new Notification(token, { alert, badge, sound, category: payload.category, data: {...} })` i stället för i `data.aps`; lägg ett enhetstest som anropar `buildApnsOptions()` och kontrollerar att `aps.alert`, `aps.sound` och `aps.category` finns samtidigt.
- **Verifiering:** enhetstest + en riktig sandbox-push till en fysisk enhet.

### F-09 Widget: mellanstor layout oanvänd, saknar datum, ingen djuplänk

- **Skärm/komponent:** `EquinetWidget` (`NextBookingWidget`, `SmallWidgetView`, `MediumWidgetView`).
- **Observation (V-kod):**
  - `supportedFamilies([.systemSmall, .systemMedium])`, men `widgetView(for:)` returnerar alltid `SmallWidgetView` (ingen läsning av `widgetFamily`). `MediumWidgetView` (170 rader, med datum och status) används aldrig.
  - Den lilla vyn visar bara klockslag, tjänst och kundinitialer; **inget datum**. En bokning i morgon ser ut som en bokning i dag.
  - Ingen `widgetURL` eller `Link`: ett tryck öppnar appen på startskärmen, inte på bokningen.
  - Statusfärger (grön/orange) på `.fill.tertiary`-bakgrund; ingen brand; `AccentColor` och `WidgetBackground` är tomma assets; ingen "uppdaterades"-information (data är cachad, tidslinjen uppdateras var 30:e min).
  - `ProgressView` i laddningsläge (animeras inte i widgets); ingen redigerad (`.redacted`) placeholder.
- **Användarpåverkan:** Leverantören ser fel dag/ingen kontext och måste själv leta upp bokningen efter öppnad app.
- **HIG:** `widgets.md › Adding interactivity`: "Ensure that a widget interaction opens your app at the right location." `› Best practices`: "Offer widgets in multiple sizes when doing so adds value." `› Using color`: "Convey meaning without relying on specific colors".
- **Rekommendation:** `@Environment(\.widgetFamily)` -> `switch` mellan Small/Medium; visa "Idag"/"Imorgon"/datum i Small; `.widgetURL(URL(string: "equinet://booking/\(id)"))` plus hantering i appen; använd `.privacySensitive()` för kundnamn på låsskärm; lägg till brandfärg och accenterade rendering modes (`widgetRenderingMode`).
- **Verifiering:** Xcode-previews för båda storlekarna, hemskärm på simulator, test av djuplänk.

### F-10 Tvingat ljust läge -- omklassificerad till beslutad avgränsning D-2

**Status:** Inte längre ett öppet HIG-fel. Se D-2 under "Beslutade avgränsningar". Den ursprungliga observationen (V-app, V-kod) står kvar för spårbarhet.

- **Observation (V-app):** Med systemets mörka läge aktivt förblir appen ljus (kontrollerad på Bokningar, `10-systemets-morka-lage-appen-forblir-ljus.png`). `.preferredColorScheme(.light)` finns i `EquinetApp.swift:20` med en kodkommentar om att webbappen saknar mörkt läge.
- **Kvarvarande åtgärd:** göra beslutet uttryckligt och dokumenterat (beslutspost, `Info.plist`, test). Se slice S11 och S13.
- **HIG (för spårbarhet):** `dark-mode.md › Best practices`: "Avoid offering an app-specific appearance setting"; `color.md › Best practices`: även en app i ett enda utseende bör ge både ljusa och mörka färgvärden.

### F-11 Accent- och statusfärger används osystematiskt

- **Skärm/komponent:** Hela appen.
- **Observation (V-app + V-kod):**
  - `AccentColor` i asset-katalogen är tom. Därför är tab-bar-valet, navigationschevronerna i Kalender, länkar och ikonerna inuti knappar systemets blå, medan chips, rubriker och Mer-listans ikoner är grön (`.tint(Color.equinetGreen)` bara på Mer-stacken).
  - Räkning (V-kod): 33 användningar av `equinetGreen`, 14 av systemets `.green` (t.ex. `tint(.green)` på Bekräfta i detaljvyn), 14 av `.blue`, 31 av `.orange`.
  - I Bokningar-listan ritas ikoner i knapparna i blå (systemaccent) på grön/rosa bakgrund (observerat på `Bekräfta`, `Avvisa`).
  - Samma färg betyder olika saker: orange = väntande, varning, "Uteblev", offline-banner, "Recensera kund".
- **Användarpåverkan:** Identiteten ser oavsiktlig ut; användaren lär sig inte vad en färg betyder.
- **HIG:** `color.md › Best practices`: "Avoid using the same color to mean different things." `› Liquid Glass color`: "Apply color sparingly ... reserve it for elements that truly benefit from emphasis, such as status indicators or primary actions."
- **Rekommendation:** En enda semantisk palett i asset-katalogen (accent, ok, varning, fara, neutral) med ljus och hög kontrast (mörkt värde definierat men oanvänt, se D-2); sätt `AccentColor` så att hela appen och widgeten ärver; ersätt `Color.green/.orange/.blue` med paletten; använd tab bar i systemets monokroma utseende med accentfärg endast på valt val. Länkfärg = accent.
- **Verifiering:** grep ska ge noll träffar på `.foregroundStyle(.blue)` / `.tint(.green)`; visuell genomgång i ljus/mörk.

### F-12 Appikonen: SF-symbol, platt enkelskikt och identiska mörka/tintade varianter

- **Skärm/komponent:** `Assets.xcassets/AppIcon.appiconset`, `LaunchIcon`.
- **Observation (V-kod + Skärmbild):**
  - Ikonens ryttare/häst är visuellt identisk med SF-symbolen `figure.equestrian.sports` som appen själv ritar i `SplashView` och `NativeLoginView` (jämförd i skärmbilder; ej pixeljämförd mot symbolbiblioteket).
  - Ikonen är en enda platt 1024 x 1024 PNG (RGBA) med ljusgrön helyta. Asset-katalogens "dark" och "tinted" pekar på exakt samma fil. Ingen skiktad Icon Composer-ikon. `LaunchIcon.imageset` har en 1015 x 1017 PNG med oväntad storlek och saknar 2x/3x-filer.
  - Widget-extensionens egen `AppIcon.appiconset` saknar filnamn (tom).
- **Användarpåverkan:** Risk för avslag/anmärkning vid App Review (SF-symboler får inte användas i appikoner); ikonen ser platt ut bredvid systemets Liquid Glass-ikoner och blir en lysande grön ruta i mörkt läge och en odefinierad skugga i tintat läge.
- **HIG:** `sf-symbols.md` (inledning): "the prohibition against using symbols — or images that are confusingly similar — in app icons, logos, or any other trademarked use." `app-icons.md › Layer design`: "layers give you the most control over how your icon design is represented"; `› Appearances`: "Use your light app icon as the basis for your dark icon."
- **Rekommendation:** Rita en egen ryttar-/hovmotiv som skikt (vektor), bygg i Icon Composer med bakgrund + 1-2 förgrundsskikt och explicita dark/tinted-varianter; ta bort `LaunchIcon` om den inte används; ge widget-ikonen ett värde eller ta bort den.
- **Verifiering:** Icon Composer-förhandsvisning (default, dark, clear, tinted); Device Hub; jämför symbolen i SF Symbols-appen.

### F-13 Pushbehörighet utan sammanhang och ingen notisinställning i appen

- **Skärm/komponent:** `ContentView` (`PushManager.shared.requestPermission()`), profil/inställningar.
- **Observation (V-app + V-kod):** Systemdialogen "Would Like to Send You Notifications" visas på Översikt direkt efter första inloggning, utan förklaring och utan koppling till en handling. `grep` efter `notif|push|avisering` i `NativeProfileView`/`ProfileModels` ger inga träffar: ingen notisinställning i appen. Detta stämmer med att dialogen återkom efter ominstallation. Dialogen visas även för hästägare i kundskalet (V-app, `15-kundskal-webview.png`), eftersom `requestPermission()` anropas för alla inloggade.
- **Användarpåverkan:** Många trycker "Tillåt inte" reflexmässigt, och det går sedan bara att ändra i iOS Inställningar. Leverantören missar nya förfrågningar.
- **HIG:** `privacy.md › Requesting permission`: "Request permission only when your app clearly needs access to the data or resource." och för förvarning: "Include only one button and make it clear that it opens the system alert." `managing-notifications.md`: "Make sure people can manage their notification settings within your app."
- **Rekommendation:** Visa en kort förskärm (ett val: "Fortsätt") efter första lyckade profilsparning eller första bokningen, med texten om vad notiserna ger ("Nya bokningsförfrågningar och avbokningar"). Lägg till en inställningsrad "Notiser" med deep link till iOS Inställningar och status.
- **Verifiering:** Ny installation: dialogen ska inte visas före förklaringen; inställning visar rätt tillstånd.

### F-14 Leverantörens WebView-skal: dubbla titlar och bakåtknappar, flytande knappar krockar med tab bar

**Avgränsning efter beslut D-3:** Fyndet gäller leverantörens WebView-skärmar i fliken Mer. Att hästägarflödet är WebView-baserat är ett beslutat val och bedöms inte som fel.

- **Skärm/komponent:** `MoreWebView` (Meddelanden, Logga arbete, Ruttplanering, Hästhistorik).
- **Observation (V-app, leverantörens WebViews):**
  - Dubbel titel: nativ navigationstitel "Meddelanden" plus webbens egen H1 "Meddelanden".
  - Dubbla bakåtkontroller: nativ bakåtpil ("Mer") plus webbens "← Tillbaka" (Hästhistorik).
  - Webbens flytande röda buggrapportknapp (48 x 48) och mikrofonknapp ligger över/under den nativa glas-tab baren.
  - Tom sida med en grå indeterminerad stapel i flera sekunder innan innehåll visas (mätt mot lokal dev-server; ej representativt för produktion).
  - Fliken Mer håller en blandning av nativa och webbskärmar med olika typografi och färg.
- **Användarpåverkan:** Appen känns som en webbsida i en app; felaktigt förväntat beteende på bakåt och dubbla trycks.
- **HIG:** Bedömning samt `toolbars.md › Navigation`: "Use the standard Back and Close buttons" och `loading.md › Best practices`: "Show something as soon as possible."
- **Rekommendation:** Inbyggda webbvyer: dölj webbens titel/bakåt/flytande knappar när `window.webkit.messageHandlers`-bryggan finns (CSS-injektion finns redan i `WebView.swift`), lägg en skelettvy eller `redacted` placeholder medan sidan laddas, fortsätt iOS-migreringen (backlog: "iOS-migrering (6 kvarvarande provider WebView-skärmar)"). Kundskalet berörs inte av detta fynd (D-3); dess funktionsfel är separata (F-35).
- **Verifiering:** Granska varje WebView-väg efter CSS-ändring; kör mobile-mcp och kontrollera att varje titel/bakåt finns exakt en gång.

### F-35 Kundskalet: splash täcker felvyn när första laddningen misslyckas

- **Skärm/komponent:** `CustomerWebView` (hästägarflödet), `WebView.swift` (`didFinish`, `didFailProvisionalNavigation`).
- **Observation (V-app):** Med webbservern stoppad och appen omstartad som inloggad kund visar appen den gröna splashen i över 45 sekunder, utan felvy, felmeddelande eller omförsök (`16-kundskal-forsta-laddning-misslyckas-splash-kvar.png`).
- **Orsak (V-kod):** Vid nätverksfel sätts `hasNavigationError = true` (felvyn ritas i `ZStack`), men `webViewReady` sätts bara i `didFinish`. Splashen ritas överst så länge `!webViewReady` och döljer därmed felvyn och dess "Försök igen"-knapp. (Leverantörens `MoreWebView` påverkas inte: den skickar `webViewReady: .constant(true)`.)
- **Användarpåverkan:** En hästägare utan täckning vid appstart ser en evig laddningsskärm och kan inte försöka igen annat än genom att tvinga stänga appen.
- **Avgränsning:** Detta är ett funktionsfel i skalet och påverkas inte av beslutet att använda WebView (D-3).
- **HIG:** `loading.md › Best practices`: "Show something as soon as possible." `alerts.md › Best practices` (om start utan nät): "show cached or placeholder data and a nonintrusive label that describes the problem". `writing.md › Best practices`: "Write clear error messages."
- **Rekommendation:** Sätt splash-tillståndet via en liten, testbar tillståndsmodell (`loading`, `ready`, `failed`) i stället för `webViewReady` som ensam grind; visa felvyn med omförsök när `hasNavigationError` blir sann eller efter en rimlig tidsgräns (till exempel 10 s); visa den delade offline-bannern ovanpå.
- **Verifiering:** Stoppa servern, starta appen: felvy med "Försök igen" inom tidsgränsen; starta servern, tryck "Försök igen": webben laddas. Enhetstest på tillståndsmodellen.

---

## Medium

### F-15 Dagens bokningar på Översikt går inte att trycka på

- **V-app (tillgänglighetsträd):** raden `14:00 Emma Eriksson / Akut hovslagarbesök` exponeras som tre `StaticText` och inte som knapp; det finns bara en länk "Visa alla i kalendern" när det är fler än tre. Koden (`todayBookingRow`) har `accessibilityElement(children: .ignore)` men ingen åtgärd.
- **Påverkan:** dagens viktigaste information är en återvändsgränd. 
- **HIG:** `lists-and-tables.md › Best practices` (selection feedback); bedömning.
- **Rekommendation:** Gör raden till `Button`/`NavigationLink` till bokningen med `.accessibilityAddTraits(.isButton)`.
- **Verifiering:** tryck på raden öppnar rätt bokning.

### F-16 Primär åtgärd i bokningsdetaljen ligger under glas-tab baren

- **V-app:** Vid första visning hamnar `Bekräfta bokning` (y = 793-843 pt) bakom tab baren (y >= 791 pt) på iPhone 17; `Avvisa` och `Lägg till anteckning` ligger utanför skärmen. Användaren måste scrolla för att kunna godkänna en väntande bokning.
- **HIG:** `layout.md › Visual hierarchy`: "place the most important items near the top and leading side"; `toolbars.md › Phone (iOS)`: prioritera de viktigaste åtgärderna.
- **Rekommendation:** Lägg åtgärdsknapparna i en nedre verktygsrad (`.toolbar { ToolbarItemGroup(placement: .bottomBar) }`) eller flytta upp dem under statusen; behåll `Avvisa` som sekundär.
- **Verifiering:** primärknappen syns utan scroll på iPhone 17e och 17 Pro Max.

### F-17 Hästlänken byter flik och tappar sammanhang

- **V-app:** Hästnamn i kort/detalj öppnar hästens WebView genom `pendingMorePath` + `selectedTab = .more`. Användaren hamnar i Mer-flikens stack; bakåt leder till Mer-menyn, inte tillbaka till bokningen.
- **HIG:** `tab-bars.md › Best practices` (flikar representerar sektioner; tillstånd per flik bevaras). Bedömning.
- **Rekommendation:** Pusha hästvyn i samma `NavigationStack` (sheet eller push) och lämna fliken orörd.

### F-18 Resizable sheets saknar grabber

- **V-kod:** `ProfileFormSheet`, `DeleteAccountSheet`, `NativeCalendarView`-bokningssheet och bokningssheets med `.presentationDetents([.medium, .large])` saknar `.presentationDragIndicator(.visible)`. Bara `CustomerDetailView` har den.
- **HIG:** `sheets.md › Mobile (iOS, iPadOS)`: "Include a grabber in a resizable sheet."
- **Rekommendation:** `.presentationDragIndicator(.visible)` på alla sheets med fler än en detent. Sheets med bara `.medium` (Avboka, Recensera) uppfyller redan "Cancel till vänster, Done till höger".

### F-19 Notisåtgärder och notisuppträdande

- **V-kod:**
  - Åtgärderna "Bekräfta"/"Avvisa" saknar gränssnittsikoner (`UNNotificationActionIcon`).
  - "Avvisa" har `options: [.destructive]` men inte `.authenticationRequired`: kan utföras från låst skärm.
  - Förgrund: `completionHandler([.banner, .badge, .sound])` visar alltid banner och ljud även om användaren redan tittar på bokningslistan.
  - Svar på åtgärd ges som *lokal notis med ljud* ("Bokning bekräftad", "Uppdatering misslyckades") i stället för i gränssnittet.
  - Serverns notistext visar kundnamn, tjänst och tid på låsskärmen; `hiddenPreviewsBodyPlaceholder` är satt (bra).
- **HIG:** `notifications.md › Notification actions`: "Provide a simple, recognizable interface icon for each notification action." och "Prefer nondestructive actions." `› Best practices`: "Handle notifications gracefully when your app is in the foreground." och "Use an alert — not a notification — to display an error message."
- **Rekommendation:** Lägg `UNNotificationActionIcon(systemImageName:)`, `.authenticationRequired` på Avvisa, returnera `[.badge]` (eller en in-app-markering) i förgrunden när den aktiva skärmen är Bokningar, och ersätt lokal feedback-notis med haptik + synlig uppdatering när appen öppnas.

### F-20 Svensk skrivregel: månader och veckodagar med versal

- **V-app:** Översiktens titel visar `Torsdag 8 Oktober` och bokningsdetaljen `Tisdag 6 Oktober 2026`. Orsak: `.localizedCapitalized` (`NativeDashboardView.swift:38`) och `.capitalized` (`NativeBookingDetailView.swift:677`). Kalendern visar rätt: `8 oktober 2026`.
- **HIG:** `writing.md › Best practices`: "Adopt capitalization rules that align with your app’s style, then apply them consistently." (Svenska skrivregler ger gemener på månadsnamn: bedömning.)
- **Rekommendation:** Versalera bara första tecknet: `"Torsdag 8 oktober"` via `prefix(1).uppercased() + dropFirst()`.

### F-21 Fel-, tom- och laddlägen: generiska och handbyggda

- **V-kod + V-app:** 22 handbyggda tomlägen/felvyer använder `Image(systemName:).font(.system(size: 48))` + titel + text, medan `ContentUnavailableView` används på ett enda ställe (dashboard-tomläge). Feltexter är generiska: "Kunde inte hämta bokningar", "Kunde inte uppdatera bokningar" (inga orsaker eller nästa steg). Offline visar cachad data utan "senast uppdaterad" (V-app: banner "Ingen internetanslutning" men inget om datats ålder). Laddning är bara en spinner utan platshållare.
- **HIG:** `writing.md › Best practices`: "Write clear error messages" och "Provide clear next steps on any blank screens."; `loading.md › Best practices`; `alerts.md › Best practices`: "If your app detects a problem at startup, like no network connection, consider alternative ways to let people know. For example, you could show cached or placeholder data and a nonintrusive label that describes the problem."
- **Rekommendation:** Ersätt handbyggda varianter med `ContentUnavailableView` (system hanterar Dynamic Type); skilj nätverksfel/serverfel/åtkomstfel; lägg "Uppdaterad kl. 15:41" i listornas sidfot vid offline.

### F-22 Kalender: nu-linjen korsar text, 9 pt-text

- **V-app + V-kod:** Den röda nu-linjen går tvärs över bokningsblockets text ("Emma Eriksson" delvis genomstruken); bokningsmarkören "M" har `font(.system(size: 9, weight: .bold))` (under 11 pt-minimum; `NativeCalendarView.swift:392`); filterchips är 30 pt höga.
- **HIG:** `accessibility.md › Vision` (11 pt minimum); `typography.md › Ensuring legibility`.
- **Rekommendation:** Rita nu-linjen under bokningsblocken (z-ordning) eller som en kort markör; byt "M" mot en symbol eller `.caption2` med `Label`.

### F-23 Kärndata i caption-storlek med sekundär färg

- **V-app + Bedömning:** På bokningskortet visas datum, tid och häst i `.caption` (12 pt) med sekundär färg. Systemets sekundärfärg mäter 3,4-3,9:1 (`#8A8A8E`/`#79797B`), vilket är systemfärgens egen kontrast men ger låg läsbarhet för det som leverantören mest behöver (tid och plats). KPI-etiketter "Idag/Kommande" har samma behandling (3,44:1).
- **HIG:** `typography.md › Conveying hierarchy`: "Adjust font weight, size, and color as needed to emphasize important information". Bedömning om att tiden bör vara `.subheadline`/`.callout` i primärfärg.
- **Rekommendation:** Tid och datum i `.subheadline` (primär färg), sekundär information i `.caption`.

### F-24 Redundans och osynkade rutnät på Översikt

- **V-app:** "Idag" förekommer tre gånger (rubrik, rad, KPI-kort "Idag: 1" som också visar samma antal), KPI-rutnätet har ojämn ensam tredje ruta, och sektionen "Nya förfrågningar: 0" tar lika mycket plats som viktig information.
- **HIG:** `layout.md › Visual hierarchy` (progressiv avslöjande, gruppera relaterat) och `designing-for-ios.md › Best practices` ("limiting the number of onscreen controls").
- **Rekommendation:** Visa väntande förfrågningar överst som ett handlingsbart kort (`priorityAction` finns redan) och ta bort dubbletten KPI "Idag".

### F-25 Start: vit launch, grön splash, vit inloggning, artificiell fördröjning

- **V-app:** Kall start visar en vit launch-skärm (`UILaunchScreen` pekar på tomt `AccentColor`), därefter en helt grön `SplashView` (vit text på `#29A678`, statusfältet i svart text), därefter vit inloggningsskärm: tre olika ytor i rad. **V-kod:** `AuthenticatedView` lägger på ytterligare en splash i 500 ms med `Task.sleep` oavsett laddningstid; appen återställer inte vald flik vid omstart (alltid Översikt, observerat efter omstart från Bokningar). En gång observerades att splash låg kvar i ~30 s medan lokal inloggning väntade på timeout; ej reproducerat.
- **HIG:** `launching.md › Best practices`: "Launch instantly." och "Restore the previous state when your app restarts"; `› Launch screens`: "Design a launch screen that’s nearly identical to the first screen of your app" och "Avoid including text"; `onboarding.md › Additional content`: "Briefly display a splash screen if necessary."
- **Rekommendation:** Sätt launch-skärmens färg i asset-katalogen till en `LaunchBackground`-färg som matchar första skärmen; ta bort `Task.sleep(500)` och visa splash bara medan data faktiskt laddas; spara/återställ vald flik med `@SceneStorage`.

### F-26 iPad: uppsträckt telefonlayout -- omklassificerad till beslutad avgränsning D-1

**Status:** Inte längre ett öppet HIG-fel. Se D-1 under "Beslutade avgränsningar". Den ursprungliga observationen står kvar för spårbarhet.

- **Observation (V-app, iPad Air 11-inch):** uppsträckt telefonlayout utan marginaler, KPI-kort i två breda kolumner (`11-ipad-oversikt.png`). iPhone är endast stående (`UISupportedInterfaceOrientations`: Portrait).
- **Kvarvarande åtgärd:** ta bort iPad-stödet (slice S12).
- **HIG (för spårbarhet):** `layout.md › Adaptability`; `tab-bars.md › Tablet (iPadOS)`.

### F-27 Inloggningen

- **V-app + V-kod:**
  - `accessibilityLabel("Email")` på fältet med synlig etikett "E-post" (Voice Control-kommandot "tryck på E-post" matchar inte).
  - `.textContentType(.emailAddress)` i stället för `.username` stör lösenordsförslag/AutoFill.
  - Ingen `.submitLabel(.next/.go)` på fälten.
  - Ingen passkey eller Sign in with Apple, och `NativeLoginView` saknar registrering (kontoskapande får ske på webben).
  - Skärmen fyller bara övre halvan; ingen `scrollDismissesKeyboard`.
  - "Logga in"-knappen är inaktiv (ljusgrå) tills båda fälten är ifyllda utan att förklara varför, annat än via VoiceOver-hint.
- **HIG:** `text-fields.md › Best practices` (etikett + hint), `entering-data.md › Best practices` ("Never prepopulate a password field" - uppfyllt), `privacy.md › Protecting data`: "Avoid relying solely on passwords for authentication."
- **Rekommendation:** Ta bort den engelska etiketten (lita på den synliga), sätt `.username`, `.submitLabel`, `.scrollDismissesKeyboard(.interactively)`; överväg Sign in with Apple/passkey som senare steg.

---

## Low

### F-28 Död kod: `NativeTabBar.swift`
- **V-kod:** 76 rader hemmagjord tab bar ("matchar webbens BottomTabBar") refereras inte från någon annan fil (`grep`). Använd systemets `TabView` (redan i bruk). Ta bort vid nästa städning.

### F-29 Redundanta tillgänglighetstips
- **V-kod (Bedömning):** `.accessibilityHint("Dubbeltryck för att öppna")` på KPI-kort och prioritetskort upprepar det VoiceOver redan säger för en knapp ("Dubbeltryck för att aktivera"). Hint ska beskriva resultatet ("Öppnar kalendern"), inte gesten.

### F-30 Möjliga dubbla tillgänglighetselement i KPI-korten
- **V-app (tillgänglighetsträd):** varje KPI-kort visas som två nästlade knappar ("Idag: 1" och "1, Idag"). VoiceOver är inte kört; det kan innebära att kortet läses två gånger. Verifiera med VoiceOver på enhet.

### F-31 Reduce Motion, Increase Contrast, Reduce Transparency
- **V-kod:** inga träffar på `accessibilityReduceMotion`, `colorSchemeContrast`, `accessibilityReduceTransparency`. Risken är låg eftersom appen mest använder systemkomponenter och få animationer (`easeInOut` 0,3 s, banner-övergång), men egna tonade bakgrunder (`Color.opacity`) anpassas inte (se F-02). Increase Contrast och Reduce Transparency kördes inte i simulatorn.
- **HIG:** `motion.md › Best practices`: "Make motion optional."; `accessibility.md › Cognitive` (Reduce Motion).

### F-32 Utloggning med bekräftelsedialog
- **V-kod (Bedömning):** `confirmationDialog("Vill du logga ut?")` för en vanlig, återställbar åtgärd. HIG avråder från varningar för vanliga, ångringsbara åtgärder (`alerts.md › Best practices`); här kostar dock en felaktig utloggning ett lösenord, så behåll eller byt till tydlig röd knapp utan dialog. Låg prioritet.

### F-33 Systemdialogernas språk
- **V-app (Bedömning):** Enheten kördes på engelska; push-dialogen var engelsk och appen svensk. Appen har ingen lokalisering (`CFBundleDevelopmentRegion` följer `DEVELOPMENT_LANGUAGE`, inga `.xcstrings`). Lägg till svensk lokalisering av `Info.plist`-strängar (NS...UsageDescription) och en `sv`-lokal.

### F-34 Statusfältsfärg och haptik
- **V-app:** Statusfältets text är svart på den gröna splashen (ljus text förväntas på mörk bakgrund). Haptik används konsekvent via `.sensoryFeedback` (bra). Liten polish.

### F-36 Observation utanför HIG: okänd `userType` ger leverantörsappen

- **V-app + V-kod:** `AuthManager.resolveUserType` returnerar `"provider"` när varken `app_metadata` eller `user_metadata` har `userType`. Den lokala testkunden `test@example.com` saknade claim och hamnade därför i leverantörsappen i stället för kundskalet. I produktion sätts claim av Custom Access Token Hook, så risken beror på att den fungerar.
- **Bedömning:** Inte ett HIG-fynd. En fail-closed-hantering (okänd roll: logga ut eller visa felvy) vore säkrare. Föreslås bedömas separat, till exempel med `/security-review`. Låg prioritet i denna audit.

---

## Vad som fungerar

- **Systemets `TabView` med glas-tab bar** (Översikt, Kalender, Bokningar, Mer) med ikon + enordsetikett; ingen egen tab bar i bruk. (`tab-bars.md › Best practices`: fyra flikar, tydliga etiketter.)
- **Bokningsdetaljen är en förebild:** 44 pt-länkar, 48-50 pt-knappar, `Status: Väntande` som text, sammanhängande tillgänglighetsetiketter ("Telefon: ...", "E-post: ..."), sektionsrubriker med versaler.
- **Kalendern har rika tillgänglighetsetiketter** på bokningsblocken: "Akut hovslagarbesök, klockan 14:00 till 15:00, Emma Eriksson, Samba, bekräftad", dag-knappar med "MÅN, 5", nu-linje med etikett.
- **Mer-menyn** är en `List` med `NavigationLink`, sektionsrubriker och `.confirmationDialog` för utloggning; `Radera konto` har bekräftelse.
- **Tydlig svensk copy** i etiketter ("Bekräfta", "Avvisa", "Genomförd", "Uteblev"), sheets med Avbryt (vänster) och handling (höger).
- **Notiskategori med `hiddenPreviewsBodyPlaceholder`**, åtgärder som kräver få ord, haptik efter åtgärd.
- **Kom igång-checklistan** på Översikt lär genom användning och går att skjuta upp ("Påminn mig imorgon", `onboarding.md › Best practices`).
- **Offline-hantering:** tydlig banner med ikon + text, cachad data visas, återanslutningsmeddelande.
- **Identitet:** den gröna färgen och ryttarmotivet ger igenkänning; det som saknas är kontrast och systematik, inte riktning.

## Återanvända backlogpunkter

Inga nya poster skapas i backlogen (uppdrag: inte ändra backlog ännu). Befintliga punkter som täcker eller överlappar fynden:

| Fynd | Befintlig punkt (`docs/sprints/backlog.md`) |
|------|---------------------------------------------|
| F-01, F-04, F-31 | "iOS accessibility audit (VoiceOver + Dynamic Type)" (0,5-1 dag), den ska utökas med mätningarna här |
| F-14 (leverantörsskalet) | "iOS-migrering (6 kvarvarande provider WebView-skärmar)" |
| F-01, F-02 (regression) | "iOS Snapshot-tester" (föreslås som verifieringsväg) |
| Verifiering via mobile-mcp | "iOS native-flöde-audit via mobile-mcp (S42-4)" |
| F-08 | Relaterad: "Verifiera `APNS_BUNDLE_ID`" och "Push live (APNs)" (rad ~224 resp. ~74). F-08 är ett nytt fynd, ingen dubblett |
| Äldre fynd | `docs/retrospectives/2026-04-18-ios-ux-audit.md` (M-01..M-06, m-05..m-09). Delvis åtgärdade (t.ex. `Radera konto` har bekräftelse, Glömt lösenord 44 pt); bokningskortens små mål (F-05) är en återkomst av M-05/M-04-klassen i listvyn. Inte alla gamla punkter återverifierades |
