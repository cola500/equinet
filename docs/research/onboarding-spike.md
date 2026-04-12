---
title: "Onboarding-spike -- registreringsflode for ny leverantor"
description: "Resultat av S9-5: test av self-service-flodet pa equinet-app.vercel.app"
category: research
status: active
last_updated: 2026-04-02
sections:
  - Sammanfattning
  - Steg-for-steg-test
  - Vad som fungerar
  - Vad som saknas
  - Minimum Viable Onboarding
  - Effort-uppskattning
---

# Onboarding-spike -- registreringsflode for ny leverantör

## Sammanfattning

**Fragestellning:** Hur registrerar sig leverantör #2 utan seed-data?
Vad saknas i self-service-flodet?

**Svar:** Registreringen fungerar tekniskt, men en ny leverantör far
INGEN vagledning efter inloggning. Det saknas en onboarding-wizard
eller checklista som guidar genom setup-stegen.

**Kritisk blockerare:** E-postverifiering kraver fungerande Resend-integration.
Om mailet inte nar fram (spam, felaktig adress) kan leverantören inte logga in.

## Steg-for-steg-test

### 1. Landningssida (/)

- **Status:** Fungerar bra
- Professionell design med tydliga CTA:er
- "Registrera dig gratis" och "Registrera som leverantör" langst ner
- "Sa funkar det" -- 3-stegsguide (Skapa konto, Hitta och boka, Hall koll)
- Separata sektioner for hastagare och leverantörer

### 2. Registreringssida (/register)

- **Status:** Fungerar
- Kontotyp-valjare: Hastagare / Tjanstelaeverantor
- Leverantör-val visar extra falt: Foretagsnamn (obligatoriskt), Beskrivning, Stad
- Losenordskrav tydligt visat med realtidsvalidering (8 tecken, stor/liten, siffra, specialtecken)
- Telefon ar valfritt
- **Problem:** Inget serviceomrade-falt vid registrering (laggs till i profilen)
- **Problem:** Ingen indikation pa att Stad paverkar sokbarhet

### 3. E-postverifiering (/check-email)

- **Status:** Fungerar -- BLOCKERARE om mail inte nar fram
- Redirectar till "Kontrollera din e-post" efter registrering
- Visar instruktioner om att klicka pa verifieringslanken
- "Skicka nytt verifieringsmail" och "Tillbaka till inloggning" knappar
- **Kan inte logga in utan verifiering** -- returnerar "Ogiltig email eller lösenord"
- Felmeddelandet ar missvisande -- borde saga "E-posten ar inte verifierad"

### 4. Inloggning (/login)

- **Status:** Fungerar (testat med seed-konto)
- Tydlig login-sida med "Glomt lösenord?" och "Registrera dig har"
- Redirectar till /provider/dashboard efter lyckad inloggning

### 5. Dashboard (/provider/dashboard)

- **Status:** Fungerar -- MEN saknar onboarding-vagledning
- Visar: Aktiva tjänster (0), Kommande bokningar (0), Nya förfrågningar (0)
- Statistik-grafer (tomma for ny leverantör)
- Snabblankar: Se bokningar, Kalender, Kundregister
- **SAKNAS:** Ingen "Kom igang"-guide, checklista eller wizard
- **SAKNAS:** Inget som forklarar "vad ska jag gora nu?"

### 6. Min profil (/provider/profile)

- **Status:** Fungerar bra
- Tre flikar: Profil, Installningar, Tillgänglighet
- Profil-tab: Profilbild, personlig info, foretagsinfo, verifiering, GDPR-export
- Tillgänglighet-tab: Oppettider per veckodag, redigerbara
- Installningar-tab: (ej testad i detalj)
- **Bra:** Alla falt som behovs finns (adress, stad, postnummer, serviceomrade, hem-position)
- **Problem:** Hem-position kraver manuell inmatning -- ingen geocoding-guide

### 7. Mina tjänster (/provider/services)

- **Status:** Fungerar
- "Lagg till tjänst" knapp tydligt synlig
- Tjanstkort med namn, beskrivning, pris, varaktighet
- Redigera och Ta bort per tjänst
- **Bra:** Intuitivt for den som hittar dit
- **Problem:** Ny leverantör ser tom lista utan forklaring

### 8. Publik profil

- **Ej testad:** Kraver att leverantören har stad satt for att synas i sok
- Landningssidan har ingen synlig "sok leverantör"-funktion for besokare

## Vad som fungerar

1. **Registreringsformularet** -- rent, tydligt, bra validering
2. **Kontotyp-valjare** -- sjalvforklarande
3. **Profilhantering** -- komplett med alla falt
4. **Tjansthantering** -- enkelt att lagga till/redigera
5. **Tillgänglighet** -- oppettider per dag
6. **Landningssida** -- professionell, bra messaging
7. **Losenordsaterstellning** -- finns (/forgot-password)

## Vad som saknas

### Kritiskt (blockerare for self-service)

| # | Problem | Effekt | Effort |
|---|---------|--------|--------|
| 1 | **Ingen onboarding-guide** | Ny leverantör vet inte vad de ska gora | 1-2 dagar |
| 2 | **E-postverifiering felmeddelande** | "Ogiltig email" istallet for "Ej verifierad" | 1h |
| 3 | **Ingen tom-tillstand vagledning** | Tomma listor utan "kom igang" | 0.5 dag |

### Viktigt (forbattrar upplevelsen)

| # | Problem | Effekt | Effort |
|---|---------|--------|--------|
| 4 | Inget serviceomrade vid registrering | Leverantör syns inte i sok | 2h |
| 5 | Ingen "din profil ar X% komplett" | Ingen motivation att fylla i allt | 0.5 dag |
| 6 | Ingen publik sok pa landningssidan | Besokare hittar inte leverantörer | 1 dag |
| 7 | Hem-position kraver manuell forstaelse | Lat/long ar inte intuitivt | 2h (geocoding) |

### Trevligt att ha

| # | Problem | Effekt | Effort |
|---|---------|--------|--------|
| 8 | Ingen valkomst-email efter registrering | Missad engagement-möjlighet | 2h |
| 9 | Ingen "bjud in dina kunder"-prompt | Leverantör far inga bokningar | 2h |
| 10 | Ingen exempeldata/demo-data for ny leverantör | Svart att forsta systemet | 1 dag |

## Minimum Viable Onboarding

For att leverantör #2 ska kunna gora self-service-registrering behovs:

### Fas 1: Blockerare (1-2 dagar)

1. **Onboarding-checklista pa dashboard** -- visa steg:
   - [ ] Fyll i foretagsinformation
   - [ ] Lagg till minst en tjänst
   - [ ] Satt oppettider
   - [ ] Lagg till serviceomrade
   - Checklistan doljs nar alla steg ar klara

2. **Fixa verifierings-felmeddelande** -- "Din e-post ar inte verifierad" med
   lank till "Skicka nytt verifieringsmail"

3. **Tom-tillstand vagledning** -- For varje tom lista, visa:
   - Tjänster: "Du har inga tjänster annu. Lagg till din forsta tjänst for att borja ta emot bokningar."
   - Bokningar: "Inga bokningar annu. Nar kunder bokar dina tjänster visas de har."

### Fas 2: Forbattringar (2-3 dagar)

4. Serviceomrade-falt i registreringsformularet
5. Profil-kompletteringsindikator
6. Valkomst-email med setup-guide
7. "Bjud in dina kunder"-prompt pa dashboard

## Effort-uppskattning

| Fas | Scope | Effort | Prioritet |
|-----|-------|--------|-----------|
| Fas 1 | Blockerare | 1-2 dagar | Hog -- kravs for leverantör #2 |
| Fas 2 | Forbattringar | 2-3 dagar | Medel -- forbattrar konvertering |
| Totalt | | 3-5 dagar | |

**Rekommendation:** Fas 1 bor in i nasta sprint. Utan onboarding-checklistan
ar det osannolikt att en ny leverantör fullfolder setup utan manuell hjalp.
