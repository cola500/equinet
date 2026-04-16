---
title: "Datalagringspolicy (GDPR)"
description: "Lagringsperioder for personuppgifter och automatisk radering av inaktiva konton"
category: security
status: active
last_updated: 2026-04-16
tags: [gdpr, security, data-retention, privacy]
sections:
  - Syfte
  - Lagringsperioder
  - Automatisk radering av inaktiva konton
  - Manuell kontoradering
  - Teknisk implementation
  - Begransningar
---

# Datalagringspolicy (GDPR)

## Syfte

Denna policy definierar hur Equinet hanterar lagring och radering av personuppgifter i enlighet med GDPR (General Data Protection Regulation), sarskilt:

- **Art. 5(1)(e)**: Lagringsminimering -- personuppgifter far inte lagras langre an nodvandigt
- **Art. 17**: Ratten att bli borttagen (ratten till radering)
- **Art. 25**: Dataskydd genom design och standard

## Lagringsperioder

| Datatyp | Lagringsperiod | Motivering |
|---------|---------------|------------|
| Aktiva konton | Sa lange kontot ar aktivt | Nodvandigt for tjansten |
| Inaktiva konton (ej inloggat 2+ ar) | 30 dagars varning + radering | Lagringsminimering (Art. 5) |
| Raderade konton | Anonymiseras omedelbart | Ratten till radering (Art. 17) |
| Bokningshistorik | Bevaras anonymiserat | Beratttigat intresse (leverantorsstatistik) |
| Recensioner | Bevaras anonymiserat (kommentar raderad) | Berattigat intresse |
| Loggar (server) | 1 ar | Sakerhet och felsokningsbehov |
| Betalningsdata | Enligt Stripe retention policy | Tredje part (Stripe) |
| Uppladdade filer | Raderas vid kontoradering | Foljer kontots livscykel |

## Automatisk radering av inaktiva konton

### Flode

1. **Identifiering**: Manatligt cron-job (`/api/cron/data-retention`) skannar Supabase Auth for konton dar `last_sign_in_at` ar aldre an 2 ar.
2. **Notifiering**: Anvandaren far ett e-postmeddelande med:
   - Information om att kontot kommer att raderas inom 30 dagar
   - Instruktion att logga in for att behalla kontot
   - Kontaktuppgifter for fragor
3. **Grace period**: 30 dagar fran notifiering.
4. **Avbrytning**: Om anvandaren loggar in under grace period raknas kontot som aktivt igen.
5. **Radering**: Efter 30 dagar utan inloggning anonymiseras kontot automatiskt.

### Undantag

- **Administratorskonton**: Raderas aldrig automatiskt (kraver manuell atgard)
- **Manuella kunder**: Skapade av leverantorer utan eget konto -- undantas fran automatisk radering

### Anonymisering (vad som hander)

Vid radering (bade manuell och automatisk) anonymiseras personuppgifter:

| Data | Atgard |
|------|--------|
| Namn | Ersatts med "Raderad anvandare" |
| E-post | Ersatts med unik hash (`deleted-UUID@deleted.equinet.se`) |
| Telefon, adress, kommun | Raderas (null) |
| GPS-koordinater | Raderas (null) |
| Profilbild | Raderas |
| Hastar | Raderas |
| Foljer/bevakar | Raderas |
| Bokningsanteckningar | Raderas |
| Recensionskommentarer | Raderas |
| Bokningsdata (tid, tjanst, pris) | Bevaras anonymiserat |
| Betyg (1-5 stjarnor) | Bevaras anonymiserat |
| Leverantorsprofil | Anonymiseras (namn, adress, inaktiveras) |

## Manuell kontoradering

Anvandare kan nar som helst begara radering av sitt konto via:
1. **Sjalvbetjaning**: Profilsidan -> "Radera mitt konto" (kraver losenordsbekraftelse + texten "RADERA")
2. **Kontakt**: support@equinet.se

Manuell radering sker omedelbart utan grace period.

## Teknisk implementation

| Komponent | Fil |
|-----------|-----|
| Cron-job | `src/app/api/cron/data-retention/route.ts` |
| Domain service | `src/domain/data-retention/DataRetentionService.ts` |
| Kontoradering | `src/domain/account/AccountDeletionService.ts` |
| Feature flag | `data_retention` (default: av) |
| E-postmall | `src/lib/email/templates/data-retention-warning.ts` |
| Cron-schema | `vercel.json` -- 1:a varje manad kl 06:00 UTC |

### Feature flag

Policyn ar gated bakom feature flag `data_retention` (default av). Flaggan maste aktiveras via admin-panelen nar policyn ar granskad och godkand.

## Begransningar

### MVP-begransningar (nuvarande implementation)

1. **Skalbarhet**: Inaktivitetsdata sparas i Supabase Auth `app_metadata` som inte ar indexerbart. Fungerar for <10 000 anvandare. Vid tillvaxt: migrera till dedikerad databastabell.
2. **Precision**: `last_sign_in_at` fran Supabase Auth ar enda inaktivitetsindikatorn. API-anrop utan inloggning (t.ex. via mobile token) raknas inte.
3. **Idempotens**: Om cron-jobbet misslyckas halvvags kan en anvandare notifieras utan att `app_metadata` uppdateras. Nasta korning skickar en till notifiering. Acceptabelt for MVP -- anvandaren far en extra paminnelse.

### Framtida forbattringar

- Dedikerad `DataRetentionNotice`-tabell for battre sparbarhet
- Webhook vid inloggning som rensar retention-notice automatiskt
- Admin-dashboard for retention-status
