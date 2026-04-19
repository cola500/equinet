---
title: "Messaging Bilagor — Arkitekturdesign"
description: "Designbeslut D1-D5 för bild-bilagor i messaging (S46 Slice 2)"
category: architecture
status: active
last_updated: 2026-04-19
tags: [messaging, attachments, supabase-storage, security, s46]
sections:
  - Översikt
  - D1 — Datamodell
  - D2 — Supabase Storage
  - D3 — Thumbnail
  - D4 — MIME och storlek
  - D5 — Path-struktur
  - Säkerhetsmodell
  - Manuell setup (Supabase Dashboard)
  - Relaterade beslut
---

# Messaging Bilagor — Arkitekturdesign

## Översikt

Sprint 46 (Slice 2 av Messaging-epiken) lägger till bild-bilagor i
befintliga meddelande-trådar. En bild per meddelande. Båda riktningar
(kund→leverantör, leverantör→kund).

**Scope:** Bara bild (JPEG/PNG/HEIC/WEBP). Ingen video, ingen PDF, ingen
ljud. Flerbild per meddelande är framtida möjlighet.

---

## D1 — Datamodell: fält på Message (inte separat tabell)

**Beslut:** Tre valfria kolumner läggs till på `Message`:

```prisma
model Message {
  // befintliga fält...
  attachmentUrl  String?  // Storage-path (inte publik URL): "conv_X/msg_Y.jpg"
  attachmentType String?  // MIME: "image/jpeg" | "image/png" | "image/heic" | "image/webp"
  attachmentSize Int?     // Storlek i bytes
}
```

**Invariant:** Antingen är alla tre null (inget bilaga) eller alla tre icke-null (bilaga finns).
API-routen enforcar detta vid skrivning.

**`attachmentUrl` lagrar path, inte URL.** Signed URLs genereras dynamiskt
vid GET /messages (kort expiry). Detta eliminerar risken att en cachad
URL exponerar bilagan efter att konversationen stängts.

**Alternativet som avfärdades:** Separat `MessageAttachment`-tabell.
Motiveras om multi-attachment per meddelande behövs — det är det inte i MVP.
Enklare att upgrada (lägg till tabell) än att splitta (migrera data).

---

## D2 — Supabase Storage: private bucket

**Bucket-namn:** `message-attachments`

**Åtkomstnivå:** Private (inte public).

**Signed URL-generering:**
```typescript
// Server-side, i GET /api/bookings/[id]/messages
const { data } = await supabase.storage
  .from('message-attachments')
  .createSignedUrl(message.attachmentUrl, 3600) // 1 timme expiry
```

Signed URL-expiry är 1 timme. Klienten hämtar nya meddelanden (och därmed
nya signed URLs) via SWR-polling (standard 30s). URL:er förblir giltiga
under normal sessionsanvändning.

**Varför private:**
Bilder mellan kund och leverantör är känsliga (hästskador, dokumentation).
Private bucket + signed URLs ger:
1. Ingen URL går att gissa (random path + signatur)
2. Signed URL kan inte transfereras (IP-bunden i Supabase Storage Pro, men
   vi är på Free — kompenseras av kort expiry)
3. Server enforcar ägarskap INNAN signed URL skapas (IDOR-skydd)

---

## D3 — Thumbnail: ingen server-side i MVP

**Beslut:** Ingen server-side thumbnail-generering.

**Motivering:**
- `sharp` på Vercel Serverless kräver plattformsspecifik native binary
- Supabase Image Transformation kräver Pro-plan (vi är på Free)
- CSS-skalad thumbnail räcker för MVP: `object-fit: cover; max-width: 200px`
- Full bild öppnas i modal vid klick (hela signed URL laddas ned)

**Framtida möjligheter:**
- Uppgradera till Supabase Pro → `?width=200&height=200` på storage-URL
- Eller: Vercel OG Image-generering som proxy

---

## D4 — MIME och storlek: server-side whitelist

**Tillåtna MIME-typer:**
- `image/jpeg`
- `image/png`
- `image/heic` (iPhone native-format)
- `image/webp`

**Max filstorlek:** 10 MB (10 × 1024 × 1024 = 10 485 760 bytes)

**Defense-in-depth validering:**

| Lager | Vad | Varför |
|-------|-----|--------|
| Klient | `<input accept="image/*">` | Convenience, filtrerar bort icke-bilder i fil-dialogen |
| API-route | Content-Type header + byteräkning | Stoppar uppenbara felaktiga requests |
| Supabase bucket | `allowedMimeTypes` + `fileSizeLimit` | Sista försvarslinje mot kringgången API |

**Notering om magic bytes:** Content-Type-header kan manipuleras av klienten.
Robust MIME-validering kräver läsning av de faktiska första bytena (magic bytes)
via `file-type`-paketet. I MVP accepteras header + filsuffix. Om security-reviewer
kräver magic-bytes-validering implementeras det i S46-1.

---

## D5 — Path-struktur i Storage

**Format:** `{conversationId}/{messageId}.{ext}`

**Exempel:** `conv_cm1abc2def/msg_cm2ghi3jkl.jpg`

**Egenskaper:**
- `conversationId` som prefix → enkel cleanup av hela tråden: `storage.from('...').list('conv_X/')`
- `messageId` är cuid (globalt unikt, tidssorterat) → ingen kollisionsrisk
- Filsuffix deriveras från MIME-typ (inte från klientens filnamn) → path traversal omöjlig
- Ingen användardata i path → ingen PII i Storage-loggar

**MIME → suffix mapping (server-side):**
```typescript
const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
}
```

---

## Säkerhetsmodell

### Flöde för upload (POST)

```
Klient
  → POST /api/bookings/[id]/messages (multipart/form-data)
      ↓ Auth check (session)
      ↓ Feature flag check
      ↓ Rate limit (upload: 10/h per user)
      ↓ IDOR: verifierar att boknings-ID tillhör sessionsanvändaren
      ↓ MIME-validering (Content-Type whitelist)
      ↓ Storleksvalidering (≤10 MB)
      ↓ Upload till Supabase Storage (service role key — kringgår RLS)
      ↓ Skapa Message (content + attachmentUrl + attachmentType + attachmentSize)
  → Response: { id, content, attachmentUrl: null, attachmentSignedUrl, ... }
```

**Notering:** Upload via service role key (inte anon key) — detta innebär att
Next.js API-routen har full storage-åtkomst. API-routens IDOR-skydd är det
enda som förhindrar att en kund laddar upp till en annan kunds conversation-path.

**Alternativet som avfärdades:** RLS på bucket-nivå med anon key. Supabase
Storage RLS för private buckets kräver att `auth.uid()` finns i JWT — det
fungerar för browser-direktanrop men inte för server-to-server via service role.
Vi väljer server-side IDOR-skydd (samma mönster som övriga routes) framför
komplicerade bucket-policies.

### Flöde för visning (GET)

```
Klient
  → GET /api/bookings/[id]/messages
      ↓ Auth + IDOR (samma som idag)
      ↓ För varje message med attachmentUrl:
          supabase.storage.createSignedUrl(path, 3600)
  → Response: messages[].attachmentSignedUrl (1h expiry)
```

Signed URL beror på korrekt ägarskapscheck i API-routen — ingen extra bucket-policy
behövs för att förhindra IDOR.

---

## Manuell setup (Supabase Dashboard)

S46-0 kräver manuell bucket-skapning. Steg:

1. **Supabase Dashboard → Storage → New bucket**
   - Name: `message-attachments`
   - Public: **NEJ** (private)
   - File size limit: `10485760` (10 MB)
   - Allowed MIME types: `image/jpeg,image/png,image/heic,image/webp`

2. **Service role key används i Next.js** (befintlig `SUPABASE_SERVICE_ROLE_KEY`)
   — ingen ny miljövariabel behövs

3. **Inga extra bucket RLS-policies behövs** (API-routen autentiserar och
   använder service role)

**Lokal dev:** `supabase start` skapar INTE buckets automatiskt. Lokal bucket
skapas via Supabase Dashboard (local: `http://localhost:54323/project/default/storage`).

---

## Relaterade beslut

| Dokument | Relation |
|----------|----------|
| [epic-messaging.md](../ideas/epic-messaging.md) | Slice 2 av messaging-epiken |
| [docs/plans/s46-0-plan.md](../plans/s46-0-plan.md) | Plan-fil med samma beslut (kortare) |
| [.claude/rules/api-routes.md](../../.claude/rules/api-routes.md) | API-säkerhetsmönster som gäller S46-1 |
| [prisma/schema.prisma](../../prisma/schema.prisma) | Uppdaterat schema (S46-0 migration) |
