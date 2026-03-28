---
title: Specialroutes -- testsäkring
description: Granskning och testsäkring av specialroutes som inte refaktorerats till centrala helpers
category: testing
status: current
last_updated: 2026-03-28
sections:
  - Granskade routes
  - Tester som lades till
  - Risker som identifierades
  - Beteende som verifierades
---

# Specialroutes -- testsäkring

> Genomförd 2026-03-28. Fokus: tester runt befintligt beteende, ingen kodändring.

---

## Granskade routes (5 st)

| Route | Före | Efter | Varför vald |
|-------|------|-------|-------------|
| `integrations/fortnox/connect` | 0 tester | 9 tester | Enda routen utan testfil -- OAuth entry point |
| `integrations/fortnox/sync` | 5 tester | 6 tester | Saknade test för null providerId (404) |
| `bookings/[id]/reschedule` | 11 tester | 13 tester | Bekräfta IDOR-skydd i domänlagret |
| `bookings/manual` | 14 tester | -- (granskad) | God täckning, inklusive IDOR-test |
| `customer/due-for-service` | 8 tester | -- (granskad) | God täckning, feature flag testad |

---

## Tester som lades till

### Fortnox connect (9 nya tester -- helt ny testfil)

| Test | Verifierar |
|------|-----------|
| returns 401 when not authenticated | auth() rejection ger 401 |
| returns 401 when session is null | null session ger 401 |
| returns 403 for customer users | Rollkontroll -- bara leverantörer |
| returns 429 when rate limited | IP-baserad rate limiting |
| returns 503 when FORTNOX_CLIENT_ID is missing | Env-var validering |
| returns 503 when FORTNOX_REDIRECT_URI is missing | Env-var validering |
| redirects to Fortnox OAuth URL | Happy path -- korrekt redirect URL |
| sets httpOnly state cookie for CSRF protection | Cookie-säkerhet (HttpOnly, Path=/) |
| includes state parameter matching cookie | CSRF state = 64 hex chars |

### Fortnox sync (+1 test)

| Test | Verifierar |
|------|-----------|
| returns 404 when provider has no providerId | Null providerId-edge case |

### Reschedule (+2 tester)

| Test | Verifierar |
|------|-----------|
| passes customerId from session to service (IDOR protection) | Session-baserad customerId, inte URL/body |
| returns error when service rejects wrong customer (IDOR) | BookingService returnerar BOOKING_NOT_FOUND vid fel kund |

---

## Risker som identifierades

### Bekräftad: IDOR-skydd i reschedule fungerar

Agenten flaggade att reschedule-routen inte verifierar booking-ägande. Granskning visade att **BookingService.rescheduleBooking() gör detta** (rad 502-504: `booking.customerId !== dto.customerId` -> BOOKING_NOT_FOUND) OCH att repositoryt har `WHERE { id, customerId }` som extra skydd. **Inget säkerhetsproblem** -- men nu dokumenterat med explicita tester.

### Bekräftad: Fortnox connect hade 0 tester

OAuth entry point utan någon testning. Nu säkrat med 9 tester som täcker auth, rollkontroll, rate limiting, env-var-validering, CSRF-token och redirect-URL.

### Observerat: bookings/manual har god IDOR-testning

Test "should use providerId from session..." verifierar att providerId tas från session, inte body. Bra mönster som bör kopieras vid nya provider-routes.

### Lämnat kvar: customer/due-for-service och bookings/manual

Båda har god befintlig täckning. Inga kritiska luckor hittades. Rate-limit 429-tester saknas men är låg risk (rate limiting testad centralt).

---

## Beteende som verifierades utan kodändring

- Fortnox connect: state-token genereras med 32 bytes randomness (64 hex chars)
- Fortnox connect: cookie sätts med httpOnly + correct path
- Fortnox sync: 404 vid null providerId (inte 500)
- Reschedule: customerId från session vidarebefordras till service (IDOR-skydd)
- Reschedule: service returnerar 404 (inte 500) vid fel kund
