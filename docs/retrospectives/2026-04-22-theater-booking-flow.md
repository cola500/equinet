---
title: "Teater-retro: Kund bokar hovslagare i fem akter"
description: "Gap-analys via rollspel. Johan som kund, appen som motspelare. 9 gap upptäckta, 4 blir S52-stories."
category: retro
status: active
last_updated: 2026-04-22
tags: [retro, theater, gap-analysis, customer-journey, pre-launch]
sections:
  - Metod
  - Rollbesättning
  - De fem akterna
  - Gap-sammanfattning
  - Mönster
  - Beslut
---

# Teater-retro: Kund bokar hovslagare i fem akter

**Datum:** 2026-04-22
**Scope:** Rollspela hela kundflödet "hitta hovslagare → kontakta → boka → genomföra → recensera" och upptäcka gap mellan kod och användarförväntan.

---

## Metod

**Förberedelse:** Explore-agent kartlade kundens flöde ände-till-ände (URLer, filsökvägar, befintliga features, dokumenterade luckor).

**Utförande:** Tech lead spelade upp föreställningen själv (efter Johans önskan) — både kundens (Johan) repliker och appens beteende, med hovslagaren Erik Järnfot som bi-roll. När friktion uppstod: explicit markering "🚨 GAP N" + dokumentation.

**Fördel jämfört med code review:** Code review ser implementationen. Teater ser *upplevelsen*. En knapp kan vara välkodad men sitta på fel ställe i flödet.

**Tid:** ~20 minuter. Hälften kartläggning, hälften föreställning.

---

## Rollbesättning

- **Johan** — kund, 42, häst Storm behöver skos om. Har appen men använder den sällan.
- **Erik Järnfot** — hovslagare, 58, Pro-konto, svarar via SMS hellre än appen.
- **Appen** — narrator, visar skärmar, suckar inombords.

---

## De fem akterna

### Akt 1 — Sökandet
Johan vill hitta en hovslagare. Klickar på kategori-ikonen "Hovslagare" på landningssidan — inget händer (ikonerna är dekoration). Använder sökrutan istället, får 14 resultat varav flera inte är hovslagare (fritextsökning matchar beskrivningar). Går in på Järnfots Hovslageri, ser tjänster + snitt-betyg + textuellt besöksområde ("Uppland, Södermanland"). Vet inte om Erik kör till just Lövsta.

### Akt 2 — Kontakten
Johan vill fråga "kommer du till Lövsta?" innan han bokar. Scrollar profilen, letar "Kontakta". Den finns inte — messaging kräver bokningsID. Ringer Erik istället. Erik svarar via SMS 45 min senare: "Ja, boka via appen." **Appen fångar inte första-kontakten — den är för logistik efter att relationen redan etablerats.**

### Akt 3 — Tidsbestämmelsen
Johan bokar. BookingDialog steg 1-5 (tjänst, häst, datum/tid, anteckningar, bekräftelse). Väljer tisdag 14:00 eftersom den är grön. Vet inte om Erik är i Lövsta just då — kalender visar bara Eriks lediga tid, inte vilka dagar han är i specifika områden. Ruttplanerings-datan finns (`RouteAnnouncementNotifier`) men exponeras inte för kund.

### Akt 4 — Bokningen
Gul "Väntar på bekräftelse"-badge. Johan väntar. Ingen indikator om Erik sett bokningen. Kollar appen var 20 min. En timme senare: chat-knappen finns (eftersom bokningen finns), Johan skriver i tråden. Inga läskvitton. Push 30 min senare: "Erik bekräftade." Grön badge. Erik skriver också: "Hälsa Storm."

### Akt 5 — Recensionen
Erik skor Storm tisdag. Åker vidare. Johan glömmer appen. Torsdag öppnar Johan appen av annan anledning, ser "Skriv recension"-knapp på bokningskortet. Skriver 5 stjärnor. **Hade han inte öppnat appen hade recensionen aldrig skrivits** — ingen push, ingen email, ingen banner.

---

## Gap-sammanfattning

| # | Akt | Gap | Allvarlighet | Status |
|---|-----|-----|--------------|--------|
| 1 | 1 | Kategori-ikoner på landningssidan filtrerar inte | Medel | Backlog |
| 2 | 1 | Ingen specialitet-filter på `/providers` | Medel-hög | Backlog |
| 3 | 1 | Besöksområde är fritext, inte geografiskt | Låg | Backlog |
| 4 | 2 | **Ingen pre-booking messaging** | **Stor** | **S52-0/1** |
| 5 | 3 | Ingen ruttplanering synlig för kund vid bokning | Medel | Backlog |
| 6 | 4 | **Pending-tillstånd ogenomskinligt för kund** | **Stor** | **S52-2** |
| 7 | 4 | Inga läskvitton i messaging | Låg-medel | Backlog (SUGGESTION-2) |
| 8 | 5 | **Ingen pro-aktiv review-uppmaning** | Medel-hög | **S52-3** |
| 9 | 5 | Ingen leverantörs-notis vid inkommande recension | Låg | Backlog |

---

## Mönster

**Relationsskapande-gap (3 av 5 akter):** Appen antar att kund och leverantör redan har en relation. Första-gångs-upptäckten är tunt täckt — kunden måste lämna appen för SMS/telefon innan hen ens bokar. Sprint 52 stänger detta med pre-booking messaging.

**Synlighets-gap (2 akter):** Pending-tillstånd och post-booking review-uppmaning är båda UI-polering + en notis. Låg teknisk effort, hög upplevelsemässig effekt. Skiljer "transaktionssystem" från "kompanjon i processen".

**Upptäckts-gap (Akt 1):** Specialitet-filter, geografiskt besöksområde, klickbara kategori-ikoner — alla medel-effort, inget i S52 (skjuts till post-S52 eller post-launch). Om lanseringen visar att förstagångskunder inte hittar rätt leverantör → prio upp.

---

## Beslut

**Johan, 2026-04-22:**

1. **S52 körs före lansering.** Bredare produkt vid lansering värd extra vecka.
2. **Timebox 1h på designdokument** för pre-booking messaging innan implementation (S52-0). "Det känns viktigt" (direkt citat).
3. **Scope S52:** gap 4, 6, 8 som egna stories. Gap 1, 2, 3, 5, 7, 9 stannar i backlog.
4. **Teater som metod blir återkommande.** Nästa kandidat: "Erik Järnfots dag" (leverantörsperspektiv) efter S52 för att hitta friktion från andra sidan.

---

## Lärdomar

**Teater fångar det code review missar.** En välkodad knapp på fel ställe i flödet är ett gap. Code review godkände både landningssidan och providers-listan, men kund-flödet har ändå kognitiva snubbeltrådar.

**Kartlägg först, spela sen.** Explore-agent gav tech lead tillräcklig kod-kunskap för att spela appen korrekt. Utan kartläggningen skulle teatern blivit fantasi-driven.

**5 akter är rätt storlek.** Täcker hela flödet utan att bli utmattande. 20 min är också rätt tid — kortare än en sprintplanering, längre än en standup.

**Icke-teknisk product owner är rätt publik.** Johan (agilist, inte utvecklare) såg gap:en tydligare än en teknisk reviewer skulle gjort. Teknisk reviewer tänker "finns det i backloggen?" — product owner tänker "skulle jag fortsätta använda den här appen?".

---

## Nästa

- S51 (pågående) avslutas
- S52 implementeras (4 stories)
- Post-S52: "Erik Järnfots dag" — teater från leverantörens perspektiv
- Post-launch: Gap 1-5-7-9 prioriteras om riktiga användare upplever dem
