---
title: "S46-0 Plan: Messaging bilagor — plan + schema + storage-setup"
description: "Designbeslut D1-D5, Prisma-schema, Supabase Storage bucket-config"
category: plan
status: active
last_updated: 2026-04-19
tags: [messaging, attachments, supabase-storage, prisma, s46]
sections:
  - Syfte
  - Designbeslut
  - Filer som ändras
  - Approach
  - Risker
---

# S46-0 Plan: Messaging bilagor — plan + schema + storage-setup

## Aktualitet verifierad

**Kommandon körda:** N/A (nyskriven sprint-story)
**Resultat:** N/A
**Beslut:** Fortsätt — S46-0 är ny story, inget att verifiera mot befintlig kod

---

## Syfte

Etablera arkitekturen för bild-bilagor i messaging: ta besluten D1-D5,
skapa Prisma-migration och dokumentera Supabase Storage-setup. Inga API-
eller UI-ändringar — det är S46-1 och S46-2.

---

## Designbeslut

### D1: Bilaga-data på Message-modellen (inte separat tabell)

**Beslut:** Utöka `Message` med tre valfria fält: `attachmentUrl`, `attachmentType`, `attachmentSize`.

**Motivering:**
- Scope: "en bild per meddelande" — relation utan att det skapar ett problem
- Enklare query: inga extra JOIN:ar när man listar meddelanden
- Enklare rollback: ta bort tre kolumner vs en hel tabell
- Separat tabell motiveras om multi-attachment per meddelande behövs (Slice 2+),
  men det är inte aktuellt nu

**Schema-patch:**
```prisma
model Message {
  // ... befintliga fält ...
  attachmentUrl  String?   // Supabase Storage path (inte publik URL)
  attachmentType String?   // MIME-typ: "image/jpeg" | "image/png" | "image/heic" | "image/webp"
  attachmentSize Int?      // Storlek i bytes
}
```

`attachmentUrl` lagrar storage-pathen (inte signed URL) — signed URLs genereras
dynamiskt vid GET /messages med kort expiry.

---

### D2: Supabase Storage — private bucket

**Bucket-namn:** `message-attachments`

**Åtkomstnivå:** Private (inte public). Signed URLs genereras server-side
med 1 timmes expiry (`createSignedUrl`).

**Varför private:**
- Kund- och leverantörs-bilder ska aldrig vara åtkomliga utan auth
- Signed URL-mönstret eliminerar IDOR-risken på URL-nivå (URL:en är unik
  per request och beror på server-side behörighetskoll)

**Supabase Storage RLS-policies (bucket-nivå):**
- INSERT: `auth.uid()` måste tillhöra conversation (via booking-ägarskap)
- SELECT: `auth.uid()` måste tillhöra conversation (samma villkor)
- DELETE: `auth.uid()` måste vara avsändaren

**Praktisk setup:**
Bucket skapas via Supabase Dashboard (inte SQL-migration) — `supabase storage`
CLI-stöd är begränsat. Policies dokumenteras i `docs/architecture/messaging-attachments.md`.

---

### D3: Thumbnail-generering — ingen server-side i MVP

**Beslut:** Ingen server-side thumbnail-generering i S46.

**Motivering:**
- `sharp` på Vercel serverless kräver native binaries (plattformsberoende build)
- Supabase Storage Image Transformation är tillgänglig (`?width=200`) men kräver
  Pro-plan (vi är på Free tier)
- Klient-sidan visar CSS-skalad thumbnail (`object-fit: cover`, `max-width: 200px`)
- Full bild öppnas i modal vid klick

**Konsekvens:** Stor bild (max 10 MB) laddas ned vid modal-öppning. Acceptabelt
för MVP — bilder fogas ofta i sammanhang (vet-besök) där användarens vilja
att se hela bilden är hög.

---

### D4: MIME + storlek — server-side whitelist

**Tillåtna MIME-typer:** `image/jpeg`, `image/png`, `image/heic`, `image/webp`

**Max storlek:** 10 MB (10 × 1024 × 1024 bytes)

**Validering sker på tre ställen (defense in depth):**
1. Klient: `<input accept="image/*">` (convenience, inte säkerhet)
2. API-route: kontrollera `Content-Type` header + byteräkning (Zod)
3. Supabase Storage: bucket-policy `allowedMimeTypes` + `maxFileSize`

**Säkerhetsnotering:** Klienten kan ljuga om `Content-Type`. Server-side
måste läsa de faktiska första bytena (magic bytes) om vi vill vara strikta.
MVP accepterar content-type-header + filsuffix. Förbättring: `file-type`-paketet
för magic bytes (kan läggas till i S46-1 om security-reviewer kräver det).

---

### D5: Bucket path-struktur

**Format:** `{conversationId}/{messageId}.{ext}`

**Exempel:** `conv_abc123/msg_xyz789.jpg`

**Varför:**
- `conversationId` som prefix möjliggör enkel cleanup av hela tråden
- `messageId` är globalt unikt (cuid) — ingen risk för kollision
- Ingen timestamp behövs (messageId innehåller tid implicit)
- Enkelt att hitta alla bilagor för en tråd: `list("conv_abc123/")`

---

## Filer som ändras/skapas

| Fil | Operation | Typ |
|-----|-----------|-----|
| `docs/plans/s46-0-plan.md` | Skapad | Lifecycle-doc (direkt main) |
| `docs/architecture/messaging-attachments.md` | Skapad | Arkitekturdokument (feature branch) |
| `prisma/schema.prisma` | Ändrad | Schema-patch (feature branch) |
| `prisma/migrations/*/migration.sql` | Skapad | SQL-migration (feature branch) |

**Inga** `src/`-filer ändras i S46-0.

---

## Approach (steg)

1. Committa denna plan-fil direkt på main + push
2. Skapa feature branch `feature/s46-0-plan-schema-storage`
3. Skapa `docs/architecture/messaging-attachments.md` med fullständig D1-D5-dokumentation
4. Patcha `prisma/schema.prisma` med tre nya kolumner på `Message`
5. Kör `npx prisma migrate dev --name add-message-attachment-fields`
6. Kör tech-architect + security-reviewer review
7. Fixa ev. blockers från review
8. Committa done-fil + uppdatera status.md
9. PR + merge

---

## Risker

| Risk | Sannolikhet | Mitigering |
|------|-------------|-----------|
| Signed URL-expiry för kort → bild laddas inte i tråden | Medel | 1h expiry per GET-anrop. UI revaliderar SWR när meddelanden hämtas — URL är färsk |
| Magic-bytes-check saknas → MIME-spoofing | Medel | Noterat i D4. Om security-reviewer flaggar: lägg till `file-type` i S46-1 |
| Supabase Storage bucket-creation kräver manuell action | Hög | Dokumenterat i detta plan + arkitektur-doc. Johan skapar bucket + policies via Dashboard |
| `attachmentUrl` lagrar path, inte URL → gammal kod läcker path i GET /messages | Låg | S46-1 bygger signed URL-generering. `attachmentUrl` är null för alla befintliga meddelanden |
