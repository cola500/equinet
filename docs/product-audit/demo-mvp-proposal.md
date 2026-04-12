---
title: Demo MVP Proposal
description: Minimal demo-MVP baserad på befintlig kod -- vad vi visar, vad vi fixar, vad vi döljer
category: product-audit
status: active
last_updated: 2026-03-25
sections:
  - Demo-MVP i en mening
  - Primär målgrupp
  - De 3 flödena vi visar
  - Vad som absolut måste fungera
  - Vad vi fejkar med seed-data
  - Vad vi inte visar
  - Prioriterad åtgärdslista
  - Demo-script
---

# Demo MVP Proposal -- Equinet

> Baserat på kodinventering per 2026-03-25.
> Principen: visa det som FAKTISKT fungerar. Inget mer.

---

## 1. Demo-MVP i en mening

**Equinet är en bokningsplattform där hästägare hittar och bokar hovslagare, och där hovslagaren hanterar sin verksamhet -- kunder, bokningar, hästar och schema -- från ett och samma ställe.**

---

## 2. Primär målgrupp för demo

**Hovslagare** (leverantör) som idag hanterar bokningar via SMS, telefon och papperskalender.

Sekundär: **Hästägare** (kund) som letar hovslagare och vill boka digitalt.

> Vi visar leverantörssidan mest -- den är mest komplett och har lägst risk.
> Kundsidan visas som komplement för att visa två-sidigheten.

---

## 3. De 3 flödena vi visar

### Flöde A: Leverantorens dag (4 min)

**Berättelse**: "Anna är hovslagare. Så här ser hennes morgon ut i Equinet."

1. Anna loggar in
2. Dashboarden visar hennes statistik och väntande bokningar
3. Hon går till kundregistret, ser sina kunder och deras hästar
4. Hon skapar en manuell bokning för en kund
5. Hon bekräftar en väntande bokning
6. Hon slutför en gammal bokning
7. Hon kollar sina tjänster och priser

**Varför detta flöde**: Det är kärnvärdet. Allt detta är testat och fungerande. Inga externa beroenden.

### Flöde B: Kunden bokar (3 min)

**Berättelse**: "Sofia har en hast som behöver skor. Hon hittar Anna på Equinet."

1. Sofia loggar in
2. Hon går till "Mina hästar" och ser sin hast Blansen
3. Hon söker leverantörer (förbered med seed-data i rätt stad)
4. Hon klickar på Anna, ser profil + recensioner + tjänster
5. Hon bokar hovslagning
6. Hon ser bokningen i "Mina bokningar"

**Varför detta flöde**: Visar kundsidans grundflöde. Risk: leverantörssöket kräver att seed-leverantörer finns i rätt geografi.

### Flöde C: Översikt (1 min)

**Berättelse**: "Plattformen har inbyggd administration."

1. Admin loggar in
2. Se statistik (användare, bokningar)
3. Visa feature flag-panelen -- "vi kan sla på features gradvis"

**Varför detta flöde**: Snabbt, saker, visar att plattformen är genomtänkt.

---

## 4. Vad som absolut måste fungera

| # | Sak | Verifiering | Notering |
|---|-----|-------------|----------|
| 1 | Inloggning (3 konton) | Logga in som leverantör, kund, admin | Seed: provider@test.se, kund@test.se, admin@equinet.se, lösenord: test123 |
| 2 | Leverantör-dashboard laddar | Navigera till /provider/dashboard | Måste visa statistik, inte tom sida |
| 3 | Kundregistret visar kunder | Navigera till /provider/customers | Seed måste ha kunder |
| 4 | Manuell bokning fungerar | Skapa bokning från leverantörsvy | Test hela flödet end-to-end |
| 5 | Bekräfta/slutför bokning | Ändra status på bokning | Statusövergångår |
| 6 | Hastlista laddar | /customer/horses | Seed måste ha hästar |
| 7 | Leverantörssök visar resultat | /providers | Seed-leverantörer måste finnas med koordinater |
| 8 | Bokning från kundsidan | Boka en tjänst via leverantörsprofil | Testa hela flödet |
| 9 | Inga synliga kraschar | Navigera alla demo-sidor | Inga vita sidor, inga 500-fel |
| 10 | Inga dev-banners i demo | Kor i prod-läge eller verifiera att DevBanner är dolt | DevBanner är villkorad på NODE_ENV |

---

## 5. Vad vi fejkar med seed-data

Seed-skriptet (`prisma/seed.ts`) skapar redan rimlig data. Det vi kan behöva justera:

| Data | Befintligt i seed | Behöver justeras? |
|------|------------------|-------------------|
| Leverantörer (5 st) | Ja -- realistiska namn, städer, tjänster | Nej, räcker |
| Tjänster med priser | Ja -- 600-5000 kr, 30-90 min | Nej |
| Tillgänglighetsschema | Ja -- man-fre 09-17 | Nej |
| Test-kund | Ja -- kund@test.se | Behöver hästar kopplade |
| Admin | Ja -- admin@equinet.se | Nej |
| **Bokningår (historik)** | **Begränsat** -- seed-test-users skapar 1 bokning | **Ja -- behöver 4-5 bokningar i olika status** |
| **Recensioner** | **Saknas i seed** | **Ja -- behöver 2-3 recensioner** |
| **Hästar kopplade till kund** | **Saknas i seed** | **Ja -- behöver 2 hästar för test-kunden** |
| **Kunder kopplade till leverantör** | **Delvis** | **Kolla -- kan behöva ProviderCustomer-koppling** |

### Minimal seed-utvidgning

Utöka `prisma/seed.ts` eller skapa `prisma/seed-demo.ts` med:

```
2-3 hästar för kund@test.se:
  - "Blansen" (Svenskt varmblod, sto, 2018)
  - "Storm" (Islandsponny, valack, 2015)

4-5 bokningar:
  - 1 slutförd (for 2 veckor sedan) -> med recension
  - 1 slutförd (for 1 vecka sedan)
  - 1 bekräftad (imorgon)
  - 1 väntande (om 3 dagar) -> för demo av bekräftelse
  - 1 manuellt skapad (nästa vecka)

2 recensioner:
  - "Jättebra! Anna är noggrann och förklarar alltid vad hon gör." (5 stjärnor)
  - "Bra service, kom i tid." (4 stjärnor)

Leverantor-kund-koppling:
  - Anna (leverantör) har kund@test.se som kund
```

---

## 6. Vad vi INTE visar

| Feature | Anledning |
|---------|-----------|
| Ruttplanering / ruttannonser | Kräver Mapbox + OSRM, komplex |
| Betalning | Mock-only, inget riktigt betalflöde |
| Stallhantering | Feature OFF, oklart värde |
| Offline-läge | Komplex, ej verifierad, kräver HTTPS |
| Rostloggning | Kräver AI-tjänst |
| Kundinsikter (AI) | Oklart om AI-integration är kopplad |
| Push-notiser | Feature OFF, kräver APNs |
| Prenumeration (Stripe) | Feature OFF, halvfärdigt |
| Gruppbokningar | Fungerar men svårt att demonstrera snabbt |
| Följ leverantör / Bevaka kommun | Nischfunktion, kräver många användare |
| iOS-appen | Separat demo, kräver simulator/enhet |
| Integrationer (Fortnox) | Kräver extern tjänst |
| Återkommande bokningar | Fungerar men ökär demo-tid utan stort värde |
| GDPR-export | Tekniskt, inte visuellt imponerande |
| Hjalpcentral | Nice-to-have, inte kärnvärde |

**Tumregel**: Om det kräver en extern tjänst, är feature-fläggat OFF, eller tär mer an 30 sekunder att forklara -- visa det inte.

---

## 7. Prioriterad åtgärdslista

### Måste fixas nu (före demo)

| # | Åtgärd | Tid | Motivering |
|---|--------|-----|-----------|
| 1 | **Verifiera databas-anslutning** -- kor `npm run env:status` + `npm run migrate:status` | 15 min | Utan rätt databas fungerar inget |
| 2 | **Utöka seed-data** -- lägg till hästar, bokningar, recensioner för demo-konton | 2-3 h | Tomma listor = död demo |
| 3 | **Manuell genomkorning av Flöde A** -- logga in, navigera varje steg, notera buggar | 1-2 h | Hitta dolda problem före demo |
| 4 | **Manuell genomkorning av Flöde B** -- kund loggar in, söker, bokar | 1 h | Kundsidan är högre risk |
| 5 | **Fixa eventuella buggar från genomkorning** | 2-4 h | Det KOMMER finnas några |

**Total: ~7-10 timmar**

### Bör fixas snart (före extern visning)

| # | Åtgärd | Tid | Motivering |
|---|--------|-----|-----------|
| 6 | Verifiera att feature flags är korrekt -- `stable_profiles`, `push_notifications`, `provider_subscription` OFF | 30 min | Halvfärdiga features ska inte synas |
| 7 | Dolj nav-länkar till features vi inte visar (ruttplanering, rostloggning) från sidomenyn | 1-2 h | Användare klickar på allt |
| 8 | Testa leverantörssöket -- fungerar det utan Mapbox? Vad visas? | 30 min | Kan behöva Mapbox-token eller fallback |
| 9 | Verifiera att BugReportFab ser OK ut (inte störande) | 15 min | Kan se oprofessionellt ut -- ELLER är bra "vi lyssnar" |
| 10 | Deploy till Vercel och verifiera att prod-version matchar | 1 h | Lokal demo = backup, prod = imponerande |

**Total: ~4-5 timmar**

### Kan vänta (efter första demo)

| # | Åtgärd | Tid | Motivering |
|---|--------|-----|-----------|
| 11 | Konfigurera SMTP/Resend för riktiga email | 1 h | Bara nödvändigt om vi visar registrering live |
| 12 | Konfigurera Mapbox för riktigt leverantörssök | 1 h | Bara nödvändigt om sök är centralt i demo |
| 13 | Laga tomma states på icke-demo-sidor | 3-4 h | Bara om någon klickar runt utanfor planerat flöde |
| 14 | Förbereda video-backup | 2 h | Fallback om live-demo går snett |
| 15 | iOS-app-demo | 4-6 h | Separat demo-tillfalle |

---

## 8. Demo-script (steg för steg)

### Intro (30 sekunder)

> "Equinet är en bokningsplattform för hasttjänster. Vi löser problemet att hovslagare och andra
> hasttjänsteleverantörer idag hanterar sin verksamhet via SMS, telefon och papperslappar.
> Lat mig visa hur det fungerar."

---

### Del A: Leverantorens dag (4 minuter)

**Logga in som Anna (leverantör)**
- Öppna `/login`
- Email: `provider@test.se`, lösenord: `test123`
- (Eller använd seed-leverantör: Erik/Anna/Lars beroende på vilken som har bäst data)

> "Det här är Annas dashboard. Hon ser sin statistik -- hur många aktiva tjänster,
> kommande bokningar, och snittbetyg."

**Visa dashboarden**
- Peka på statistikkorten (tjänster, bokningar, recensioner)
- Peka på "Väntande bokningar" om det finns några

> "Hon börjar sin dag med att kolla vem som har bokat."

**Gå till Bokningar**
- Klicka "Bokningar" i menyn
- Visa listan med bokningar i olika status
- Visa filterflikarna (Alla, Väntar, Bekräftade, etc)

> "Här ser hon alla sina bokningar. Den har är ny och väntar på bekräftelse."

**Bekräfta en bokning**
- Klicka på en väntande bokning
- Klicka "Bekräfta"
- Visa att status ändras

> "Med ett klick är bokningen bekräftad. Kunden får ett meddelande."

**Gå till Kundregistret**
- Klicka "Kunder" i menyn
- Visa kundlistan
- Klicka på en kund, visa hästar och anteckningar

> "Anna har alla sina kunder samlade har. Hon ser vilka hästar varje kund har
> och kan lägga till egna anteckningar."

**Skapa en manuell bokning**
- Klicka "Ny bokning" (eller ga via bokningssidan)
- Välj kund, tjänst, datum, tid
- Spara

> "Anna kan också skapa bokningar själv -- till exempel när någon ringer och vill boka."

**Visa Tjänster**
- Klicka "Tjänster" i menyn
- Visa tjänster med namn, pris, tid

> "Här hanterar hon sina tjänster och priser. Enkelt att uppdatera."

**Slutför en bokning**
- Gå tillbaka till Bokningar
- Välj en bekräftad bokning
- Klicka "Slutfor"

> "När jobbet är klart markerar Anna bokningen som slutförd."

---

### Del B: Kunden bokar (3 minuter)

**Logga ut, logga in som Sofia (kund)**
- Logga ut
- Logga in: `kund@test.se`, lösenord: `test123`

> "Nu byter vi perspektiv. Sofia är hästägare och behöver en hovslagare."

**Visa Mina hästar**
- Klicka "Mina hästar"
- Visa hästprofil med detaljer

> "Sofia har sina hästar registrerade. Hon ser Blansens hela servicehistorik."

**Sök leverantör**
- Gå till "Sök leverantör" (`/providers`)
- (Se till att listan visar leverantörer -- seed-data måste matcha)

> "Sofia söker hovslagare i sitt område. Hon ser vilka som finns, deras betyg och priser."

**Klicka på leverantör**
- Välj Anna
- Visa profil: tjänster, recensioner, öppettider

> "Hon kan läsa recensioner från ändra kunder och se vad Anna erbjuder."

**Boka**
- Klicka "Boka"
- Välj tjänst, datum, tid
- Bekräfta

> "Bokning klar. Anna får en notis och Sofia ser bokningen i sin lista."

**Visa bokningen**
- Gå till "Mina bokningar"
- Visa den nya bokningen (status: Väntar)

> "Här ser Sofia alla sina bokningar och kan hantera dem."

---

### Del C: Plattformen (1 minut)

**Logga ut, logga in som admin**
- Logga in: `admin@equinet.se`, lösenord: `test123`

> "Bakom kulisserna har vi en administratorspanel."

**Visa admin-dashboard**
- Peka på statistik

> "Vi ser hur många användare, bokningar och leverantörer som finns på plattformen."

**Visa feature flags**
- Gå till System-installningar
- Visa fläggorna

> "Vi rullar ut nya funktioner gradvis. Här kan vi sla på och av features
> utan att deploya ny kod."

---

### Avslut (30 sekunder)

> "Det där är Equinet. En enkel bokningsplattform för hasttjänster
> som ersätter SMS och papperslappar med något som bara fungerar.
> Vi har [X] leverantörer och [Y] kunder i systemet."

---

## Tidsbedömning

| Fas | Tid |
|-----|-----|
| Förbereda seed-data | 2-3 h |
| Manuell genomkorning + fixa buggar | 3-6 h |
| Öva demo-scriptet 1-2 gånger | 1 h |
| **Total före första demo** | **6-10 h** |

---

## Checklistor

### Kvällen före demo

- [ ] `npm run env:status` -- rätt databas?
- [ ] `npm run migrate:status` -- inga pending migrationer?
- [ ] Logga in som alla 3 konton -- fungerar?
- [ ] Navigera alla demo-sidor -- inga kraschar?
- [ ] Finns det bokningar i olika status att visa?
- [ ] Finns det recensioner att visa?
- [ ] Finns det hästar kopplade till test-kunden?
- [ ] Leverantorssoket visar resultat?

### Precis före demo

- [ ] Öppna appen i Chrome (ej Firefox -- bäst kompatibilitet)
- [ ] Rensa eventuell gammal session (logga ut)
- [ ] Ha login-uppgifter redo (provider@test.se / kund@test.se / admin@equinet.se)
- [ ] Stäng ändra flikar (undvik störningar)
- [ ] Mobilen på tyst
