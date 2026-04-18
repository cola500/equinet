---
title: "Release-checklista"
description: "Manuell verifieringschecklista att köra före varje större lansering av Equinet"
category: testing
status: active
last_updated: 2026-04-18
tags: [release, checklist, qa, manual-testing]
sections:
  - Automatiska gates (kör först)
  - Kritiska flöden
  - Feature-specifika flöden
  - Pre-launch-blockerare
  - Godkänn och signera av
---

# Release-checklista

> Kör denna checklista manuellt FÖRE varje större lansering.
> Automatiska gates körs alltid först -- manuell verifiering kompletterar, ersätter inte.

---

## Automatiska gates (kör först)

Kör innan manuell verifiering. Alla MÅSTE vara gröna.

```bash
npm run check:all          # typecheck + test:run + lint + check:swedish
bash scripts/rls-proof-tests.sh   # RLS-policies (28 policies, 24 bevistester)
npm run test:e2e:smoke     # Smoke: app startar, login fungerar
npm run test:e2e:critical  # Kritiska flöden: bokning, betalning, leverantör
npm run migrate:status     # Inga pending migrationer mot Supabase
```

Gå INTE vidare om något gate är rött.

---

## Kritiska flöden

### 1. Registrering och e-postverifiering

| Steg | Var att klicka | Förväntat resultat |
|------|---------------|--------------------|
| Registrera ny kund | /register -> Hästägare | Verifieringsmail skickas |
| Verifiera e-post | Länk i mail | Konto aktiverat, omdirigeras till inloggning |
| Logga in som kund | /login | Omdirigeras till /providers |
| Registrera ny leverantör | /register -> Tjänsteleverantör | Verifieringsmail skickas |
| Logga in som leverantör | /login | Omdirigeras till /provider/dashboard |

### 2. Leverantör: fullständig bokningscykel

| Steg | Var att klicka | Förväntat resultat |
|------|---------------|--------------------|
| Lägg till tjänst | Provider -> Tjänster -> + | Tjänst skapas och visas |
| Sätt öppettider | Provider -> Kalender -> Redigera öppettider | Tider sparas |
| Kund bokar | Providers -> välj leverantör -> Boka | Bokning skapas, status "Väntande" |
| Leverantör accepterar | Provider -> Bokningar -> Acceptera | Status "Bekräftad" |
| Leverantör genomför | Provider -> Bokningar -> Genomförd | Status "Genomförd" |
| Kund lämnar recension | Kund -> Mina bokningar -> Lämna omdöme | Recension sparad |
| Leverantör svarar | Provider -> Recensioner -> Svara | Svar visas under recensionen |

### 3. Kund bokar hos leverantör

| Steg | Var att klicka | Förväntat resultat |
|------|---------------|--------------------|
| Hitta leverantör | /providers -> sök | Lista med leverantörer |
| Se profil | Klicka på leverantör | Profil med tjänster och lediga tider |
| Boka | Välj tjänst -> datum -> tid -> bekräfta | Bokning skapad |
| Se bokning | Kund -> Mina bokningar | Bokning i lista med rätt status |

### 4. Admin MFA (enrollment + verifiering)

| Steg | Var att klicka | Förväntat resultat |
|------|---------------|--------------------|
| Gå till MFA-setup | /admin/mfa/setup | Sida laddas med "Aktivera MFA"-knapp |
| Enrollera | Klicka "Aktivera" | QR-kod visas |
| Skanna och verifiera | Autentiseringsapp -> 6-siffrig kod | "MFA aktiverat" |
| Logga ut och in | /login -> admin | Verifieringssida visas efter lösenord |
| Ange TOTP-kod | Kod från autentiseringsapp | Inloggad i admin-panel |

---

## Feature-specifika flöden

### Offline-flöde (webb PWA)

Kräver att `offline_mode`-flaggan är PÅ.

| Steg | Var att klicka | Förväntat resultat |
|------|---------------|--------------------|
| Ladda sidan online | /provider/bookings | Data visas och cachas |
| Koppla från nät | Devtools -> Offline ELLER flytta till täckningsfritt | Gul banner: "Du är offline" |
| Navigera i cached data | Bokningar, Kalender | Data visas från cache (max 4h) |
| Gör ändringar offline | Markera bokning som klar | Gul badge: "Väntar på synk" |
| Återanslut | Aktivera nät igen | Grön banner, synk sker automatiskt |

### Offline-flöde (iOS native)

| Steg | Var | Förväntat resultat |
|------|-----|--------------------|
| Stäng av nät | iPhone -> Flygplansläge | Gul offline-banner i appen |
| Se cached bokningar | Native bokningslista | Bokningar visas |
| Återanslut | Stäng av flygplansläge | Grön "Återansluten"-banner |

### Hjälpcentral

| Steg | Var att klicka | Förväntat resultat |
|------|---------------|--------------------|
| Öppna hjälp | Provider -> ? (hjälp-ikon) | Hjälpcentralen öppnas |
| Sök artikel | Sökfält -> "bokningar" | Relevanta artiklar visas |
| Öppna artikel | Klicka på artikel | Artikel renderas korrekt |
| Rollspecifikt innehåll | Logga in som kund -> hjälp | Kund-artiklar visas (ej provider-artiklar) |

### Ruttplanering

| Steg | Var att klicka | Förväntat resultat |
|------|---------------|--------------------|
| Skapa rutt | Provider -> Rutter -> + | Formulär öppnas |
| Lägg till stopp | Ange adress | Stopp läggs till, karta uppdateras |
| Optimera | Klicka "Optimera" | Stopp ordnas om, restid beräknas |
| Karta renderas | Se kartvy | Karta med stopp visas (Leaflet) |

### Onboarding-wizard

| Steg | Var att klicka | Förväntat resultat |
|------|---------------|--------------------|
| Ny leverantör loggar in | /provider/dashboard | Onboarding-checklista visas |
| Fyll i profil | Steg 1 | Profildata sparad, steg bockas av |
| Lägg till tjänst | Steg 2 | Tjänst skapad, steg bockas av |
| Sätt öppettider | Steg 3 | Tider sparade, steg bockas av |
| Slutför | Alla steg klara | Checklista försvinner |

### Återkommande bokningar

Kräver att `recurring_bookings`-flaggan är PÅ och att leverantören har aktiverat serier.

| Steg | Var att klicka | Förväntat resultat |
|------|---------------|--------------------|
| Aktivera serier | Provider -> Profil -> Återkommande | Toggle PÅ, välj max tillfällen |
| Kund skapar serie | Boka -> "Gör detta återkommande" | Intervall och antal väljs |
| Bekräfta serie | Bekräfta | Alla bokningstillfällen skapas |
| Resultatsida | Se resultat | X av X bokningar skapade, eventuella hopp förklaras |
| Avbryt ett tillfälle | Bokningslista -> avboka | Enbart det tillfället avbokas, serien intakt |

---

## Pre-launch-blockerare

Dessa måste vara lösta INNAN publik lansering. Kontrollera status.

| Blockerare | Status | Åtgärd |
|-----------|--------|--------|
| Apple Developer Program (99 USD/år) | Ej köpt | Krävs för push-notiser i iOS App Store |
| Stripe live-mode | Ej konfigurerat | Krävs för riktiga betalningar (test-mode OK för beta) |
| Vercel Pro ($20/mån) | Ej uppgraderat | Krävs för kommersiellt bruk (Hobby tillåter ej) |

---

## Godkänn och signera av

| Gate | OK? | Signerat av | Datum |
|------|-----|------------|-------|
| Automatiska gates (alla gröna) | | | |
| Kritiska flöden (alla checkpoints) | | | |
| Feature-specifika flöden | | | |
| Pre-launch-blockerare hanterade | | | |
| **Redo för lansering** | | | |
