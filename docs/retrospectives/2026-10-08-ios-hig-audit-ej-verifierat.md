---
title: "iOS HIG-genomlysning 2026-10-08 -- vad som inte kunde verifieras"
description: "Lista över ytor, tillstånd och påståenden i HIG-genomlysningen som inte kunde verifieras, och vad som krävs för att göra det"
category: research
status: draft
last_updated: 2026-10-10
sections:
  - S6-körpass: stor text i leverantörsappen (2026-10-10)
  - Inte körda i appen
  - Inte möjliga i simulatorn
  - Begränsningar i mätningen
  - Fynd som kräver bekräftelse
tags: [ios, hig, accessibility, audit]
related:
  - docs/retrospectives/2026-10-08-ios-hig-audit.md
  - docs/retrospectives/2026-10-08-ios-hig-audit-matris.md
  - docs/retrospectives/2026-10-08-ios-hig-audit-pr-slices.md
---

# iOS HIG-genomlysning 2026-10-08 -- vad som inte kunde verifieras

## S6-körpass: stor text i leverantörsappen (2026-10-10)

Körpass vid AX5 (`accessibility-extra-extra-extra-large`) på iPhone 17e (iOS 26.5, den minsta enheten) mot `main` efter PR #547, lokal testdata, ljust systemläge. Inga produktändringar. Syftet var att avgöra vad som faktiskt återstår efter S1 inför sprintens nästa slices. Bilder finns lokalt (`~/Desktop/equinet-s6-evidence`), inte i repot.

| Skärm | Resultat vid AX5 | Detaljer | Slice |
|-------|------------------|----------|-------|
| Översikt | Klar | Åtgärdad i S1 (PR #547) | S1 |
| Bokningar (lista) | **Fel** | Tjänstens namn bryts per bokstav (`Hel/sko/nin/g`), priset på tre rader, kortet fyller skärmen; filterchipsen är horisontellt scrollbara (fungerar). Handlingsknapparna ligger under skärmbrytet och granskades i auditen (F-01) | S2 |
| Bokningsdetalj | OK | Scrollar, etiketter radbryts; lång e-postadress avstavas (oundvikligt) | - |
| Kalender | **Fel (flera delar)** | Dagshuvudet bryts mitt i ordet (`LÖR/DAG`) och datumet trunkeras (`10…`); veckoremsans bokstäver radbryts och överlappar; timetiketter blir `1…`; händelseblock klipps (`Lisa Anders…`); filterchipsen klipps. Bedömd M, risk för L | S6a |
| Mer-menyn | OK | Systemlistan radbryter korrekt (`Medde-/landen`) | - |
| Inloggning | OK | Fält, etiketter och knapp läsbara; "Glömt lösenord?" ligger nära hemindikatorn. Tangentbordsläge ej testat (SecureField går inte att skriva i via mobile-mcp) | - |
| Mina tjänster | Delvis | Titeln bryts mitt i ord (`garbesö/k`) eftersom "Aktiv"-pillen ligger bredvid | senare |
| Kunder | Delvis | Metaraden bryts mitt i ord (`boknin/gar`); stor tom yta under rubriken | senare |
| Pushbehörighetsdialogen | OK | Läsbar, knappar växer med texten | - |
| Formulär-sheets (Anteckning, Avboka m.fl.) | **Ej körda** | Kräver svep i detaljvyn (WebDriver-svepet är instabilt) | S6c |
| Recensioner, Profil, Insikter, Hjälp | **Ej körda** | Utanför körpassets avgränsning (inte huvudflöden) | S6c |
| Meddelanden, hästhistorik (WebView) | Ej bedömda | WebView, beslutad avgränsning D-3 | - |

**Begränsningar:** bara iPhone 17e, bara AX5, bara ljust läge. Bokningslistans knapprad och Kalenderns lägre del granskades inte ned till sista pixeln.

**Rekommendation för sprintens sista objekt:** Kalender (huvudflöde, tydligast trasig). Mina tjänster och Kunder är små, separata fel i sekundära vyer.

## Inte körda i appen

| Område | Läge | Vad som behövs |
|--------|------|----------------|
| **Hästägarens (kundens) flöde (skalet)** | Delvis verifierat i andra passet: kundskalet laddar webbappen med webbritad bottennavigation, flytande buggknapp och pushdialog (`15-kundskal-webview.png`); första laddningen vid nere server verifierad (F-35). Webbinnehållets egen tillgänglighet och funktion är inte granskad (webbgranskning; D-3). Kunden behövde en lokal `userType`-claim för att nå skalet (se F-36) | Webbgranskning av hästägarflödet som separat uppdrag; ingen iOS-HIG-åtgärd utöver skalets fynd |
| **Nativa Profil, Tjänster, Kunder, Recensioner, Insikter, Hjälp, Gruppbokningar, Annonser, Besöksplanering** | Endast kod/mönstersökning. Inte öppnade i appen | Ett körpass med mobile-mcp (bygger vidare på backlogpunkten "iOS native-flöde-audit via mobile-mcp (S42-4)") |
| **Formulär-sheets med tangentbord** (Tjänst, Profil, Avboka, Recensera) | Endast kod; tangentbordsöverlapp i `.medium`-detent och fokusordning ej testade | Öppna sheets med tangentbord på liten iPhone |
| **Bokningsåtgärder (Bekräfta/Avvisa/Uteblev)** | Medvetet inte körda (skulle ändra lokal data och, via serverlogik, trigga notiser) | Test mot sandlåda med återställbar seed; verifiera ångra/bekräftelse efter åtgärd |
| **Login med felaktiga uppgifter / felmeddelande** | Endast kod (`loginErrorType`, ikon + text). Första inloggningsförsöket mot kall lokal GoTrue låg kvar på splash i ca 30 s; ej reproducerat | Test av felvägar: fel lösenord, nätverksfel, serverfel |
| **Liggande iPhone** | Endast stående stöds (`UISupportedInterfaceOrientations` = Portrait). Inget att köra | Ingen åtgärd; avgränsning som redan gäller |
| **iPad** | Avgränsat bort (D-1). iPad Air kördes en gång för att visa utseendet, ingen mer testning planeras | Ingen |
| **Liten iPhone** | Endast iPhone 17 (6,3") och iPad Air kördes. Ingen skärm <= 6,1" | Kör iPhone 17e/SE-liknande storlek vid AX3-AX5 |

## Inte möjliga i simulatorn

| Område | Anledning | Vad som behövs |
|--------|-----------|----------------|
| **VoiceOver, Voice Control, Switch Control** | Simulatorn kör inte skärmläsare; granskningen bygger på tillgänglighetsträdet (etiketter, storlekar) via mobile-mcp/WebDriverAgent. Ordning och faktisk uppläsning är inte verifierade | Test på fysisk enhet med VoiceOver, Voice Control, Switch Control |
| **Reduce Motion, Increase Contrast, Reduce Transparency** | Inställningarna kördes inte med skärmbilder (en `increase_contrast`-växling gjordes men ingen skärm dokumenterades) | Kör alla skärmar med respektive inställning; mät om kontrast med verktyget |
| **Push-notiser och notisåtgärder** | APNs är inte skarp (backlog: "Push live (APNs)"); simulatorn saknar enhetstoken. Notisutseende, åtgärdsknappar och låsskärm är bedömda från kod | Sandbox-push till fysisk enhet; lås/lås upp; Focus-lägen; ikon på åtgärder |
| **Widget på hemskärm och låsskärm** | Widgeten lades inte till i simulatorn (kräver manuell redigering av hemskärmen). Layout, tomtillstånd och djuplänk är bedömda från kod | Lägg till widgeten (liten och medium) i simulatorn eller på enhet, i ljus/mörk/tintad/klar rendering |
| **Systemytor i ljust läge** (behörighetsdialoger, tangentbord, delningsark när systemet är mörkt) | Ej kört: bara appens egna skärmar kontrollerades i systemets mörka läge. Behövs för att bekräfta D-2-implementationen (S13) | Kör i systemets mörka läge efter S13 |
| **Face ID, haptik, Dynamic Island, systemets Liquid Glass i verklig GPU** | Simulatorns ersättningar saknar känsla/prestanda | Fysisk enhet |
| **Kalendersynk (EventKit) och behörighet** | Behörighetsflödet för kalender (`NSCalendarsFullAccessUsageDescription`) kördes inte | Kör "Synka till Kalender" och granska behörighetstext och tidpunkt |
| **Röstloggning (mikrofon + taligenkänning)** | Behörigheterna `NSMicrophoneUsageDescription`/`NSSpeechRecognitionUsageDescription` begärs i en WebView-flöde som inte kördes | Kör "Logga arbete" på enhet; kontrollera att behörigheten begärs i sammanhang |
| **Appikon på hemskärm i alla lägen** | Inte renderad på hemskärmen i dark/tinted/clear | Icon Composer-förhandsvisning och enhet |

## Begränsningar i mätningen

- **Kontrastvärden** kommer från pixelsampling i simulatorns skärmbilder (iOS 27.0). Systemfärgernas exakta värden varierar mellan iOS-versioner; mätningen avser den version som kördes. Antialiasing kan ge små avvikelser (några hundradelar).
- **Dev-server:** WebView-sidor laddade långsamt mot lokal dev-server (kompilering vid första besök). Tomsidan före innehåll ("laddar...") är därför inte representativ för tidpunkt, bara för avsaknaden av platshållare.
- **Systemets språk** var engelska; svenska systemdialoger (behörigheter) är därför inte verifierade.
- **Webbens innehåll** i WebView (typografi, kontrast, tillgänglighet) granskades inte som webb; bara skalet kring det.
- **Äldre audit (2026-04-18):** inte alla punkter (M-01..M-06, m-05..m-09) återverifierades.

## Fynd som kräver bekräftelse

| Fynd | Vad som är osäkert | Hur det bekräftas |
|------|--------------------|-------------------|
| F-06 | Orsaken till dubbel åtgärd vid korttryck (antas vara `List`-radens knappstil); beteendet är observerat | Minimalt reproducerbart test; testa `.buttonStyle(.borderless)` |
| F-08 | Pushpayloadens utseende i verkligheten; slutsatsen bygger på `apns2`-källan | Skriv enhetstest; skicka riktig sandbox-push |
| F-09 | Widgetens faktiska rendering och att medium-vyn verkligen aldrig används | Xcode-förhandsvisning av medium; hemskärmstest |
| F-12 | Att ikonens motiv är identiskt med SF-symbolen (jämförelsen gjordes visuellt mot symbolen som appen själv ritar) | Jämför mot symbolen i SF Symbols-appen; fråga eventuell designer om ikonens ursprung |
| F-30 | Om KPI-korten läses två gånger av VoiceOver (nästlade knappar i trädet) | VoiceOver på enhet |
| F-16 | Om samma placering av primärknappar gäller på alla iPhone-storlekar | Kör iPhone 17e och 17 Pro Max |
