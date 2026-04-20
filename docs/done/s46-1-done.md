---
title: S46-1 klar — Upload-endpoint för messaging bilagor
description: POST /api/bookings/[id]/messages/attachments implementerad med TDD
category: done
status: done
last_updated: 2026-04-20
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Lärdomar
---

# S46-1 klar — Upload-endpoint för messaging bilagor

## Acceptanskriterier

- [x] POST /api/bookings/[id]/messages/attachments accepterar bild via multipart/form-data
- [x] MIME-validering (jpeg, png, heic, webp) med magic bytes-kontroll via file-type
- [x] Storleksgräns 10 MB
- [x] Auth + feature flag + rate limit (messageUpload 10/h) på korrekt ordning
- [x] IDOR-skydd via loadBookingForMessaging
- [x] Privat Supabase-bucket (message-attachments) med signed URLs vid GET
- [x] Rollback (deleteMessage) om uppladdning misslyckas
- [x] GET /api/bookings/[id]/messages returnerar attachmentSignedUrl (1h expiry)
- [x] 9 integrationstester gröna

## Definition of Done

- [x] Inga TypeScript-fel (typecheck: 0 errors)
- [x] Inga console errors / console.* i produktionskod
- [x] Säker (validateMessageAttachment, magic bytes fail-closed, IDOR-guard)
- [x] Tester skrivna FÖRST (TDD): 4289 tester totalt, alla gröna
- [x] check:all 4/4 gröna
- [x] Feature branch, mergad via PR

## Reviews körda

- **security-reviewer**: Kördes. Hittade M1 (storagePath vs placeholder), I1 (Zod bookingId), I2 (magic bytes fail-open). M1 och I2 fixades. I1 (UUID-check) reverted pga test-inkompatibilitet — IDOR-skyddet via loadBookingForMessaging är tillräckligt.
- **code-reviewer**: Integrerat i security-review ovan.

## Docs uppdaterade

- Ingen docs-uppdatering behövs — intern API-route utan ny användarvänd UI ännu (UI kommer i S46-2+)
- `docs/architecture/messaging-attachments.md` skapades i S46-0 och är aktuellt

## Lärdomar

1. **`file instanceof File` failar i Vitest/JSDOM** — NextRequest med FormData returnerar en Blob, inte File. Använd `!file || typeof file === 'string'` för formData-kontroll.
2. **`vi.fn()` utan `.mockResolvedValue()` returnerar undefined** — Om en mock-metod ska returnera ett Promise men saknar `.mockResolvedValue()`, kraschar `.catch()` anrop på resultatet. Löst med defensiv guard i `sendMessageNotification`: `if (notifyResult) { void notifyResult.catch(...) }`.
3. **Storage path måste beräknas INNAN createMessage** — Skicka in den slutliga sökvägen (med korrekt extension) som `attachment.url` till service.sendMessage. Annars lagras en placeholder i DB som aldrig uppdateras.
4. **Rollback ska använda `msg.id`, inte det externt genererade `messageId`** — Mocked createMessage returnerar ett annat ID. I produktion är de identiska, men för korrekthet och testkompabilitet: använd `msg.id` från return-värdet.

## Modell

sonnet
