---
title: "Plan Template"
description: "Template for feature implementation plans with quality dimensions and verification"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Aktualitet verifierad
  - Kontext
  - Approach
  - Kvalitetsdimensioner
  - Faser
  - Verifiering
---

# Plan: [Feature]

## Aktualitet verifierad

> **OBLIGATORISK för backlog-stories och audit-stories.** Skriv N/A (nyskriven sprint-story utan bakgrundsantaganden) om ej tillämplig.

**Två kategorier att verifiera:**
- **"Redan fixat"-risk** (backlog-stories): verifiera att problemet fortfarande finns.
- **"Påstått gap"-risk** (audit-stories): verifiera att det som sägs saknas faktiskt saknas. Grep för befintlig funktionalitet INNAN implementation. Exempel: om storyn säger "haptic saknas i 6 vyer", kör `grep -r "UINotificationFeedbackGenerator" ios/` -- om det redan finns, justera scope.

**Kommandon körda:**
```bash
# Exempel -- ersätt med faktiska kommandon för storyn
grep -r "det_som_ska_fixas" src/
```

**Resultat:** [Vad hittades / inte hittades]

**Beslut:** [Fortsätt med implementation / Redan löst i commit <hash> -- stäng storyn / Justera scope till det som faktiskt saknas]

---

## Kontext
Vad som finns idag, vad som ska byggas, varför.

## Approach
Högnivå-strategi, fasindelning.

## Arkitekturcoverage (OBLIGATORISK om story implementerar tidigare design)

Om denna story bygger på ett arkitekturdokument (t.ex. `docs/architecture/<domain>.md`) från en tidigare designstory, lista varje numrerat beslut och markera status:

| Beslut | Beskrivning | Implementeras i denna story? | Var (fil/rad)? |
|--------|-------------|------------------------------|----------------|
| D1 | ... | Ja / Nej (uppskjuten till S<X>) | ... |

**Alla "Ja"-beslut MÅSTE ha en implementation i denna story.** "Nej"-beslut kräver explicit beslut och backlog-rad för uppföljning.

**Om ingen tidigare designstory finns:** Skriv "N/A -- ingen tidigare arkitekturdesign".

## Kvalitetsdimensioner

### API-routes (om tillämpligt)
- Vilka endpoints? HTTP-metoder?
- Auth: session-check, ägarskapvalidering
- Rate limiting: vilken limiter? (api, booking, etc.)
- Validering: Zod-schema med .strict()
- Felmeddelanden: svenska

### Datamodell (om tillämpligt)
- Prisma-schemaändringar
- Kärndomän? -> repository obligatoriskt
- Nya fält på befintlig modell? -> lista select-block att uppdatera
- Migration: default-värden för befintliga rader?

### UI (om tillämpligt)
- Vilka sidor/komponenter?
- Mobil-först: responsive-mönster
- Svenska strängar: lista alla user-facing texter
- Återanvändning: vilka befintliga komponenter?

## Faser

### Fas 1: ...
### Fas 2: ...

## Verifiering
Hur testar vi att allt fungerar?
