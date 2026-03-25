---
title: Demo Readiness
description: Bedömning av vad som är demo-bart idag och vad som krävs för en trovärdig demo
category: product-audit
status: active
last_updated: 2026-03-25
sections:
  - Rekommenderade demoflöden
  - Förutsättningar
  - Vad som bör doljas
  - Åtgärder före demo
  - Alternativa demostrategier
---

# Demo Readiness -- Equinet

> Bedömning per 2026-03-25. Baserad på kodinventering, inte manuell verifiering.
> **VIKTIGT**: Inget av detta är verifierat genom att faktiskt kora applikationen.
> Rekommendation: Kor igenom varje flöde manuellt INNAN demo.

---

## Rekommenderade demoflöden

### Demo 1: Leverantorens vardag (BAST för demo)

**Varför**: Mest komplett flöde, minst beroende på externa tjänster, visar kärnvärdet.

**Berättelse**: "En hovslagare använder Equinet för att hantera sin verksamhet."

| Ordning | Steg | Tid | Risk |
|---------|------|-----|------|
| 1 | Logga in som leverantör | 30s | Låg |
| 2 | Se dashboard med statistik + väntande bokningar | 30s | Låg |
| 3 | Gå till kundregistret, visa kundinformation | 1 min | Låg |
| 4 | Skapa en manuell bokning för en kund | 1 min | Låg |
| 5 | Gå till bokningslistan, bekräfta bokningen | 30s | Låg |
| 6 | Slutför bokningen | 30s | Låg |
| 7 | Visa kalender-/schemavy | 30s | Medel |
| 8 | Visa tjänster som leverantören erbjuder | 30s | Låg |
| 9 | Visa "besöksplanering" (hästar som behöver service) | 30s | Låg |

**Total tid**: ~5-6 minuter
**Förutsättningar**: Seed-data med leverantör + kunder + hästar + några bokningar.

---

### Demo 2: Kundens bokningsresa

**Varför**: Visar kundsidan -- hitta leverantör, boka, hantera.

**Berättelse**: "En hästägare hittar och bokar en hovslagare."

| Ordning | Steg | Tid | Risk |
|---------|------|-----|------|
| 1 | Logga in som kund | 30s | Låg |
| 2 | Visa "Mina hästar" -- hästprofil med detaljer | 1 min | Låg |
| 3 | Se leverantörssök (FOrberedd med seed-data) | 1 min | MEDEL -- Mapbox? |
| 4 | Välj leverantör, se profil + recensioner | 30s | Låg |
| 5 | Boka en tjänst | 1 min | Låg |
| 6 | Gå till "Mina bokningar", se bokningen | 30s | Låg |
| 7 | Omboka bokningen till annan tid | 30s | Låg |

**Total tid**: ~5 minuter
**Förutsättningar**: Seed-data med leverantör som har tjänster + schema. Mapbox-token för leverantörssök (ELLER visa förberedd lista).

---

### Demo 3: Admin-översikt

**Varför**: Snabb, enkel att visa, minimal risk.

**Berättelse**: "Plattformsadmin övervakar verksamheten."

| Ordning | Steg | Tid | Risk |
|---------|------|-----|------|
| 1 | Logga in som admin | 30s | Låg |
| 2 | Se plattformsstatistik (användare, bokningar) | 30s | Låg |
| 3 | Visa användarhantering med sök | 30s | Låg |
| 4 | Visa feature flag-panel, togglea en flägga | 30s | Låg |
| 5 | Visa buggrapporter | 30s | Låg |

**Total tid**: ~2-3 minuter

---

## Rekommenderad demo-ordning

1. **Demo 1** (leverantör) -- visar kärnvärdet, låg risk
2. **Demo 2** (kund) -- visar användarresan, medelhög risk
3. **Demo 3** (admin) -- visar plattformskontroll, låg risk

**Totalt**: ~12-14 minuter

---

## Förutsättningar

### Absolut nödvändigt

| # | Åtgärd | Anledning | Uppskattad insats |
|---|--------|-----------|------------------|
| 1 | **Seed-data i demo-databas** | Tomma listor = dödflödd demo | 2-4 timmar |
| 2 | **Verifiera inloggning fungerar** | Auth är grunden för allt | 30 min |
| 3 | **Manuell genomkorning av Demo 1** | Hitta trasiga vyer/tomt state | 2-3 timmar |
| 4 | **Feature flags korrekt satta** | Halvfärdiga features måste vara OFF | 30 min |

### Starkt rekommenderat

| # | Åtgärd | Anledning | Uppskattad insats |
|---|--------|-----------|------------------|
| 5 | Mapbox-token konfigurerad | Leverantörssök + kartor | 30 min |
| 6 | Profilbilder för seed-leverantörer | Trovardigare utseende | 1-2 timmar |
| 7 | Realistiska tjänstenamn + priser | "Hovslagning 1500 kr, 45 min" | 1 timme |

---

## Seed-data för demo

En trovärdig demo kräver minst:

```
Leverantörer (3 st):
- "Anna Andersson Hovslägeri" -- Göteborg, hovslagning + akutbesok
- "Erik Eriksson Hastvard" -- Kungalv, tandvard + vaccinering
- "Maria Johansson Ridskola" -- Molndal, ridlektioner

Kunder (2 st):
- "Sofia Berg" -- 2 hästar, 3 tidigare bokningar
- "Lars Nilsson" -- 1 hast, 1 aktiv bokning

Hästar (3 st):
- "Blansen" -- Svenskt varmblod, sto, 2018
- "Storm" -- Islandsponny, valack, 2015
- "Pransen" -- Connemara, sto, 2020

Bokningår (5 st):
- 2 slutförda (med recensioner)
- 1 bekräftad (framtida)
- 1 väntande (för demo av bekräftelse)
- 1 manuellt skapad

Recensioner (2 st):
- "Anna" har 4.5 i snitt, 2 recensioner
```

**OBS**: Seed-skriptet (`prisma/seed.ts`) skapar redan 5 test-leverantörer men med generiska namn. Det kan behöva anpassas för demo.

---

## Vad som bör doljas eller undvikas i demo

### Dolj (sta INTE i dessa vyer)

| Vy/Feature | Anledning |
|------------|-----------|
| Ruttplanering (`/provider/routes`) | Kräver Mapbox + OSRM. Komplex, risk för tomma kartor |
| Ruttannonser (`/provider/announcements`) | Beror på ruttplanering |
| Betalning (Stripe) | Mock-provider visar "mock" i UI. Stripe kräver konfiguration |
| Stallhantering (`/stable/*`) | Feature flåg OFF. Ej testad i prod |
| Offlineläge | Kräver HTTPS + Service Worker. Svart att demonstrera |
| Rostloggning (`/provider/voice-log`) | Kräver AI-tjänst. Risk för fel |
| Integrationer (Fortnox) | Kräver extern tjänst |
| Kundinsikter | Markerad "AI" men oklart om faktisk AI är kopplad |
| Push-notiser | Feature flåg OFF, kräver APNs |
| Leverantörsprenumeration | Feature flåg OFF, kräver Stripe |

### Vär forsiktig med

| Vy/Feature | Risk |
|------------|------|
| Leverantörssök | Tomt om inga leverantörer matchar geosök |
| Kalendervy | Kan se tom ut utan bokningar |
| Notiser | Kan vara tomma |
| Gruppbokningar | Feature on men komplext flöde |
| Recensioner | Tomma utan seed-data |

---

## Åtgärder före demo (prioritetsordning)

### P0 -- Måste fixas

1. **Skapa demo-seed-script**: Ett dedicerat `prisma/seed-demo.ts` med realistisk data (se ovan).
2. **Manuell genomkorning**: Kor igenom alla tre demo-flödena manuellt, notera buggar.
3. **Verifiera att alla ON-fläggör fungerar**: Kor `npm run flags:validate` och granska output.
4. **Fixa eventuella tomma states**: Säker på att "inga bokningar" / "inga kunder" visar vanligt meddelande, inte en krasch.

### P1 -- Bör fixas

5. **Konfigurera Mapbox-token**: För leverantörssök. Alternativt: hårdkoda sökresultat i demo.
6. **Verifiera responsiv design**: Demo på laptop -- säker på att inget är trasigt på desktop.
7. **Stänga av felaktiga feature flags**: `stable_profiles`, `push_notifications`, `provider_subscription` -- konfirmera att de är OFF.

### P2 -- Nice to have

8. **Profilbilder**: Lägg till bilder på leverantörer för trevligare UI.
9. **Ta bort dev-banners**: Säker på att inga "development mode"-banners visas.
10. **Förbered fallback**: Ha screenshots av kritiska sidor om något går snett live.

---

## Alternativa demostrategier

### Strategi A: Live demo (rekommenderat)

Kor applikationen live på Vercel eller lokalt. Visa de tre flödena i ordning.

**Fördelar**: Autentiskt, visar att det fungerar.
**Risker**: Nagot kan ga snett. Tomma states. Laddtider.

### Strategi B: Video / Screenshots

Spela in en video av de tre flödena i förhand. Visa video i demo.

**Fördelar**: Kontrollerat, ingen risk för live-buggar.
**Risker**: Mindre imponerande. Kan se "fejkat" ut.

### Strategi C: Hybrid

Visa live för leverantörs-flödet (lägst risk), screenshots/video för kundflödet (Mapbox-beroende).

**Fördelar**: Bästa av bada. Sparar tid.

---

## Sammanfattande bedömning

**Equinet är demo-bart för leverantörs-flödet redan idag**, förutsatt att:
1. Det finns rimlig seed-data i databasen
2. Inloggning fungerar
3. Feature flags är korrekt satta

**Kundflödet är demo-bart med förbehåll** -- leverantörssök kräver Mapbox-token eller förberedd data.

**INTE demo-bart idag**: Ruttplanering, betalning (Stripe), stallhantering, offline, rostloggning, push-notiser.

**Storsta risken**: Att vi inte har kort igenom flödet manuellt och att det finns dolda buggar i UI som inte täcks av enhetstester (tomma states, trasiga dialoger, felaktiga navigeringslänkar).
