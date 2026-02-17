# Gruppbokningar

> Se [API.md](../API.md) för gemensamma mönster (autentisering, felkoder, säkerhetsprinciper).

Stallgemenskaper samordnar leverantörsbesök. En kund skapar en grupprequest, andra hakar på via invite code, och leverantören matchar och skapar sekventiella bokningar.

---

## POST /api/group-bookings

Skapa ny grupprequest. Skaparen läggs automatiskt till som första deltagare.

**Auth:** Required (customer)

**Request Body:**
```json
{
  "serviceType": "Hovslagning",
  "locationName": "Sollebrunn Ridklubb",
  "address": "Stallvägen 1, 441 91 Alingsås",
  "dateFrom": "2026-02-15T00:00:00.000Z",
  "dateTo": "2026-02-28T00:00:00.000Z",
  "maxParticipants": 6,
  "notes": "Vi har 6 hästar totalt",
  "latitude": 57.93,
  "longitude": 12.53
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid", "inviteCode": "ABC12345", "status": "open",
  "serviceType": "Hovslagning", "locationName": "Sollebrunn Ridklubb",
  "participants": [{ "id": "uuid", "userId": "uuid", "numberOfHorses": 1 }],
  "_count": { "participants": 1 }
}
```

---

## GET /api/group-bookings

Hämta alla grupprequests där användaren är skapare eller deltagare.

**Auth:** Required (customer)

**Response:** `200 OK` -- Array sorterad nyast först. Inkluderar deltagare (exkl. cancelled) och deltagarantal.

---

## GET /api/group-bookings/[id]

Hämta detaljer för en grupprequest.

**Auth:** Required (skapare, deltagare, matchad provider, eller valfri provider om öppen)

**Response:** `200 OK`
```json
{
  "id": "uuid", "creatorId": "uuid", "serviceType": "Hovslagning",
  "locationName": "Sollebrunn Ridklubb", "address": "Stallvägen 1",
  "dateFrom": "2026-02-15T00:00:00.000Z", "dateTo": "2026-02-28T00:00:00.000Z",
  "maxParticipants": 6, "status": "open", "inviteCode": "ABC12345",
  "participants": [
    { "id": "uuid", "userId": "uuid", "numberOfHorses": 2, "horseName": "Blansen", "status": "joined",
      "user": { "firstName": "Anna" }, "horse": { "name": "Blansen" } }
  ],
  "provider": null, "_count": { "participants": 3 }
}
```

---

## PUT /api/group-bookings/[id]

Uppdatera grupprequest (bara skaparen).

**Auth:** Required (skapare)

**Request Body:**
```json
{ "notes": "Uppdaterad info", "maxParticipants": 8, "status": "cancelled" }
```

**Tillåtna statusövergångar:** `open` -> `cancelled`, `matched` -> `cancelled`

**Felkoder:**
- `400` -- Ogiltig statusövergång
- `403` -- Inte skapare

---

## POST /api/group-bookings/join

Gå med i en grupprequest via invite code.

**Auth:** Required (customer)

**Request Body:**
```json
{
  "inviteCode": "ABC12345",
  "numberOfHorses": 2,
  "horseName": "Blansen",
  "notes": "Känslig på vänster fram"
}
```

**Validering:**
- Request måste vara "open"
- Inte full (deltagare < maxParticipants)
- Join deadline inte passerad
- Användaren inte redan ansluten

**Response:** `201 Created`

**Felkoder:**
- `400` -- Full, redan ansluten, eller ogiltigt
- `404` -- Ogiltig invite code

---

## GET /api/group-bookings/available

Hämta öppna grupprequests (för leverantörer).

**Auth:** Required (provider)

**Response:** `200 OK` -- Array med öppna grupprequests med framtida datum.

---

## POST /api/group-bookings/[id]/match

Leverantören matchar och skapar individuella bokningar.

**Auth:** Required (provider)

**Request Body:**
```json
{ "serviceId": "uuid", "bookingDate": "2026-02-20T00:00:00.000Z", "startTime": "09:00" }
```

**Vad som händer:**
1. Validerar tjänst (providerägd + aktiv)
2. Skapar sekventiella bokningar (09:00-09:45, 09:45-10:30, etc.)
3. Uppdaterar deltagares status till "booked"
4. Ändrar request-status till "matched"
5. Notifierar alla deltagare

**Response:** `200 OK` `{ "message": "5 bokningar skapade", "bookingsCreated": 5 }`

---

## DELETE /api/group-bookings/[id]/participants/[pid]

Ta bort deltagare (skaparen kan ta bort andra, deltagare kan lämna).

**Auth:** Required (skaparen eller deltagaren själv)

**Beteende:**
- Soft delete: Markerar participant som "cancelled"
- Skaparen tar bort någon -> notifierar borttagen deltagare
- Deltagare lämnar -> notifierar skaparen
- Inga aktiva deltagare kvar -> avbryter hela requesten

**Response:** `200 OK`
