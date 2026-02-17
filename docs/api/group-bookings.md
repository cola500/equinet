# Gruppbokningar

> Se [API.md](../API.md) for gemensamma monster (autentisering, felkoder, sakerhetsprinciper).

Stallgemenskaper samordnar leverantorsbesok. En kund skapar en grupprequest, andra hakar pa via invite code, och leverantoren matchar och skapar sekventiella bokningar.

---

## POST /api/group-bookings

Skapa ny grupprequest. Skaparen laggs automatiskt till som forsta deltagare.

**Auth:** Required (customer)

**Request Body:**
```json
{
  "serviceType": "Hovslagning",
  "locationName": "Sollebrunn Ridklubb",
  "address": "Stallvagen 1, 441 91 Alingsas",
  "dateFrom": "2026-02-15T00:00:00.000Z",
  "dateTo": "2026-02-28T00:00:00.000Z",
  "maxParticipants": 6,
  "notes": "Vi har 6 hastar totalt",
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

Hamta alla grupprequests dar anvandaren ar skapare eller deltagare.

**Auth:** Required (customer)

**Response:** `200 OK` -- Array sorterad nyast forst. Inkluderar deltagare (exkl. cancelled) och deltagarantal.

---

## GET /api/group-bookings/[id]

Hamta detaljer for en grupprequest.

**Auth:** Required (skapare, deltagare, matchad provider, eller valfri provider om oppen)

**Response:** `200 OK`
```json
{
  "id": "uuid", "creatorId": "uuid", "serviceType": "Hovslagning",
  "locationName": "Sollebrunn Ridklubb", "address": "Stallvagen 1",
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

**Tillatna statusovergangar:** `open` -> `cancelled`, `matched` -> `cancelled`

**Felkoder:**
- `400` -- Ogiltig statusovergang
- `403` -- Inte skapare

---

## POST /api/group-bookings/join

Ga med i en grupprequest via invite code.

**Auth:** Required (customer)

**Request Body:**
```json
{
  "inviteCode": "ABC12345",
  "numberOfHorses": 2,
  "horseName": "Blansen",
  "notes": "Kanslig pa vanster fram"
}
```

**Validering:**
- Request maste vara "open"
- Inte full (deltagare < maxParticipants)
- Join deadline inte passerad
- Anvandaren inte redan ansluten

**Response:** `201 Created`

**Felkoder:**
- `400` -- Full, redan ansluten, eller ogiltigt
- `404` -- Ogiltig invite code

---

## GET /api/group-bookings/available

Hamta oppna grupprequests (for leverantorer).

**Auth:** Required (provider)

**Response:** `200 OK` -- Array med oppna grupprequests med framtida datum.

---

## POST /api/group-bookings/[id]/match

Leverantoren matchar och skapar individuella bokningar.

**Auth:** Required (provider)

**Request Body:**
```json
{ "serviceId": "uuid", "bookingDate": "2026-02-20T00:00:00.000Z", "startTime": "09:00" }
```

**Vad som hander:**
1. Validerar tjanst (provideragd + aktiv)
2. Skapar sekventiella bokningar (09:00-09:45, 09:45-10:30, etc.)
3. Uppdaterar deltagares status till "booked"
4. Andrar request-status till "matched"
5. Notifierar alla deltagare

**Response:** `200 OK` `{ "message": "5 bokningar skapade", "bookingsCreated": 5 }`

---

## DELETE /api/group-bookings/[id]/participants/[pid]

Ta bort deltagare (skaparen kan ta bort andra, deltagare kan lamna).

**Auth:** Required (skaparen eller deltagaren sjalv)

**Beteende:**
- Soft delete: Markerar participant som "cancelled"
- Skaparen tar bort nagon -> notifierar borttagen deltagare
- Deltagare lamnar -> notifierar skaparen
- Inga aktiva deltagare kvar -> avbryter hela requesten

**Response:** `200 OK`
