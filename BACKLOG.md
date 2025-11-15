# 📋 Equinet - Produktbacklog

**Senast uppdaterad:** 2025-11-15
**Nuvarande version:** v1.2.0 (MVP)
**Produktägare:** Johan Lindengård
**Status:** Backlog för prioritering

---

## 📊 Nuvarande Status (v1.2.0 - MVP KLAR!)

### ✅ Implementerat

**Grundfunktionalitet:**
- ✅ Användare kan registrera sig som kund eller leverantör
- ✅ NextAuth autentisering med credentials provider
- ✅ Kunder kan boka tjänster hos leverantörer
- ✅ Leverantörer kan hantera tjänster och bokningar
- ✅ Profilhantering för både kunder och leverantörer

**Rutt-funktion (MVP):**
- ✅ Kunder skapar flexibla beställningar (RouteOrders) utan fast tid
- ✅ Leverantörer ser tillgängliga beställningar sorterade efter avstånd
- ✅ Filtrera beställningar (tjänstetyp, prioritet, datumspann)
- ✅ Skapa rutter med manuellt valda beställningar
- ✅ Haversine-baserad avståndsberäkning (fågelvägen)
- ✅ Stopp-för-stopp navigation med statusuppdateringar
- ✅ ETA-beräkning per stopp (30 min service + 10 min mellan stopp)

**Teknisk Foundation:**
- ✅ Next.js 15.5.0 App Router
- ✅ Prisma ORM med SQLite (dev)
- ✅ TypeScript strict mode
- ✅ Security headers (CSP, HSTS, CORS)
- ✅ Database index för performance
- ✅ Centraliserad auth helper & middleware
- ✅ JSON parsing error handling i alla API routes
- ✅ 134 unit tests + 35 E2E tests (100% pass rate)

---

## 🎯 Epics & Features

### EPIC 1: Kartvy & Ruttoptimering (Fas 2)

**Strategisk Värdering:** Stor UX-förbättring, foundation för framtida features
**Teknisk Komplexitet:** 🟡 Medel-Hög
**Estimerad Total Tid:** 2-3 veckor

---

#### F-1.1: Interaktiv Kartvy för Beställningar

**User Story:**
_"Som leverantör vill jag se tillgängliga beställningar på en karta, så att jag enkelt kan se geografisk spridning och planera rutter visuellt."_

**Beskrivning:**
- Interaktiv karta som visar alla tillgängliga beställningar som markörer
- Färgkodade markörer efter prioritet (🔴 Akut, 🟢 Normal)
- Klickbara markörer som visar beställningsdetaljer (kund, tjänst, datum, antal hästar)
- Clustering vid många beställningar (förhindra performance-problem)
- Synkning mellan listvy och kartvy (samma filter)

**Acceptanskriterier:**
- [ ] Karta visas på `/provider/route-planning`
- [ ] Alla tillgängliga beställningar renderas som markörer
- [ ] Färgkodning fungerar (röd för urgent, grön för normal)
- [ ] Klick på markör visar popup med detaljer
- [ ] Filter från listvy påverkar även kartan
- [ ] Performance: <2s laddning för 100+ markörer (med clustering)
- [ ] Responsiv: Fungerar på desktop (mobile nice-to-have)

**Tekniska Beslut:**
- 🔶 **BESLUT KRÄVS:** Kart-API val (se sektion "Tekniska Beslut" nedan)
- 🔶 **BESLUT KRÄVS:** State management library (Zustand rekommenderas)

**Beroenden:**
- ⚠️ **BLOCKER:** Provider hem-position saknas i databas (se F-1.4)
- Kart-API konto & API-nyckel
- Eventuell budget ($8-20/mån)

**Risker:**
- 🟡 Ny teknologi (kartbibliotek) - learning curve
- 🟡 Performance med många markörer (kräver clustering)
- 🟢 Ingen backend-ändring, bara frontend

**Komplexitet:** 🟡 Medel
**Estimat:** 1 vecka (inkl. learning curve för kart-API)

---

#### F-1.2: Automatisk Ruttoptimering

**User Story:**
_"Som leverantör vill jag att systemet automatiskt optimerar ordningen på stopp i min rutt, så att jag kör kortaste möjliga sträcka."_

**Beskrivning:**
- Implementera ruttoptimeringsalgoritm (Nearest Neighbor eller 2-opt)
- "Optimera rutt"-knapp på `/provider/route-planning`
- Omberäkna stopp-ordning för minimal total körsträcka
- Visa "före/efter" jämförelse (total km, total tid)
- Möjlighet att ångra optimering

**Acceptanskriterier:**
- [ ] "Optimera rutt"-knapp synlig på route planning-sidan
- [ ] Algoritm beräknar kortaste vägen för valda beställningar
- [ ] Visuell feedback: "Optimerar..." spinner
- [ ] Visa förbättring: "Sparade 12 km (23 min) med optimering"
- [ ] Omberäkna ETA för alla stopp efter optimering
- [ ] Ångra-funktion (återställ till manuell ordning)
- [ ] Performance: <1s för 10 stopp, <5s för 50 stopp

**Tekniska Beslut:**
- 🔶 **BESLUT KRÄVS:** Algoritm-val (Nearest Neighbor vs 2-opt vs Google Directions API)
  - Nearest Neighbor: Enkel, snabb, 70-80% optimal
  - 2-opt: Mer komplex, bättre resultat, längre tid
  - Google Directions API: Bäst resultat, kostar pengar, extern dependency

**Beroenden:**
- Ingen hård dependency (kan göras utan kartvy)
- Men bättre UX med kartvy (se optimerade rutten visuellt)

**Risker:**
- 🟡 Algoritmisk komplexitet (testa noggrant!)
- 🟡 Performance för många stopp (>50)
- 🟢 Ingen databas-ändring

**Komplexitet:** 🟡 Medel
**Estimat:** 3-4 dagar

---

#### F-1.3: Drag-and-Drop Justering av Stopp

**User Story:**
_"Som leverantör vill jag kunna dra och släppa stopp för att manuellt justera ordningen, eftersom jag kan ha lokalkännedom som algoritmen missar."_

**Beskrivning:**
- Drag-and-drop i stopp-listan (desktop)
- Visuell feedback när man drar (highlight, preview)
- Automatisk omberäkning av ETA vid drop
- Uppdatera kartvy (om F-1.1 implementerad) med nya linjer
- "Ångra"-funktion för senaste ändringen

**Acceptanskriterier:**
- [ ] Dra ett stopp till ny position i listan
- [ ] Visuell feedback under drag (cursor, highlight)
- [ ] ETA omberäknas automatiskt vid drop
- [ ] Total körsträcka uppdateras
- [ ] Kartlinjer uppdateras (om kartvy finns)
- [ ] Ångra-knapp fungerar
- [ ] Touch-support (mobile) - nice-to-have

**Tekniska Beslut:**
- 🔶 **BESLUT KRÄVS:** Drag-and-drop library (dnd-kit, react-beautiful-dnd, eller native HTML5?)

**Beroenden:**
- Ingen hård dependency
- Bättre med kartvy (F-1.1) för visuell feedback

**Risker:**
- 🟢 Låg risk - vanilla React state management
- 🟢 Många etablerade bibliotek finns

**Komplexitet:** 🟢 Låg
**Estimat:** 2-3 dagar

---

#### F-1.4: Provider Hem-Position i Databas

**User Story:**
_"Som leverantör vill jag ange min hemadress/bas-position, så att systemet kan beräkna avstånd från min position till första stopp."_

**Beskrivning:**
- Lägg till `homeLatitude` och `homeLongitude` (Decimal, optional) i Provider-modellen
- UI i `/provider/profile` för att ange hemadress
- Geocoding-integration (konvertera adress → koordinater)
- Använd hem-position vid avståndsberäkning till första beställning
- Visa "Avstånd från din bas: 12 km" i UI

**Acceptanskriterier:**
- [ ] Prisma schema uppdaterad med homeLatitude/homeLongitude
- [ ] Migration körd (befintliga providers får NULL)
- [ ] Formulärfält i Provider Profile: "Hemadress/Basposition"
- [ ] Geocoding konverterar adress → lat/long automatiskt
- [ ] Spara koordinater i databasen
- [ ] Visa hem-position på karta (om F-1.1 implementerad)
- [ ] Avståndsberäkning använder hem-position → första stopp
- [ ] Validering: Koordinater inom Sverige (lat: 55-69, long: 11-24)

**Tekniska Beslut:**
- 🔶 **BESLUT KRÄVS:** Geocoding-tjänst
  - Google Geocoding API ($5/1000 requests efter free tier)
  - Mapbox Geocoding (gratis upp till 100k requests/mån)
  - Nominatim (OpenStreetMap, gratis, långsammare)

**Beroenden:**
- **BLOCKERAR:** F-1.1 (Kartvy behöver hem-position för bra UX)
- Schema migration + Prisma generate

**Risker:**
- 🟢 Låg risk - liknande boknings-address functionality
- 🟡 Geocoding API-kostnad (om Google)

**Komplexitet:** 🟢 Låg
**Estimat:** 1 dag

---

### EPIC 2: Realtidsspårning (Fas 3)

**Strategisk Värdering:** "Wow-faktor", stor kundnytta
**Teknisk Komplexitet:** 🔴 Hög
**Estimerad Total Tid:** 3-4 veckor
**OBS:** Rekommenderas EFTER Fas 2 (kräver kartvy som foundation)

---

#### F-2.1: Realtidsposition från Leverantör

**User Story:**
_"Som leverantör vill jag dela min position i realtid under en aktiv rutt, så att kunder kan se var jag befinner mig."_

**Beskrivning:**
- Leverantör startar "Live Tracking" när rutt påbörjas
- Browser Geolocation API hämtar position var 30:e sekund
- Position skickas till backend och sparas (temporärt!)
- Visas på karta för både leverantör och kund
- Auto-stop när rutt markeras som completed

**Acceptanskriterier:**
- [ ] "Starta Live Tracking"-knapp på aktiv rutt
- [ ] Browser ber om location-tillstånd
- [ ] Position uppdateras var 30s (konfigurerbart)
- [ ] Position sparas i databas (RoutePosition-tabell)
- [ ] Leverantör ser sin egen position på karta
- [ ] Position raderas automatiskt efter rutt completed (GDPR!)
- [ ] Fungerar i bakgrunden (även om browser minimerad)
- [ ] Felhantering: "GPS ej tillgänglig", "Tillstånd nekat"

**Tekniska Beslut:**
- 🔶 **BESLUT KRÄVS:** Realtid-strategi (se sektion "Tekniska Beslut")
  - WebSockets (Pusher, Ably, Socket.io)
  - Server-Sent Events (SSE)
  - Polling (30s interval)
- 🔶 **BESLUT KRÄVS:** Position-datalagring
  - Egen tabell (RoutePosition)
  - Redis (snabbare, lättare att radera)

**Beroenden:**
- **KRÄVER:** F-1.1 (Kartvy) för att visa position
- Eventuell WebSocket-tjänst ($0-49/mån)

**Risker:**
- 🔴 Hög komplexitet - WebSockets/Realtid är nytt
- 🔴 GDPR-risk om position inte raderas korrekt
- 🟡 Battery drain på leverantörens mobil
- 🟡 GPS-precision kan variera (10-50 meter fel)

**Komplexitet:** 🔴 Hög
**Estimat:** 1.5 veckor

---

#### F-2.2: Kund Ser Leverantör på Karta

**User Story:**
_"Som kund vill jag se leverantörens position i realtid på en karta, så att jag vet när de är på väg och ungefär när de kommer."_

**Beskrivning:**
- Kund ser karta på `/customer/bookings/[id]`
- Leverantörens position visas som rörlig markör
- "ETA: 23 minuter" baserat på aktuell position + avstånd
- Auto-refresh var 30s (eller WebSocket-push)
- Visa rutt-linje från leverantör → kundens adress

**Acceptanskriterier:**
- [ ] Karta visas på boknings-detaljsida (om rutt är aktiv)
- [ ] Leverantörens position uppdateras i realtid (30s intervall)
- [ ] ETA beräknas från nuvarande position
- [ ] Rutt-linje visas (leverantör → kund)
- [ ] "Leverantören är 5 km bort" visas
- [ ] Fungerar utan page refresh (realtid)
- [ ] Placeholder om GPS ej tillgänglig: "Leverantören har startat rutten"

**Tekniska Beslut:**
- Samma som F-2.1 (WebSocket vs Polling)

**Beroenden:**
- **KRÄVER:** F-2.1 (måste ha position att visa)
- **KRÄVER:** F-1.1 (Kartvy)

**Risker:**
- 🟡 Performance om många samtidiga kunder (100+)
- 🟢 Låg risk - mestadels frontend-rendering

**Komplexitet:** 🟡 Medel
**Estimat:** 1 vecka

---

#### F-2.3: Push-Notifikationer

**User Story:**
_"Som kund vill jag få notifikationer när leverantören är på väg, så att jag vet när jag ska vara hemma."_

**Beskrivning:**
- Skicka notifikationer vid key events:
  - "Leverantören är 30 min bort"
  - "Leverantören har anlänt"
  - "Tjänsten är påbörjad"
  - "Tjänsten är klar"
- Stöd för: Push notifications (web), Email, SMS (optional)
- Kund kan välja preferenser i profil

**Acceptanskriterier:**
- [ ] Notifikation skickas vid "30 min kvar"
- [ ] Notifikation skickas vid "har anlänt"
- [ ] Notifikation skickas vid "tjänst påbörjad"
- [ ] Notifikation skickas vid "tjänst klar"
- [ ] Email som fallback om push ej tillgänglig
- [ ] Kund kan stänga av notifikationer i profil
- [ ] Ingen spam (max 1 notis per event)

**Tekniska Beslut:**
- 🔶 **BESLUT KRÄVS:** Notifikations-strategi (se sektion "Tekniska Beslut")
  - Web Push API (gratis, kräver service worker)
  - Email (Resend, SendGrid - $0-15/mån)
  - SMS (Twilio - $0.01/sms)

**Beroenden:**
- **KRÄVER:** F-2.1 (position för att beräkna "30 min bort")
- Email/SMS-tjänst konto

**Risker:**
- 🟡 Komplexitet: Service Worker för web push
- 🟡 Kostnad för SMS (kan bli dyrt)
- 🟢 Email är enkelt (många bibliotek)

**Komplexitet:** 🟡 Medel
**Estimat:** 1 vecka

---

### EPIC 3: UX Quick Wins

**Strategisk Värdering:** Snabba förbättringar, direkt användarnytta
**Teknisk Komplexitet:** 🟢 Låg
**Estimerad Total Tid:** 1-2 dagar (alla tillsammans)

Dessa kommer från UX-genomlysningen och löser identifierade problem snabbt.

---

#### F-3.1: Lösenordskrav-Indikator

**User Story:**
_"Som ny användare vill jag se visuell feedback på om mitt lösenord uppfyller kraven, så att jag inte får error först vid submit."_

**Beskrivning:**
- Realtids-validering av lösenord medan användaren skriver
- Visa krav med checkboxes:
  - ✅ Minst 8 tecken
  - ✅ En versal bokstav
  - ✅ En gemen bokstav
  - ✅ En siffra
- Grön checkbox när krav uppfyllt, röd/grå när inte

**Acceptanskriterier:**
- [ ] Indikator visas under lösenordsfält i registrering
- [ ] Uppdateras i realtid när användare skriver
- [ ] Alla 4 krav visas
- [ ] Visuell feedback: ✅ (grön) eller ❌ (röd)
- [ ] Submit-knapp disabled tills alla krav uppfyllda (optional)

**Beroenden:** Inga

**Risker:** 🟢 Ingen - vanilla React state

**Komplexitet:** 🟢 Låg
**Estimat:** 30 minuter

---

#### F-3.2: Avboka-Funktion för Kunder

**User Story:**
_"Som kund vill jag kunna avboka en bokning, ifall mina planer ändras."_

**Beskrivning:**
- "Avboka"-knapp på `/customer/bookings`
- Confirmation-dialog: "Är du säker?"
- Uppdatera status till `cancelled`
- Email-notifikation till leverantör (optional)
- Visa avbokade bokningar i separat sektion (grå ut)

**Acceptanskriterier:**
- [ ] "Avboka"-knapp på pending/confirmed bokningar
- [ ] Confirmation-dialog visas
- [ ] Status uppdateras till `cancelled` i databas
- [ ] Bokning försvinner från "Aktiva bokningar"
- [ ] Visas under "Avbokade bokningar" (collapsed)
- [ ] Leverantör ser cancelled-status
- [ ] Endast pending/confirmed bokningar kan avbokas (ej completed)

**Beroenden:**
- Prisma schema behöver `cancelled` status (finns redan?)

**Risker:** 🟢 Ingen - standard CRUD

**Komplexitet:** 🟢 Låg
**Estimat:** 1 timme

---

#### F-3.3: "Försök igen"-Knappar vid Fel

**User Story:**
_"Som användare vill jag kunna försöka igen när något går fel, istället för att behöva ladda om hela sidan."_

**Beskrivning:**
- Error states visar "Försök igen"-knapp
- Retry samma request utan page reload
- Visuell feedback: "Försöker igen..." spinner
- Efter 3 misslyckade försök: "Kontakta support"

**Acceptanskriterier:**
- [ ] Alla error states har "Försök igen"-knapp
- [ ] Klick på knapp gör om samma request
- [ ] Visuell feedback: Loading spinner
- [ ] Max 3 retry-försök, sedan disabled
- [ ] Fungerar för: Bokningar, Profil-uppdateringar, Tjänste-skapande

**Beroenden:** Inga

**Risker:** 🟢 Ingen - state management

**Komplexitet:** 🟢 Låg
**Estimat:** 1 timme

---

#### F-3.4: Onboarding Checklist för Leverantörer

**User Story:**
_"Som ny leverantör vill jag ha en guide för vad jag behöver göra för att komma igång, så att jag inte missar viktiga steg."_

**Beskrivning:**
- Checklist på leverantörens dashboard:
  - ✅ Fyll i företagsprofil
  - ✅ Lägg till minst en tjänst
  - ✅ Ställ in tillgänglighet (öppettider)
  - ✅ Aktivera bokningar
- Klickbara items som leder till rätt sida
- Dölj checklist när allt är klart

**Acceptanskriterier:**
- [ ] Checklist visas på `/provider/dashboard` för nya leverantörer
- [ ] 4 steg visas
- [ ] Checkboxar uppdateras automatiskt baserat på data
- [ ] Klick på item navigerar till rätt sida
- [ ] Checklist döljs när alla steg är klara
- [ ] Kan manuellt dölja checklist ("Visa inte detta igen")

**Beroenden:** Inga

**Risker:** 🟢 Ingen - presentational komponent

**Komplexitet:** 🟢 Låg
**Estimat:** 3 timmar

---

### EPIC 4: Teknisk Skuld & Infrastruktur

**Strategisk Värdering:** Måste göras före produktion
**Teknisk Komplexitet:** 🟡-🔴 Medel-Hög
**Estimerad Total Tid:** 1-2 veckor

---

#### F-4.1: PostgreSQL Migration

**User Story:**
_"Som utvecklare vill jag migrera från SQLite till PostgreSQL, så att applikationen kan hantera concurrency och är production-ready."_

**Beskrivning:**
- Sätt upp PostgreSQL databas (Supabase rekommenderas - gratis tier)
- Uppdatera Prisma schema (`provider = "postgresql"`)
- Migrera data från SQLite → PostgreSQL
- Uppdatera connection string i `.env`
- Verifiera att alla queries fungerar (särskilt Decimal-handling)

**Acceptanskriterier:**
- [ ] PostgreSQL databas uppsatt (Supabase eller lokal)
- [ ] Prisma schema uppdaterad
- [ ] Migration script körd
- [ ] All befintlig data migrerad korrekt
- [ ] Alla tester (134 unit + 35 E2E) passerar
- [ ] Dev och prod använder PostgreSQL
- [ ] Connection pooling konfigurerat (för Vercel)

**Tekniska Beslut:**
- 🔶 **BESLUT KRÄVS:** PostgreSQL-hosting
  - Supabase (gratis tier: 500MB, 2 CPU)
  - Railway ($5/mån)
  - Neon (gratis tier: 3GB)
  - Lokal (dev only)

**Beroenden:**
- **REKOMMENDERAS FÖRE:** Produktion
- Kan göras när som (inga features blockerar)

**Risker:**
- 🟡 Migration-script kan faila (testa noga!)
- 🟡 Decimal-handling skiljer sig mellan SQLite och PostgreSQL
- 🟡 Connection pooling krävs för Vercel (serverless)

**Komplexitet:** 🟡 Medel
**Estimat:** 1 dag

---

#### F-4.2: Koordinat-Precision (Float → Decimal)

**User Story:**
_"Som leverantör vill jag att avståndsberäkningar är exakta (±1 meter), inte ±10+ meter som nu."_

**Beskrivning:**
- Ändra `latitude` och `longitude` från `Float` till `Decimal(10,8)` i Prisma
- Uppdatera API routes för Decimal-konvertering
- Uppdatera seed-script
- Migration av befintlig data

**Acceptanskriterier:**
- [ ] Prisma schema uppdaterad (Decimal)
- [ ] API routes konverterar number → Decimal korrekt
- [ ] Seed-script fungerar med Decimal
- [ ] Alla tester passerar
- [ ] Befintlig data migrerad utan förlust

**Beroenden:**
- **REKOMMENDERAS:** Görs samtidigt med F-4.1 (PostgreSQL migration)
- Annars: SQLite lagrar Decimal som TEXT (inte optimal)

**Risker:**
- 🟢 Låg risk - Prisma hanterar konvertering
- 🟢 Begränsad scope (1 modell, 3 API routes)

**Komplexitet:** 🟢 Låg
**Estimat:** 30-45 minuter (om separat från PostgreSQL)

---

#### F-4.3: Rate Limiting (Produktion)

**User Story:**
_"Som systemägare vill jag förhindra API-abuse och DDoS-attacker genom rate limiting."_

**Beskrivning:**
- Implementera rate limiting på alla API routes
- Redis-baserad (Upstash gratis tier)
- Olika limits per endpoint:
  - Auth: 5 requests/min
  - Read: 60 requests/min
  - Write: 30 requests/min
- Returnera 429 Too Many Requests vid överskridning

**Acceptanskriterier:**
- [ ] Redis-connection uppsatt (Upstash)
- [ ] Middleware för rate limiting
- [ ] Olika limits per route-typ
- [ ] 429-response med Retry-After header
- [ ] Logga rate limit violations
- [ ] Whitelist för interna IP (optional)

**Tekniska Beslut:**
- 🔶 **BESLUT KRÄVS:** Rate limiting-tjänst
  - Upstash Redis (gratis: 10k requests/dag)
  - Vercel KV (beta, kan vara dyrt)
  - Custom Redis (Railway, $5/mån)

**Beroenden:**
- **KRÄVER:** Produktion (skippa i dev för enkelhetens skull)

**Risker:**
- 🟡 Ny tjänst (Redis) - kräver setup
- 🟡 Kan påverka legitima användare (för låga limits)

**Komplexitet:** 🟡 Medel
**Estimat:** 4 timmar

---

## 🔧 Tekniska Beslut som Måste Tas

Dessa beslut blockerar eller påverkar flera features. Behöver prioriteras och beslutas av produktägare.

### D-1: Kart-API Val

**Påverkar:** F-1.1, F-2.2

**Alternativ:**

| Leverantör | Kostnad | Pros | Cons | Rekommendation |
|------------|---------|------|------|----------------|
| **Mapbox** | $8.50/mån (100k loads) | Bästa pricing, modern API, bra React-bibliotek | Mindre känt än Google | ⭐ **REKOMMENDERAD** |
| **Google Maps** | ~$20/mån (estimat) | Mest komplett, stor community | Dyrare, mer komplex pricing | OK om budget finns |
| **Leaflet + OSM** | Gratis | Helt gratis, open source | Mer manuellt jobb, sämre geocoding | Bra för MVP, begränsar senare |

**Rekommendation:** Mapbox - bästa balans mellan pris och features.

---

### D-2: State Management för Kartvy

**Påverkar:** F-1.1, F-1.3

**Alternativ:**

| Library | Komplexitet | Pros | Cons | Rekommendation |
|---------|--------------|------|------|----------------|
| **Zustand** | Låg | Enkel, minimal boilerplate, bra TypeScript | Mindre ekosystem | ⭐ **REKOMMENDERAD** |
| **Redux Toolkit** | Medel | Etablerad, stor community, DevTools | Mer boilerplate | Overkill för detta projekt |
| **React Context** | Låg | Built-in, ingen dependency | Performance-problem vid många updates | OK för MVP, byt senare |

**Rekommendation:** Zustand - perfekt för detta use case.

---

### D-3: Realtid-Strategi

**Påverkar:** F-2.1, F-2.2

**Alternativ:**

| Metod | Komplexitet | Pros | Cons | Kostnad | Rekommendation |
|-------|--------------|------|------|---------|----------------|
| **Polling (30s)** | Låg | Enkel, fungerar överallt, ingen extra tjänst | Inte "true" realtid, mer requests | Gratis | ⭐ **MVP** |
| **Server-Sent Events** | Medel | Enkel server-push, HTTP-baserad | Ingen client → server push | Gratis | Bra upgrade |
| **WebSockets (Pusher)** | Hög | True realtid, bi-directional | Komplex, kostar pengar | $49/mån | Overkill för MVP |

**Rekommendation:**
- **MVP:** Polling (30s intervall) - enkelt, gratis, funkar
- **Senare:** Server-Sent Events - upgrade när ni vill ha "true" realtid

---

### D-4: Notifikations-Strategi

**Påverkar:** F-2.3

**Alternativ:**

| Metod | Komplexitet | Pros | Cons | Kostnad | Rekommendation |
|-------|--------------|------|------|---------|----------------|
| **Email (Resend)** | Låg | Enkelt, alla har email, billigt | Inte instant | $0-15/mån | ⭐ **START HÄR** |
| **Web Push API** | Medel | Gratis, instant, native browser | Kräver service worker, permission | Gratis | Bra tillägg |
| **SMS (Twilio)** | Låg | Instant, når alla | Dyrt ($0.01/sms) | Varierar | Endast för kritiska notiser |

**Rekommendation:**
- **Fas 1:** Email (Resend) - enkelt och billigt
- **Fas 2:** Lägg till Web Push - för användare som vill
- **Optional:** SMS för akuta beställningar (urgent priority)

---

### D-5: Ruttoptimeringsalgoritm

**Påverkar:** F-1.2

**Alternativ:**

| Algoritm | Komplexitet | Kvalitet | Performance | Rekommendation |
|----------|--------------|----------|-------------|----------------|
| **Nearest Neighbor** | Låg | 70-80% optimal | Mycket snabb | ⭐ **MVP** |
| **2-opt** | Medel | 90-95% optimal | Snabb (<50 stopp) | Bra upgrade |
| **Google Directions API** | Låg (integrering) | 99% optimal | Snabb men kostar | För produktion |

**Rekommendation:**
- **MVP:** Nearest Neighbor - enkel, snabb, "good enough"
- **Senare:** 2-opt - när ni vill ha bättre optimering
- **Produktion:** Google Directions API - när budget finns och exakthet krävs

---

## 📊 Dependency Graph

Visuell översikt av vad som måste göras i vilken ordning:

```
FOUNDATION
├─ F-1.4: Provider Hem-Position ──┐
│                                  │
KARTVY (kan göras parallellt)     │
├─ F-1.1: Interaktiv Kartvy ◄─────┘
├─ F-1.2: Automatisk Ruttoptimering (OBEROENDE)
└─ F-1.3: Drag-and-Drop (OBEROENDE)

REALTID (kräver kartvy)
├─ F-2.1: Realtidsposition ◄───── F-1.1
├─ F-2.2: Kund Ser Karta ◄──────┬─ F-2.1
│                                └─ F-1.1
└─ F-2.3: Push-Notifikationer ◄─── F-2.1

UX QUICK WINS (alla oberoende)
├─ F-3.1: Lösenordskrav
├─ F-3.2: Avboka-funktion
├─ F-3.3: Försök igen-knappar
└─ F-3.4: Onboarding Checklist

INFRASTRUKTUR (gör före produktion)
├─ F-4.1: PostgreSQL Migration ──┐
├─ F-4.2: Koordinat-Precision ◄───┘ (rekommenderat samtidigt)
└─ F-4.3: Rate Limiting (prod only)
```

**Kritisk väg (längsta kedjan):**
F-1.4 → F-1.1 → F-2.1 → F-2.2 → F-2.3 = ~4-5 veckor

---

## 🎯 Rekommenderad Implementation-Ordning

Som teknisk rådgivare rekommenderar jag denna ordning (du prioriterar sedan):

### **Sprint 1: Quick Wins + Foundation (1 vecka)**
Snabba vinster som ger direkt värde + förbereder för kartvy.

1. **F-3.1:** Lösenordskrav-indikator (30 min)
2. **F-3.2:** Avboka-funktion (1h)
3. **F-3.3:** Försök igen-knappar (1h)
4. **F-3.4:** Onboarding Checklist (3h)
5. **F-1.4:** Provider Hem-Position (1 dag)

**Varför:** Direkt användarnytta, låg risk, förbereder för kartvy.

---

### **Sprint 2: Kartvy (1.5-2 veckor)**
Implementera kartfunktionalitet (kräver beslut om Mapbox/Google först!).

1. **D-1:** Beslut om Kart-API (Mapbox rekommenderas)
2. **D-2:** Beslut om State Management (Zustand rekommenderas)
3. **F-1.1:** Interaktiv Kartvy (1 vecka)
4. **F-1.3:** Drag-and-Drop (2-3 dagar)

**Varför:** Stor UX-förbättring, foundation för realtid, hög användarnytta.

---

### **Sprint 3: Ruttoptimering (3-4 dagar)**
Kan göras parallellt med Sprint 2 eller efter.

1. **D-5:** Beslut om Algoritm (Nearest Neighbor för MVP)
2. **F-1.2:** Automatisk Ruttoptimering (3-4 dagar)

**Varför:** Oberoende av kartvy, stor funktionell förbättring.

---

### **Sprint 4 (SENARE): Realtid (3-4 veckor)**
Gör EFTER kartvy är klar.

1. **D-3:** Beslut om Realtid-strategi (Polling för MVP)
2. **D-4:** Beslut om Notifikationer (Email först)
3. **F-2.1:** Realtidsposition (1.5 veckor)
4. **F-2.2:** Kund Ser Karta (1 vecka)
5. **F-2.3:** Push-Notifikationer (1 vecka)

**Varför:** Högsta komplexitet, stor "wow-faktor", kräver kartvy först.

---

### **FÖRE PRODUKTION: Infrastruktur (1-2 veckor)**
Måste göras innan ni deployar till riktiga användare.

1. **F-4.1:** PostgreSQL Migration (1 dag)
2. **F-4.2:** Koordinat-Precision (samtidigt med F-4.1)
3. **F-4.3:** Rate Limiting (4h)

**Varför:** Kritiskt för produktion, stabilitet och säkerhet.

---

## 📈 Estimat Sammanfattning

| Epic | Features | Total Tid | Komplexitet |
|------|----------|-----------|-------------|
| **Epic 1: Kartvy** | 4 features | 2-3 veckor | 🟡 Medel-Hög |
| **Epic 2: Realtid** | 3 features | 3-4 veckor | 🔴 Hög |
| **Epic 3: UX Quick Wins** | 4 features | 1-2 dagar | 🟢 Låg |
| **Epic 4: Infrastruktur** | 3 features | 1-2 veckor | 🟡 Medel |

**Total tid för allt:** ~8-10 veckor (om sekventiellt)
**Realistisk timeline (parallellt + iterativt):** 3-4 månader

---

## 💰 Kostnadsbedömning (Månadskostnad i Produktion)

| Tjänst | Kostnad | När Behövs |
|--------|---------|------------|
| **Mapbox** | $8.50/mån | F-1.1 (Kartvy) |
| **PostgreSQL (Supabase)** | Gratis (500MB) | F-4.1 (Produktion) |
| **Upstash Redis** | Gratis (10k req/dag) | F-4.3 (Rate Limiting) |
| **Email (Resend)** | $0-15/mån | F-2.3 (Notifikationer) |
| **TOTAL MVP** | **$8-24/mån** | |
| | | |
| **WebSockets (Pusher)** | $49/mån | F-2.1 (om ni vill true realtid) |
| **SMS (Twilio)** | Varierar ($0.01/sms) | F-2.3 (optional) |
| **TOTAL MED REALTID** | **$57-90/mån** | |

**Anteckning:** Alla tjänster har gratis tiers för utveckling/MVP!

---

## 🎬 Nästa Steg (för Produktägare)

**Dina beslut som behövs:**

1. **Prioritera Epics:** Vilken ordning känns rätt?
   - Quick Wins först → Kartvy → Realtid?
   - Kartvy direkt (skip quick wins)?
   - Något helt annat?

2. **Fatta Tekniska Beslut:**
   - D-1: Kart-API (Mapbox vs Google vs OSM)
   - D-3: Realtid-strategi (Polling vs WebSockets)
   - D-4: Notifikationer (Email vs Push vs SMS)

3. **Budget:** OK med $8-24/mån för Mapbox + Email?

4. **Timeline:** Vill du:
   - Sprint-baserat (1-2 veckor/sprint)?
   - Feature-baserat (en feature i taget)?
   - MVP-release (fixa quick wins + kartvy, sedan utvärdera)?

**Jag rekommenderar:**
1. Börja med **Sprint 1 (Quick Wins + Foundation)** - 1 vecka
2. Ta beslut om kart-API under Sprint 1
3. Fortsätt med **Sprint 2 (Kartvy)** - 2 veckor
4. Utvärdera efter kartvy: Vill ni fortsätta med realtid eller andra features?

**Vad säger du - var vill du börja?**
