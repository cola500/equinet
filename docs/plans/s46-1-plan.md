---
title: "S46-1 Plan: API + upload-endpoint (TDD)"
description: "Upload-endpoint för bild-bilagor, rate limiter, repository-utökning, signed URL i GET"
category: plan
status: active
last_updated: 2026-04-20
tags: [s46, messaging, attachments, api, tdd]
sections:
  - Aktualitet verifierad
  - Syfte
  - Blockers från S46-0-review
  - Operationsordning
  - Faser
  - Säkerhetschecklist
  - Risker
---

# S46-1 Plan: API + upload-endpoint (TDD)

## Aktualitet verifierad

**Kommandon körda:** N/A (nyskriven sprint-story)
**Resultat:** N/A
**Beslut:** Fortsätt — S46-1 är ny story, inga befintliga filer att verifiera mot

---

## Syfte

Implementera server-side upload-endpoint för bild-bilagor i messaging.
Kund eller leverantör skickar en bild → lagras i Supabase Storage →
Message-raden skapas med `attachmentUrl/Type/Size` → GET /messages
returnerar signed URL.

---

## Blockers från S46-0-review (måste lösas här)

- **BLOCKER-A:** Upload-specifik rate limiter `messageUpload` (10/h per user)
- **BLOCKER-B:** Client-given path förhindras — all path-konstruktion server-side
- **MAJOR-1:** Transaktionellt mönster — upload EFTER message-skapande
- **MAJOR-3:** Magic bytes-validering (`file-type`-paketet)

---

## Operationsordning (löser messageId-problemet)

Upload sker EFTER Message skapas i DB. MessageId genereras med
`crypto.randomUUID()` i API-routen och skickas som explicit `id` till
`createMessage`. Path byggs med `bookingId` (känt upfront) + messageId:

```
bookingId känt → messageId = crypto.randomUUID()
→ createMessage(id=messageId, content="", attachmentUrl=null, ...) → Message-rad
→ upload till "{bookingId}/{messageId}.{ext}"
→ updateMessageAttachment(messageId, url, type, size)
→ om upload fail → deleteMessage(messageId) → returnera 500
→ om updateMessageAttachment fail → log orphaned file → returnera 500
```

Invariant: antingen har Message-raden ALLA tre attachment-fält satta, eller INGA.

**Varför bookingId i path (inte conversationId):**
bookingId är känt före DB-anrop. conversationId kräver ett extra SELECT
eller upsert. bookingId → conversationId är trivialt att härleda vid cleanup.

---

## Faser

### Fas 1: Rate limiter + beroenden

**Filer:** `src/lib/rate-limit.ts`

- Lägg till `messageUpload` limiter: `slidingWindow(10, "1 h")` (prod)
- In-memory fallback: `{ max: 100, window: 60 * 60 * 1000 }` (laxare i test)
- Ingen ny dependency — `crypto.randomUUID()` finns inbyggt i Node 18+
- `file-type` installeras: `npm install file-type` (magic bytes-validering)

### Fas 2: Repository-utökning (TDD)

**Filer:**
- `src/infrastructure/persistence/conversation/IConversationRepository.ts`
- `src/infrastructure/persistence/conversation/PrismaConversationRepository.ts`
- `src/infrastructure/persistence/conversation/MockConversationRepository.ts`

**Ändringar:**

`Message`-interface: lägg till tre nullable fält:
```typescript
attachmentUrl: string | null
attachmentType: string | null
attachmentSize: number | null
```

`CreateMessageData`: lägg till:
```typescript
id?: string          // Externt genererat — om ej satt genereras av Prisma
attachmentUrl?: string
attachmentType?: string
attachmentSize?: number
```

`messageSelect`: lägg till de tre fälten.

Ny metod `updateMessageAttachment(messageId, data)`:
```typescript
updateMessageAttachment(
  messageId: string,
  data: { attachmentUrl: string; attachmentType: string; attachmentSize: number }
): Promise<void>
```

Ny metod `deleteMessage(messageId)`:
```typescript
deleteMessage(messageId: string): Promise<void>
```

### Fas 3: ConversationService-utökning (TDD)

**Fil:** `src/domain/conversation/ConversationService.ts`

`SendMessageInput`: lägg till valfria attachment-fält:
```typescript
attachment?: {
  url: string
  type: string
  sizeBytes: number
}
```

`sendMessage`: hoppa över CONTENT_EMPTY-check om `attachment` är satt (bilaga
kan sakna text-caption). Skicka vidare attachment-fälten till `createMessage`.

### Fas 4: Storage-helper (TDD med mock)

**Fil:** `src/lib/supabase-storage.ts` (utökas)

Tre nya funktioner för message-attachments:

```typescript
const MESSAGE_BUCKET = 'message-attachments'
const MESSAGE_ALLOWED_MIME = ['image/jpeg','image/png','image/heic','image/webp']
const MESSAGE_MAX_SIZE = 10 * 1024 * 1024 // 10 MB

// Upload — returnerar storage-path
uploadMessageAttachment(bookingId, messageId, buffer, mimeType): Promise<string>

// Delete
deleteMessageAttachment(path): Promise<void>

// Signed URL (1h expiry)
createMessageSignedUrl(path): Promise<string | null>
```

Magic bytes-validering med `file-type`:
```typescript
import { fileTypeFromBuffer } from 'file-type'
const detected = await fileTypeFromBuffer(buffer)
if (!MESSAGE_ALLOWED_MIME.includes(detected?.mime ?? '')) throw new Error(...)
```

### Fas 5: Upload-endpoint (TDD — BDD dual-loop)

**Fil:** `src/app/api/bookings/[id]/messages/attachments/route.ts`

`POST /api/bookings/[id]/messages/attachments` — multipart/form-data:
- `file`: bild
- `caption` (optional): textkommentar (max 500 tecken)

Säkerhetsordning:
1. Auth (session null-guard)
2. Feature flag
3. Rate limit `messageUpload`
4. IDOR: `loadBookingForMessaging` (bookingId tillhör sessionsanvändaren)
5. Parse `request.formData()`
6. MIME-validering (Content-Type header + magic bytes via file-type)
7. Storleksvalidering (≤ 10 MB)
8. Skapa Message i DB med extern messageId
9. Upload till Storage
10. Uppdatera Message med attachmentUrl/Type/Size
11. Vid fel i steg 9-10: deleteMessage → returnera 500

### Fas 6: GET response — signed URLs

**Fil:** `src/app/api/bookings/[id]/messages/route.ts`

Uppdatera GET-responsen: för varje message med `attachmentUrl != null`,
generera signed URL och inkludera `attachmentSignedUrl` i response.

```typescript
// I GET-handlers response-mappning:
attachmentSignedUrl: m.attachmentUrl
  ? await createMessageSignedUrl(m.attachmentUrl)
  : null
```

---

## Säkerhetschecklist (per api-routes.md)

- [x] Auth: providerId/customerId från session (aldrig request body)
- [x] IDOR: `loadBookingForMessaging` körs INNAN storage-anrop
- [x] Rate limit: `messageUpload` (10/h) EFTER auth, FÖRE body-parse
- [x] MIME: server-side whitelist + magic bytes
- [x] Storlek: ≤ 10 MB server-side
- [x] Path: 100% server-konstruerad (bookingId + messageId — aldrig klient-sträng)
- [x] Zod: `.strict()` på caption-fält
- [x] Svenska felmeddelanden
- [x] `logger` (inte `console.*`)

---

## Risker

| Risk | Mitigering |
|------|-----------|
| `file-type` stöder inte HEIC-validering | Testa i implementationen. Fallback: whitelist Content-Type |
| Vercel 4.5 MB body-limit för formData | `request.formData()` i App Router kringgår bodyParser — verifiera |
| Orphaned Message om upload failar | `deleteMessage(messageId)` i catch-blocket |
| Orphaned file om updateMessageAttachment failar | Logga sökvägen med `logger.error` — manuell cleanup möjlig |
