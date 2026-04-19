---
title: "Sprint 46: Messaging Slice 2 — bilagor (bild)"
description: "Kund skickar bild på hästskada inför vet/hovslagarbesök. Supabase Storage + MIME-validering + thumbnail. Första feature-sprint efter S45 process-hardening."
category: sprint
status: planned
last_updated: 2026-04-19
tags: [sprint, messaging, supabase-storage, attachments, security]
sections:
  - Sprint Overview
  - Stories
  - Risker
  - Definition of Done
---

# Sprint 46: Messaging Slice 2 — bilagor (bild)

## Sprint Overview

**Mål:** Implementera bild-bilagor i messaging per epic Slice 2. Kund kan skicka bild på häst/skada i befintlig tråd → leverantör ser bilden i sin tråd. Supabase Storage med MIME-validering, storleksgräns, thumbnail.

**Per epic:** [epic-messaging.md](../ideas/epic-messaging.md) Slice 2. Effort 1-2 dagar. Värde: högt för veterinär/hovslagare.

**Scope-avgränsning:**
- **Bara bild** (JPEG/PNG/HEIC). Ingen video, ingen PDF, ingen ljud (det är Slice 4).
- **Bara en bild per meddelande**. Flerbild kan komma senare.
- **Båda håll** — kund och leverantör kan skicka.
- **Textmeddelanden fortsätter fungera som tidigare** (ingen regression).

**Första riktig feature-sprint efter S45 process-hardening.** Processen ska bevisa sig själv — målet är procedurbrott ≤ 2.

---

## Stories

### S46-0: Plan + schema + storage-setup

**Prioritet:** 0
**Effort:** 1-2h
**Domän:** docs + prisma + infra (`prisma/schema.prisma` + Supabase Storage bucket)

Detaljerad plan + schema-beslut + Supabase Storage-bucket-config.

**Designbeslut att göra:**
- **D1:** Utöka `Message`-modellen med valfria fält (`attachmentUrl`, `attachmentType`, `attachmentSize`) ELLER separat `MessageAttachment`-tabell (relation)?
- **D2:** Supabase Storage bucket-namn, RLS-policies, public vs private (private + signed URLs rekommenderat)
- **D3:** Thumbnail-generering — server-side (Supabase edge function, sharp i API) eller klient-sida?
- **D4:** MIME + storlek — whitelist `image/jpeg|png|heic`, max 10 MB
- **D5:** Bucket-path-struktur: `messages/{conversationId}/{messageId}/{filename}` eller UUID-baserad?

**Leverabler:**
- `docs/plans/s46-0-plan.md` committad FÖRE implementation (S45-0-hook ska varna om detta glöms)
- `docs/architecture/messaging-attachments.md` — designdokument med D1-D5 motivering
- Schema-migration (om vald: egen tabell) eller schema-patch (om vald: fält på Message)
- Supabase Storage bucket skapad + RLS-policies dokumenterade

**Reviews:** tech-architect (plan) + security-reviewer (RLS + storage-policies + MIME-whitelist)

**Arkitekturcoverage:** N/A (skapar design)

---

### S46-1: API + upload-endpoint (TDD)

**Prioritet:** 1
**Effort:** 3-4h
**Domän:** `src/app/api/conversations/[id]/messages/route.ts` + `src/domain/conversation/`

Utöka `POST /api/conversations/[id]/messages` för att acceptera bild-upload. Alternativt: separat endpoint `POST /api/conversations/[id]/messages/attachments`.

**BDD dual-loop:**
- RED: integration-test `messages-with-attachment.integration.test.ts` — uppladdning lyckas, returneras URL
- Inre loop: unit-tester för MIME-validering, signed URL-generering, filstorlek-check
- GREEN: integrationstest grönt

**Säkerhetschecklista (per api-routes.md):**
- [ ] Auth: providerId/customerId från session (inte request body)
- [ ] IDOR: `findByIdForX` på conversation-ägare
- [ ] Zod-schema `.strict()` på multipart/form-data
- [ ] Rate-limit: specifikt för uploads (10/h per user?)
- [ ] MIME-validering **server-side** (inte trust client)
- [ ] Storleksgräns server-side
- [ ] Sanitera filnamn (path traversal)

**Reviews:** security-reviewer + code-reviewer

**Arkitekturcoverage:** verifiera att alla D1-D5 från S46-0 är implementerade

---

### S46-2: UI — skicka bild + visa i tråd

**Prioritet:** 2
**Effort:** 3-4h
**Domän:** `src/components/customer/bookings/MessagingDialog.tsx` + `src/app/provider/messages/[bookingId]/page.tsx`

**Klient-UX:**
- Bilaga-ikon i skicka-formulär (båda rollerna)
- Fil-input accepts `image/*` (inte alla filer)
- Preview innan skicka
- Progress-indikator under upload
- Bilder i tråd: thumbnail som klickbart → fullvy (modal)
- Fallback: "Bilden kunde inte laddas" vid signed URL-fel

**Mobile-UX:**
- iPhone: triggera kamera direkt via `capture="environment"` (valfritt)
- Touch-target ≥44pt på bilaga-knapp och thumbnail

**Reviews:** cx-ux-reviewer (använd review-manifest messaging-sektion + touch-targets + svenska strängar) + code-reviewer

**Arkitekturcoverage:** N/A

---

### S46-3: iOS WebView-verifiering + backlogg-fynd

**Prioritet:** 3
**Effort:** 1-2h
**Domän:** ios (mobile-mcp audit)

**Aktualitet verifierad:**
- iOS är WebView för messaging (S37-rollout) — slice 2 bör fungera utan native-ändring
- Men: file-picker i WebView kan ha iOS-specifika problem (foto-galleri-åtkomst, HEIC-konvertering)

**Implementation:**
- mobile-mcp: öppna tråd, försök skicka bild från foto-galleri
- Verifiera: foto-access-permission-prompt visas, bild laddas upp, thumbnail renderas
- HEIC: verifiera konvertering (Safari konverterar automatiskt i `<input capture>`?)

**Deliverables:**
- Retro-anteckning i `docs/metrics/ios-audit-2026-04-XX-messaging-attachments.md`
- Backlog-rader för native-fixar (om några)

**Reviews:** ingen subagent (audit, inte kod)

**Arkitekturcoverage:** N/A

---

## Risker

| Risk | Sannolikhet | Mitigering |
|------|-------------|-----------|
| HEIC-bilder från iPhone inte standard-renderbara | Hög | Konvertera server-side till JPEG, eller förlita oss på Safari's automatkonvertering |
| Supabase Storage-kostnad ökar vid många bilder | Låg | 10 MB × 10 uploads/dag × 30 dagar = 3 GB/månad — låg kostnad |
| Rate-limit på upload otillräckligt → spam | Medel | 10/h per user, 50/h per conversation. Justera efter mätning. |
| RLS-hål: kund ser annan kunds bild-URL | **Kritisk** | Security-reviewer obligatorisk. Signed URLs med kort expiry + RLS på bucket-nivå. |
| WebView kan inte hämta från Supabase Storage pga CORS | Medel | Testa i S46-3. Fallback: proxy via Next.js API. |
| Kund trycker "skicka bild" men upload failar → meddelande skickas utan bilaga | Medel | Transactional: upload FÖRST, sedan skapa Message. Om upload failar → inget meddelande. |

---

## Definition of Done (sprintnivå)

- [ ] Alla 4 stories done
- [ ] Plan-commit FÖRE implementation för varje story (S45-0-hook grön)
- [ ] Tech-architect + security-reviewer godkänt S46-0-planen + S46-1-API
- [ ] cx-ux-reviewer godkänt S46-2-UI
- [ ] iOS-audit genomförd (S46-3)
- [ ] Kund kan skicka bild, leverantör ser den (och vice versa)
- [ ] Signed URLs med expiry, inget läckage av andras bilder
- [ ] `npm run check:all` 4/4 grön
- [ ] Sprint-avslut körd KORREKT (tech-lead-review på retro + status)
- [ ] Procedurbrott ≤ 2 (test av S45-automation)

**Flag för procedurbrott-uppföljning:** Detta är **första feature-sprint efter process-hardening**. Vi mäter om hooks faktiskt hjälper. Om brotten är >5 = automation räcker inte, behöver strukturell förändring (som väntar i backloggen).
