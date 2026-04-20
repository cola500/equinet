---
title: "S46-2 Plan: UI — skicka bild + visa i tråd"
description: "Bilaga-stöd i messaging UI för kund (MessagingDialog) och leverantör (provider thread page)"
category: plan
status: active
last_updated: 2026-04-20
sections:
  - Approach
  - Filer
  - Faser
  - Säkerhetsöverväganden
  - Risker
---

# S46-2 Plan: UI — skicka bild + visa i tråd

## Aktualitet verifierad

**Kommandon körda:** N/A (nyskriven sprint-story)
**Resultat:** S46-1 mergad till main (PR #238). Backend-API klart.
**Beslut:** Fortsätt

## Approach

Strategy: Layer-by-layer (ren UI-story, API finns klart via S46-1).

Backend (S46-1) exponerar:
- `POST /api/bookings/[id]/messages/attachments` — multipart upload, returnerar message-objekt
- `GET /api/bookings/[id]/messages` — returnerar `attachmentSignedUrl`, `attachmentType`, `attachmentSize` per meddelande

Inga nya API-routes. Inga schema-ändringar.

## Filer som ändras/skapas

| Fil | Åtgärd |
|-----|--------|
| `src/components/provider/messages/AttachmentBubble.tsx` | Ny — delade thumbnail + fullskärm |
| `src/components/customer/bookings/MessagingDialog.tsx` | Ändra — bilaga-ikon, upload, rendering |
| `src/app/provider/messages/[bookingId]/page.tsx` | Ändra — bilaga-ikon, upload, rendering |

## Faser

### Fas 1: Delade UI-komponenter

`src/components/provider/messages/AttachmentBubble.tsx`

Innehåller:
- `AttachmentBubble` — visar bilaga i tråden (thumbnail + klick → fullskärm)
- `ImageFullscreenModal` — Dialog med full bild + stäng-knapp
- `AttachmentPreview` — preview av vald fil innan skicka (med ta-bort-knapp)

Inga tester (UI-komponenter, verifieras via typecheck).

### Fas 2: MessagingDialog.tsx (kund)

Tillägg:
- `Message`-interface: lägg till `attachmentSignedUrl?`, `attachmentType?`, `attachmentSize?`
- State: `attachedFile`, `attachmentPreviewUrl`, `isUploading`
- `fileInputRef` + hidden `<input type="file" accept="image/*" capture="environment">`
- Paperclip-ikon (Paperclip från lucide-react) i compose-area — min-h-[44px]
- `handleFileSelect()` — klient-side UX-validering (MIME + storlek)
- `handleSendAttachment()` — FormData POST till `/api/bookings/[id]/messages/attachments`
- `AttachmentPreview` i compose-area när fil vald
- Progress-indikator: "Laddar upp..." text vid `isUploading`
- `AttachmentBubble` i tråden för meddelanden med `attachmentSignedUrl`
- Skicka-knapp är disabled när `isUploading`

Skicka-logik: om `attachedFile` finns → `handleSendAttachment()`, annars `handleSend()`.
Text och bilaga är SEPARATA meddelanden (inte blandat).

### Fas 3: Provider thread page

Samma tillägg som Fas 2, men:
- senderType: "PROVIDER" i optimistisk update
- `VoiceTextarea` behålls (ej ersätta med Textarea)

## Säkerhetsöverväganden

- Klient-side MIME/storlek-check är UX, INTE säkerhet (server validerar alltid)
- Ingen `URL.createObjectURL` läcker — revoke vid cleanup och vid unmount
- `capture="environment"` är valfritt hint till mobilen, ej säkerhetskritiskt
- `attachmentSignedUrl` kommer från API — renderas som `<img src>`, ingen eval

## Risker

- HEIC-bilder: `<img>` renderar HEIC i Safari men inte Chrome/Firefox. 
  Mitigering: visa alltid `<img>` — om den inte kan visas syns alt-text "Bilden kunde inte laddas".
- Signed URL expiry: efter 1h kan bilden inte laddas om tråden är öppen länge.
  Mitigering: SWR refreshInterval 10s revaliderar och hämtar nya URLs automatiskt.
- Stor bild = lång upload-tid.
  Mitigering: progress-indikator + disabled state.
