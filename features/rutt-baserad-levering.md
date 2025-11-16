# Feature Spec: Rutt-baserad Tjänstelevering

## 📋 Översikt

En funktion som tillåter hästägare att begära tjänster på en specifik adress, och leverantörer att plocka upp flera beställningar i ett geografiskt område och skapa optimerade rutter - likt hur en glassbil, Foodora eller PostNord fungerar.

**Affärsvärde:** 
- Leverantörer kan effektivisera sina dagar genom att ta flera jobb i samma område
- Hästägare får flexibilitet att boka utan att välja exakt tid
- Minskar restid och ökar lönsamhet för leverantörer

---

## 🎯 Användarscenarier

### Scenario 1: Hästägare Begär Tjänst
Emma äger tre hästar på sitt stall utanför Uppsala. Hennes hovslagare kommer vart 8:e vecka. Emma vill boka hovslagning men är flexibel med exakt tid - huvudsaken är att det sker inom kommande två veckor. Hon lägger in en "rutt-beställning" med sin adress och väljer önskat datum-spann.

### Scenario 2: Leverantör Planerar Rutt
Johan är hovslagare och jobbar i Uppsala-området. På måndagen öppnar han appen och ser 8 nya rutt-beställningar från olika hästägare i regionen. Han väljer 5 av dessa som ligger bra geografiskt, appen genererar en optimal rutt, och han bokar in dessa för tisdag mellan 08:00-16:00. Varje hästägare får automatisk notifikation om ungefärlig tid.

### Scenario 3: Akut-beställning
Lisa's häst har tappat en sko. Hon lägger en akutbeställning med "ASAP" prioritet. Leverantörer i området får pushnotis och kan lägga till detta i sin befintliga rutt om de har tid, eller skapa en egen akut-rutt.

---

## 👥 User Stories

### För Hästägare

**US-1:** Som hästägare vill jag kunna begära en tjänst på min adress utan att välja exakt tid, så att jag slipper boka långt i förväg och kan vara flexibel.

**US-2:** Som hästägare vill jag kunna ange ett datum-spann (t.ex. "nästa vecka" eller "inom 14 dagar") när tjänsten ska utföras.

**US-3:** Som hästägare vill jag kunna ange om det är akut eller normal prioritet.

**US-4:** Som hästägare vill jag få notifikation när en leverantör har lagt till mig i sin rutt, samt ungefärlig tid för besöket.

**US-5:** Som hästägare vill jag kunna se på en karta var leverantören är (realtid) när det är min tur snart.

**US-6:** Som hästägare vill jag kunna ange hur många hästar som ska behandlas på samma besök.

### För Leverantörer

**US-7:** Som leverantör vill jag kunna se alla tillgängliga rutt-beställningar i mitt område på en karta, så att jag kan välja vilka jobb jag vill ta.

**US-8:** Som leverantör vill jag kunna filtrera beställningar efter tjänstetyp, prioritet, datum-spann och geografiskt område.

**US-9:** Som leverantör vill jag att systemet genererar en optimal rutt baserat på de beställningar jag väljer, för att minimera körtid.

**US-10:** Som leverantör vill jag kunna manuellt ändra ordningen på stopp i rutten om jag vet bättre.

**US-11:** Som leverantör vill jag kunna sätta en "rutt-dag" (t.ex. "Tisdag i Uppsala-området") och låta systemet föreslå beställningar som passar.

**US-12:** Som leverantör vill jag kunna navigera till nästa stopp direkt från appen (integration med Google Maps/Apple Maps).

**US-13:** Som leverantör vill jag kunna markera ett stopp som "påbörjat", "klart" eller "problem" under dagen.

**US-14:** Som leverantör vill jag att kunder automatiskt får uppdatering om min ETA (estimated time of arrival) när jag närmar mig.

---

## 🔧 Funktionella Krav

### 1. Rutt-beställning (Hästägare)

#### Formulär för Rutt-beställning
- **Adress:** Automatisk adress-sökning med Google Maps/Mapbox
- **Koordinater:** Lat/Long sparas för korrekt position
- **Tjänstetyp:** Dropdown (Hovslagning, Massage, Akupunktur, etc.)
- **Antal hästar:** Numerisk input (påverkar beräknad tid)
- **Datum-spann:** Datepicker med "från-till" datum
- **Prioritet:** Normal / Akut
- **Specialinstruktioner:** Fritext (t.ex. "stor gårdsplan", "parkera vid röda ladan")
- **Kontaktinfo:** Telefonnummer för eventuella problem

#### Validering
- Adress måste valideras och ha koordinater
- Datum-spann kan vara max 30 dagar för normal prioritet
- Akut-beställningar kräver datum inom 48 timmar

### 2. Rutt-översikt (Leverantör)

#### Kartvy
- **Markör för varje beställning:**
  - Färgkodad efter prioritet (röd=akut, grön=normal)
  - Visar tjänstetyp som ikon
  - Klickbar för att visa detaljer
- **Clustering:** Gruppera närliggande beställningar vid zoom out
- **Filter:**
  - Tjänstetyp (checkbox-lista)
  - Datum-spann (datepicker)
  - Prioritet (dropdown)
  - Radie från min position (slider: 10-100 km)
  - Endast obesvarade beställningar

#### Listvy
- Alternativ till kartvyn
- Sorteras efter: avstånd, datum, prioritet
- Visa viktig info: adress, tjänst, antal hästar, datum-spann

### 3. Rutt-skapande (Leverantör)

#### Steg 1: Välj Beställningar
- Leverantör väljer beställningar från karta eller lista
- Checkbox-selection
- Visar totalt antal, total beräknad tid, totalt avstånd

#### Steg 2: Optimera Rutt
- Knapp: "Optimera rutt"
- Algoritm beräknar kortaste vägen mellan alla punkter
- Visar rutt på karta med numrerade stopp (1, 2, 3...)
- Visar beräknad körsträcka och total tid

#### Steg 3: Granska och Justera
- Drag-and-drop för att ändra ordning manuellt
- Lägg till paus/lunch (valfritt stopp)
- Sätt start-tid för första stoppet
- Systemet beräknar ETA för varje stopp automatiskt

#### Steg 4: Bekräfta och Spara
- Knapp: "Bekräfta rutt"
- Alla kunder får notifikation:
  - "Din hovslagare kommer [datum] ca [tid] (+/- 30 min)"
- Rutten sparas och syns i leverantörens schema

### 4. Rutt-körning (Leverantör)

#### Under Dagen
- **Översikt:** Lista med dagens stopp i ordning
- **Aktivt stopp:**
  - Navigera-knapp (öppnar Google Maps/Apple Maps)
  - "Påbörja besök"-knapp
  - Timer startar automatiskt
  - Kundinformation visas (adress, specialinstruktioner, telefonnummer)
- **Statusuppdatering:**
  - Markera som "Klar" när besöket är avslutat
  - Valfri: lägg till notering (t.ex. "Häst behöver återbesök")
  - Systemet flyttar automatiskt till nästa stopp
- **Problem:**
  - "Rapportera problem"-knapp
  - Alternativ: "Kund ej hemma", "Hittar ej adress", "Behöver mer tid", "Annat"
  - Kunden får automatisk notifikation

#### ETA-uppdateringar
- **Realtidsspårning (valfritt):**
  - Leverantör kan aktivera "Dela min position"
  - Nästa kund i rutten kan se leverantörens position på karta
  - Aktiveras automatiskt 30 min innan beräknad ETA
- **Automatiska ETA-uppdateringar:**
  - Om leverantör blir försenad (markerar "behöver mer tid")
  - System räknar om ETA för resterande stopp
  - Kunder får pushnotis: "Din hovslagare är försenad, ny ETA: 14:30"

### 5. Bekräftelse och Notifikationer

#### När Rutt Skapas
**Till kund:**
- Push: "Din beställning har bokats!"
- Email: Bekräftelse med datum, ungefärlig tid, leverantörens namn
- SMS: "Din hovslagare kommer [datum] ca [tid]"

**Till leverantör:**
- Rutt visas i kalender/schema
- Sammanfattning: totalt X beställningar, Y mil att köra, Z timmar

#### Under Rutt-dagen
**Till kund:**
- Push (30 min innan): "Din hovslagare är på väg, ETA: 14:15"
- Push (vid försening): "Ny ETA: 15:00"
- Push (när besök påbörjas): "Din hovslagare har anlänt"

**Till leverantör:**
- Påminnelse 1 timme innan första stoppet
- Notis när nästa stopp är klart

#### Efter Besök
**Till kund:**
- Push: "Besöket är klart! Hur var din upplevelse?"
- Länk till betygsättning (framtida feature)

---

## 🗄️ Databasschema

### Nya Tabeller

#### route_orders
```sql
id: UUID (PK)
customer_id: UUID (FK -> users.id)
service_type: VARCHAR (t.ex. 'hovslagning', 'massage')
address: TEXT
latitude: DECIMAL(10, 8)
longitude: DECIMAL(11, 8)
number_of_horses: INTEGER
date_from: DATE
date_to: DATE
priority: ENUM ('normal', 'urgent')
special_instructions: TEXT
contact_phone: VARCHAR
status: ENUM ('pending', 'in_route', 'completed', 'cancelled')
created_at: TIMESTAMP
updated_at: TIMESTAMP
```

#### routes
```sql
id: UUID (PK)
provider_id: UUID (FK -> providers.id)
route_name: VARCHAR (t.ex. "Uppsala Tisdag")
route_date: DATE
start_time: TIME
status: ENUM ('planned', 'active', 'completed', 'cancelled')
total_distance_km: DECIMAL(5, 2)
total_duration_minutes: INTEGER
created_at: TIMESTAMP
updated_at: TIMESTAMP
```

#### route_stops
```sql
id: UUID (PK)
route_id: UUID (FK -> routes.id)
route_order_id: UUID (FK -> route_orders.id)
stop_order: INTEGER (1, 2, 3... ordning i rutten)
estimated_arrival: DATETIME
estimated_duration_minutes: INTEGER
actual_arrival: DATETIME (nullable)
actual_departure: DATETIME (nullable)
status: ENUM ('pending', 'in_progress', 'completed', 'problem')
problem_note: TEXT (nullable)
created_at: TIMESTAMP
updated_at: TIMESTAMP
```

#### provider_locations (för realtidsspårning)
```sql
id: UUID (PK)
provider_id: UUID (FK -> providers.id)
route_id: UUID (FK -> routes.id)
latitude: DECIMAL(10, 8)
longitude: DECIMAL(11, 8)
recorded_at: TIMESTAMP
```

---

## 🔌 API Endpoints

### Rutt-beställningar (Hästägare)

#### `POST /api/route-orders`
Skapa ny rutt-beställning
```json
{
  "serviceType": "hovslagning",
  "address": "Storgatan 123, Uppsala",
  "latitude": 59.8586,
  "longitude": 17.6389,
  "numberOfHorses": 2,
  "dateFrom": "2025-11-15",
  "dateTo": "2025-11-22",
  "priority": "normal",
  "specialInstructions": "Parkera vid röda ladan",
  "contactPhone": "0701234567"
}
```

#### `GET /api/route-orders/my-orders`
Hämta kundens egna beställningar

#### `PATCH /api/route-orders/:id/cancel`
Avboka beställning

### Rutt-planering (Leverantör)

#### `GET /api/route-orders/available`
Hämta tillgängliga beställningar i område
Query params:
- `serviceType`: string
- `latitude`: number
- `longitude`: number
- `radiusKm`: number
- `dateFrom`: date
- `dateTo`: date
- `priority`: string

Response:
```json
{
  "orders": [
    {
      "id": "uuid",
      "address": "Storgatan 123, Uppsala",
      "latitude": 59.8586,
      "longitude": 17.6389,
      "serviceType": "hovslagning",
      "numberOfHorses": 2,
      "dateSpan": "2025-11-15 till 2025-11-22",
      "priority": "normal",
      "distanceFromProvider": 12.5
    }
  ]
}
```

#### `POST /api/routes`
Skapa ny rutt
```json
{
  "routeName": "Uppsala Tisdag",
  "routeDate": "2025-11-19",
  "startTime": "08:00",
  "orderIds": ["uuid1", "uuid2", "uuid3"]
}
```

#### `POST /api/routes/:id/optimize`
Optimera stopp-ordning i rutt
```json
{
  "startLocation": {
    "latitude": 59.8586,
    "longitude": 17.6389
  }
}
```

Response:
```json
{
  "optimizedRoute": [
    {
      "stopOrder": 1,
      "orderId": "uuid1",
      "address": "...",
      "estimatedArrival": "08:30",
      "estimatedDuration": 45
    },
    {
      "stopOrder": 2,
      "orderId": "uuid3",
      "address": "...",
      "estimatedArrival": "10:00",
      "estimatedDuration": 30
    }
  ],
  "totalDistance": 45.2,
  "totalDuration": 360
}
```

#### `GET /api/routes/my-routes`
Hämta leverantörens rutter

#### `GET /api/routes/:id`
Hämta specifik rutt med alla stopp

### Rutt-körning (Leverantör)

#### `PATCH /api/route-stops/:id/start`
Markera stopp som påbörjat
```json
{
  "actualArrival": "2025-11-19T08:35:00Z"
}
```

#### `PATCH /api/route-stops/:id/complete`
Markera stopp som klart
```json
{
  "actualDeparture": "2025-11-19T09:20:00Z",
  "notes": "Allt gick bra, hästen var lugn"
}
```

#### `PATCH /api/route-stops/:id/problem`
Rapportera problem
```json
{
  "problemType": "customer_not_home",
  "problemNote": "Ringde men inget svar"
}
```

#### `POST /api/provider-locations`
Uppdatera leverantörens position (realtid)
```json
{
  "routeId": "uuid",
  "latitude": 59.8586,
  "longitude": 17.6389
}
```

#### `GET /api/routes/:id/provider-location`
Hämta leverantörens senaste position (för kund)

---

## 🎨 UI/UX Design

### Hästägare: Skapa Rutt-beställning

**Sida:** `/route-orders/new`

```
┌─────────────────────────────────────────┐
│  Beställ Tjänst - Flexibel Tid          │
├─────────────────────────────────────────┤
│                                         │
│  Vilken tjänst behöver du?              │
│  [Dropdown: Hovslagning ▼]              │
│                                         │
│  Din adress                             │
│  [Storgatan 123, Uppsala            🔍] │
│  [             KARTA                   ] │
│  [         (med markör)                ] │
│                                         │
│  Antal hästar                           │
│  [2 ▲▼]                                 │
│                                         │
│  När ska det göras?                     │
│  Från: [15 Nov 2025 📅]                 │
│  Till:  [22 Nov 2025 📅]                │
│                                         │
│  Prioritet                              │
│  ( ) Normal - inom datum-spann          │
│  ( ) Akut - så snart som möjligt       │
│                                         │
│  Specialinstruktioner (valfritt)        │
│  [Parkera vid röda ladan...]           │
│                                         │
│  Kontakttelefon                         │
│  [0701234567]                          │
│                                         │
│  [       Skicka Beställning       ]     │
│                                         │
│  💡 Du kommer få notis när en           │
│     leverantör har lagt till dig        │
│     i sin rutt                          │
└─────────────────────────────────────────┘
```

### Leverantör: Rutt-planering

**Sida:** `/provider/route-planning`

**Tab 1: Karta**
```
┌─────────────────────────────────────────┐
│  Tillgängliga Beställningar             │
├─────────────────────────────────────────┤
│  Filter: [Hovslagning ▼] [Normal ▼]    │
│  Radie: [───●────] 50 km                │
│  Datum: [15-22 Nov 📅]                  │
│                                         │
│  [          KARTA MED MARKÖRER         ]│
│  [                                     ]│
│  [  🔴 Akut (2)                        ]│
│  [  🟢 Normal (15)                     ]│
│  [                                     ]│
│  [  Välj: ☐ Alla synliga              ]│
│                                         │
│  Valda: 5 beställningar                 │
│  [        Skapa Rutt       ]            │
└─────────────────────────────────────────┘
```

**Tab 2: Lista**
```
┌─────────────────────────────────────────┐
│  ☐ Storgatan 123, Uppsala               │
│     Hovslagning • 2 hästar • 12 km      │
│     15-22 Nov • Normal                  │
│                                         │
│  ☐ Björkvägen 45, Uppsala               │
│     Hovslagning • 1 häst • 8 km         │
│     15-22 Nov • Normal                  │
│                                         │
│  ☐ Gamla Vägen 7, Knivsta               │
│     Massage • 3 hästar • 25 km          │
│     18-25 Nov • 🔴 Akut                 │
└─────────────────────────────────────────┘
```

### Leverantör: Aktiv Rutt

**Sida:** `/provider/routes/:id/active`

```
┌─────────────────────────────────────────┐
│  Uppsala Tisdag - 19 Nov 2025           │
│  Stopp 2 av 5 • 15 km kvar              │
├─────────────────────────────────────────┤
│                                         │
│  ✅ Stopp 1 - Klar 08:55                │
│                                         │
│  ▶️ Stopp 2 - AKTIVT                    │
│  Anna Andersson                         │
│  Storgatan 123, Uppsala                 │
│  Hovslagning • 2 hästar (60 min)        │
│  ETA: 10:15 • Anlänt: 10:12            │
│                                         │
│  📞 0701234567                          │
│  💬 "Parkera vid röda ladan"            │
│                                         │
│  [    🗺️ Navigera    ] [  ✅ Klar  ]   │
│  [    ⚠️ Problem     ]                  │
│                                         │
│  ⏹️ Stopp 3 - Väntande                  │
│  Lars Larsson • Björkvägen 45           │
│  ETA: 11:30 (8 km)                      │
│                                         │
│  ⏹️ Stopp 4 - Väntande                  │
│  Maria Ek • Gamla Vägen 7               │
│  ETA: 13:15 (12 km)                     │
└─────────────────────────────────────────┘
```

### Hästägare: Spåra Leverantör

**Sida:** `/orders/:id/track` (öppnas från notifikation)

```
┌─────────────────────────────────────────┐
│  Din Hovslagare är på väg! 🐴           │
├─────────────────────────────────────────┤
│                                         │
│  [          KARTA MED RUTT             ]│
│  [                                     ]│
│  [    📍 Du är här                     ]│
│  [    🚗 Johan (leverantör)            ]│
│  [    📌 → 📌 → 📍 (rutt)              ]│
│                                         │
│  Johan Johansson - Hovslagare           │
│  ⭐⭐⭐⭐⭐ (47 omdömen)                │
│                                         │
│  Beräknad ankomst: 14:15 (+/- 30 min)   │
│                                         │
│  Du är stopp 3 av 5 idag                │
│                                         │
│  📞 Kontakta Johan                      │
│                                         │
│  Får notis när Johan är 5 min bort 🔔   │
└─────────────────────────────────────────┘
```

---

## 🧮 Teknisk Implementation

### 1. Kart-integration

**Rekommenderade Tjänster:**
- **Google Maps Platform** (mest komplett)
  - Maps JavaScript API
  - Geocoding API
  - Distance Matrix API
  - Directions API
- **Mapbox** (bättre pricing för stora volymer)
- **Leaflet + OpenStreetMap** (gratis alternativ)

**Funktioner som behövs:**
- Geocoding (adress → lat/long)
- Reverse geocoding (lat/long → adress)
- Visa karta med custom markers
- Rita rutt mellan punkter
- Beräkna avstånd och restid

### 2. Ruttoptimering

**Alternativ A: Egen Implementation**
- Använd Distance Matrix API för att få avstånd mellan alla punkter
- Implementera "Nearest Neighbor"-algoritm eller "2-opt" för att hitta bästa rutten
- Funkar för <20 stopp

**Alternativ B: Tredjepartstjänst**
- **Google Routes API** (nyare, bättre optimering)
- **Mapbox Optimization API**
- **OSRM (Open Source Routing Machine)** - gratis alternativ

**Pseudo-kod för enkel ruttoptimering:**
```javascript
function optimizeRoute(startPoint, orders) {
  let route = [startPoint]
  let remainingOrders = [...orders]
  
  while (remainingOrders.length > 0) {
    let currentPoint = route[route.length - 1]
    let nearest = findNearestOrder(currentPoint, remainingOrders)
    route.push(nearest)
    remainingOrders = remainingOrders.filter(o => o.id !== nearest.id)
  }
  
  return route
}

function findNearestOrder(point, orders) {
  let minDistance = Infinity
  let nearest = null
  
  for (let order of orders) {
    let distance = calculateDistance(point, order)
    if (distance < minDistance) {
      minDistance = distance
      nearest = order
    }
  }
  
  return nearest
}

// Haversine formula för avstånd mellan lat/long
function calculateDistance(point1, point2) {
  const R = 6371 // jordens radie i km
  const dLat = toRad(point2.lat - point1.lat)
  const dLon = toRad(point2.lon - point1.lon)
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}
```

### 3. Realtidsspårning

**WebSocket eller Server-Sent Events:**
```javascript
// Leverantör-app: Skicka position varje 30 sekunder
setInterval(() => {
  navigator.geolocation.getCurrentPosition((position) => {
    fetch('/api/provider-locations', {
      method: 'POST',
      body: JSON.stringify({
        routeId: currentRouteId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      })
    })
  })
}, 30000)

// Kund-app: Lyssna på uppdateringar
const eventSource = new EventSource(`/api/routes/${routeId}/location-stream`)
eventSource.onmessage = (event) => {
  const location = JSON.parse(event.data)
  updateMapMarker(location.latitude, location.longitude)
}
```

### 4. ETA-beräkning

```javascript
function calculateETAs(route, currentStopIndex) {
  let currentTime = new Date()
  
  for (let i = currentStopIndex; i < route.stops.length; i++) {
    let stop = route.stops[i]
    
    if (i === currentStopIndex) {
      // Pågående stopp - använd beräknad duration
      stop.eta = currentTime
      currentTime = new Date(currentTime.getTime() + stop.estimatedDuration * 60000)
    } else {
      // Framtida stopp - lägg till restid
      let previousStop = route.stops[i - 1]
      let travelTime = calculateTravelTime(previousStop, stop)
      currentTime = new Date(currentTime.getTime() + travelTime * 60000)
      stop.eta = currentTime
      currentTime = new Date(currentTime.getTime() + stop.estimatedDuration * 60000)
    }
  }
  
  return route
}
```

### 5. Notifikationer

**Push Notifications:**
- **Web:** Firebase Cloud Messaging eller OneSignal
- **Mobile:** Apple Push Notification Service (APNS) / Firebase

**Email:**
- SendGrid eller Resend

**SMS:**
- Twilio eller 46elks (svensk tjänst)

**Triggers:**
- Rutt skapad → Email + Push till alla kunder
- 30 min innan stopp → Push till kund
- Stopp påbörjat → Push till kund
- Försening → Push till alla påverkade kunder

---

## ⚠️ Edge Cases & Problem

### Problem 1: Kund avbokar efter rutt är skapad
**Lösning:**
- Ta bort stopp från rutten
- Räkna om ETA för resterande stopp
- Notifiera leverantör
- Notifiera påverkade kunder om nya tider

### Problem 2: Leverantör blir kraftigt försenad
**Lösning:**
- Leverantör kan klicka "Behöver mer tid"
- System räknar om alla ETA
- Skickar nya tider till alla väntande kunder
- Om försening >2h, erbjud kunder att avboka

### Problem 3: Leverantör hittar ej adress
**Lösning:**
- "Rapportera problem"-knapp
- Leverantör kan ringa kund direkt från app
- Kan markera som "hoppas över" och göra sist
- Systemet justerar rutten

### Problem 4: Kund inte hemma
**Lösning:**
- Leverantör markerar "Kund ej hemma"
- Systemet loggar detta
- Kund debiteras eventuellt utryckningsavgift
- Kan schemaläggas om

### Problem 5: Väderproblem / Bilhaveri
**Lösning:**
- Leverantör kan avbryta hela rutten
- Alla kunder får automatisk notis
- Erbjuds att ombokas till annan dag
- System föreslår lediga dagar

### Problem 6: För få beställningar i område
**Lösning:**
- System kan föreslå närliggande områden
- Leverantör kan sätta lägsta antal stopp för att rutten ska löna sig
- Kunder får notis: "Din beställning väntar på fler bokningar i området"

---

## 📊 Metrics & Analytics (Framtida)

### För Leverantörer
- Genomsnittligt antal stopp per rutt
- Total körsträcka vs faktisk arbetstid (effektivitet)
- Inkomst per körd kilometer
- Avbokningsfrekvens
- Förseningar (hur ofta, genomsnittlig tid)

### För Plattformen
- Genomsnittlig tid från beställning till rutt-placering
- Fyllnadsgrad av rutter (hur många stopp i genomsnitt)
- Geografisk heatmap över populära områden
- Populäraste tjänster för rutt-bokningar

---

## 🚀 Implementation Roadmap

### Fas 1: Grundläggande Rutt-funktion (v1.0)
**Tid: 4-6 veckor**

- [ ] Databasschema för route_orders, routes, route_stops
- [ ] Kart-integration (Mapbox eller Google Maps)
- [ ] Hästägare: Skapa rutt-beställning med adress
- [ ] Leverantör: Se tillgängliga beställningar på karta
- [ ] Leverantör: Välj beställningar och skapa rutt (manuell ordning)
- [ ] Grundläggande notifikationer (email)
- [ ] Leverantör: Se dagens rutt och navigera mellan stopp
- [ ] Markera stopp som klar

**Testbart resultat:** En leverantör kan se beställningar på karta, skapa en rutt manuellt, och köra rutten stopp för stopp.

### Fas 2: Ruttoptimering (v1.1)
**Tid: 2-3 veckor**

- [ ] Implementera ruttoptimeringsalgoritm
- [ ] Automatisk beräkning av ETA för varje stopp
- [ ] Leverantör kan se total körsträcka och tid
- [ ] Förbättrad kartvy med numrerade stopp
- [ ] Drag-and-drop för manuell justering

**Testbart resultat:** Systemet kan automatiskt optimera ordningen på stopp för att minimera körtid.

### Fas 3: Realtidsspårning & ETA (v1.2)
**Tid: 3-4 veckor**

- [ ] Realtidsposition från leverantör
- [ ] Kund kan se leverantörens position på karta
- [ ] Automatisk ETA-uppdatering vid försening
- [ ] Push-notifikationer (30 min innan, vid ankomst)
- [ ] SMS-notifikationer (valfritt)

**Testbart resultat:** Kunder kan följa leverantören i realtid och får uppdateringar om ETA.

### Fas 4: Problemhantering & Edge Cases (v1.3)
**Tid: 2 veckor**

- [ ] Rapportera problem-funktionalitet
- [ ] Hantera avbokningar i aktiv rutt
- [ ] Omberäkning av rutt vid problem
- [ ] Kontakta kund direkt från app

**Testbart resultat:** Systemet kan hantera vanliga problem som uppstår under en rutt-dag.

### Fas 5: Förbättringar & Analys (v1.4)
**Tid: 2-3 veckor**

- [ ] Rutthistorik och statistik
- [ ] Intelligent förslag på beställningar baserat på tidigare rutter
- [ ] Återkommande rutter ("Varje tisdag i Uppsala")
- [ ] Export av rutt till Google Calendar
- [ ] Förbättrad filtrering och sökning

---

## 🎨 Design Assets Behövs

### Ikoner
- 📍 Kund-markör (kan vara häst-ikon)
- 🚗 Leverantör-bil (med riktning)
- 🔴 Akut-markör
- 🟢 Normal-markör
- ✅ Klar-markör
- ⚠️ Problem-ikon

### Kartdesign
- Custom styling av karta (matcha app-färger)
- Rutt-linje (färg och tjocklek)
- Cluster-design för många markörer

---

## 💰 Kostnader (Estimering)

### Google Maps Platform
- **Maps JavaScript API:** $7 per 1000 laddningar
- **Geocoding API:** $5 per 1000 requests
- **Distance Matrix API:** $10 per 1000 requests (viktigt för ruttoptimering)
- **Directions API:** $10 per 1000 requests

**Estimering för 100 rutter/månad:**
- 100 ruttplaneringar × 10 beställningar = 1000 Distance Matrix calls = $10
- 1000 geocodingar = $5
- 500 kartvyningar = $3.50
- **Total: ~$20/månad**

### Mapbox (Alternativ)
Ofta billigare vid större volymer.

### SMS (46elks)
~0.60 kr/SMS till Sverige

---

## 📝 Dokumentation för Utvecklare

### Environment Variables
```env
# Karta
GOOGLE_MAPS_API_KEY="..."
# eller
MAPBOX_ACCESS_TOKEN="..."

# Notifikationer
FIREBASE_SERVER_KEY="..."
SENDGRID_API_KEY="..."
TWILIO_ACCOUNT_SID="..."
TWILIO_AUTH_TOKEN="..."
```

### Viktiga NPM Packages
```json
{
  "dependencies": {
    "@googlemaps/js-api-loader": "^1.16.2",
    "mapbox-gl": "^3.0.0",
    "socket.io": "^4.6.0",
    "socket.io-client": "^4.6.0",
    "date-fns": "^2.30.0",
    "haversine-distance": "^1.2.1"
  }
}
```

---

## ✅ Definition of Done

Feature är klar när:

- [ ] Hästägare kan skapa rutt-beställning med adress
- [ ] Leverantör kan se alla beställningar på karta med filter
- [ ] Leverantör kan välja beställningar och skapa optimerad rutt
- [ ] Leverantör kan navigera rutten stopp för stopp
- [ ] Kunder får notifikationer om sin tid i rutten
- [ ] Realtidsspårning fungerar
- [ ] ETA uppdateras automatiskt vid förändringar
- [ ] Problem kan rapporteras och hanteras
- [ ] Alla edge cases testade
- [ ] Responsiv design (mobil + desktop)
- [ ] Dokumentation skriven
- [ ] User acceptance testing (UAT) godkänd

---

## 🎯 Success Metrics

### Launch Targets (Månad 1)
- 20 leverantörer använder rutt-funktionen
- 100 rutt-beställningar skapade
- 50 rutter körda
- Genomsnittligt 4 stopp per rutt
- <10% avbokningar
- >80% kund-nöjdhet

### 3-Month Goals
- 50% av alla leverantörer använder rutt-funktion
- 500+ rutt-beställningar/månad
- Genomsnittligt 6 stopp per rutt
- 20% färre "tomkörnings"-kilometer för leverantörer
- <5% avbokningar

---

**Kontakt för frågor:** [Din kontakt här]

**Skapad:** 2025-11-11
**Version:** 1.0
