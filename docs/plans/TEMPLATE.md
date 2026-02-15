# Plan: [Feature]

## Kontext
Vad som finns idag, vad som ska byggas, varför.

## Approach
Högnivå-strategi, fasindelning.

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
