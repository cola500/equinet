---
title: "Stallprofiler och Stallplatser (Marketplace Expansion)"
description: "Epic för att introducera stall som aktör i plattformen - stallprofiler, stallplatser, sök, hästkoppling och inbjudningar"
category: "epic"
status: "draft"
last_updated: "2026-03-09"
sections:
  - Bakgrund
  - Mål
  - Affärsmål
  - Scope (MVP)
  - Out of Scope
  - Användarroller
  - Definition of Done
  - Acceptanskriterier
  - Framgångsmått
  - Risker
  - Möjlig framtida utveckling
  - Frågor inför implementation
  - Rekommenderad nästa brytning
tags:
  - epic
  - marketplace
  - stall
  - stallplatser
---

# EPIC: Stallprofiler och Stallplatser (Marketplace Expansion)

## Bakgrund

Equinet är idag en plattform för att koppla samman hästägare och serviceleverantörer (t.ex. hovslagare).
Många hästägare finns organiserade i stall med flera hästar och gemensamma servicebehov.

Genom att introducera stall som en aktör i plattformen kan Equinet:

- hjälpa stallägare att marknadsföra lediga stallplatser
- förenkla koordinering av service (t.ex. hovslagare)
- attrahera fler användare via stallägare som bjuder in sina inackorderingar

Stall fungerar då som **geografiska hubs** i plattformen.

---

## Mål

Denna Epic ska göra det möjligt för stallägare att:

1. Skapa och hantera en stallprofil
2. Publicera lediga stallplatser
3. Synas i sökresultat för hästägare
4. Bjuda in sina inackorderingar till plattformen
5. Koppla hästar till ett stall

---

## Affärsmål

- Öka användartillväxt via stallägare
- Göra Equinet mer attraktiv för hästägare som söker stallplats
- Skapa fler servicebokningar via stallbaserade grupper

---

## Scope (MVP)

Epicen omfattar följande funktioner.

### 1. Stallprofil

Stallägare kan skapa en publik profil för sitt stall.

Profilen innehåller:

- stallnamn
- kommun
- stad (valfritt)
- beskrivning
- bilder
- antal stallplatser
- kontaktinformation

Profilen ska kunna:

- redigeras
- visas publikt
- kopplas till en användare (stallägare)

---

### 2. Stallplatser

Stallägare kan registrera stallplatser.

En stallplats innehåller:

- stall
- status (ledig / uthyrd)
- pris (valfritt)
- tillgänglig från datum

Stallplatser kan:

- markeras som lediga
- publiceras i sök

---

### 3. Sök stallplatser

Hästägare ska kunna:

- söka stallplatser
- filtrera på kommun
- se stallprofil
- se lediga stallplatser

---

### 4. Koppla hästar till stall

En hästägare ska kunna ange vilket stall hästen står i.

Det gör att:

- service kan organiseras per stall
- gruppbokningar blir enklare

---

### 5. Stallägare kan bjuda in inackorderingar

Stallägare ska kunna bjuda in hästägare till Equinet.

Flöde:

1. Stallägare klickar **"Bjud in"**
2. skickar länk
3. hästägare registrerar konto
4. kopplas till stallet

---

## Out of Scope

Följande funktioner ingår inte i denna Epic:

- avancerad stalladministration
- hyreskontrakt
- ekonomihantering
- stalljournaler
- foderplanering
- stall-ERP funktioner

Equinet ska fortsatt vara en **marknadsplats**, inte ett stalladministrationssystem.

---

## Användarroller

Denna Epic introducerar en ny roll:

**Stallägare**

En användare kan ha flera roller:

- kund (hästägare)
- leverantör
- stallägare

---

## Definition of Done

Epicen anses klar när:

- stallägare kan skapa stallprofil
- stallplatser kan registreras
- stallplatser kan publiceras
- hästägare kan hitta stallplatser via sök
- hästar kan kopplas till stall
- stallägare kan bjuda in inackorderingar

---

## Acceptanskriterier (Epic-nivå)

- stallprofil kan skapas och visas publikt
- stallplatser kan markeras som lediga
- stallplatser kan hittas via geografisk sökning
- hästar kan kopplas till stall
- inbjudningar fungerar

---

## Framgångsmått

Epicen anses framgångsrik när:

- stallägare börjar registrera stall
- stallplatser publiceras
- hästägare ansluter via stallägare
- fler servicebokningar sker via stall

---

## Risker

### Risk: Stallfunktion blir för komplex

Mitigation:
Håll funktionerna enkla och fokuserade på marknadsplatsen.

### Risk: Få stall registrerar sig

Mitigation:
Gör stallannonser gratis i början.

---

## Möjlig framtida utveckling

Efter MVP kan följande funktioner byggas:

- stallreviews
- stallfaciliteter
- stallbaserade gruppbokningar
- hovslagare kan se stall med många hästar
- premium stallannonser

---

## Frågor inför implementation

1. Ska stallplatser vara gratis eller premium?
2. Ska stall kunna ha flera administratörer?
3. Ska stall kunna vara publika utan lediga platser?

---

## Rekommenderad nästa brytning

Den här Epicen kan brytas ner i cirka **6–8 user stories**.

Möjliga nästa steg:

- Stallprofil
- Hantera stallplatser
- Sök stallplatser
- Koppla hästar till stall
- Inbjudningar till stall
