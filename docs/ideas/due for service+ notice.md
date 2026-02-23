# Feature: "Due for service" + Ruttannons → Hyperrelevant notis

Syfte:  
Skapa en unik och hyperrelevant notifiering genom att kombinera:

1. Hästens service-status (”due for service”)
2. Ny ruttannons i kundens område

Exempelnotis:  
> "Blansen behövde skos för 2 veckor sedan. Anna har lediga tider i Kungsbacka nästa vecka."

---

# Story 1: "Due for service" – Beräkning per häst

## User Story

Som kund vill jag att systemet kan avgöra om min häst är "due for service",  
så att jag kan få relevanta påminnelser och smarta matchningar.

## Acceptanskriterier

- Systemet kan avgöra om en häst är overdue baserat på:
  - senaste service-datum
  - serviceintervall (dagar/veckor)
- Systemet kan beräkna hur länge hästen är overdue (dagar/veckor).
- Beräkningen är deterministisk och testbar.
- Om fält saknas i modellen introduceras minsta möjliga nya fält.

## Verifiering

1. Skapa en häst med gammalt service-datum → ska vara overdue.
2. Skapa en häst med nyligt service-datum → ska inte vara overdue.
3. Kontrollera att beräkningen ger korrekt antal dagar/veckor.

## Uppgifter

- Identifiera befintlig datamodell.
- Implementera due-beräkning.
- Lägg till testtäckning för beräkningslogik.

---

# Story 2: Intern notis vid matchning (Due + Ruttannons)

## User Story

Som kund vill jag få en intern notis när en leverantör annonserar en rutt i mitt område  
och jag har en häst som är overdue,  
så att jag enkelt kan boka.

## Acceptanskriterier

- När en ruttannons skapas:
  - Identifiera kunder i området.
  - Filtrera kunder med minst en overdue häst.
  - Skapa intern notis.
- Notisen ska innehålla:
  - Hästens namn (mest overdue om flera)
  - Leverantörens namn
  - Område + tidsperiod
  - Overdue-formulering
  - Länk till relevant vy
- Max en notis per (kund, ruttannons).

## Verifiering

1. Seed kund med overdue häst och rätt område.
2. Skapa ruttannons i området → notis skapas.
3. Skapa ruttannons i annat område → ingen notis.
4. Uppdatera häst så den inte är overdue → ingen notis.
5. Upprepa event → ingen dubblettnotis.

## Uppgifter

- Koppla trigger till skapande av ruttannons.
- Implementera område + overdue-filter.
- Implementera dubblettskydd.
- Lägg testtäckning för trigger och filter.

---

# Story 3: Push-notis (leveranskanal)

## User Story

Som kund vill jag få push-notis när ovanstående händer,  
så att jag uppmärksammas även när jag inte är i appen.

## Acceptanskriterier

- Om push-token finns → skicka push-notis.
- Om push saknas → intern notis finns kvar (robust fallback).
- Notisen länkar korrekt till relevant vy.
- Ingen dubblettpush för samma ruttannons.

## Verifiering

1. Kund med push-token → skapa matchande ruttannons → push skickas.
2. Kund utan push-token → intern notis finns, ingen crash.
3. Klicka push → korrekt vy öppnas.
4. Upprepa trigger → ingen dubblett.

## Uppgifter

- Identifiera/implementera push-stöd.
- Koppla push till notis-eventet.
- Säkerställ fallback.
- Lägg minimal testtäckning.

---

# Framtida Utbyggnad (Valfri)

- Följ leverantör
- Notifieringspreferenser
- Rate limiting
- SMS fallback
- “Snart dags” (inte bara overdue)