---
title: "S46-2 Done: UI — skicka bild + visa i tråd"
category: done
status: done
last_updated: 2026-04-20
---

# S46-2 Done: UI — skicka bild + visa i tråd

## Acceptanskriterier

- [x] Bilaga-ikon (Paperclip) i compose-area för kund (MessagingDialog) och leverantör (thread page)
- [x] Fil-input accept="image/*" utan capture (galleri + kamera via OS-native picker)
- [x] Klient-side UX-validering: MIME-whitelist + max 10 MB med svenska toast-meddelanden
- [x] Preview innan skicka (AttachmentPreview, 80×80 thumbnail med ta-bort-knapp)
- [x] Progress-indikator under upload (skicka-knapp visar "Laddar upp...")
- [x] Bilder i tråd: AttachmentBubble (klickbar thumbnail → ImageFullscreenModal)
- [x] Fallback: retry-knapp "Bilden kunde inte laddas" vid img-fel (täcker utgångna signed URLs)
- [x] Touch-targets ≥44pt: Paperclip-knapp, ta-bort-knapp, skicka-knapp, thumbnail, fallback-knapp
- [x] Textmeddelanden fortsätter fungera utan regression (4302 tester gröna)

## Definition of Done

- [x] Inga TypeScript-fel
- [x] Inga console errors (clientLogger används)
- [x] Säker (MIME + storlek, servern validerar alltid — klienten är UX-guard)
- [x] Tester: check:all 4/4 grön (UI-story, inga nya unit-tester krävda per testing.md-regler)
- [x] Feature branch, mergad via PR

## Reviews körda

**cx-ux-reviewer** — kördes på alla tre ändrade filer.

Findings:
- Major 1: `autoFocus` på Textarea → FIXAT (borttaget)
- Major 2: `capture="environment"` tvingar kamera, hindrar galleri-val → FIXAT (borttaget)
- Major 3: X-knapp touch-target 24px → FIXAT (min-h/w-[44px])
- Minor: dubbel progress-text → FIXAT (borttaget, knapp-label räcker)
- Minor: "Bilden kunde inte laddas" saknar retry → FIXAT (knapp som nollställer imgError-state)
- Suggestion: optimistisk uppdatering för bilagor → SKJUTET (scope S46-4, komplex)
- Suggestion: datumrubrik i tråd → SKJUTET (backlog, gäller alla meddelanden, inte bilage-specifikt)

**code-reviewer** — kördes på alla tre ändrade filer.

Findings:
- Major 1: `autoFocus` → FIXAT
- Major 2: duplicerade ALLOWED_MIME/MAX_SIZE-konstanter → FIXAT (extraherat till `src/lib/messaging-constants.ts`)
- Minor: oanvänd `Image`-import → FIXAT (borttaget)
- Minor: saknat `aria-hidden` på X-ikon → FIXAT
- Minor: dubbel useEffect cleanup-revoke → ACCEPTERAT (idempotent, lägre risk än att bryta cleanup-kedjan)
- Minor: scrollIntoView saknar optimistisk scroll vid upload-start → ACCEPTERAT (scope)
- Suggestion: `capture="environment"` → FIXAT (se ovan)

## Docs uppdaterade

Ingen docs-uppdatering krävd (intern UI-feature utan ändring i help-artiklar eller operations).
MessagingDialog och provider thread page är feature-flaggade bakom `messaging` — ingen officiell release ännu.

## Arkitekturcoverage

S46-2 implementerar UI-lagret. Inga D1-D5 designbeslut från S46-0 berörs av UI-storien.
API-kontraktet (S46-1) — `attachmentSignedUrl`, `attachmentType`, `attachmentSize` — konsumeras korrekt.

## Verktyg använda

- Läste patterns.md vid planering: ja — identifierade ResponsiveDialog, toast-mönster
- Kollade code-map.md: nej (visste var filerna var)
- Hittade matchande pattern: ResponsiveDialog för fullskärmsmodal, displayMessages-pattern

## Modell

sonnet

## Lärdomar

- **`capture="environment"` är kontraproduktivt** — triggar direkt kamera utan galleri-väljare på mobil. Standard `accept="image/*"` ger OS-native picker med båda valen. Lägg till i gotchas.
- **Duplicerade UI-konstanter** är en risk vid MIME-expansion — samla dem i delad fil redan från start.
- **CX-UX-review fångade autoFocus-gotcha** som var dokumenterad i review-manifestet men ändå lekte igenom. Manifestet är värdefullt — bekräftar att det är värt att läsa varje gång.
- **Retry-knapp på misslyckad img-load** är ett bra mönster för signed URLs med kort expiry — SWR-revalidation hämtar nya URLs automatiskt vid nästa poll.
