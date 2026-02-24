# Produkttestningsguide - Equinet

> **Syfte:** Systematisk genomgång av alla funktioner i Equinet, avsedd att köras av produktägare innan vi släpper på riktiga användare. Varje avsnitt har checkboxar som kan bockas av under testningen.
>
> **Senast uppdaterad:** 2026-02-24

---

## Innehåll

1. [Förberedelser](#1-förberedelser)
2. [Startsida & Offentliga sidor](#2-startsida--offentliga-sidor)
3. [Registrering & Inloggning](#3-registrering--inloggning)
4. [Kundflöden](#4-kundflöden)
5. [Leverantörsflöden](#5-leverantörsflöden)
6. [Adminflöden](#6-adminflöden)
7. [Feature-flaggade funktioner](#7-feature-flaggade-funktioner)
8. [Notifikationer & E-post](#8-notifikationer--e-post)
9. [Mobil & Responsivitet](#9-mobil--responsivitet)
10. [Gradvis utrullning](#10-gradvis-utrullning---checklista)

---

## 1. Förberedelser

### Testkonton att använda

Du behöver tre separata konton för att testa alla roller:

| Roll | Beskrivning |
|------|-------------|
| **Kund** | Registrera som kund (välj "Hästägare" vid registrering) |
| **Leverantör** | Registrera som leverantör (välj "Tjänsteleverantör" vid registrering) |
| **Admin** | Behöver tilldelas admin-rättighet i databasen eller av en befintlig admin |

### Miljö

- [ ] Bestäm om testning sker mot lokal miljö eller staging/produktion
- [ ] Verifiera att e-post fungerar (behövs för verifiering och notifikationer)
- [ ] Ha tillgång till admin-kontot för feature flag-hantering

### Webbläsare

- [ ] Testa primärt i Chrome (stöd för röstloggning via Web Speech API)
- [ ] Kontrollera även i Safari (mobilvy) och Firefox (fallback utan röst)

---

## 2. Startsida & Offentliga sidor

### Startsidan (`/`)

- [ ] Sidan laddas och visar hero-sektion med "Boka hästtjänster enkelt och smidigt"
- [ ] Knappen "Registrera dig gratis" leder till `/register`
- [ ] Knappen "Hitta tjänster" leder till `/providers`
- [ ] Feature-sektion visar tre kort: Sök och jämför, Boka direkt, Håll koll
- [ ] Sektionen "Är du tjänsteleverantör?" visas med CTA
- [ ] Annonsförhandsvisning (kommande rutter) visas om det finns aktiva annonser
- [ ] Footer med copyright visas

### Integritetspolicy (`/integritetspolicy`)

- [ ] Sidan laddas och visar integritetspolicy

### Användarvillkor (`/anvandarvillkor`)

- [ ] Sidan laddas och visar användarvillkor

### Hitta tjänster - utan inloggning (`/providers`)

- [ ] Sidan laddas och visar en lista med leverantörer
- [ ] Sökfältet fungerar (sök på namn, tjänstetyp)
- [ ] Klicka på en leverantör visar deras profil (`/providers/[id]`)
- [ ] Leverantörsprofilen visar: namn, beskrivning, tjänster med pris, recensioner, kompetenser

### Lediga tider (`/announcements`)

- [ ] Sidan visar annonserade rutter (om feature flag `route_announcements` är PÅ)
- [ ] Klicka på en annons visar detaljer

---

## 3. Registrering & Inloggning

### Registrering (`/register`)

- [ ] Formuläret visas med val av roll (Hästägare / Tjänsteleverantör)
- [ ] Fyll i namn, e-post och lösenord
- [ ] Validering: kort lösenord ger felmeddelande
- [ ] Validering: ogiltig e-post ger felmeddelande
- [ ] Lyckad registrering skickar verifieringsmail
- [ ] Omdirigering till `/check-email`

### E-postverifiering (`/verify-email`)

- [ ] Klicka på länk i verifieringsmail
- [ ] Kontot aktiveras, omdirigering till inloggning

### Återskicka verifiering (`/resend-verification`)

- [ ] Kan begära ny verifieringslänk om den gamla gått ut

### Inloggning (`/login`)

- [ ] Logga in med verifierat konto
- [ ] Felmeddelande vid fel lösenord (på svenska)
- [ ] Felmeddelande vid overifierat konto
- [ ] Kund omdirigeras till `/providers` (söksidan)
- [ ] Leverantör omdirigeras till `/provider/dashboard`

### Glömt lösenord (`/forgot-password`)

- [ ] Ange e-post och skicka
- [ ] E-post med återställningslänk skickas

### Återställ lösenord (`/reset-password`)

- [ ] Länk från e-post fungerar
- [ ] Nytt lösenord kan sättas
- [ ] Kan logga in med nytt lösenord

### Utloggning

- [ ] Logga ut fungerar från header-menyn
- [ ] Omdirigering till startsidan

---

## 4. Kundflöden

> Logga in med kundkonto för dessa tester.

### 4.1 Navigation

- [ ] Bottenmeny (mobil) visar: Sök, Bokningar, Hästar + Mer-meny
- [ ] Mer-meny visar: Lediga tider, Gruppbokningar (om PÅ), Vanliga frågor, Min profil
- [ ] Desktop-nav visar alla menyval korrekt
- [ ] Aktiv sida markeras med grön färg

### 4.2 Sök och boka tjänster (`/providers`)

- [ ] Lista med leverantörer visas
- [ ] Filtrera på tjänstetyp fungerar
- [ ] Filtrera på avstånd/plats fungerar (om geolokation finns)
- [ ] Klicka på leverantör öppnar profil (`/providers/[id]`)
- [ ] Leverantörsprofilen visar: kontaktinfo, tjänster, priser, omdömen, verifierade kompetenser
- [ ] Bokningsdialog öppnas vid klick på "Boka"
- [ ] Steg 1: Välj tjänst
- [ ] Steg 2: Välj datum och tid
- [ ] Steg 3: Välj häst (om kunden har registrerade hästar)
- [ ] Steg 4: Bekräfta bokning
- [ ] Felmeddelande om man försöker boka sig själv (om kunden även är leverantör)
- [ ] Bokningen skapas med status "Väntande"

### 4.3 Mina bokningar (`/customer/bookings`)

- [ ] Lista visar alla bokningar
- [ ] Filtrera på status fungerar (Väntande, Bekräftad, Genomförd, Avbokad)
- [ ] Bokningsdetaljer visas vid klick
- [ ] Avboka en väntande bokning fungerar
- [ ] Bekräftelsemeddelande visas vid avbokning
- [ ] Betalning fungerar för bekräftade/genomförda bokningar (mock-betalning)
- [ ] Kvitto kan laddas ner efter betalning (format EQ-YYYYMM-XXXX)
- [ ] Ombokning fungerar om leverantören tillåter det

### 4.4 Lämna recension

- [ ] Efter genomförd bokning: knapp för att lämna recension
- [ ] Stjärnbetyg 1-5 kan väljas
- [ ] Textkommentar kan skrivas
- [ ] Recensionen visas på leverantörens profil

### 4.5 Mina hästar (`/customer/horses`)

- [ ] Lista visar alla registrerade hästar
- [ ] Lägg till ny häst: namn, ras, födelseår, kön, UELN, mikrochip, speciella behov
- [ ] Redigera hästuppgifter
- [ ] Hästdetaljer (`/customer/horses/[id]`) visar all info
- [ ] Hälsotidslinje visar historik från bokningar och anteckningar
- [ ] Exportera hästdata fungerar

### 4.6 Kundprofil (`/customer/profile`)

- [ ] Visa och redigera personuppgifter (namn, e-post, telefon)
- [ ] Adress och platsuppgifter
- [ ] Spara ändringar fungerar

### 4.7 Vanliga frågor (`/customer/faq`)

- [ ] Sidan laddas med FAQ-innehåll
- [ ] Frågor är relevanta och på svenska

### 4.8 Dataexport (`/customer/export`)

- [ ] GDPR-export kan begäras
- [ ] Exportfilen innehåller all persondata (JSON/CSV)

### 4.9 Följa leverantörer

- [ ] "Följ"-knapp på leverantörsprofil fungerar
- [ ] Avfölja fungerar

---

## 5. Leverantörsflöden

> Logga in med leverantörskonto för dessa tester.

### 5.1 Onboarding

- [ ] Ny leverantör ser onboarding-checklista på dashboard
- [ ] Checklistan guidar genom: profil, tjänster, öppettider

### 5.2 Dashboard (`/provider/dashboard`)

- [ ] KPI-kort visas (bokningar, intäkter, kunder)
- [ ] Stat-korten visar rimlig data
- [ ] Onboarding-checklista visas för nya leverantörer

### 5.3 Navigation

- [ ] Bottenmeny (mobil): Översikt, Kalender, Bokningar + Mer
- [ ] Mer-meny: Mina tjänster, Logga arbete (om PÅ), Ruttplanering (om PÅ), Rutt-annonser (om PÅ), Kunder, Besöksplanering (om PÅ), Gruppbokningar (om PÅ), Insikter (om PÅ), Recensioner, Min profil
- [ ] Desktop-nav visar primära och sekundära menyer korrekt

### 5.4 Mina tjänster (`/provider/services`)

- [ ] Lista visar alla tjänster
- [ ] Lägg till ny tjänst: namn, beskrivning, pris, varaktighet
- [ ] Redigera befintlig tjänst
- [ ] Aktivera/inaktivera tjänst

### 5.5 Bokningshantering (`/provider/bookings`)

- [ ] Lista visar inkommande bokningar
- [ ] Filtrera på status fungerar
- [ ] Acceptera en väntande bokning -> status ändras till "Bekräftad"
- [ ] Avböj en bokning -> status ändras till "Avböjd"
- [ ] Markera bokning som genomförd -> status ändras till "Genomförd"
- [ ] Markera som "ej infunnen" fungerar
- [ ] Anteckningar kan läggas till på en bokning
- [ ] Snabbanteckning (quick note) fungerar

### 5.6 Kalender (`/provider/calendar`)

- [ ] Veckoöversikt visas med bekräftade bokningar
- [ ] Navigera mellan veckor med pilknappar
- [ ] Klicka på veckodag visar/redigerar öppettider
- [ ] Klicka på datum öppnar dialog för tillgänglighetsundantag
- [ ] "+"-knapp för manuell bokning fungerar

### 5.7 Manuell bokning

- [ ] Sök efter befintlig kund
- [ ] Skapa bokning åt kund med tjänst, datum, tid
- [ ] Bokningen visas i kundens bokningslista

### 5.8 Kunder (`/provider/customers`)

- [ ] Lista visar alla kunder som bokat
- [ ] Sök bland kunder
- [ ] Klicka på kund visar detaljvy
- [ ] Kundens hästar visas
- [ ] Privata anteckningar (journal) kan skapas, redigeras, tas bort
- [ ] Kundhistorik (tidigare bokningar) visas

### 5.9 Hästtidslinje (`/provider/horse-timeline/[horseId]`)

- [ ] Tidslinje visar alla händelser för hästen
- [ ] Anteckningar och hälsoobservationer visas kronologiskt

### 5.10 Recensioner (`/provider/reviews`)

- [ ] Lista visar kundrecensioner
- [ ] Svara på en recension fungerar
- [ ] Genomsnittligt betyg visas

### 5.11 Leverantörsprofil (`/provider/profile`)

- [ ] Redigera företagsnamn, beskrivning, kontaktinfo
- [ ] Uppdatera adress (geokodning av plats)
- [ ] Ladda upp profilbild
- [ ] "Accepterar nya kunder"-toggle fungerar
- [ ] Spara ändringar

### 5.12 Verifiering (`/provider/verification`)

- [ ] Lista kompetenser/certifikat
- [ ] Skicka in verifieringsförfrågan
- [ ] Status visas (grå = väntande, grön = verifierad)

### 5.13 Exportera data (`/provider/export`)

- [ ] GDPR-export fungerar

---

## 6. Adminflöden

> Logga in med adminkonto för dessa tester.

### 6.1 Dashboard (`/admin`)

- [ ] KPI-kort: antal användare, bokningar, leverantörer, intäkter
- [ ] Siffrorna ser rimliga ut

### 6.2 Användare (`/admin/users`)

- [ ] Lista visar alla registrerade användare
- [ ] Sök på namn/e-post fungerar
- [ ] Filtrera på roll (kund/leverantör/admin)
- [ ] Blockera en användare fungerar
- [ ] Avblockera fungerar
- [ ] Tilldela admin-rättighet

### 6.3 Bokningar (`/admin/bookings`)

- [ ] Lista visar alla bokningar i systemet
- [ ] Sök/filtrera fungerar
- [ ] Admin kan avboka med anledning

### 6.4 Recensioner (`/admin/reviews`)

- [ ] Lista visar alla recensioner
- [ ] Moderera (ta bort) olämplig recension

### 6.5 Verifieringar (`/admin/verifications`)

- [ ] Lista visar väntande verifieringsförfrågningar
- [ ] Godkänn en förfrågan med kommentar
- [ ] Avslå en förfrågan med kommentar
- [ ] Status uppdateras på leverantörens profil

### 6.6 System (`/admin/system`)

- [ ] Databasstatus visas
- [ ] Feature flags kan togglas PÅ/AV (se [avsnitt 7](#7-feature-flaggade-funktioner))
- [ ] E-postinställningar visas

### 6.7 Notifikationer (`/admin/notifications`)

- [ ] Skicka massnotifikation till alla användare
- [ ] Skicka till alla kunder
- [ ] Skicka till alla leverantörer

### 6.8 Integrationer (`/admin/integrations`)

- [ ] Integrationssidan laddas
- [ ] Fortnox-integration visas (status)

---

## 7. Feature-flaggade funktioner

> Dessa funktioner styrs via feature flags i Admin > System. Testa genom att slå PÅ en i taget och verifiera att funktionen dyker upp korrekt.

### 7.1 Röstloggning (`voice_logging`)

**Leverantörssida: Logga arbete (`/provider/voice-log`)**
- [ ] Menyval "Logga arbete" visas när flaggan är PÅ
- [ ] Menyval försvinner när flaggan är AV
- [ ] Klicka på mikrofon startar inspelning (Chrome/Edge/Safari)
- [ ] Diktera arbete, t.ex. "Jag verkade alla fyra hovarna på Blansen"
- [ ] AI tolkar och matchar mot befintliga bokningar
- [ ] Hälsoobservationer kan läggas till
- [ ] Fallback till manuell textinmatning i Firefox
- [ ] Förslag på nästa besöksintervall visas

### 7.2 Ruttplanering (`route_planning`)

**Leverantörssida: Ruttplanering (`/provider/route-planning`)**
- [ ] Menyval "Ruttplanering" visas när flaggan är PÅ
- [ ] Menyval försvinner när flaggan är AV
- [ ] Skapa ny rutt med datum och stopp
- [ ] Kartvy visar stopp på karta
- [ ] Optimera ruttordning fungerar
- [ ] Restid mellan stopp beräknas
- [ ] Google Maps-navigation kan öppnas

**Rutter (`/provider/routes`)**
- [ ] Lista visar skapade rutter
- [ ] Ruttdetaljer visar alla stopp och status

### 7.3 Rutt-annonser (`route_announcements`)

**Leverantörssida: Rutt-annonser (`/provider/announcements`)**
- [ ] Menyval "Rutt-annonser" visas när flaggan är PÅ
- [ ] Menyval försvinner när flaggan är AV
- [ ] Skapa ny annons kopplad till en rutt
- [ ] Annons visar datum, område, lediga tider

**Kundsida: Lediga tider (`/announcements`)**
- [ ] Kunder ser annonserade rutter
- [ ] Klicka på annons -> kan boka en ledig tid via rutten
- [ ] Bokningsflödet (`/announcements/[id]/book`) fungerar

### 7.4 Besöksplanering / "Due for Service" (`due_for_service`)

**Leverantörssida: Besöksplanering (`/provider/due-for-service`)**
- [ ] Menyval "Besöksplanering" visas när flaggan är PÅ
- [ ] Menyval försvinner när flaggan är AV
- [ ] Lista visar hästar som är dags för besök baserat på intervall
- [ ] Intervall kan sättas per häst och tjänst
- [ ] Förfallna besök markeras tydligt

**Kundsida: Påminnelser**
- [ ] Kunder kan se kommande serviceintervall för sina hästar (`/customer/horses/[id]`)

### 7.5 Gruppbokningar (`group_bookings`)

**Kundsida: Gruppbokningar (`/customer/group-bookings`)**
- [ ] Menyval "Gruppbokningar" visas när flaggan är PÅ
- [ ] Menyval försvinner när flaggan är AV
- [ ] Skapa ny gruppbokning (`/customer/group-bookings/new`)
- [ ] Bjud in andra hästägare
- [ ] Anslut till befintlig gruppbokning (`/customer/group-bookings/join`)
- [ ] Gruppbokningsdetaljer (`/customer/group-bookings/[id]`)

**Leverantörssida: Gruppbokningar (`/provider/group-bookings`)**
- [ ] Lista visar inkommande gruppbokningar
- [ ] Matcha gruppbokning med rutt
- [ ] Gruppbokningsdetaljer (`/provider/group-bookings/[id]`)

### 7.6 Affärsinsikter (`business_insights`)

**Leverantörssida: Insikter (`/provider/insights`)**
- [ ] Menyval "Insikter" visas när flaggan är PÅ
- [ ] Menyval försvinner när flaggan är AV
- [ ] Grafer/diagram visar: populära tjänster, tidsanalys, kundretention
- [ ] Kundfrekvensanalys fungerar

**Kundinsikter (per kund)**
- [ ] AI-drivna insikter visas på kundens detaljsida (VIP-scoring, riskflaggor)

### 7.7 Återkommande bokningar (`recurring_bookings`)

- [ ] Seriealternativ visas i bokningsflödet när flaggan är PÅ
- [ ] Seriealternativ döljs när flaggan är AV
- [ ] Skapa återkommande serie (veckovis, varannan vecka, månadsvis)
- [ ] Visa serie-bokningar i bokningslistan
- [ ] Avbryt en hel serie

### 7.8 Offlineläge (`offline_mode`)

> Testa genom att stänga av nätverket (flygplansläge eller DevTools > Network > Offline)

- [ ] Leverantörens Översikt, Kalender och Bokningar fungerar offline (cacheade)
- [ ] Offlineindikator visas tydligt
- [ ] Ändringar (markera genomförd, uppdatera anteckning) köas lokalt
- [ ] Vid återanslutning synkas köade ändringar automatiskt
- [ ] Navigering till ej cacheade sidor visar offline-meddelande (inte krasch)
- [ ] Toast-meddelande "Du är offline" vid försök att navigera utan internet

---

## 8. Notifikationer & E-post

### In-app-notifikationer (`/notifications`)

- [ ] Olästa notifikationer visas med badge i header
- [ ] Klicka på klockan visar notifikationslista
- [ ] Markera som läst fungerar
- [ ] Notifikationer skapas vid:
  - [ ] Ny bokning (till leverantör)
  - [ ] Bokning accepterad/avböjd (till kund)
  - [ ] Bokning genomförd (till kund)
  - [ ] Bokning avbokad (till motpart)
  - [ ] Ny recension (till leverantör)

### E-postnotifikationer

- [ ] Verifieringsmail vid registrering
- [ ] Återställningsmail vid glömt lösenord
- [ ] Bokningsbekräftelse
- [ ] Bokningspåminnelse (24 timmar innan)
- [ ] Avprenumerera-länk fungerar (`/api/email/unsubscribe`)

---

## 9. Mobil & Responsivitet

> Testa på en riktig telefon eller med DevTools i mobilt läge (375px bred).

### Generellt

- [ ] Alla sidor är användbara på mobilskärm
- [ ] Bottenmeny (tabs) visas på mobil, döljs på desktop
- [ ] Desktop-nav visas på desktop, döljs på mobil
- [ ] "Mer"-drawer öppnas smidigt på mobil
- [ ] Knappar och klickbara ytor är minst 48px höga (tumvänliga)
- [ ] Formulär fungerar med mobilt tangentbord
- [ ] Modaler/dialoger är scrollbara om innehållet inte ryms

### PWA (Progressive Web App)

- [ ] "Installera app"-prompt visas (Android Chrome)
- [ ] Appen kan installeras till hemskärmen
- [ ] Installerad app öppnas i helskärm utan adressfält
- [ ] App-ikon visas korrekt

---

## 10. Gradvis utrullning - Checklista

### Fas 1: Intern testning (nuvarande fas)

- [ ] Alla avsnitt ovan är genomgångna och markerade
- [ ] Inga kritiska buggar kvar
- [ ] E-post fungerar korrekt i produktion
- [ ] Feature flags fungerar via admin-panel

### Fas 2: Closed alpha (5-10 användare)

Rekommenderade feature flags för alpha:

| Feature flag | Rekommendation | Kommentar |
|--------------|---------------|-----------|
| `voice_logging` | PÅ | Kärn-USP, testa med riktiga leverantörer |
| `route_planning` | PÅ | Viktigt för leverantörer |
| `route_announcements` | PÅ | Kopplat till ruttplanering |
| `due_for_service` | PÅ | Bra värde direkt |
| `group_bookings` | AV | Komplex feature, testa mer först |
| `business_insights` | PÅ | Read-only, låg risk |
| `recurring_bookings` | AV | Komplex, behöver mer testning |
| `offline_mode` | AV | Testa med utvalda leverantörer |

**Uppgifter innan alpha:**
- [ ] Bjud in 2-3 leverantörer som du har kontakt med
- [ ] Bjud in 3-5 hästägare (gärna kunder till inbjudna leverantörer)
- [ ] Upprätta enkel feedbackkanal (t.ex. formulär, e-post, chatt)
- [ ] Övervaka felloggar (Sentry) dagligen under första veckan
- [ ] Ha plan för hur man snabbt kan stänga av funktioner vid problem

### Fas 3: Open beta

**Uppgifter innan beta:**
- [ ] Alpha-feedback bearbetad och kritiska problem fixade
- [ ] Betalningsintegration på plats (Swish/Stripe)
- [ ] Integritetspolicy och användarvillkor juridiskt granskade
- [ ] Kontodeletionsfunktion implementerad (GDPR Art. 17)
- [ ] Lasttest genomfört och godkänt
- [ ] Övervakning och larm uppsatt (uptime, felfrekvens)

---

## Testlogg

Använd denna tabell för att dokumentera testresultat:

| Datum | Testare | Avsnitt | Status | Kommentar |
|-------|---------|---------|--------|-----------|
| | | | | |
| | | | | |
| | | | | |

### Statusnyckel

- **OK** - Fungerar som förväntat
- **Bugg** - Funktion trasig, beskriv i kommentar
- **UX** - Fungerar men dålig upplevelse, beskriv
- **Ej testat** - Kunde inte testas (t.ex. saknar testdata)
- **N/A** - Ej tillämpligt (feature flag av, etc.)

---

## Tips för effektiv testning

1. **Testa "happy path" först** - gör det en normalanvändare gör
2. **Testa sedan edge cases** - tomma fält, specialtecken, lång text
3. **Testa på mobil** - de flesta hästägare/leverantörer kommer använda mobil ute i stallet
4. **Notera allt** - även om det "bara" är en känsla av att något är krångligt
5. **Testa flöden, inte bara sidor** - t.ex. hela kedjan: sök -> boka -> bekräfta -> genomför -> recensera -> betala
6. **Växla mellan roller** - boka som kund, hantera som leverantör, moderera som admin

---

*Denna guide täcker appens funktioner per 2026-02-24. Uppdatera vid ny funktionalitet.*
