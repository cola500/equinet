# Equinet - Produktbacklog

**Senast uppdaterad:** 2026-01-30
**Nuvarande version:** v0.2.0+
**Produktagare:** Johan Lindengard

---

## Implementerat (sammanfattning)

> Se README.md for fullstandig lista.

**Auth:** Registrering, login, rollval, email-verifiering, losenordsstyrka
**Leverantor:** Dashboard, tjanster (CRUD), oppettider, exceptions, kalender, bokningshantering, onboarding, profil med geo-position, recensioner & svar
**Kund:** Leverantorsgalleri, bokningar, avbokning, flexibla ruttbestallningar, profil, recensioner & betyg, mock-betalning
**Rutter:** RouteOrders, ruttplanering (Haversine + Nearest Neighbor), stopp-for-stopp, ETA, kartvy (Leaflet/OSM), announcements, geo-matching
**Teknisk:** Next.js 16, NextAuth v5, PostgreSQL (Supabase), Prisma, rate limiting (Upstash Redis), email-notifikationer, DDD-Light, 722 tester (70% coverage), CI/CD, Sentry

---

## Kvarvarande features

### Tier 1 -- Kortsiktigt

| ID | Feature | Status | Beskrivning |
|----|---------|--------|-------------|
| F-1.3 | Drag-and-drop stopp | Ej startad | Dra och slapp stopp i ruttplaneringen for manuell justering. Omberaknar ETA automatiskt. |
| F-4.2 | Koordinat-precision Float->Decimal | Ej startad | Andra latitude/longitude fran Float till Decimal(10,8) i Prisma for battre precision (+-1m istallet for +-10m). |
| F-1.2 | Forbattrad ruttoptimering | Grundversion finns | Nuvarande: Nearest Neighbor. Mojlig upgrade till 2-opt eller extern API for battre resultat. |

### Tier 2 -- Medellang sikt

| Feature | Beskrivning |
|---------|-------------|
| Bilduppladdning | Profilbilder och tjänstebilder. Kräver beslut om lagring (D-6). |
| Betalningsintegration | Stripe eller Klarna för riktiga betalningar. Ersätter mock-betalning. |
| Push/SMS-notifikationer | Komplement till email. Web Push (gratis) + SMS (Twilio) för kritiska händelser. |

### Tier 3 -- Langsiktigt

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
| D-6 | Bildlagring | Supabase Storage / Cloudinary / S3 | Bilduppladdning |

Borttagna beslut: D-1 (Kart-API = Leaflet/OSM, redan implementerat), D-2 (State management = ej behövt).

---

## Beroendegraf

```
TIER 1 (oberoende, kan göras parallellt)
├── F-1.3: Drag-and-Drop stopp
├── F-4.2: Koordinat-precision
└── F-1.2: Förbättrad ruttoptimering (kräver D-5)

TIER 2 (oberoende av varandra)
├── Bilduppladdning (kräver D-6)
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
| **Nuvarande total** | **$0/mån** | Alla free tiers |

Framtida kostnader: Stripe (~2.9% + $0.30/transaktion), Twilio SMS ($0.01/sms), bildlagring (gratis tier räcker initialt).

---

## Nästa steg

- **Sprint 2 pågår:** E2E-stabilitet, CI-automation, BookingRepository
- **Nästa feature-sprint:** F-1.3 (drag-and-drop) + F-4.2 (koordinat-precision)
- **Före produktion:** Betalningsintegration, bilduppladdning, push-notifikationer
- **Framtida "wow-faktor":** Realtidsspårning (Tier 3) -- kräver kartvy som foundation (redan klar)
