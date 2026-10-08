---
title: "iOS HIG-genomlysning 2026-10-08 -- föreslagna PR-slices"
description: "Små, fristående PR-slices i prioriterad ordning efter produktbesluten (iPhone-only, ljust läge, WebView för hästägare), med problem, evidens, tester, acceptans, docs, beroenden och HIG-källor"
category: plan
status: draft
last_updated: 2026-10-08
sections:
  - Utgångspunkter
  - Gemensamma regler för alla slices
  - Översikt i prioriterad ordning
  - "Prio 1: Blockerande Dynamic Type och tillgänglighet"
  - "Prio 2: VoiceOver, fokusordning, etiketter och tryckytor"
  - "Prio 3: Avgränsningsåtgärder"
  - "Prio 4: Widgetens verifierade problem"
  - "Prio 5: Navigation, formulär, sheets samt fel- och offlinelägen"
  - "Prio 6: Visuell finslipning"
  - Beroendekarta och risker
tags: [ios, hig, accessibility, plan]
depends_on:
  - docs/retrospectives/2026-10-08-ios-hig-audit.md
related:
  - docs/retrospectives/2026-10-08-ios-hig-audit-sammanfattning.md
  - docs/retrospectives/2026-10-08-ios-hig-audit-matris.md
  - docs/retrospectives/2026-10-08-ios-hig-audit-ej-verifierat.md
---

# iOS HIG-genomlysning 2026-10-08 -- föreslagna PR-slices

Detta är ett förslag, inte ett beslut. Ingen slice är påbörjad. Ordningen följer produktens prioritering: (1) blockerande Dynamic Type och tillgänglighet, (2) VoiceOver, fokusordning, etiketter och tryckytor, (3) avgränsningsåtgärder, (4) widgetens verifierade problem, (5) navigation, formulär, sheets samt fel- och offlinelägen, (6) visuell finslipning.

## Utgångspunkter

Tre produktbeslut gäller (se "Beslutade avgränsningar" i `2026-10-08-ios-hig-audit.md`):

- **D-1** iPhone-only tills vidare (slice S12).
- **D-2** Endast ljust läge tills vidare, uttryckligt och dokumenterat (slice S11, S13).
- **D-3** Hästägarupplevelsen förblir WebView-baserad. Ingen slice föreslår en omskrivning. Skalets funktionsfel är separata slices (S18, S21, S27, S30).

Evidensetiketter i varje slice: **V-app** (verifierat i körande app), **V-kod** (endast belagt i kod), **Ej verifierat** (inte körd eller mätt, ska verifieras som första steg i sliceen). Fynd-ID (F-xx) och bilagor hänvisar till `2026-10-08-ios-hig-audit.md` och `docs/metrics/ios-audit-2026-10-08/`.

**Placering utanför de sex kategorierna:** S16 (push-payload, F-08) är ett serverfel utan UI och passar ingen av kategorierna. Den placeras i prio 5 men är fristående, kan tas när som helst och bör vara klar före push blir skarp. S30 (F-36, okänd `userType`) är en observation utanför HIG och placeras sist.

## Gemensamma regler för alla slices

- **Branch och PR:** en slice = en PR från `feature/ios-hig-<slice-id>-<kort-beskrivning>` mot `main`, grön `Quality Gate Passed` före merge.
- **Test först** där det finns logik att testa (BDD/TDD enligt `CLAUDE.md`): extrahera ren logik (status till text och symbol, tillståndsmodell, datumformat, kontrastberäkning) och testa den med XCTest i `EquinetTests`. Nivå 1 under arbete (`-only-testing:EquinetTests/<suite>`), Nivå 2 före PR (full svit).
- **Layout- och tillgänglighetskrav kan inte bevisas av enhetstester** (se `...-ej-verifierat.md`; snapshot-tester finns inte, befintlig backlogpunkt "iOS Snapshot-tester"). Acceptans för dem är därför ett **mätprotokoll** som bifogas PR:en med före/efter-skärmbilder:
  - Stor text: `xcrun simctl ui <UDID> content_size accessibility-extra-extra-extra-large` (AX5) och `accessibility-large`, därefter normal (`large`).
  - Tryckytor: `mobile_list_elements_on_screen` (storlek i pt) för alla interaktiva element på berörd skärm.
  - Kontrast: pixelmätning enligt WCAG-formeln (verktyget från audit-passet finns lokalt men är inte versionshanterat; Accessibility Inspector duger också).
  - VoiceOver-etiketter: träd-dump via mobile-mcp; faktisk uppläsning kräver enhet.
- **Granskning enligt `review-matrix.md`:** Swift under `ios/**` kräver `/code-review` först och därefter `ios-expert` om det är komplex SwiftUI. Serverkod i `src/domain/**` kräver `/code-review`. Docs-bara-PR:er kräver ingen reviewer.
- **Docs som normalt berörs** (anges per slice där de avviker): `.claude/rules/ios-learnings.md` (nya mönster), `docs/testing/testing-guide.md` (testscenario för användarvänd ändring), hjälpartikel i `src/lib/help/articles/provider/` när slutanvändarens beteende ändras, samt `docs/sprints/backlog.md` när en punkt stängs eller utökas.
- **Små diffar:** varje slice ska kunna reverteras ensam. Inget refactor-arbete ingår (`docs/architecture/refactor-triggers.md`).
- **Mallen per slice:** Problem och skärmar, Evidens, Nytta, Tester och acceptans, Docs, Beroenden och risker, HIG-källor.

## Översikt i prioriterad ordning

| Slice | Titel | Fynd | Prio | Evidens | Storlek |
|-------|-------|------|------|---------|---------|
| S0 | (Valfri) Layout-/snapshot-spår för stor text | stöd för S1, S2, S6 | - | - | 0,5-1 dag |
| S1 | Dynamic Type: Översikt | F-01 | 1 | V-app | liten |
| S2 | Dynamic Type: bokningskort och filterchips | F-01 | 1 | V-app | liten-medel |
| S3 | Semantisk färgpalett och `AccentColor` | F-11, F-02 | 1 | V-app | liten-medel |
| S4 | Kontrast i bokningar, kalender, inloggning och banner | F-02 | 1 | V-app | liten |
| S5 | Bokningsstatus som text och symbol | F-03 | 1 | V-app | liten |
| S6 | Dynamic Type: övriga nativa vyer | F-01 | 1 | Ej verifierat | medel (kan delas) |
| S7 | Etiketter: kalenderns ikonknappar, inloggning, hints | F-04, F-27, F-29 | 2 | V-app | liten |
| S8 | Tryckytor och korttryck på bokningskort | F-05, F-06 | 2 | V-app | liten-medel |
| S9 | Översikt: tillgänglighetselement och tryckbara dagens-rader | F-15, F-30 | 2 | V-app (F-15), Ej verifierat (F-30) | liten |
| S10 | Tillgänglighetsinställningar och fokusordning | F-31 | 2 | Ej verifierat | liten (verifiering) |
| S11 | Dokumentera de tre besluten | D-1, D-2, D-3 | 3 | - | docs |
| S12 | iPhone-only | D-1 (F-26) | 3 | V-kod | liten |
| S13 | Ljust läge uttryckligt | D-2 (F-10) | 3 | V-app | liten |
| S14 | Widget: familjeval, datum, etiketter | F-09 | 4 | V-kod | liten-medel |
| S15 | Widget: djuplänk till bokning | F-09 | 4 | V-kod | liten-medel |
| S16 | Push-payload: `category` skriver över `aps` | F-08 | 5 | V-kod | liten |
| S17 | Avvisa och Uteblev: bekräftelse eller ångra | F-07 | 5 | V-kod | liten-medel |
| S18 | Kundskalet: splash täcker felvyn | F-35 | 5 | V-app | liten |
| S19 | Leverantörens WebView-skal: dubbla kontroller och flytande knappar | F-14 | 5 | V-app | medel |
| S20 | Bokningsflödet: hästvy i samma stack och synlig primärknapp | F-16, F-17 | 5 | V-app | liten |
| S21 | Pushbehörighet i sammanhang och notisinställning | F-13 | 5 | V-app | medel |
| S22 | Notisåtgärder och förgrundsvisning | F-19 | 5 | V-kod | liten-medel |
| S23 | Sheets och formulär | F-18, F-27 | 5 | V-kod | liten |
| S24 | Fel-, tom- och offlinelägen | F-21 | 5 | V-kod/V-app | medel (kan delas) |
| S25 | Svenska datumformat | F-20 | 6 | V-app | mycket liten |
| S26 | Kalender- och översiktsfinish | F-22, F-23, F-24 | 6 | V-app | liten |
| S27 | Start och launch | F-25 | 6 | V-app/V-kod | liten-medel |
| S28 | Appikon | F-12 | 6 | V-kod + skärmbild | medel (design) |
| S29 | Städning | F-28, F-32, F-33, F-34 | 6 | V-kod | liten |
| S30 | Okänd `userType` ska inte ge leverantörsappen | F-36 | utanför | V-app + V-kod | liten (triage) |

---

## Prio 1: Blockerande Dynamic Type och tillgänglighet

### S0 (valfri, rekommenderad före S1, S2 och S6) Layout-/snapshot-spår för stor text

- **Problem och skärmar:** Det finns inget automatiserat sätt att fånga att layouten går sönder vid stor text. Utan det kan S1, S2 och S6 bara bevisas med manuella skärmbilder, och regressioner uppstår igen. Gäller Översikt, Bokningar, Kalender, Mer.
- **Evidens:** Saknad infrastruktur (V-kod: inga snapshot-tester; befintlig backlogpunkt "iOS Snapshot-tester", 0,5-1 dag).
- **Nytta:** Framtida ändringar fångas automatiskt; acceptans för S1, S2, S6 blir körbar.
- **Tester och acceptans:** Ett snapshot-ramverk i `EquinetTests` (val av bibliotek är en separat diskussion, ny beroende kräver motivering enligt `CLAUDE.md`), baseline för Översikt och en bokningskortsfixtur vid `large` och `accessibility-extra-extra-extra-large`. Acceptans: testerna går rött när en fast bredd återinförs.
- **Docs:** `.claude/rules/ios-learnings.md` (hur man kör och uppdaterar baselines), `docs/sprints/backlog.md` (punkten stängs).
- **Beroenden och risker:** Nytt beroende; baselines är simulator- och versionskänsliga (iOS 27.0 mot CI:s iOS 26.2). Slicen är valfri: om den hoppas över bevisas S1, S2, S6 manuellt.
- **HIG-källor:** `layout.md › Adaptability` ("Preview your app on multiple devices, using different size classes, localizations, and text sizes").

### S1 Dynamic Type: Översikt

- **Problem och skärmar:** Dagens bokning på Översikt har fast kolumnbredd 44 pt för klockslaget (`NativeDashboardView.swift:246`), så `14:00` blir `1/4:/0/0` vid AX5; navigationstiteln trunkeras (`Torsdag 8 O…`); KPI-kortet "Kommande" bryts `Kom-/mande`; rutnätet förblir tvåkolumnigt. Ikoner har fast 40/48 pt.
- **Evidens:** **V-app** (`08-oversikt-ax5.png`) och V-kod (noll Dynamic Type-anpassning i appen).
- **Nytta:** Leverantörer som använder stor text kan läsa dagens bokningar och KPI:erna.
- **Tester och acceptans:**
  - Mätprotokoll vid `large`, `accessibility-large`, AX3 och AX5: tiden visas på en rad, titeln visar hela datumet (eller radbryts på två rader), KPI-kort i en kolumn från accessibility-storlek, inga avhuggna ord.
  - Enhetstest för eventuell extraherad titel-/tidsformaterare (till exempel `DashboardTitleFormatter`); layouten bevisas av mätprotokollet (eller S0).
  - Implementation: `.frame(minWidth:)` med `.fixedSize` eller `ViewThatFits`; `@Environment(\.dynamicTypeSize)` med `isAccessibilitySize` för kolumnantal; `@ScaledMetric` för ikonstorlekar.
- **Docs:** `.claude/rules/ios-learnings.md` (mönster för adaptiv layout), `docs/testing/testing-guide.md` (scenario "Stor text" för iOS).
- **Beroenden och risker:** Ingen blockerande. Rör bara `NativeDashboardView.swift`. Låg risk; kan krocka med S9 (samma fil), så ta S1 före S9.
- **HIG-källor:** `accessibility.md › Vision` ("enlarge text by at least 200 percent"); `typography.md › Supporting Dynamic Type` ("Make sure your app’s layout adapts to all font sizes"; "Consider adjusting your layout at large font sizes"); `layout.md › Adaptability` ("Be prepared for text-size changes").

### S2 Dynamic Type: bokningskort och filterchips

- **Problem och skärmar:** På Bokningar bryts tjänstens namn mitt i orden (`Hel-/sko-/ning`), priset hamnar på tre rader, datum/häst radbryts, den tre-knappars rad (`Genomförd/Uteblev/Avboka`) trunkeras redan vid normal storlek (`Genom…`) och vid AX5 hamnar knapparna bakom tab baren.
- **Evidens:** **V-app** (`04-bokningar-lista.png`, `09-bokningar-ax5.png`).
- **Nytta:** Bokningslistan, appens mest använda yta, blir läsbar och användbar vid stor text; "Genom…" försvinner även vid normal storlek.
- **Tester och acceptans:** Mätprotokoll vid `large` och AX5: kortets sidhuvud staplas (tjänst över pris), handlingsknappar byter till `VStack` eller flerrads vid `isAccessibilitySize` (`ViewThatFits`), ingen knappetikett trunkeras vid `large`, filterchips radbryts inte mitt i ord. Före/efter-skärmbilder i PR.
- **Docs:** `.claude/rules/ios-learnings.md`; `docs/testing/testing-guide.md`.
- **Beroenden och risker:** Rör `NativeBookingsView.swift` (`BookingCard`), samma struktur som S5 och S8. **Ordning: S2, sedan S5, sedan S8** för att undvika mergekonflikter. Risk: knapprader som växer påverkar kortets höjd och rullning; kontrollera att `highlightedBookingId`-scroll fortfarande fungerar.
- **HIG-källor:** `typography.md › Supporting Dynamic Type` ("Keep text truncation to a minimum as font size increases"); `layout.md › Adaptability`; `accessibility.md › Vision`.

### S3 Semantisk färgpalett och `AccentColor`

- **Problem och skärmar:** `AccentColor` är tom, så tab bar, navigationschevroner, länkar och ikoner inuti knappar är systemets blå, medan chips, rubriker och Mer-listan är grön. Räkning: 33 `equinetGreen`, 14 `.green`, 14 `.blue`, 31 `.orange`. Brandgrönt `#29A678` ger 3,08:1 mot vitt. Berör hela appen och widgeten (som också har tom `AccentColor`/`WidgetBackground`).
- **Evidens:** **V-app** (mätt kontrast och skärmbilder) och V-kod (räkningen).
- **Nytta:** En färg betyder en sak; grunden för alla kontrastförbättringar; widgeten ärver samma palett.
- **Tester och acceptans:**
  - Färgtokens i asset-katalogen med ljust värde och högkontrastvariant (mörkt värde definierat men oanvänt, se D-2). Förslag från audit: accent/fyllning `#177A58` (5,30:1 mot vitt), behåll `#29A678` som stor dekorativ yta.
  - **Automatiserat test** `PaletteContrastTests`: lös varje token i ljus och hög kontrast (`UITraitCollection`) och kontrollera WCAG-förhållandet mot dess avsedda bakgrund (>= 4,5:1 för text, >= 3:1 för stor text och ikoner). Detta är den enda slice där kontrast kan enhetstestas.
  - `AccentColor` satt; global `.tint`; inga träffar kvar på `.foregroundStyle(.blue)` eller `.tint(.green)` (grep som acceptans).
  - Ingen layoutändring i sliceen.
- **Docs:** `.claude/rules/ios-learnings.md` (palett och tokenpolicy); `docs/decision-log.md` (om paletten kräver ett varumärkesbeslut, kontrollera med Johan).
- **Beroenden och risker:** Varumärkesfråga: nyansen på grönt ändras något. Kräver godkännande av ny nyans. Asset-ändringar i widgeten kräver `membershipExceptions`-kontroll (`ios-learnings.md`). S4 bygger på S3.
- **HIG-källor:** `color.md › Best practices` ("Avoid using the same color to mean different things"; "supply light and dark variants, and an increased contrast option"); `accessibility.md › Vision` (kontrasttabellen); `dark-mode.md › Dark Mode colors` (minst 4,5:1).

### S4 Kontrast i bokningar, kalender, inloggning och banner

- **Problem och skärmar:** Efter S3: applicera paletten på vita-på-grön-knappar (Bekräfta, Genomförd, Logga in), valda chips och deras räknare (2,16:1), tonade knappar (Uteblev 1,81:1, Avvisa 2,54:1, Anteckning 2,32:1), statuschip i detaljvyn (2,09:1), offline-banner (1,66:1, delas med kundskalet), hästlänk (3,15:1) och ras i parentes (1,88:1), "Glömt lösenord?".
- **Evidens:** **V-app** (alla värden pixelmätta, `04-bokningar-lista.png`, `12-offline-banner.png`, `13-bokningsdetalj.png`).
- **Nytta:** Läsbart i dagsljus i stall och ridhus.
- **Tester och acceptans:** Mät om alla ovan med samma metod: varje text >= 4,5:1 (>= 3:1 för stor/fet text). Offline-bannern kontrolleras både i leverantörsappen och kundskalet. Före/efter-tabell i PR.
- **Docs:** `docs/testing/testing-guide.md` (kontrastscenario).
- **Beroenden och risker:** Kräver S3. Rör flera filer (`NativeBookingsView`, `NativeCalendarView`, `NativeLoginView`, `NetworkBannerView`, `NativeBookingDetailView`) men bara färgvärden. Tonade bakgrunder kan behöva lägre opacitet för att nå 4,5:1 (se audit F-02).
- **HIG-källor:** `accessibility.md › Vision`; `color.md › Best practices`; `color.md › Inclusive color`.

### S5 Bokningsstatus som text och symbol

- **Problem och skärmar:** Bokningslistan visar status som en 8 pt färgprick; tillgänglighetsträdet och `accessibilityDescription` saknar status. Bokningsdetaljen visar redan status som text ("Väntande").
- **Evidens:** **V-app** (tillgänglighetsträd) och V-kod (`BookingCard.statusIndicator`, rad ~470).
- **Nytta:** Färgblinda och VoiceOver-användare kan se och höra om en bokning är väntande, bekräftad, genomförd, avbokad eller uteblev.
- **Tester och acceptans:**
  - Extrahera `BookingStatusPresentation` (status → svensk text, SF-symbol, tillgänglighetstext) och testa alla fem statusar plus okänd status (`BookingStatusPresentationTests`).
  - Chip med symbol och text i kortet; status först i kortets `accessibilityLabel`.
  - Mätprotokoll: träd-dump visar status; simulerad färgblindhet (Accessibility Inspector) skiljer alla fem.
- **Docs:** `docs/testing/testing-guide.md`; `.claude/rules/ios-learnings.md` (återanvändbar statuschip, samma i detaljvyn).
- **Beroenden och risker:** Rör `BookingCard`; ta efter S2 och före S8. Chipens kontrast kräver S3/S4-paletten (kan göras först med systemfärger och justeras sen).
- **HIG-källor:** `color.md › Inclusive color` ("Avoid relying solely on color"); `accessibility.md › Vision` ("Convey information with more than color alone").

### S6 Dynamic Type: övriga nativa vyer

- **Problem och skärmar:** Kalender, Mer, Tjänster, Kunder, Recensioner, Profil, Insikter, Hjälp, Inloggning och formulär-sheets har inte testats vid stor text. Samma mönster som i S1/S2 förekommer (noll anpassning i koden, 22 fasta ikonstorlekar, `.frame(width:)` på text).
- **Evidens:** **Ej verifierat** i körning; V-kod för mönstret.
- **Nytta:** Hela leverantörsappen blir användbar vid stor text, inte bara de två skärmar som kördes.
- **Tester och acceptans:** Första steget är ett körpass vid AX3 och AX5 över alla listade skärmar med skärmbilder (blir en komplettering av `...-ej-verifierat.md`). Därefter fixar per skärm. **Dela upp i flera PR:er** när omfattningen är känd (förslag: Kalender, Kunder och Tjänster, Profil och formulär, övrigt). Acceptans per skärm enligt mätprotokollet.
- **Docs:** Uppdatera `...-ej-verifierat.md` och matrisen när körpasset är gjort; `.claude/rules/ios-learnings.md`.
- **Beroenden och risker:** Omfattning okänd tills körpasset är gjort; därför osäker storlek. Kan göras efter S1 och S2 så att mönstret är etablerat.
- **HIG-källor:** `typography.md › Supporting Dynamic Type`; `layout.md › Adaptability`; `accessibility.md › Vision`.

---

## Prio 2: VoiceOver, fokusordning, etiketter och tryckytor

### S7 Etiketter: kalenderns ikonknappar, inloggning, hints

- **Problem och skärmar:** Kalenderns datumhuvud har ikonknappar utan etikett som läses som "Back", "Forward" och "Snooze" (månknappen styr om dagen är stängd). Inloggningsfältets `accessibilityLabel("Email")` skiljer sig från den synliga etiketten "E-post" (Voice Control-mismatch). `accessibilityHint("Dubbeltryck för att öppna")` på KPI-kort och prioritetskort upprepar gesten i stället för att beskriva resultatet.
- **Evidens:** **V-app** (tillgänglighetsträd för kalendern) och V-kod (inloggning, hints; hints är en egen bedömning).
- **Nytta:** Navigering och dagsstatus i kalendern blir begripliga för VoiceOver- och Voice Control-användare.
- **Tester och acceptans:** Träd-dump visar "Föregående dag", "Nästa dag" och tillståndsberoende etikett för månknappen ("Markera dagen som stängd" / "Öppna dagen"); inloggningsfältet har etikett som matchar synlig text; hints beskriver resultat ("Öppnar kalendern"). Enhetstest på extraherad etikettfunktion för dagstängning (om den extraheras). Verifiering på enhet med VoiceOver är komplement (se `...-ej-verifierat.md`).
- **Docs:** `docs/testing/testing-guide.md`.
- **Beroenden och risker:** Inga. Liten och fristående.
- **HIG-källor:** `voiceover.md › Descriptions` ("Provide alternative labels for all key interface elements"); `toolbars.md › Actions` ("Make sure the meaning of each control is clear"); `accessibility.md › Mobility` (Voice Control kräver etiketter).

### S8 Tryckytor och korttryck på bokningskort

- **Problem och skärmar:** Hästlänk 31 x 14 pt, telefonlänk 82 x 14 pt och "Visa detaljer" 12 pt hög; handlingsknappar 28 pt med 8 pt mellanrum; ett kort har 44 pt på en knapp men 28 pt på de andra. Ett tryck på kortytan utlöser både bokningsdetaljen och hoppet till Mer med hästens WebView (SwiftUI `List`-radens knappstil är en trolig orsak).
- **Evidens:** **V-app** (mått i tillgänglighetsträdet; dubbelåtgärden observerad). Orsaken till dubbelåtgärden är inte isolerad med ett minimalt test.
- **Nytta:** Rätt knapp träffas även med handskar; ett tryck gör det man förväntar sig.
- **Tester och acceptans:**
  - Kortet blir en enda `NavigationLink(value:)`; inre knappar och länkar får `.buttonStyle(.borderless)` och `.contentShape`; mål >= 44 pt (`.controlSize(.large)`/`minHeight: 44`), 12 pt mellanrum mellan Bekräfta och Avvisa. Telefon och häst kan flyttas till detaljvyn (där de redan är 44 pt) om kortet blir för trångt.
  - Mätprotokoll: alla interaktiva element >= 44 pt (>= 28 pt absolut minimum); tryck på kortytan öppnar bara detaljen (ingen flikväxling); tryck på hästnamn gör bara det den ska.
  - UI-test är inte tillgängligt (XCUITest-spåret är en separat backlogpunkt); manuellt protokoll gäller.
- **Docs:** `docs/testing/testing-guide.md`; `.claude/rules/ios-learnings.md` (gotcha: flera knappar i `List`-rad).
- **Beroenden och risker:** Rör `BookingCard`; efter S2 och S5. Risk: kortet blir högre; kontrollera att listans visuella täthet fortfarande fungerar. Hästlänkens destination hänger ihop med S20.
- **HIG-källor:** `accessibility.md › Mobility` (44 x 44 pt standard, 28 x 28 pt minimum; "about 12 points of padding"); `lists-and-tables.md › Best practices` ("Provide appropriate feedback when people select a list item"); egen bedömning för orsaken till dubbelåtgärden.

### S9 Översikt: tillgänglighetselement och tryckbara dagens-rader

- **Problem och skärmar:** Dagens bokningar på Översikt är bara statisk text (inte tryckbara); KPI-korten exponeras som två nästlade knappar ("Idag: 1" och "1, Idag") i tillgänglighetsträdet, vilket kan innebära att kortet läses två gånger.
- **Evidens:** **V-app** för att raderna inte är tryckbara; **Ej verifierat** för dubbel uppläsning (kräver VoiceOver på enhet).
- **Nytta:** Dagens viktigaste information blir en genväg till bokningen; korten läses en gång.
- **Tester och acceptans:** Dagens rad är en `Button`/`NavigationLink` till bokningen med rätt trait; träd-dump visar ett element per KPI-kort; tryck öppnar rätt bokning (använd `pendingBookingId`-mekanismen som redan finns).
- **Docs:** `docs/testing/testing-guide.md`.
- **Beroenden och risker:** Rör `NativeDashboardView.swift`; efter S1. Låg risk.
- **HIG-källor:** `voiceover.md › Navigation` ("Specify how elements are grouped, ordered, or linked"); `lists-and-tables.md › Best practices`.

### S10 Tillgänglighetsinställningar och fokusordning

- **Problem och skärmar:** Reduce Motion, Increase Contrast och Reduce Transparency är inte körda; koden har noll träffar på `accessibilityReduceMotion`, `colorSchemeContrast` och `accessibilityReduceTransparency`. VoiceOver-fokusordning och rotor är inte verifierade på någon skärm.
- **Evidens:** **Ej verifierat**.
- **Nytta:** Bekräftar (eller motbevisar) att systemkomponenterna räcker; hittar eventuella brister i egna tonade bakgrunder och i läsordningen.
- **Tester och acceptans:** Verifieringsslice: kör alla huvudskärmar med respektive inställning och på enhet med VoiceOver; resultat som komplettering av `...-ej-verifierat.md` och nya fynd vid behov. Fixar ingår bara om de är små; annars egna slices.
- **Docs:** `...-ej-verifierat.md` och matrisen uppdateras.
- **Beroenden och risker:** Kräver fysisk enhet för VoiceOver och Voice Control. Bör göras efter S3-S5 så att paletten finns.
- **HIG-källor:** `accessibility.md › Cognitive` (Reduce Motion), `motion.md › Best practices` ("Make motion optional"), `dark-mode.md › Best practices` (Increase Contrast och Reduce Transparency), `voiceover.md › Navigation`.

---

## Prio 3: Avgränsningsåtgärder

### S11 Dokumentera de tre besluten

- **Problem och skärmar:** Besluten D-1, D-2, D-3 finns bara i auditdokumenten och i en kodkommentar (ljust läge). De ska vara uttryckliga och dokumenterade.
- **Evidens:** Docs-slice; underlaget är **V-app** och V-kod i auditen.
- **Nytta:** Framtida arbete (och agenter) behandlar dem som beslut, inte som fel; omprövningsvillkoren är nedskrivna.
- **Tester och acceptans:** Poster i `docs/decision-log.md` (kontext, beslut, konsekvenser, omprövningsvillkor) för D-1, D-2, D-3; en rad i `.claude/rules/ios-learnings.md`. `npm run docs:validate` grön. Ingen kod.
- **Docs:** `docs/decision-log.md`, `.claude/rules/ios-learnings.md`, `docs/INDEX.md` vid behov.
- **Beroenden och risker:** Inga. Kan göras när som helst (rekommenderas före S12 och S13).
- **HIG-källor:** `dark-mode.md › Best practices` och `color.md › Best practices` (D-2); `layout.md › Adaptability` (D-1).

### S12 iPhone-only

- **Problem och skärmar:** Appen deklarerar iPad (`TARGETED_DEVICE_FAMILY = "1,2,7"` för appen, `"1,2"` för widget och tester; `UISupportedInterfaceOrientations~ipad` i `Info.plist`).
- **Evidens:** **V-kod** (inställningarna); iPad-utseendet är V-app (`11-ipad-oversikt.png`).
- **Nytta:** Ingen ostödd iPad-yta; mindre testyta.
- **Tester och acceptans:** Sätt `TARGETED_DEVICE_FAMILY = "1"` för app, widget och tester; ta bort `UISupportedInterfaceOrientations~ipad`. Test i `EquinetTests` som läser `Bundle.main.infoDictionary` (`UIDeviceFamily` är `[1]`; inga iPad-orienteringar). Build för iPhone-simulator grön; CI:s iOS-jobb grönt. **Att undersöka före merge:** om appen redan distribueras med iPad-stöd (TestFlight/App Store), och hur iPhone-only-appen beter sig på iPad, Mac och Vision i kompatibilitetsläge (`SUPPORTED_PLATFORMS` innehåller `macosx` och `xros`).
- **Docs:** `docs/decision-log.md` (D-1), `.claude/rules/ios-learnings.md`, README om iPad omnämns (ingen träff vid kontroll av README och iOS-docs 2026-10-08).
- **Beroenden och risker:** Rör `project.pbxproj`; kontrollera mot `ios-learnings.md` (Xcode kan omserialisera filen; ta backup och diff). Distributionsrisk: att ta bort enhetsstöd i en redan publicerad app kan hindra iPad-användare från uppdateringar.
- **HIG-källor:** `layout.md › Adaptability`; `designing-for-ios.md`.

### S13 Ljust läge uttryckligt

- **Problem och skärmar:** Ljust läge är bara en kodkommentar vid `.preferredColorScheme(.light)`. Ingen `UIUserInterfaceStyle` i `Info.plist`. Att verifiera: att systemytor utanför SwiftUI-roten (behörighetsdialoger, tangentbord, delningsark) följer med; att widgeten förblir systemanpassad.
- **Evidens:** **V-app** (appen förblir ljus i systemets mörka läge); systemytorna är **Ej verifierat**.
- **Nytta:** Beteendet är avsiktligt, spårbart och konsekvent över hela appen.
- **Tester och acceptans:** Sätt `UIUserInterfaceStyle = Light` i appens `Info.plist` (behåll eller ta bort `.preferredColorScheme` enligt vad som visar sig behövas); test i `EquinetTests` som läser `infoDictionary`; mätprotokoll: kör alla huvudskärmar plus en pushdialog och ett delningsark i systemets mörka läge; widgeten kontrolleras separat i mörkt läge och ska inte forceras.
- **Docs:** `docs/decision-log.md` (D-2, med omprövningsvillkor), kodkommentaren pekar på beslutet.
- **Beroenden och risker:** Rekommenderas efter S11. Palettens mörka värden (S3) är definierade men oanvända. Risk: widgeten följer systemet och kan se annorlunda ut än appen (acceptabelt, dokumenteras).
- **HIG-källor:** `dark-mode.md › Best practices`; `color.md › Best practices` (även ett enda utseende bör ge ljusa och mörka värden); `widgets.md › Appearances` (widgeten följer systemets utseende).

---

## Prio 4: Widgetens verifierade problem

### S14 Widget: familjeval, datum och etiketter

- **Problem och skärmar:** `supportedFamilies([.systemSmall, .systemMedium])`, men `widgetView(for:)` returnerar alltid `SmallWidgetView`; `MediumWidgetView` används aldrig. Den lilla vyn visar inget datum (en bokning imorgon ser ut som en i dag). Inga tillgänglighetsetiketter, inget varumärke, `ProgressView` i laddningsläge.
- **Evidens:** **V-kod** (widgeten renderades inte i körning; se `...-ej-verifierat.md`).
- **Nytta:** Rätt layout per storlek; ingen förväxling av dag.
- **Tester och acceptans:** Första steget: förhandsgranska och lägg widgeten på simulatorns hemskärm i båda storlekarna och verifiera att medium-vyn aldrig visas. Därefter: `@Environment(\.widgetFamily)` med `switch`; datumtext ("Idag"/"Imorgon"/"tors 8 okt") i liten vy; `.accessibilityLabel`; `.privacySensitive()` för kundnamn; `.redacted` placeholder i stället för `ProgressView`. Extrahera datumtext-logiken och enhetstesta (`WidgetDateLabelTests`: idag, imorgon, senare). Xcode-previews för båda storlekarna.
- **Docs:** `.claude/rules/ios-learnings.md` (widget-gotchas), `docs/testing/testing-guide.md`.
- **Beroenden och risker:** Widgetmålets `membershipExceptions` vid nya filer (`ios-learnings.md`). S3-paletten ger varumärkesfärg men är inget krav. Widgeten följer systemets utseende (D-2).
- **HIG-källor:** `widgets.md › Best practices` ("Offer widgets in multiple sizes when doing so adds value"; "Balance information density"); `widgets.md › Using color` ("Convey meaning without relying on specific colors").

### S15 Widget: djuplänk till bokning

- **Problem och skärmar:** Inget `widgetURL`/`Link`: ett tryck öppnar appen på startskärmen, inte på bokningen.
- **Evidens:** **V-kod**.
- **Nytta:** Ett tryck på widgeten tar leverantören direkt till rätt bokning.
- **Tester och acceptans:** `.widgetURL(URL(string: "equinet://booking/<id>"))`; appen hanterar URL:en via befintlig `pendingBookingId`-mekanism; enhetstest för URL-tolkningen (giltig, ogiltig, okänt id); manuellt: tryck på widgeten öppnar Bokningar med rätt kort markerat. URL-schemat registreras i `Info.plist` (kontrollera att detta inte krockar med befintliga scheman).
- **Docs:** `.claude/rules/ios-learnings.md`; `docs/testing/testing-guide.md`.
- **Beroenden och risker:** Kräver S14 om vyerna delar kod; kan göras separat. Säkerhet: validera id från URL (inget förtroende för indata). Rör `Info.plist`.
- **HIG-källor:** `widgets.md › Adding interactivity` ("Ensure that a widget interaction opens your app at the right location").

---

## Prio 5: Navigation, formulär, sheets samt fel- och offlinelägen

### S16 Push-payload: `category` skriver över `aps`

- **Problem och skärmar:** `PushDeliveryService.ts` skickar `data: { aps: { category } }`. I `apns2@12.2.0` ersätter `data.aps` hela `aps`-objektet, så `alert`, `sound` och `badge` försvinner för notiser med kategori (nya bokningsförfrågningar). Berör ingen iOS-skärm direkt; notisen och åtgärderna Bekräfta/Avvisa.
- **Evidens:** **V-kod** (bibliotekets källa läst). Inte verifierat på enhet (push är inte skarp, backlog "Push live (APNs)").
- **Nytta:** Förfrågningar når leverantören med synlig text och ljud, och åtgärderna fungerar.
- **Tester och acceptans:** Test först (RED): anropa `buildApnsOptions()` på den `Notification` som tjänsten bygger och kräv att `aps.alert`, `aps.sound`, `aps.badge` och `aps.category` finns samtidigt. Åtgärd: skicka kategorin via `category`-alternativet. `npm run check:all` grön. Verifiering på fysisk enhet med sandbox-push när push är skarp.
- **Docs:** README/NFR om push omnämns; relaterad backlogpunkt "Verifiera `APNS_BUNDLE_ID`" noteras.
- **Beroenden och risker:** Ingen iOS-ändring. Fristående och kan tas när som helst; bör vara klar före push blir skarp. Review: `/code-review` (server). Risk: ändrar leverans i produktion, så testa i sandbox.
- **HIG-källor:** `notifications.md › Best practices` och `› Notification actions`.

### S17 Avvisa och Uteblev: bekräftelse eller ångra

- **Problem och skärmar:** I bokningskort och detaljvy utförs `declineBooking` och `markNoShow` direkt utan bekräftelse eller ångra. Avvisa avbokar och notifierar kunden.
- **Evidens:** **V-kod** (inte körd; skulle ändra data).
- **Nytta:** Ett felträff på en irreversibel kundåtgärd kan ångras eller bekräftas.
- **Tester och acceptans:** Välj mönster med Johan (affärsbeslut: bekräftelsedialog eller ångra-banner 5-8 s). Enhetstest på ViewModel: fördröjd sändning avbryts vid ångra; sändning sker efter tidsfönstret. Mätprotokoll: tryck på Avvisa visar dialog/banner; Avbryt gör ingenting. Hjälpartikel för leverantör uppdateras.
- **Docs:** `src/lib/help/articles/provider/` (bokningsflödet), `docs/testing/testing-guide.md`.
- **Beroenden och risker:** Efter S8 (samma kort). Risk: en ångra-fördröjning påverkar kalendersynk och optimistisk UI (`ios-learnings.md`).
- **HIG-källor:** `feedback.md › Best practices` ("Warn people when they initiate a task that can cause data loss that’s unexpected and irreversible"); `alerts.md › Best practices` ("Avoid displaying alerts for common, undoable actions"; "when people take an uncommon destructive action that they can’t undo, it’s important to display an alert").

### S18 Kundskalet: splash täcker felvyn

- **Problem och skärmar:** I `CustomerWebView` sätts `webViewReady` bara i `didFinish`. Vid misslyckad första laddning ritas felvyn under splashen, som ligger kvar. Hästägaren ser en evig splash.
- **Evidens:** **V-app** (`16-kundskal-forsta-laddning-misslyckas-splash-kvar.png`, över 45 s) och V-kod.
- **Nytta:** Hästägare utan täckning får ett tydligt fel och kan försöka igen. Detta är ett funktionsfel i skalet och påverkas inte av beslutet om WebView (D-3).
- **Tester och acceptans:** Extrahera `ShellLoadState` (`loading`, `ready`, `failed`) och enhetstesta övergångarna (fel före första `didFinish` ger `failed`, omförsök ger `loading`, `didFinish` ger `ready`). Mätprotokoll: stoppa servern, starta appen: felvy med "Försök igen" inom 10 s; starta servern, tryck: webben laddas. Offline-bannern syns ovanpå.
- **Docs:** `.claude/rules/ios-learnings.md`; `docs/testing/testing-guide.md`.
- **Beroenden och risker:** Rör `CustomerWebView.swift` och möjligen `WebView.swift`; fristående. Risk: tidsgränsen för att visa felvy får inte dölja en långsam men lyckad laddning.
- **HIG-källor:** `loading.md › Best practices` ("Show something as soon as possible"); `alerts.md › Best practices` (start utan nät: visa cachat/platshållare med diskret etikett); `writing.md › Best practices` ("Write clear error messages").

### S19 Leverantörens WebView-skal: dubbla kontroller och flytande knappar

- **Problem och skärmar:** I `MoreWebView` (Meddelanden, Logga arbete, Ruttplanering, Hästhistorik) visas både nativ och webbaserad titel, både nativ ("Mer") och webbaserad ("← Tillbaka") bakåtknapp, och webbens flytande knappar (buggrapport 48 x 48, mikrofon) krockar med den nativa glas-tab baren. Tom sida utan platshållare medan sidan laddar.
- **Evidens:** **V-app** (`07-meddelanden-webview.png`, `14-hasthistorik-webview-dubbla-bakatkontroller.png`). Laddtiden mättes mot lokal dev-server och är inte representativ.
- **Nytta:** En titel, en bakåtknapp, inga överlappande knappar; platshållare under laddning.
- **Tester och acceptans:** Utöka befintlig CSS-injektion i `WebView.swift` (eller webbens egen `isNativeApp`-signal) så att webbens titel, bakåt och flytande knappar döljs i skalet; nativ skelett/`redacted` under laddning. Mätprotokoll: för varje WebView-väg finns exakt en titel och en bakåtknapp, inga knappar bakom tab baren. Kontroll av att webbläsarversionen (Safari/PWA) inte påverkas (webbändring).
- **Docs:** `.claude/rules/ios-learnings.md`; `docs/sprints/backlog.md` ("iOS-migrering (6 kvarvarande provider WebView-skärmar)": noteras som mildring).
- **Beroenden och risker:** Berör både iOS och webbkod; webben har egna regler (`.claude/rules`) och E2E. Risk: CSS-baserad döljning är skör vid webbändringar; föredra en explicit webbflagga. Gäller inte kundskalet (D-3).
- **HIG-källor:** `toolbars.md › Navigation` ("Use the standard Back and Close buttons"); `loading.md › Best practices`; egen bedömning för flytande knappar.

### S20 Bokningsflödet: hästvy i samma stack och synlig primärknapp

- **Problem och skärmar:** Hästlänken byter flik till Mer (`pendingMorePath` plus `selectedTab = .more`) och lämnar användaren i Mer-stacken; i bokningsdetaljen hamnar `Bekräfta bokning` bakom glas-tab baren vid första visning (y = 793 pt, tab bar från y = 791 pt på iPhone 17).
- **Evidens:** **V-app** (`13-bokningsdetalj.png`, `14-hasthistorik-...png`).
- **Nytta:** Användaren stannar i sitt sammanhang; primärknappen syns utan att scrolla.
- **Tester och acceptans:** Hästvyn pushas i samma `NavigationStack` (eller sheet) utan flikbyte; åtgärdsknapparna flyttas till en nedre verktygsrad eller över tab bar-kanten. Mätprotokoll: på iPhone 17e och 17 Pro Max syns primärknappen utan scroll; bakåt från hästvyn återvänder till bokningen. Enhetstest för eventuell routinglogik (`pendingMorePath` används inte längre för häst).
- **Docs:** `docs/testing/testing-guide.md`.
- **Beroenden och risker:** Efter S8. Risk: hästvyn är en WebView (`/provider/horse-timeline/...`); att visa den i samma stack kräver en wrapper som `MoreWebView` (se S19).
- **HIG-källor:** `tab-bars.md` (inledningen: flikar bevarar navigationstillstånd per sektion); `layout.md › Visual hierarchy`; `toolbars.md › Phone (iOS)`.

### S21 Pushbehörighet i sammanhang och notisinställning

- **Problem och skärmar:** Systemdialogen för notiser visas direkt på Översikt efter första inloggning, utan förklaring, för både leverantörer och hästägare. Ingen notisinställning i appen.
- **Evidens:** **V-app** (`17-pushbehorighet-direkt-efter-inloggning.png`, `15-kundskal-webview.png`) och V-kod (ingen träff på notisinställning i `NativeProfileView`).
- **Nytta:** Fler tackar ja eftersom syftet förklarats; användaren kan se och ändra läget i appen.
- **Tester och acceptans:** Förskärm med en enda knapp ("Fortsätt") som öppnar systemdialogen, visad vid ett lämpligt tillfälle (förslag: efter första sparade profilen för leverantör; efter första bokningen för kund; affärsbeslut). Inställningsrad "Notiser" som visar status och öppnar iOS Inställningar. Enhetstest på beslutslogiken (när förskärmen visas, status per `UNAuthorizationStatus`, inte visa igen efter nej). Mätprotokoll på ny installation.
- **Docs:** Hjälpartikel (leverantör och kund), `docs/testing/testing-guide.md`.
- **Beroenden och risker:** Berör kundskalet via `ContentView`, men ändringen sitter i det native skalet (D-3 påverkas inte). Produktbeslut om tidpunkt krävs.
- **HIG-källor:** `privacy.md › Requesting permission` ("Request permission only when your app clearly needs access"; "Include only one button and make it clear that it opens the system alert"); `managing-notifications.md` ("Make sure people can manage their notification settings within your app"); `onboarding.md › Additional requests`.

### S22 Notisåtgärder och förgrundsvisning

- **Problem och skärmar:** Åtgärderna Bekräfta/Avvisa saknar ikoner; Avvisa kan utföras från låst skärm (`.authenticationRequired` saknas); förgrundsnotiser visar alltid banner och ljud; svar på åtgärd ges som lokal notis med ljud; kundnamn och tjänst visas på låsskärmen.
- **Evidens:** **V-kod** (push är inte skarp; ingen enhetsverifiering).
- **Nytta:** Mindre störande notiser, säkrare åtgärder från låsskärm.
- **Tester och acceptans:** `UNNotificationActionIcon`, `.authenticationRequired` på Avvisa, förgrundsvisning anpassad efter aktiv skärm, feedback via haptik och synlig uppdatering i stället för lokal notis. Enhetstest på extraherad kategori-/åtgärdskonfiguration (identifierare, alternativ, ikon). Verifiering på fysisk enhet med sandbox-push.
- **Docs:** Hjälpartikel om notiser; `.claude/rules/ios-learnings.md`.
- **Beroenden och risker:** Efter S16 (annars saknas den synliga notisen). Innehåll på låsskärmen är en integritetsavvägning (affärsbeslut).
- **HIG-källor:** `notifications.md › Notification actions` ("Provide a simple, recognizable interface icon"; "Prefer nondestructive actions"), `› Best practices` ("Handle notifications gracefully when your app is in the foreground"; "Use an alert, not a notification, to display an error message"), `› Content`.

### S23 Sheets och formulär

- **Problem och skärmar:** Resizable sheets (`.medium` och `.large`: Profil, Radera konto, Anteckning, Kalenderns bokningssheet) saknar grabber; inloggningsfältet använder `.emailAddress` i stället för `.username` för lösenordsförslag; inga `.submitLabel`; ingen `scrollDismissesKeyboard`.
- **Evidens:** **V-kod**.
- **Nytta:** Tydligt att sheets går att dra; smidigare tangentbord och lösenordsförslag.
- **Tester och acceptans:** `.presentationDragIndicator(.visible)` på alla sheets med fler än en detent; `textContentType(.username)`, `.submitLabel(.next/.go)`, `.scrollDismissesKeyboard(.interactively)`. Mätprotokoll: grabber syns; Retur-tangenten visar "Nästa/Gå"; lösenordsförslag erbjuds i simulatorn.
- **Docs:** `.claude/rules/ios-learnings.md`.
- **Beroenden och risker:** Inga. Liten; rör flera filer men bara modifierare.
- **HIG-källor:** `sheets.md › Mobile (iOS, iPadOS)` ("Include a grabber in a resizable sheet"); `text-fields.md › Best practices`; `entering-data.md › Best practices`; `privacy.md › Protecting data` (lösenordshantering).

### S24 Fel-, tom- och offlinelägen

- **Problem och skärmar:** 22 handbyggda tom-/felvyer med fast 48 pt ikon (ingen skalning), `ContentUnavailableView` används på ett enda ställe; feltexter generiska ("Kunde inte hämta bokningar"); offline visas cachad data utan "senast uppdaterad"; laddning är bara en spinner.
- **Evidens:** **V-kod** (22 träffar) och **V-app** (offline-läge, `12-offline-banner.png`).
- **Nytta:** Begripliga fel med nästa steg; stor text hanteras automatiskt av systemkomponenten.
- **Tester och acceptans:** Ersätt handbyggda vyer med `ContentUnavailableView` (`ContentUnavailableView` hanterar Dynamic Type); skilj nätverksfel, serverfel och åtkomstfel i en liten felmodell (`FetchFailureKind`) som enhetstestas; "Uppdaterad kl. HH:MM" i sidfot vid offline. **Dela upp per skärmgrupp** vid behov.
- **Docs:** `docs/testing/testing-guide.md`.
- **Beroenden och risker:** Efter S6 för skärmar som redan har fixats; annars dubbelarbete. Risk: texterna är innehåll (svenska, ton); kräver textbeslut.
- **HIG-källor:** `writing.md › Best practices` ("Write clear error messages"; "Provide clear next steps on any blank screens"); `loading.md › Best practices`; `alerts.md › Best practices`.

---

## Prio 6: Visuell finslipning

### S25 Svenska datumformat

- **Problem och skärmar:** Översiktens titel visar `Torsdag 8 Oktober` och bokningsdetaljen `Tisdag 6 Oktober 2026` (`.localizedCapitalized` på `NativeDashboardView.swift:38` och `.capitalized` på `NativeBookingDetailView.swift:677`). Svenska skrivregler ger gemener på månadsnamn.
- **Evidens:** **V-app**.
- **Nytta:** Korrekt svenska i appens första skärm.
- **Tester och acceptans:** Extrahera en `SwedishDateTitle`-hjälpare som bara versalerar första tecknet; enhetstest (`torsdag 8 oktober` → `Torsdag 8 oktober`, flera månader, tomt).
- **Docs:** Inga.
- **Beroenden och risker:** Efter S1 (samma fil). Mycket liten.
- **HIG-källor:** `writing.md › Best practices` ("Adopt capitalization rules that align with your app’s style, then apply them consistently"); svenska skrivregler är egen bedömning.

### S26 Kalender- och översiktsfinish

- **Problem och skärmar:** Nu-linjen korsar bokningsblockets text; "M"-markören är 9 pt (`NativeCalendarView.swift:392`); kalenderns filterchips är 30 pt höga; kärndata på bokningskorten är caption i sekundär färg; "Idag" visas tre gånger på Översikt och tom KPI "Nya förfrågningar: 0" tar lika mycket plats som viktig information.
- **Evidens:** **V-app** (`05-kalender.png`, `03-oversikt.png`, `04-bokningar-lista.png`).
- **Nytta:** Läsbarare och mindre brus.
- **Tester och acceptans:** Rita nu-linjen under blocken; byt "M" till symbol eller `.caption2` med etikett; chips >= 44 pt; tid och datum i `.subheadline` primär färg; ta bort dubbletten KPI "Idag"; väntande förfrågningar som handlingskort överst. Mätprotokoll och före/efter-skärmbilder.
- **Docs:** Inga utöver testing-guide.
- **Beroenden och risker:** Efter S1, S2, S8 (samma filer). Designbeslut om informationshierarki kan kräva Johans input.
- **HIG-källor:** `accessibility.md › Vision` (11 pt minimum); `typography.md › Conveying hierarchy`; `layout.md › Visual hierarchy`; `designing-for-ios.md › Best practices`.

### S27 Start och launch

- **Problem och skärmar:** Kall start visar vit launch-skärm (`UILaunchScreen` pekar på tom `AccentColor`), därefter grön splash, därefter vit inloggning; `AuthenticatedView` lägger en artificiell splash på 500 ms (`Task.sleep`); vald flik återställs inte vid omstart (alltid Översikt).
- **Evidens:** **V-app** (`01-kallstart-vit-launchskarm.png`, omstart) och V-kod (`Task.sleep`).
- **Nytta:** Snabbare och lugnare start; användaren fortsätter där hen var.
- **Tester och acceptans:** Launch-skärmens färg matchar första skärmen (färg i asset, ingen text); ta bort `Task.sleep(500)`; `@SceneStorage` för vald flik. Enhetstest för `AppTab`-persistens. Mätprotokoll: kall start visar ingen vit-grön-vit-sekvens.
- **Docs:** `.claude/rules/ios-learnings.md`.
- **Beroenden och risker:** Efter S3 (färg). Splash behövs fortfarande för kundskalet tills S18 är gjord (tillståndsmodellen).
- **HIG-källor:** `launching.md › Best practices` och `› Launch screens`; `onboarding.md › Additional content`.

### S28 Appikon

- **Problem och skärmar:** Ikonens ryttare/häst liknar SF-symbolen `figure.equestrian.sports` som appen själv ritar; ikonen är en enda platt PNG; "dark" och "tinted" pekar på samma fil; `LaunchIcon.imageset` har oväntad storlek och saknar 2x/3x; widgetens `AppIcon.appiconset` saknar filer.
- **Evidens:** **V-kod** (asset-struktur) och uppskattat från skärmbild (jämförelsen med symbolen är visuell, ej pixeljämförd).
- **Nytta:** Ingen risk vid App Review för SF-symbol i ikon; ikonen följer systemets utseenden (default, dark, clear, tinted).
- **Tester och acceptans:** Bekräfta först mot symbolbiblioteket. Därefter egen vektor-ikon i skikt via Icon Composer med explicita dark/tinted-varianter; förhandsvisning i alla utseenden; ta bort oanvänd `LaunchIcon`. Designunderlag krävs (extern/intern designinsats).
- **Docs:** Inga utöver ev. README.
- **Beroenden och risker:** Designberoende. **Tidsgräns:** bör vara klar före första App Store-inlämning. Påverkas inte av D-2.
- **HIG-källor:** `sf-symbols.md` (inledningen: förbud mot symboler i appikoner); `app-icons.md › Layer design` och `› Appearances`.

### S29 Städning

- **Problem och skärmar:** Oanvänd `NativeTabBar.swift` (76 rader); utloggningsdialog för en vanlig åtgärd; ingen svensk lokalisering av systemtexter; svart statusfältstext på grön splash.
- **Evidens:** **V-kod** (död kod, lokalisering) och **V-app** (statusfält).
- **Nytta:** Mindre kod att underhålla; svenska behörighetstexter.
- **Tester och acceptans:** Ta bort `NativeTabBar.swift` (grep visar inga referenser; bygget grönt); utvärdera utloggningsdialogen; lägg `sv`-lokalisering för `Info.plist`-strängar; sätt statusfältsstil på splash. Tester: bygg och befintliga sviter gröna.
- **Docs:** Inga.
- **Beroenden och risker:** Lokalisering kan påverka widgetmålet. Låg risk.
- **HIG-källor:** `alerts.md › Best practices`; `writing.md`; egen bedömning för död kod.

### S30 Okänd `userType` ska inte ge leverantörsappen (utanför HIG)

- **Problem och skärmar:** `AuthManager.resolveUserType` faller tillbaka på `"provider"` när claim saknas. Den lokala testkunden hamnade i leverantörsappen.
- **Evidens:** **V-app** (lokalt) och V-kod. Produktion sätter claim via Custom Access Token Hook.
- **Nytta:** Fail-closed: okänd roll ger felvy eller utloggning i stället för leverantörsappen.
- **Tester och acceptans:** Enhetstest i `AuthManagerTests`: saknad claim ger inte `provider`. Bedöm med `/security-review` före åtgärd.
- **Docs:** `docs/guides/gotchas.md` om ett mönster uppstår.
- **Beroenden och risker:** Rör autentisering (review-matrisen kräver `/security-review` och `/code-review`). Beteendeändring för användare med saknad claim.
- **HIG-källor:** Ingen. Egen bedömning (säkerhet).

---

## Beroendekarta och risker

Ordningar som minskar mergekonflikter och dubbelarbete (samma filer):

- **Bokningskortet:** S2, sedan S5, sedan S8, sedan S17. S4 och S26 rör samma fil men bara färg respektive finish.
- **Översikt:** S1, sedan S9, sedan S25, sedan S26.
- **Palett:** S3 före S4, S5 (färdig stil), S27 och S14.
- **Kundskalet:** S18 före S27 (splash-beteendet); S21 rör `ContentView`.
- **Notiser:** S16 före S22.
- **Beslut:** S11 före S12 och S13.

Övergripande risker:

- **Simulator mot CI:** Mätningar gjordes på iOS 27.0; CI och minimimål är iOS 26.2. Systemfärger och layout kan skilja sig lätt.
- **Ingen layout-testning i CI i dag:** Utan S0 vilar stor text-acceptansen på manuella protokoll.
- **Webbkoppling:** S19 och delar av S20 berör webbkod; följ webbens egna regler och E2E-krav.
- **Distribution:** S12 (iPhone-only) kan påverka redan installerade iPad-användare; kontrollera distributionsläget före merge.
- **Produktbeslut som krävs under vägen:** ny nyans på grönt (S3), mönster för Avvisa/Uteblev (S17), tidpunkt för pushbehörighet (S21), ikon (S28).
