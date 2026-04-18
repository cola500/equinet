---
title: "Epic: Bokningskommunikation i Equinet"
description: "Meddelandefunktion mellan leverantör och kund, slicad enligt Seven Dimensions"
category: idea
status: active
last_updated: 2026-04-18
tags: [messaging, epic, seven-dimensions, post-launch]
sections:
  - Epic
  - Personas och värde
  - Slicing enligt Seven Dimensions
  - Beslut
  - Nästa steg
---

# Epic: Bokningskommunikation i Equinet

## Epic

**Som leverantör vill jag hantera all bokningskommunikation i Equinet så att jag minskar context-switching mellan kanaler (SMS, samtal, Messenger) och upplevs professionell av mina kunder.**

## Personas och värde

| Persona | Smärta idag | Förväntat värde |
|---------|-------------|-----------------|
| **Leverantör (primär)** | Byter mellan SMS, samtal, Messenger, mail för 10-50 kunder. Hög kognitiv belastning. | Ett ställe för all bokningskommunikation. Minskad context-switching. |
| **Kund (sekundär)** | Låg -- har bara en leverantör per gång. | Stannar i Equinet istället för att hoppa till SMS. Upplevd professionalism. |

**Success-mått:**
- Upplevd professionalism (NPS / enkät)
- Ekosystem-retention ("leverantören sköter alla hästgrejer i appen")
- (Sekundärt) Svarstid leverantör → kund

## Slicing enligt Seven Dimensions

Slicing gjord 2026-04-18 med Richard Lawrence's Seven Dimensions-ramverk. Fem slices identifierade, MVP valt.

### Slice 1 (MVP) -- Per bokning: tvåvägs text, polling

**Dimensioner kombinerade:**
- **Workflow step:** bara aktiva bokningar (inte före bokning, inte efter arkiverad)
- **Simple/Complex:** ren text, inga bilagor, inga reaktioner
- **Defer Performance:** SWR-polling var 30s (ingen Realtime)
- **Major Effort uppskjuten:** ingen läskvitto, ingen "skriver nu"-indikator

**Leverans:**
- Ny `Conversation`/`Message`-domän (kärndomän, repository obligatoriskt)
- Inkorg-vy: alla leverantörens aktiva bokningar med olästa meddelanden
- Tråd-vy: per-bokning chat-historik + skriv-fält
- Push-notifiering vid nytt meddelande
- Webb + iOS (WebView räcker initialt, native senare)

**Effort:** ~4-5 dagar. Ger uppskattat 80% av värdet.

### Slice 2 -- Bilagor (bild)

Kund skickar bild på hästskada inför veterinärbesök eller hovslagarbesök. Supabase Storage + MIME-validering + thumbnail-generering.

**Värde:** Högt för veterinär/hovslagar-specifika domäner. Leverantör kan förbereda sig bättre.

**Effort:** 1-2 dagar.

### Slice 3 -- Realtid

Supabase Realtime ersätter SWR-polling. Meddelanden syns direkt utan 30s-fördröjning.

**Värde:** Upplevd modernitet. Polling fungerar funktionellt men känns gammalt när meddelanden kommer.

**Effort:** 1-2 dagar.

### Slice 4 -- Röstmeddelanden

Leverantör står i stallet, diktar svar. Återanvänder `SpeechRecognizer` från S8.

**Värde:** Unik konkurrensfördel för fysiskt arbetande leverantörer.

**Effort:** 2-3 dagar.

### Slice 5 -- Förfrågningar FÖRE bokning

"Kan ni komma till Norrtälje nästa vecka?" utan befintlig bokning. Annan datamodell (ingen bokning att koppla till). Kräver inbox-struktur för okvalificerade förfrågningar.

**Effort:** 2-3 dagar + produktbeslut om triage/spam-skydd.

## Beslut (2026-04-18)

- **Slice 1 är MVP.** Johan bekräftade.
- **Realtid skjuts.** Polling räcker -- sparar 1-2 dagar och får större värdeleverans snabbare.
- **Leverantör ↔ leverantör (tidigare "Variant B")** hör INTE till denna epic. Separat epic med annan persona (community, nätverkseffekt, moderering).

## Nästa steg

1. ~~När Slice 1 är närmare i tid: skriv detaljerad story med TDD-plan, API-kontrakt, schema-ändringar~~ **Klart 2026-04-18**: Sprint 35 planerad, arkitekturbeslut dokumenterat i [messaging-domain.md](../architecture/messaging-domain.md) (S35-0), tech-architect + security-reviewer har godkänt.
2. Mät Slice 1-värdet innan Slice 2-5 prioriteras
3. Observera hur tidiga användare faktiskt kommunicerar -- kan påverka slice-ordningen

## Arkitekturbeslut

- **[messaging-domain.md](../architecture/messaging-domain.md)** (2026-04-18) — Schema, API-kontrakt, RLS-policies, rate limiting, notifier-integration för Slice 1.
