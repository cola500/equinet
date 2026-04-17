---
title: "Manuell testningsguide"
description: "Komplett checklista for manuell testning av Equinet -- alla floden, feature flags, mobil"
category: testing
status: active
last_updated: 2026-04-17
tags: [testing, manual, checklist, qa]
sections:
  - Startsida och offentliga sidor
  - Registrering och inloggning
  - Kundfloeden
  - Leverantorsfloeden
  - Adminfloeden
  - Feature-flaggor
  - Notifikationer och e-post
  - Mobil och PWA
  - Tips
---

# Manuell testningsguide

> Checklista for manuell testning av alla floeden i Equinet.
> Interaktiv version med progress-tracking finns i admin-panelen: `/admin/testing-guide`

## Startsida och offentliga sidor

### Startsidan

- [ ] Sidan laddas och visar hero-sektion
- [ ] "Registrera dig gratis" leder till /register
- [ ] "Hitta tjanster" leder till /providers
- [ ] Feature-sektionen visar tre kort
- [ ] CTA "Ar du tjansteleverantor?" visas
- [ ] Annonsforhandsvisning visas
- [ ] Footer med copyright visas

### Ovriga offentliga sidor

- [ ] Integritetspolicy laddas
- [ ] Anvandarvillkor laddas
- [ ] Leverantorslista visas utan inloggning
- [ ] Sok pa namn/tjanstetyp fungerar
- [ ] Leverantorsprofil visar info, tjanster, omdomen
- [ ] Lediga tider visas

---

## Registrering och inloggning

### Registrering

- [ ] Rollval visas (Hastagare / Tjansteleverantor)
- [ ] Validering: kort losenord ger felmeddelande
- [ ] Validering: ogiltig e-post ger felmeddelande
- [ ] Lyckad registrering skickar verifieringsmail
- [ ] Omdirigering till /check-email

### E-postverifiering

- [ ] Verifieringslanken aktiverar kontot
- [ ] Kan begara ny verifieringslanke

### Inloggning

- [ ] Logga in med verifierat konto
- [ ] Felmeddelande vid fel losenord
- [ ] Kund -> /providers, Leverantor -> /provider/dashboard

### Losenordsaterstellning

- [ ] Glomt losenord skickar e-post
- [ ] Aterstellningslanken fungerar
- [ ] Nytt losenord kan sattas och anvandas

### Utloggning

- [ ] Logga ut fungerar
- [ ] Omdirigeras till startsidan

---

## Kundfloeden

### Navigation

- [ ] Bottenmeny: Sok, Bokningar, Hastar + Mer
- [ ] Mer-meny visar ratt alternativ
- [ ] Aktiv sida markeras med gron farg

### Sok och boka

- [ ] Leverantorslista med sok och filter
- [ ] Leverantorsprofil visar info och priser
- [ ] Bokningsdialog oppnas
- [ ] Steg: tjanst -> datum/tid -> hast -> bekrafta
- [ ] Bokning skapas med status "Vantande"

### Mina bokningar

- [ ] Lista visar alla bokningar
- [ ] Filtrera pa status fungerar
- [ ] Avboka vantande bokning
- [ ] Betalning fungerar (mock)
- [ ] Kvitto kan laddas ner
- [ ] Ombokning fungerar [kraver self_reschedule]

### Recensioner

- [ ] Recensionsknapp efter genomford bokning
- [ ] Stjarnbetyg och kommentar fungerar
- [ ] Recensionen syns pa leverantorens profil

### Mina hastar

- [ ] Lista visar alla hastar
- [ ] Lagg till hast med alla falt
- [ ] Redigera hastuppgifter
- [ ] Halsotidslinje visar historik
- [ ] Exportera hastdata

### Profil och ovrigt

- [ ] Visa och redigera personuppgifter
- [ ] FAQ-sidan laddas
- [ ] GDPR-export fungerar
- [ ] Folj/avfolj leverantor [kraver follow_provider]

---

## Leverantorsfloeden

### Dashboard och onboarding

- [ ] KPI-kort visas
- [ ] Onboarding-checklista for nya leverantorer

### Mina tjanster

- [ ] Lista visar alla tjanster
- [ ] Lagg till ny tjanst
- [ ] Redigera befintlig tjanst
- [ ] Aktivera/inaktivera tjanst

### Bokningshantering

- [ ] Inkommande bokningar med filter
- [ ] Acceptera -> Bekraftad
- [ ] Avboj bokning
- [ ] Markera som genomford
- [ ] Markera som "ej infunnen"
- [ ] Anteckningar och snabbanteckning

### Kalender

- [ ] Veckooversikt med bokningar
- [ ] Navigera mellan veckor
- [ ] Redigera oppettider
- [ ] Tillganglighetsundantag
- [ ] Manuell bokning via "+"

### Manuell bokning

- [ ] Sok efter kund
- [ ] Skapa bokning at kund
- [ ] Bokningen syns i kundens lista

### Kunder

- [ ] Kundlista med sok
- [ ] Kunddetaljer med hastar och historik
- [ ] Privata anteckningar: skapa, redigera, ta bort

### Hasttidslinje

- [ ] Tidslinje visar alla handelser
- [ ] Anteckningar visas kronologiskt

### Recensioner

- [ ] Lista visar kundrecensioner
- [ ] Svara pa recension

### Profil och verifiering

- [ ] Redigera foretagsinfo
- [ ] Uppdatera adress (geokodning)
- [ ] "Accepterar nya kunder"-toggle
- [ ] Skicka in verifieringsforfragan
- [ ] Verifieringsstatus visas korrekt
- [ ] GDPR-export

---

## Adminfloeden

### Dashboard och anvandare

- [ ] KPI-kort: anvandare, bokningar, leverantorer, intakter
- [ ] Sok och filtrera anvandare
- [ ] Blockera/avblockera anvandare
- [ ] Tilldela admin-rattighet

### Innehall och moderering

- [ ] Bokningslista med sok/filter
- [ ] Admin kan avboka med anledning
- [ ] Ta bort olamplig recension
- [ ] Verifieringar: godkann/avsla med kommentar

### System och notifikationer

- [ ] Databasstatus visas
- [ ] Feature flags kan togglas
- [ ] E-postinstallningar fungerar
- [ ] Massnotifikation fungerar
- [ ] Integrationssidan (Fortnox) laddas

---

## Feature-flaggor

> Varje feature nedan kraver att respektive flagga ar PA i Admin -> System.

### Rostloggning (voice_logging)

- [ ] "Logga arbete" visas nar PA, doljs nar AV
- [ ] Mikrofon startar inspelning
- [ ] AI tolkar och matchar mot bokningar
- [ ] Fallback till text i Firefox

### Ruttplanering (route_planning)

- [ ] Menyval visas nar PA, doljs nar AV
- [ ] Skapa rutt med datum och stopp
- [ ] Kartvy med stopp
- [ ] Optimera ordning och restidsberakning

### Rutt-annonser (route_announcements)

- [ ] Menyval visas nar PA, doljs nar AV
- [ ] Skapa annons kopplad till rutt
- [ ] Kunder ser annonser under "Lediga tider"
- [ ] Kund kan boka via annons

### Besoksplanering (due_for_service)

- [ ] Menyval visas nar PA, doljs nar AV
- [ ] Hastar som behover besok listas
- [ ] Intervall kan sattas per hast/tjanst
- [ ] Forfallna besok markeras tydligt

### Gruppbokningar (group_bookings)

- [ ] Menyval visas for kund och leverantor
- [ ] Kund kan skapa och bjuda in
- [ ] Kund kan ansluta till grupp
- [ ] Leverantor kan matcha gruppbokning

### Affarsinsikter (business_insights)

- [ ] Menyval visas nar PA, doljs nar AV
- [ ] Grafer: tjanster, tidsanalys, retention

### Aterkommande bokningar (recurring_bookings)

- [ ] Seriealternativ visas/doljs korrekt
- [ ] Skapa serie (veckovis, varannan, manadsvis)
- [ ] Avbryt en hel serie

### Offlinelage (offline_mode)

- [ ] Oversikt, Kalender, Bokningar offline
- [ ] Offlineindikator visas
- [ ] Andringar synkas vid ateranslutning
- [ ] Ej cacheade sidor visar offline-meddelande

### Sjalvservice-ombokning (self_reschedule)

- [ ] Ombokning visas/doljs baserat pa flagga
- [ ] Kund kan valja nytt datum/tid
- [ ] Leverantor ser ombokningshistorik

### Folj leverantor (follow_provider)

- [ ] Folj-knapp visas pa leverantorsprofil
- [ ] Kund kan folja och avfolja
- [ ] Notis vid ny rutt-annons i kundens kommun

### Bevaka kommun (municipality_watch)

- [ ] Bevakningsval visas i kundprofil
- [ ] Valj kommun + tjanstetyp
- [ ] Notis vid ny rutt-annons i bevakad kommun

### Kundinsikter (customer_insights)

- [ ] Kundinsikter visas/doljs baserat pa flagga
- [ ] AI-genererade insikter pa kunddetaljsida
- [ ] Insikter uppdateras vid ny bokningshistorik

---

## Notifikationer och e-post

### In-app

- [ ] Olast-badge visas i header
- [ ] Notifikationslista oppnas
- [ ] Markera som last
- [ ] Notifikation vid ny bokning
- [ ] Notifikation vid statusandring

### E-post

- [ ] Verifieringsmail vid registrering
- [ ] Aterstellningsmail fungerar
- [ ] Bokningsbekraftelse skickas
- [ ] Bokningspaminnelse (24h innan)
- [ ] Avprenumerera-lank fungerar

---

## Mobil och PWA

### Responsiv design

- [ ] Alla sidor anvandbara pa 375px
- [ ] Bottenmeny pa mobil, doljs pa desktop
- [ ] Knappar minst 48px (tumvanliga)
- [ ] Formular fungerar med mobilt tangentbord
- [ ] Modaler scrollbara vid langt innehall

### PWA

- [ ] "Installera app"-prompt visas
- [ ] Appen kan installeras
- [ ] Oppnas i helskarm utan adressfalt
- [ ] App-ikon visas korrekt

---

## Tips

- Testa "happy path" forst
- Testa pa mobil -- de flesta anvander mobilen i stallet
- Testa floeden: sok -> boka -> bekrafta -> genomfor -> recensera
- Vaxla roller: kund, leverantor, admin
