---
title: "Claude Code – överlämning"
description: "Claude Codes tillfälliga överlämning i pågående sprint"
category: sprint
status: active
last_updated: 2026-10-16
tags: [agents, collaboration, handoff]
sections:
  - Gjort
  - Verifierat
  - Beslut eller frågor till Johan
  - Rekommenderat nästa steg
  - Rör inte
  - Relaterade filer och PR
---

# Claude Code – överlämning

**Senast uppdaterad:** 2026-10-16\
**Aktuell uppgift:** R3 – operativ och affärsmässig readiness (klar)\
**Branch eller worktree:** `docs/readiness-r3`\
**Status:** väntar på Codex/Johan-granskning

## Gjort

- R3-resultatet står i sprintdokumentet under "R3-resultat (2026-10-16)":
  - villkor, kvitto och support
  - säljarmodell
  - refund-process
  - krav för livebetalning
  - incidenthantering
  - marknadsjämförelse
  - R4-kandidaterna D1–D5
- Endast läsning av kod, dokument och officiella källor. Inga miljö-, Stripe- eller dataändringar.

## Verifierat

- [läst] Ingen Stripe Connect, ingen transfer och ingen plattformsavgift. Betalningen landar på Equinets konto, medan kvittot anger leverantören. Merchant of record, utbetalning och momsansvar är odefinierade. Betaltjänstfrågan är juridisk och inte avgjord.
- [läst] Ingen avbokningsgräns i koden, trots 24 h i villkoren. Leverantörer saknar egna avbokningsregler.
- [läst] Ingen refund- eller tvisthantering, varken i kod, admin eller webhook.
- [läst] Kvittot saknar moms och säljarens identitetsnummer. Betalningsunderlag till privatkund och förenklad faktura är skilda frågor: faktura krävs inte alltid, men när en förenklad faktura utfärdas eller krävs ska den enligt Skatteverket innehålla säljarens identitetsnummer och moms. Det nuvarande kvittot uppfyller inte de kraven.
- [läst] `on_behalf_of` styr "business of record" i Stripe-flödet men avgör inte ensamt juridisk säljare. Google Pay: R2 observerade ett `Permissions-Policy`-fel, men faktisk tillgänglighet är inte verifierad.
- [läst] `logger` skickar inte fel till Sentry, trots att DSN finns i prod. Incident-runbooken täcker bara prenumerationswebhooks.
- [läst] Marknadskällorna (Bokadirekt, Fresha) hämtades. Bokadirekts sidor anger inte hur utbetalning till salongen sker.

## Beslut eller frågor till Johan

- **D1 är en ny P0-fråga:** vem ska vara säljare? Behövs en juridisk bedömning av betaltjänsttillstånd innan R4 prioriteras? Först därefter jämförs direct charges och destination charges. Ingen laddningstyp är vald.

## Rekommenderat nästa steg

- Codex och Johan granskar R3. Därefter R4: samlat READY-beslut och prioritering av A, B, C1–C7 och D1–D5.

## Rör inte

- `codex.md`, produktkod, env, flaggor, Stripe, Supabase, `.vercel`.

## Relaterade filer och PR

- `docs/sprints/customer-purchase-readiness-2026-10.md` (R3-resultat)
- PR: ingen. Ocommittat på `docs/readiness-r3`.
