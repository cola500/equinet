---
title: User Flows
description: De viktigaste användarflödena i Equinet -- steg, status och blockerare
category: product-audit
status: active
last_updated: 2026-03-25
sections:
  - Sammanfattning
  - Leverantorsflöden
  - Kundflöden
  - Delade flöden
  - Adminflöden
---

# User Flows -- Equinet

> Varje flöde bedoms med: **Komplett** / **Delvis** / **Brutet** / **Saknas**
> "Komplett" = alla steg har kod + UI + API. Inte verifierat i produktion.

---

## Sammanfattning

| # | Flöde | Roll | Status | Demo-bart? |
|---|-------|------|--------|------------|
| 1 | Registrering & Inloggning | Alla | Komplett | Ja |
| 2 | Leverantör: Onboarding | Leverantör | Komplett | Ja |
| 3 | Leverantör: Hantera bokningar | Leverantör | Komplett | Ja |
| 4 | Leverantör: Skapa manuell bokning | Leverantör | Komplett | Ja |
| 5 | Kund: Hitta leverantör | Kund | Delvis | Med förbehåll |
| 6 | Kund: Boka tjänst | Kund | Komplett | Ja |
| 7 | Kund: Hantera hästar | Kund | Komplett | Ja |
| 8 | Kund: Omboka / Avboka | Kund | Komplett | Ja |
| 9 | Kund: Skriv recension | Kund | Komplett | Ja |
| 10 | Gruppbokning | Kund | Delvis | Med förbehåll |
| 11 | Ruttplanering + Annonsering | Leverantör | Delvis | Nej |
| 12 | Återkommande bokningar | Leverantör | Komplett | Ja |
| 13 | Betalning | Kund | Delvis | Nej (mock ok?) |
| 14 | Stallhantering | Stallägare | Delvis | Nej |

---

## Leverantorsflöden

### Flöde 1: Registrering & Inloggning

**Roll**: Leverantör / Kund
**Status**: **Komplett**

| Steg | Beskrivning | Startpunkt | Slutpunkt |
|------|-------------|-----------|-----------|
| 1 | Besök `/register` | Landningssida | Registreringsformulär |
| 2 | Välj roll (kund/leverantör) | Registreringsformulär | Rolval |
| 3 | Fyll i namn, email, lösenord | Rolval | Verifieringsmail skickat |
| 4 | Klicka verifieringslanken i email | Email | Inloggad + dashboard |

**Alternativt**: Logga in via `/login` med email + lösenord.

**Blockerare**:
- Email-utskick kräver konfigurerad SMTP (env: `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`). Utan SMTP skapas kontot men verifieringsmail kommer inte.
- **Workaround för demo**: Manuellt satt `emailVerified: true` i databasen, eller skippa email-verifiering.

---

### Flöde 2: Leverantör Onboarding

**Roll**: Leverantör
**Status**: **Komplett**

| Steg | Beskrivning | Startpunkt | Slutpunkt |
|------|-------------|-----------|-----------|
| 1 | Logga in som leverantör | `/login` | `/provider/dashboard` |
| 2 | Se onboarding-checklista | Dashboard | Checklista med steg |
| 3 | Fyll i foretags-/profilinfo | `/provider/profile` | Sparad profil |
| 4 | Lägg till tjänster | `/provider/services` | Tjänster skapade |
| 5 | Satt tillgänglighetsschema | `/provider/profile?tab=availability` | Schema sparat |
| 6 | (Valfritt) Lägg till första kund | `/provider/customers` | Kund skapad |

**Blockerare**:
- Inga härda blockerare. Onboarding-status trackas via `/api/provider/onboarding-status`.
- Profilbild kräver filuppladdning (`/api/upload`), som i sin tur kräver konfigurerad blob storage.

---

### Flöde 3: Leverantör Hanterar Bokningar

**Roll**: Leverantör
**Status**: **Komplett**

| Steg | Beskrivning | Startpunkt | Slutpunkt |
|------|-------------|-----------|-----------|
| 1 | Se alla bokningar | `/provider/bookings` | Bokningslista |
| 2 | Filtrera på status | Bokningslista | Filtrerad vy |
| 3 | Bekräfta bokning | Bokningsrad -> "Bekräfta" | Status: confirmed |
| 4 | Slutför bokning | Bekräftad bokning -> "Slutfor" | Status: completed |
| 5 | (Valfritt) Skriv kundrecension | Efter slutförd | Recension skapad |
| 6 | (Valfritt) Avboka | Bokning -> "Avboka" | Status: cancelled |

**Blockerare**: Inga. Statusövergångår är tydligt implementerade.

---

### Flöde 4: Leverantör Skapar Manuell Bokning

**Roll**: Leverantör
**Status**: **Komplett**

| Steg | Beskrivning | Startpunkt | Slutpunkt |
|------|-------------|-----------|-----------|
| 1 | Klicka "Ny bokning" | `/provider/bookings` | Bokningsformulär |
| 2 | Välj kund (eller skapa ny) | Formulär | Kund vald |
| 3 | Välj tjänst, datum, tid | Formulär | Tjänst + tid vald |
| 4 | (Valfritt) Välj hast | Formulär | Hast vald |
| 5 | Spara | Formulär | Bokning skapad (status: confirmed) |

**Blockerare**: Inga. Ghost-kunder (utan konto) stods.

---

### Flöde 11: Ruttplanering + Annonsering

**Roll**: Leverantör
**Status**: **Delvis**

| Steg | Beskrivning | Startpunkt | Slutpunkt |
|------|-------------|-----------|-----------|
| 1 | Skapa ruttannons | `/provider/announcements/new` | Annons skapad |
| 2 | Lägg till stopp/platser | Annonseringsformulär | Stopp tillagda |
| 3 | Publicera | Annons -> publicera | Publik på `/announcements` |
| 4 | Kunder som följer/bevakar får notis | Automatiskt | Notis levererad |
| 5 | Kund bokar via annons | `/announcements/[id]/book` | Bokning skapad |

**Blockerare**:
- Kartrendering och avståndsberäkning kräver Mapbox-token
- Ruttoptimering kräver OSRM-tjänst
- Notis-leverans beror på follow/municipality_watch-fläggor
- Komplext flöde med många beroenden -- svårt att demo:a isolerat

---

## Kundflöden

### Flöde 5: Kund Hittar Leverantör

**Roll**: Kund
**Status**: **Delvis**

| Steg | Beskrivning | Startpunkt | Slutpunkt |
|------|-------------|-----------|-----------|
| 1 | Besök leverantörssök | `/providers` | Sokvy |
| 2 | (Valfritt) Filtrera på plats/tjänst | Sokvy | Filtrerade resultat |
| 3 | Klicka på leverantör | Resultatlista | `/providers/[id]` |
| 4 | Se profil, tjänster, recensioner | Leverantörsprofil | Profilinformation |
| 5 | Se tillgänglighet | Leverantörsprofil | Kalendervy |

**Blockerare**:
- **Seed-data**: Utan leverantörer i databasen visas tom lista. Seed-skriptet skapar 5 test-leverantörer men dessa är i specifika städer (Göteborg, Stockholm, etc).
- **Geocoding**: Platsfiltrering kräver Mapbox. Utan token fungerar inte avstandsbaserad sökning.
- **Tom state**: Om inga leverantörer matchar visas förmodligen tom sida -- oklart om det finns ett "inga resultat"-meddelande.

---

### Flöde 6: Kund Bokar Tjänst

**Roll**: Kund
**Status**: **Komplett**

| Steg | Beskrivning | Startpunkt | Slutpunkt |
|------|-------------|-----------|-----------|
| 1 | Hitta leverantör | `/providers` | Leverantörsprofil |
| 2 | Välj tjänst | Leverantörsprofil | Tjänst vald |
| 3 | Välj datum + tid | Bokningsformulär | Tid vald |
| 4 | (Valfritt) Välj hast | Bokningsformulär | Hast vald |
| 5 | Bekräfta bokning | Bokningsformulär | Bokning skapad (status: pending) |
| 6 | Vänta på leverantörsbekräftelse | Bokningslista | Status: confirmed |

**Blockerare**:
- Beror på Flöde 5 (hitta leverantör). Om det fungerar är själva bokningen robust (överlappskontroll, tidsvalidering).
- Betalning sker efter bokning (mock-provider som default).

---

### Flöde 7: Kund Hanterar Hästar

**Roll**: Kund
**Status**: **Komplett**

| Steg | Beskrivning | Startpunkt | Slutpunkt |
|------|-------------|-----------|-----------|
| 1 | Navigera till "Mina hästar" | `/customer/horses` | Hastlista |
| 2 | Klicka "Lägg till hast" | Hastlista | Formulär |
| 3 | Fyll i namn, ras, födelseår, kon, specialbehov | Formulär | Hast skapad |
| 4 | Se hastdetalj + tidslinje | `/customer/horses/[id]` | Tidslinje |
| 5 | (Valfritt) Dela hästprofil | Hastdetalj -> "Dela" | Delningslank |

**Blockerare**: Inga. Enkel CRUD.

---

### Flöde 8: Kund Ombokar / Avbökar

**Roll**: Kund
**Status**: **Komplett**

| Steg | Beskrivning | Startpunkt | Slutpunkt |
|------|-------------|-----------|-----------|
| 1 | Se bokningar | `/customer/bookings` | Bokningslista |
| 2 | Välj bokning | Bokningslista | Bokningsdetalj |
| 3a | Ombokning: Välj ny tid | Ombokningsdialog | Ombokning begard |
| 3b | Avbokning: Bekräfta | Avbokningsdialog | Status: cancelled |

**Blockerare**: Inga. Feature-fläggat (`self_reschedule`) men ON som default.

---

### Flöde 9: Kund Skriver Recension

**Roll**: Kund
**Status**: **Komplett**

| Steg | Beskrivning | Startpunkt | Slutpunkt |
|------|-------------|-----------|-----------|
| 1 | Se slutförd bokning | `/customer/bookings` | Slutförd bokning |
| 2 | Klicka "Skriv recension" | Bokningsdetalj | Recensionsformulär |
| 3 | Ge betyg (1-5) + kommentar | Formulär | Recension skapad |
| 4 | Leverantör kan svara | Leverantörs recensions-vy | Svär publicerat |

**Blockerare**: Kräver att en bokning har status "completed".

---

### Flöde 10: Gruppbokning

**Roll**: Kund
**Status**: **Delvis**

| Steg | Beskrivning | Startpunkt | Slutpunkt |
|------|-------------|-----------|-----------|
| 1 | Skapa gruppbokning | `/customer/group-bookings/new` | Formulär |
| 2 | Fyll i tjänst, plats, datum, max deltagare | Formulär | Gruppbokning skapad |
| 3 | Dela inbjudningskod | Gruppbokning -> kod | Kod kopierad |
| 4 | Ändra deltagare går med | `/customer/group-bookings/join` | Deltagare tillagd |
| 5 | Leverantör matchar | Leverantörens vy | Bokningår skapade |

**Blockerare**:
- Matchningslogik finns men oklart hur leverantör "upptacker" gruppförfrågan
- Geocoding kräver Mapbox för platssökning
- Feature-fläggat (`group_bookings`, ON som default)

---

### Flöde 12: Återkommande bokningar

**Roll**: Leverantör
**Status**: **Komplett**

| Steg | Beskrivning | Startpunkt | Slutpunkt |
|------|-------------|-----------|-----------|
| 1 | Skapa bokningsserie | Bokningsformulär | Serie skapad |
| 2 | Välj kund, tjänst, intervall, antal | Formulär | Parametrar satta |
| 3 | Bokningår genereras automatiskt | Automatiskt | N bokningar skapade |
| 4 | (Valfritt) Avbryt serie | Serie-detalj | Serie avbruten |

**Blockerare**: Feature-fläggat (`recurring_bookings`, ON som default). Implementerat och mergat.

---

## Delade flöden

### Flöde 13: Betalning

**Roll**: Kund
**Status**: **Delvis**

| Steg | Beskrivning | Startpunkt | Slutpunkt |
|------|-------------|-----------|-----------|
| 1 | Bokning slutförd | Bokningsdetalj | Betalningsknapp |
| 2 | Välj betalmetod | Dialog | Mock / Stripe |
| 3 | Genomfor betalning | Betalningsflöde | Betald |
| 4 | Ladda ner kvitto | Bokningsdetalj | Kvitto-PDF |

**Blockerare**:
- Mock-provider fungerar utan konfiguration
- Stripe kräver env-variabler + konfigurerade produkter
- Swish-betalning är bara ett enum, ingen implementation
- Kvittogenerering finns (HTML-baserad)

---

## Adminflöden

### Flöde: Admin Dashboard

**Roll**: Admin
**Status**: **Komplett**

| Steg | Beskrivning | Startpunkt | Slutpunkt |
|------|-------------|-----------|-----------|
| 1 | Logga in som admin | `/login` | `/admin` |
| 2 | Se plattformsstatistik | Dashboard | Statistik |
| 3 | Hantera användare | `/admin/users` | Anvandarvy |
| 4 | Hantera feature flags | `/admin/system` | Fläggör togglade |
| 5 | Granska recensioner | `/admin/reviews` | Moderation |
| 6 | Se buggrapporter | `/admin/bug-reports` | Bugg-lista |

**Blockerare**: Kräver `isAdmin: true` på användaren. Seed-data skapar en admin-användare.

---

## Kritiska beroenden för flödeskomplettering

| Beroende | Påverkar flöden | Konfiguration |
|----------|----------------|---------------|
| SMTP-server | Registrering, inbjudningar, pasord-återställning | `EMAIL_HOST/USER/PASS` |
| Mapbox API | Leverantörssok, ruttplanering, gruppbokningar | `MAPBOX_ACCESS_TOKEN` |
| Stripe | Betalning, prenumeration | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| OSRM | Ruttoptimering | Extern tjänst-URL |
| APNs | Push-notiser (iOS) | Apple Developer cert |
| Blob storage | Profilbilder, hästfoton | Vercel Blob config |
| AI-tjänst | Kundinsikter, rostloggning | OpenAI API-nyckel (?) |
