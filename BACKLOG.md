# Equinet - Produktbacklog

**Senast uppdaterad:** 2026-02-06
**Nuvarande version:** v0.2.0+
**Produktägare:** Johan Lindengård

---

## Implementerat (sammanfattning)

> Se README.md för fullständig lista.

**Auth:** Registrering, login, rollval, email-verifiering, lösenordsstyrka
**Leverantör:** Dashboard, tjänster (CRUD), öppettider, exceptions, kalender, bokningshantering, onboarding, profil med geo-position, recensioner & svar, kundrecensioner (betygsatt kunder)
**Kund:** Leverantörsgalleri, bokningar, avbokning, flexibla ruttbeställningar, profil, recensioner & betyg, mock-betalning, hästregister med vårdhistorik, hästhälsotidslinje (anteckningar + kategorifilter)
**Leverantör:** Kompetenser & certifikat (5 typer: utbildning/organisation/certifikat/erfarenhet/licens, utfärdare, år, max 5 bilder, redigera/ta bort, badge), read-only hästtidslinje
**Admin:** Verifieringsgranskning (godkänn/avvisa med kommentar, bilder, metadata, notifikation till provider)
**Rutter:** RouteOrders, ruttplanering (Haversine + Nearest Neighbor), stopp-för-stopp, ETA, kartvy (Leaflet/OSM), announcements, geo-matching
**Gruppbokning:** GroupBookingRequest + Participant-modeller, 7 API-endpoints (CRUD + join + available + match), GroupBookingService med sekventiell bokningslogik, invite codes, 6 UI-sidor (kund + leverantör), notifikationer
**Notifikationer:** In-app notifikationer (klocka + dropdown + polling), automatiska återbokningspåminnelser (cron), betalningsabstraktion (gateway pattern)
**Dataexport:** GDPR-dataexport (JSON + CSV), hästpass med delbara länkar (30d expiry, integritetsskydd)
**Bilduppladdning:** Supabase Storage-integration, drag-and-drop, client-side komprimering, IDOR-skydd, inkopplad på hästprofil (foto) och leverantörsprofil (profilbild)
**Bokföring:** IAccountingGateway (Fortnox), OAuth 2.0, token-kryptering (AES-256-GCM), faktura-synk, MockAccountingGateway
**Manuell bokning:** Provider kan skapa bokningar åt kunder (ghost user-pattern), kundsök begränsad till egna kunder, häst-dropdown, steg-för-steg dialog, "M"-indikator i kalender, audit trail
**Kundregister:** Samlad kundlista för leverantörer (härledd från bokningar), filter, sök, hästar per kund
**Återbesöksplanering:** "Dags för besök"-vy med statusbadges (försenad/inom 2v/ej aktuell), individuella återbesöksintervall per häst (override av tjänstens default via HorseServiceInterval)
**Leverantörsanteckningar:** providerNotes på bokningar, UI i bokningsdetalj och hästjournal (bara synligt för leverantören, integritetsskyddat)
**Teknisk:** Next.js 16, NextAuth v5, PostgreSQL (Supabase), Prisma, rate limiting (Upstash Redis), email-notifikationer, DDD-Light, 1289+ tester (70% coverage), CI/CD, Sentry, Vercel Cron Jobs

---

## Kvarvarande features

### Tier 1 -- Kortsiktigt

| ID | Feature | Status | Beskrivning |
|----|---------|--------|-------------|
| F-1.3 | Drag-and-drop stopp | Ej startad | Dra och släpp stopp i ruttplaneringen för manuell justering. Omberäknar ETA automatiskt. |
| F-4.2 | Koordinat-precision Float->Decimal | Ej startad | Ändra latitude/longitude från Float till Decimal(10,8) i Prisma för bättre precision (+-1m istället för +-10m). |
| F-1.2 | Förbättrad ruttoptimering | Grundversion finns | Nuvarande: Nearest Neighbor. Möjlig upgrade till 2-opt eller extern API för bättre resultat. |

### Tier 2 -- Medellång sikt

| Feature | Beskrivning | Status |
|---------|-------------|--------|
| ~~Bilduppladdning~~ | Supabase Storage, drag-and-drop, client-side komprimering | **Implementerad** |
| ~~Bokföringsintegration~~ | IAccountingGateway + FortnoxGateway + MockAccountingGateway, OAuth, token-kryptering | **Implementerad** |
| Betalningsintegration (Swish/Stripe) | Riktig betalning via PaymentGateway-interface. Mock-gateway finns. | Ej startad |
| Push/SMS-notifikationer | Komplement till in-app + email. Web Push (gratis) + SMS (Twilio) för kritiska händelser. | Ej startad |

### Tier 3 -- Långsiktigt

| Feature | Beskrivning | Beroenden |
|---------|-------------|-----------|
| Realtidsspårning | Leverantörens position i realtid under aktiv rutt (GPS var 30s). | Kräver D-3. GDPR-hänsyn. |
| Kund ser leverantör på karta | Kund ser leverantörens position + ETA på bokningsdetalj-sida. | Kräver realtidsspårning. |
| Proximity-notifikationer | "Leverantören är 30 min bort", "Har anlänt", etc. | Kräver realtidsspårning + D-4. |

---

## Öppna tekniska beslut

| ID | Beslut | Alternativ | Påverkar |
|----|--------|------------|----------|
| D-3 | Realtid-strategi | Polling 30s (MVP) / SSE / WebSockets (Pusher) | Realtidsspårning |
| D-4 | Notifikations-strategi | Email (redan finns) / Web Push (gratis) / SMS (Twilio, $0.01/sms) | Push/SMS-notifikationer |
| D-5 | Ruttoptimeringsalgoritm | Nearest Neighbor (nuvarande) / 2-opt / Google Directions API | F-1.2 |
| ~~D-6~~ | ~~Bildlagring~~ | ~~Supabase Storage~~ | ~~Bilduppladdning~~ -- **beslut: Supabase Storage** |

Borttagna beslut: D-1 (Kart-API = Leaflet/OSM, redan implementerat), D-2 (State management = ej behövt), D-6 (Bildlagring = Supabase Storage, implementerat).

---

## Beroendegraf

```
TIER 1 (oberoende, kan göras parallellt)
├── F-1.3: Drag-and-Drop stopp
├── F-4.2: Koordinat-precision
└── F-1.2: Förbättrad ruttoptimering (kräver D-5)

TIER 2 (oberoende av varandra)
├── Betalningsintegration
└── Push/SMS-notifikationer (kräver D-4)

TIER 3 (kedja)
Realtidsspårning (D-3) → Kund ser karta → Proximity-notifikationer (D-4)
```

---

## Kostnadsbedömning

| Tjänst | Kostnad | Status |
|--------|---------|--------|
| Supabase (PostgreSQL) | Gratis (500 MB) | Implementerat |
| Upstash Redis | Gratis (10k req/dag) | Implementerat |
| Vercel hosting | Gratis (hobby) | Implementerat |
| Sentry monitoring | Gratis (5k events) | Implementerat |
| Vercel Cron | Ingår i hobby | Implementerat (påminnelser) |
| **Nuvarande total** | **$0/mån** | Alla free tiers |

Framtida kostnader: Swish/Stripe (~2.9% + $0.30/transaktion), Twilio SMS ($0.01/sms), bildlagring (gratis tier räcker initialt).

---

## Nästa steg

- **Fas 3 klar:** Dataexport, hästpass, bilduppladdning, Fortnox-integration -- alla implementerade
- **Fas 4 klar:** Kundregister, återbesöksplanering, leverantörsanteckningar -- alla implementerade
- **Nästa fas:** Fortnox sandbox-verifiering, Supabase Storage bucket-setup, svenska tecken-audit
- **Före produktion:** Betalningsintegration (Swish/Stripe), push-notifikationer, E2E för nya features
- **Tier 1 polish:** F-1.3 drag-and-drop, F-4.2 koordinat-precision
- **Framtida "wow-faktor":** Realtidsspårning (Tier 3) -- kräver kartvy som foundation (redan klar)
- **Gruppbokning vidareutveckling:** Geo-filtrering i /available, E2E-tester, eventuellt stallkoncept (Stable-modell)
