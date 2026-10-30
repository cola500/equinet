---
title: "Epic: Besöksplats och restid mellan bokningar"
description: "Bokningar ska räkna restid från platsen där hästen står (stallet), med en buffert leverantören själv ställer in, så att tiderna som erbjuds går att hinna till."
category: idea
status: draft
last_updated: 2026-10-30
tags: [booking, travel-time, stable, route-planning, epic]
related:
  - docs/ideas/epic-stall.md
  - docs/architecture/booking-flow.md
sections:
  - Epic
  - Personas och värde
  - Success-mått
  - Nuläge i koden
  - Slicing
  - Beslut
  - Öppna frågor
  - Nästa steg
---

# Epic: Besöksplats och restid mellan bokningar

## Epic

**Som leverantör som åker ut till hästar vill jag att bokningar bara görs på tider jag hinner köra till, räknat från där hästen faktiskt står, så att min dag håller utan att jag behöver pussla manuellt.**

## Personas och värde

| Persona | Smärta idag | Förväntat värde |
|---------|-------------|-----------------|
| **Leverantör (primär)** | Fasta tidsluckor och en hårdkodad buffert på 60 minuter. Restiden räknas från ägarens hemadress, inte från stallet. Två hästar i samma stall kräver ändå en timmes mellanrum. Manuella bokningar och ombokningar kontrolleras inte alls mot restid. | Bokningar som går att hinna mellan, en buffert anpassad efter det egna arbetet och tätare dagar när flera hästar står på samma plats. |
| **Hästägare (sekundär)** | Kan välja en tid som ser ledig ut och sedan få felet "Otillräcklig tid till föregående bokning". | Bara tider som faktiskt går att boka visas. |

## Success-mått

- Inga bokningar nekas med restidsfel efter att kunden valt en tid som visades som ledig.
- Dagens rutt, tidslistan och kontrollen när bokningen sparas utgår från samma besöksplats.
- Flera hästar i samma stall kan bokas direkt efter varandra.
- Leverantören kan ändra sin buffert själv.

## Nuläge i koden

Genomlyst 2026-10-30.

- **Tidsluckor:** `src/lib/utils/slotCalculator.ts` delar upp öppettiderna efter tjänstens längd, med start vid öppning.
- **Restidskontroll i tidslistan:** `/api/providers/[id]/availability` filtrerar på restid via `TravelTimeService`, men bara om kunden har en position i sin profil (`lat`/`lng` från `useWeekAvailability`).
- **Restidskontroll när bokningen sparas:** `BookingService.createBooking` → `BookingValidation.validateTravelTime`. Saknar kunden position används leverantörens hemadress. Saknas positioner helt krävs 60 minuter.
- **Beräkning** (`src/domain/booking/TravelTimeService.ts`): fågelväg × 1,2 vid 50 km/h, **plus alltid 60 minuter**. Värdena är hårdkodade och kan inte ställas in per leverantör.
- **Plats som används:**

  | Del | Plats |
  |---|---|
  | Dagens rutt (`/api/provider/today-route`) | Hästens stall om det har position, annars ägarens hemadress |
  | Restidskontrollen (tidslista och bokning) | Bara ägarens hemadress (`User.latitude/longitude`) |

- **Saknas:** restidskontroll i `createManualBooking` och `rescheduleBooking` (bara överlapp kontrolleras).
- **Glapp:** en kund utan sparad adress ser tider utan restidskontroll, men bokningen kan nekas när den sparas eftersom kontrollen då räknar från leverantörens hemadress med 60 minuters buffert.
- **Datamodell:** `Horse.stableId` finns och är live. `Stable` har position men kräver en stallägare (`userId @unique`), och stallprofiler ligger bakom den avstängda flaggan `stable_profiles`. Hästägare kan alltså inte lägga upp stall själva. `Horse` saknar egen plats. `Booking.horseId` är frivilligt.

## Slicing

Uppdelningen gjordes 2026-10-30 och följer bokningsflödets steg (Workflow Steps), enkla regler före varianter (Business Rule Variations) och funktion före prestanda (Defer Performance).

### Slice 1 (MVP): Besöksplats

**Leverans:**
- Hästprofilen får fältet "Hästen står på". Adressen omvandlas till en position och används när hästen inte är kopplad till ett stall med position.
- En gemensam regel avgör var besöket sker: hästens stall → hästens plats → ägarens hemadress (tillfällig reserv till steg 2).
- Regeln används i tidslistan, i kontrollen när bokningen sparas och i Dagens rutt.

**Teknik:** schemaändring med nya nullbara fält på `Horse` (adress, latitud, longitud). Den kräver granskning av `tech-architect`, en RLS-genomgång och en genomgång av alla select-block för `Horse`.

**Uppskattning:** 2–3 dagar.

### Slice 2: Plats krävs vid bokning

Saknar den valda hästen plats får kunden ange den i bokningsflödet. API:et avvisar bokningen annars. Reserven till hemadressen tas bort.

**Uppskattning:** 1–2 dagar.

### Slice 3: Buffert och samma plats

Bufferten blir ett standardvärde som leverantören kan ändra, i stället för hårdkodade 60 minuter. Besök på samma plats kräver ingen restid.

**Uppskattning:** 1–2 dagar. Kräver en schemaändring på `Provider`.

### Slice 4: Riktig körtid

Restidskontrollen använder vägsträcka via OSRM i stället för fågelväg × 1,2.

**Uppskattning:** 1–2 dagar. Beror på hur OSRM ska driftas, eftersom den publika demoservern inte är avsedd för produktion.

### Slice 5: Kontroll överallt

Restidskontroll även för manuella bokningar och ombokningar.

**Uppskattning:** 1 dag.

## Beslut

- **2026-10-30 (Johan):** besöksplatsen är **stallets adress**, inte ägarens hemadress.
- **2026-10-30 (Johan):** står hästen i ett stall som inte finns i Equinet anges platsen på hästen ("Hästen står på"). Hästägare ska inte kunna lägga upp stall i den här epiken; det hör till [stall-epiken](epic-stall.md).
- **2026-10-30 (Johan):** bufferten ska vara ett **standardvärde som leverantören själv kan ändra**, i kombination med dynamisk restid. Det är parkerat till Slice 3.
- **MVP:** inte bestämt. Förslaget är Slice 1, eventuellt tillsammans med Slice 2.

## Öppna frågor

- Ska MVP vara bara Slice 1, eller Slice 1 och 2 tillsammans?
- Vilket standardvärde ska bufferten ha, och ska det skilja mellan yrkesgrupper (till exempel hovslagare och veterinär)?
- Hur ska bokningar utan kopplad häst hanteras (`horseId` saknas och namnet står som fritext)?
- Ska hästens plats kunna ändras per bokning, till exempel vid tävling eller tillfällig uppstallning?
- Var ska OSRM driftas för Slice 4 (egen server eller en betaltjänst)?

## Nästa steg

Johan tittar på förslaget igen. Därefter bestäms MVP, och `tech-architect` granskar schemaändringen innan Slice 1 påbörjas.
