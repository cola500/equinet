---
title: Route-orders testsäkring
description: Granskning och testsäkring av den känsliga dual-mode route-orders-routen
category: testing
status: current
last_updated: 2026-03-28
sections:
  - Vad som gör routen känslig
  - Befintlig täckning
  - Tester som lades till
  - Kvarvarande risker
  - Bedömning
---

# Route-orders testsäkring

> Genomförd 2026-03-28. Route: `src/app/api/route-orders/route.ts` (480 LOC).

---

## Vad som gör routen känslig

1. **Dual-mode POST**: Samma endpoint hanterar 2 helt olika flöden:
   - `customer_initiated`: Kund skapar beställning (Zod-schema A, status "pending")
   - `provider_announced`: Leverantör skapar annonsering (Zod-schema B, status "open", med municipalitetsvalidering + tjänstekoppling)

2. **Rollbaserad dispatching**: `announcementType` i body styr vilken intern funktion som körs. Fel roll -> 403, men dispatching sker EFTER auth och feature flag.

3. **Dual-mode GET**: Samma endpoint returnerar olika data beroende på `announcementType` query param + user role. Felaktig kombination -> 400.

4. **Date-validering med olika regler per typ**: Customer: max 30 dagar span. Provider: max 14 dagar. Urgent: max 48h framåt.

5. **Service-ägarvalidering**: Provider-annonsering verifierar att alla serviceIds tillhör leverantören OCH är aktiva.

6. **Fire-and-forget side effects**: Notifieringar till followers/municipality watchers dispatches asynkront.

---

## Befintlig täckning (18 tester)

| Area | Tester | Status |
|------|--------|--------|
| POST 401 (ej autentiserad) | 1 | OK |
| POST customer happy path | 1 | OK |
| POST customer 403 (provider försöker) | 1 | OK |
| POST provider happy path | 1 | OK |
| POST provider 400 (ogiltig kommun) | 1 | OK |
| POST provider 400 (tomma serviceIds) | 1 | OK |
| POST provider 400 (tjänst tillhör inte provider) | 1 | OK |
| POST provider 400 (saknad kommun) | 1 | OK |
| POST provider 403 (customer försöker) | 1 | OK |
| POST provider 404 (profil saknas) | 1 | OK |
| POST provider specialInstructions | 1 | OK |
| POST provider backward-compat serviceType | 1 | OK |
| GET 401 (ej autentiserad) | 1 | OK |
| GET provider announcements | 1 | OK |
| GET provider 404 (profil saknas) | 1 | OK |
| GET 400 (ogiltiga query params) | 1 | OK |
| **Feature flag** | **0** | **Saknades** |
| **Date-validering** | **0** | **Saknades** |
| **Cross-role GET** | **0** | **Saknades** |

---

## Tester som lades till (7 nya)

### POST-guarder (2)

| Test | Verifierar |
|------|-----------|
| Feature flag disabled -> 404 | `route_planning` feature flag respekteras |
| Invalid JSON -> 400 | Felaktig body ger 400, inte 500 |

### Date-validering (3)

| Test | Verifierar |
|------|-----------|
| Customer: span > 30 dagar -> 400 | Gräns för kundbeställningar |
| Customer: dateTo < dateFrom -> 400 | Logisk datumordning |
| Provider: span > 14 dagar -> 400 | Striktare gräns för annonseringar |

### Cross-role GET (2)

| Test | Verifierar |
|------|-----------|
| Customer + provider_announced -> 400 | Kund kan inte se leverantörs-announcements |
| Provider + customer_initiated -> 400 | Leverantör kan inte se kundbeställningar |
| Customer + customer_initiated -> 200 | Kund kan se sina egna beställningar |

---

## Kvarvarande risker

| Risk | Allvarlighet | Kommentar |
|------|-------------|-----------|
| Urgent 48h-gräns otestad | Låg | Edge case i customer flow, validering finns i kod (rad 131-138) |
| Notifier fire-and-forget | Låg | Asynkron dispatch, error-catch loggar men verifieras inte i test |
| Pagination i GET customer_initiated | Låg | Limit/offset finns men testas inte |
| customerId från session (IDOR) | OK | Verifierad: `customerId: session.user.id` (rad 152), providerId från lookup (rad 211) |

---

## Bedömning

**Routen känns nu tillräckligt säkrad för att lämnas orörd.** 25 tester täcker:
- Alla auth/rollkombinationer (401, 403 för båda roller)
- Feature flag gating
- Dual-mode dispatching (customer vs provider)
- Date-validering för båda typer
- Cross-role GET-access
- Service-ägarvalidering
- Input-validering (ogiltiga params, saknade fält, ogiltig kommun)

**Vid framtida ändring**: Routen bör refaktoreras till två separata routes (`/api/route-orders/customer` + `/api/route-orders/announcements`) om fler features läggs till i endera flödet. Men med nuvarande scope och 25 tester är den säker att lämna.
